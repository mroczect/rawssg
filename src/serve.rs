use anyhow::Result;
use notify::{Event, EventKind, RecursiveMode, Watcher};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc;
use std::thread;
use tiny_http::{Header, Response, Server};

pub fn start_server(output_dir: &str, port: u16) -> Result<()> {
    // Channel: watcher -> rebuild thread
    let (tx, rx) = mpsc::channel();

    // Watcher thread
    let tx_watcher = tx.clone();
    let watch_dirs = vec!["content", "templates", "config.yaml"];
    thread::spawn(move || {
        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                if matches!(
                    event.kind,
                    EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)
                ) {
                    tx_watcher.send(()).ok();
                }
            }
        })
        .unwrap();
        for dir in &watch_dirs {
            let path = Path::new(dir);
            if path.is_dir() {
                watcher.watch(path, RecursiveMode::Recursive).ok();
            } else if path.is_file() {
                watcher.watch(path, RecursiveMode::NonRecursive).ok();
            }
        }
        loop {
            thread::park();
        }
    });

    // Reload counter: bertambah setiap rebuild selesai
    let reload_counter = Arc::new(AtomicU32::new(0));
    let counter_for_rebuild = reload_counter.clone();

    // Rebuild thread – otomatis rebuild lalu naikkan counter
    thread::spawn(move || {
        loop {
            rx.recv().ok(); // tunggu perubahan
            println!("📝 Perubahan terdeteksi, rebuild...");
            if let Err(e) = crate::compiler::compile_site("content", "dist") {
                eprintln!("Rebuild error: {}", e);
            } else {
                counter_for_rebuild.fetch_add(1, Ordering::SeqCst);
                println!("✅ Rebuild selesai.");
            }
        }
    });

    // HTTP server
    let server = Server::http(format!("0.0.0.0:{}", port)).unwrap();
    println!("🚀 Server berjalan di http://localhost:{}", port);

    let dist_path = PathBuf::from(output_dir);

    for request in server.incoming_requests() {
        let url = request.url().to_string();
        let file_path = if url == "/" {
            dist_path.join("index.html")
        } else {
            dist_path.join(&url[1..])
        };

        // Long polling untuk live reload
        if url == "/__rawssg_reload" {
            let current = reload_counter.load(Ordering::SeqCst);
            let start = std::time::Instant::now();
            let timeout = std::time::Duration::from_secs(25);
            while start.elapsed() < timeout {
                if reload_counter.load(Ordering::SeqCst) != current {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(200));
            }
            let response = Response::from_string("reload");
            request.respond(response).ok();
            continue;
        }

        // Melayani file statis
        if file_path.is_file() {
            let content = fs::read(&file_path).unwrap_or_else(|_| b"File not found".to_vec());
            let mut response = Response::from_data(content);
            if file_path.extension().map_or(false, |ext| ext == "html") {
                response = response.with_header(
                    "Content-Type: text/html; charset=utf-8"
                        .parse::<Header>()
                        .unwrap(),
                );
            } else if file_path.extension().map_or(false, |ext| ext == "css") {
                response =
                    response.with_header("Content-Type: text/css".parse::<Header>().unwrap());
            } else if file_path.extension().map_or(false, |ext| ext == "js") {
                response = response.with_header(
                    "Content-Type: application/javascript"
                        .parse::<Header>()
                        .unwrap(),
                );
            }
            request.respond(response).ok();
        } else {
            let response = Response::from_string("404 Not Found").with_status_code(404);
            request.respond(response).ok();
        }
    }

    Ok(())
}
