use anyhow::{Result, anyhow};
use notify::{Event, EventKind, RecursiveMode, Watcher};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use tiny_http::{Header, Response, Server};

pub fn start_server(output_dir: &str, port: u16) -> Result<()> {
    let (tx, rx) = mpsc::channel::<()>();
    let watcher_tx = tx.clone();
    let _watcher_handle = thread::spawn(move || {
        let mut watcher =
            match notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    if matches!(
                        event.kind,
                        EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)
                    ) {
                        watcher_tx.send(()).ok();
                    }
                }
            }) {
                Ok(w) => w,
                Err(e) => {
                    eprintln!("Failed to create file watcher: {}", e);
                    return;
                }
            };

        let watch_dirs = ["content", "templates", "config.yaml"];
        for dir in &watch_dirs {
            let path = Path::new(dir);
            if path.is_dir() {
                if let Err(e) = watcher.watch(path, RecursiveMode::Recursive) {
                    eprintln!("Watch error on {}: {}", dir, e);
                }
            } else if path.is_file() {
                if let Err(e) = watcher.watch(path, RecursiveMode::NonRecursive) {
                    eprintln!("Watch error on {}: {}", dir, e);
                }
            }
        }

        loop {
            thread::park();
        }
    });

    let reload_counter = Arc::new(AtomicU32::new(0));
    let counter_for_rebuild = reload_counter.clone();
    thread::spawn(move || {
        loop {
            match rx.recv() {
                Ok(()) => {
                    println!("Change detected, rebuilding...");
                    if let Err(e) = crate::compiler::compile_site("content", "dist") {
                        eprintln!("Rebuild error: {}", e);
                    } else {
                        counter_for_rebuild.fetch_add(1, Ordering::SeqCst);
                        println!("Rebuild complete.");
                    }
                }
                Err(_) => break,
            }
        }
    });

    let server = Server::http(format!("0.0.0.0:{}", port))
        .map_err(|e| anyhow!("Failed to bind to port {}: {}", port, e))?;
    println!("Server running at http://localhost:{}", port);

    let dist_path = PathBuf::from(output_dir)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(output_dir));

    for request in server.incoming_requests() {
        let dist = dist_path.clone();
        let counter = reload_counter.clone();
        thread::spawn(move || {
            if let Err(e) = handle_request(request, &dist, &counter) {
                eprintln!("Error handling request: {}", e);
            }
        });
    }

    Ok(())
}

fn handle_request(
    request: tiny_http::Request,
    dist_path: &Path,
    reload_counter: &AtomicU32,
) -> Result<()> {
    let url = request.url().to_string();

    if url == "/__rawssg_reload" {
        let current = reload_counter.load(Ordering::SeqCst);
        let start = std::time::Instant::now();
        let timeout = Duration::from_secs(25);
        while start.elapsed() < timeout {
            if reload_counter.load(Ordering::SeqCst) != current {
                break;
            }
            thread::sleep(Duration::from_millis(200));
        }
        let response = Response::from_string("reload");
        request.respond(response)?;
        return Ok(());
    }

    let requested_path = if url == "/" {
        "index.html".to_string()
    } else {
        url.trim_start_matches('/').to_string()
    };

    let file_path = dist_path.join(&requested_path);
    let canonical_file = match file_path.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            let response = Response::from_string("404 Not Found").with_status_code(404);
            request.respond(response)?;
            return Ok(());
        }
    };

    if !canonical_file.starts_with(dist_path) {
        let response = Response::from_string("403 Forbidden").with_status_code(403);
        request.respond(response)?;
        return Ok(());
    }

    match fs::read(&canonical_file) {
        Ok(content) => {
            let mime = mime_type(&canonical_file);
            let header =
                Header::from_bytes("Content-Type", mime.as_str()).expect("Invalid MIME header");
            let response = Response::from_data(content).with_header(header);
            request.respond(response)?;
        }
        Err(_) => {
            let response = Response::from_string("500 Internal Server Error").with_status_code(500);
            request.respond(response)?;
        }
    }

    Ok(())
}

fn mime_type(path: &Path) -> String {
    match path.extension().and_then(|e| e.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("css") => "text/css",
        Some("js") => "application/javascript",
        Some("json") => "application/json",
        Some("xml") => "application/xml",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("ico") => "image/x-icon",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("ttf") => "font/ttf",
        _ => "application/octet-stream",
    }
    .to_string()
}
