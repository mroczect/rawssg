```
.  # .
├── Cargo.lock
├── Cargo.toml
├── build.rs
├── snapcat.md
├── src
│   ├── compiler.rs
│   ├── config.rs
│   ├── embedded.rs
│   ├── error.rs
│   ├── init.rs
│   ├── main.rs
│   ├── serve.rs
│   ├── types.rs
├── templates
│   ├── blog
│   │   ├── config.yaml
│   │   ├── first-post.md
│   ├── homepage
│   │   ├── config.yml
│   │   ├── first-post.md
│   │   ├── index.md
│   ├── index.html
│   ├── script.js
│   ├── styles.css
```
## ./src/main.rs

```rust
mod compiler;
mod embedded;
mod types;
mod config;
mod init;
mod serve;

use clap::{Parser, Subcommand};
use anyhow::Result;

// Tambahkan ini
fn print_manual() {
    println!("rawssg - Static Site Generator dengan vibe terminal\n");
    println!("USAGE:");
    println!("    rawssg <COMMAND>\n");
    println!("COMMANDS:");
    println!("    help                  Tampilkan panduan ini");
    println!("    version               Tampilkan versi");
    println!("    info                  Metadata build");
    println!("    init <TEMPLATE>       Buat proyek baru (homepage/blog)");
    println!("    config <ACTION>       Manajemen konfigurasi (check/init/show)");
    println!("    compile [SRC] [DST]   Build situs (default: content/ -> dist/)");
    println!("    serve [PORT]          Jalankan server lokal (default: 3000)");
}

fn print_build_info() {
    println!("rawssg v{}", env!("CARGO_PKG_VERSION"));
    println!("Build date: {}", env!("BUILD_DATE"));  // perlu build.rs, sementara kosong
    println!("Profile: {}", env!("PROFILE"));
    println!("Target: {}", env!("TARGET"));
}

// ... (derive Cli dan Commands tetap) ...

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Help => {
            print_manual();
        }
        Commands::Version => {
            println!("rawssg v{}", env!("CARGO_PKG_VERSION"));
        }
        Commands::Info => {
            print_build_info();
        }
        Commands::Init { template } => {
            match template {
                InitTemplate::Homepage => init::create_homepage_project()?,
                InitTemplate::Blog => init::create_blog_project()?,
            }
        }
        Commands::Config { action } => {
            match action {
                ConfigAction::Check => config::validate_all()?,
                ConfigAction::Init => config::create_default_config()?,
                ConfigAction::Show => config::show_current_config()?,
            }
        }
        Commands::Compile { content_dir, output_dir } => {
            let content = content_dir.as_deref().unwrap_or("content");
            let output = output_dir.as_deref().unwrap_or("dist");
            compiler::compile_site(content, output)?;   // <-- panggil dari compiler
        }
        Commands::Serve { port } => {
            let port = port.unwrap_or(3000);
            let output_dir = "dist";   // default folder output yang diserve
            // Pastikan sudah ada hasil build, atau lakukan build dulu
            if !std::path::Path::new(output_dir).exists() {
                compiler::compile_site("content", output_dir)?;
            }
            serve::start_server(output_dir, port)?;
        }
    }

    Ok(())
}
```
## ./src/error.rs

```rust

```
## ./src/compiler.rs

```rust
use anyhow::{Context, Result};
use pulldown_cmark::{html, Options, Parser};
use crate::embedded::INDEX_TEMPLATE;
use crate::types::{GlobalConfig, PageFrontMatter, NavItem};
use std::path::Path;
use std::fs;
use crate::embedded;
use walkdir::WalkDir;
use crate::config;

fn gen_navbar(items: &[NavItem]) -> String {
    if items.is_empty() { return String::new(); }
    let mut html = String::from("<nav class=\"top-nav\"><ul>");
    for item in items {
        html.push_str(&format!(
            "<li><a href=\"{}\">{}</a></li>",
            item.url, item.label
        ));
    }
    html.push_str("</ul></nav>");
    html
}

/// Generate HTML untuk sidebar
fn gen_sidebar(items: &[NavItem]) -> String {
    if items.is_empty() { return String::new(); }
    let mut html = String::from(
        "<aside class=\"sidebar\" id=\"sidebar\">\
         <button id=\"sidebar-toggle\">☰</button><ul>"
    );
    for item in items {
        html.push_str(&format!(
            "<li><a href=\"{}\">{}</a></li>",
            item.url, item.label
        ));
    }
    html.push_str("</ul></aside>");
    html
}

/// Parse Markdown + frontmatter (manual, tapi aman)
pub fn parse_markdown(raw: &str) -> Result<(PageFrontMatter, String)> {
    let trimmed = raw.trim_start();
    if !trimmed.starts_with("---") {
        anyhow::bail!("Frontmatter tidak ditemukan (harus diawali '---')");
    }

    // Cari akhir blok YAML (harus ada '---' lagi)
    let without_first = trimmed.trim_start_matches("---").trim_start();
    let end = without_first.find("\n---")
        .or_else(|| without_first.find("\r\n---"))
        .unwrap_or(without_first.len());

    let yaml_str = &without_first[..end];
    let markdown_str = without_first[end..]
        .trim_start_matches("\n---")
        .trim_start_matches("\r\n---")
        .trim();

    let fm: PageFrontMatter = serde_yaml::from_str(yaml_str)
        .context("Gagal parsing frontmatter YAML")?;

    let md_html = markdown_to_html(markdown_str);
    Ok((fm, md_html))
}

fn markdown_to_html(md: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    let parser = Parser::new_ext(md, options);
    let mut html_out = String::new();
    html::push_html(&mut html_out, parser);
    html_out
}

pub fn build_html(
    config: &GlobalConfig,
    fm: &PageFrontMatter,
    content_html: &str,
) -> String {
    let navbar_html = gen_navbar(&config.navbar);
    let sidebar_html = gen_sidebar(&config.sidebar);

    INDEX_TEMPLATE
        .replace("{{ title }}", &fm.title)
        .replace("{{ desc }}", &fm.desc)
        .replace("{{ author }}", &fm.author)
        .replace("{{ repo_url }}", &fm.repo_url)
        .replace("{{ license }}", &fm.license)
        .replace("{{ footer }}", &fm.footer)
        .replace("{{ content }}", content_html)
        .replace("{{ navbar }}", &navbar_html)
        .replace("{{ sidebar }}", &sidebar_html)
}

pub fn compile_site(content_dir: &str, output_dir: &str) -> Result<()> {
    // Load global config
    let global_config = config::load_config("config.yaml")?;

    fs::create_dir_all(&output_dir)?;
    let css_dest = Path::new(&output_dir).join("styles.css");
    fs::write(&css_dest, embedded::STYLES_CSS)?;
    let js_dest = Path::new(&output_dir).join("script.js");
    fs::write(&js_dest, embedded::SCRIPT_JS)?;

    // Proses semua file .md di content_dir secara rekursif
    for entry in WalkDir::new(content_dir) {
        let entry = entry?;
        let path = entry.path();
        if path.extension().unwrap_or_default() != "md" {
            continue;
        }

        let raw = fs::read_to_string(&path)
            .with_context(|| format!("Gagal membaca {}", path.display()))?;
        let (fm, content_html) = parse_markdown(&raw)?;
        let html = build_html(&global_config, &fm, &content_html);

        // Tentukan path output
        let rel_path = path.strip_prefix(content_dir)?;
        let out_name = rel_path.with_extension("html");
        let out_path = Path::new(&output_dir).join(out_name);
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&out_path, html)?;
        println!("✅ Generated: {}", out_path.display());
    }

    println!("\n🎉 Situs selesai di-generate di folder '{}'", output_dir);
    Ok(())
}
```
## ./src/types.rs

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]   // <-- tambahkan Serialize
pub struct NavItem {
    pub label: String,
    pub url: String,
}

#[derive(Debug, Deserialize, Serialize)]           // <-- tambahkan Serialize
pub struct GlobalConfig {
    pub navbar: Vec<NavItem>,
    pub sidebar: Vec<NavItem>,
}

#[derive(Debug, Deserialize)]
pub struct PageFrontMatter {
    pub title: String,
    pub desc: String,
    pub author: String,
    pub repo_url: String,
    pub license: String,
    pub footer: String,
}
```
## ./src/embedded.rs

```rust
pub const INDEX_TEMPLATE: &str = include_str!("../templates/index.html");
pub const STYLES_CSS: &str = include_str!("../templates/styles.css");
pub const SCRIPT_JS: &str = include_str!("../templates/script.js");
```
## ./src/config.rs

```rust
use anyhow::{Context, Result};
use std::fs;
use crate::types::GlobalConfig;
use crate::compiler;                      // <-- tambahkan ini
use walkdir::WalkDir;                     // <-- ganti glob

pub fn load_config(path: &str) -> Result<GlobalConfig> {
    let yaml = fs::read_to_string(path)
        .with_context(|| format!("Gagal membaca config file '{}'", path))?;
    let config: GlobalConfig = serde_yaml::from_str(&yaml)
        .context("Gagal parsing config.yaml")?;
    Ok(config)
}

pub fn validate_all() -> Result<()> {
    // 1. Baca config.yaml
    let config = load_config("config.yaml")?; // config tidak digunakan tapi bisa diperiksa nanti
    // 2. Scan folder content/ secara rekursif
    for entry in WalkDir::new("content") {
        let entry = entry?;
        let path = entry.path();
        if path.extension().unwrap_or_default() == "md" {
            let raw = fs::read_to_string(path)?;
            if let Err(e) = compiler::parse_markdown(&raw) {
                eprintln!("❌ Error di {}: {}", path.display(), e);
            } else {
                println!("✅ {} valid", path.display());
            }
        }
    }
    Ok(())
}

pub fn create_default_config() -> Result<()> {
    let default_config = r#"
navbar: []
sidebar: []
"#;
    fs::write("config.yaml", default_config)?;
    println!("✅ config.yaml berhasil dibuat.");
    Ok(())
}

pub fn show_current_config() -> Result<()> {
    let config = load_config("config.yaml")?;
    println!("{}", serde_yaml::to_string(&config)?);
    Ok(())
}
```
## ./src/init.rs

```rust
use anyhow::Result;
use std::fs;

pub fn create_homepage_project() -> Result<()> {
    let dirs = ["content/blog", "templates"];
    for d in &dirs {
        fs::create_dir_all(d)?;
    }

    // Buat config.yaml
    let config_yaml = include_str!("../templates/homepage/config.yml");
    fs::write("config.yaml", config_yaml)?;

    // Buat halaman depan (index.md)
    let index_md = include_str!("../templates/homepage//index.md");
    fs::write("content/index.md", index_md)?;

    // Buat contoh post blog
    let sample_post = include_str!("../templates/homepage/first-post.md");
    fs::write("content/blog/first-post.md", sample_post)?;

    println!("✅ Proyek homepage berhasil dibuat. Silakan edit konten di folder 'content/'.");
    Ok(())
}

pub fn create_blog_project() -> Result<()> {
    fs::create_dir_all("content")?;

    let config_yaml = include_str!("../templates/blog/config.yaml");
    fs::write("config.yaml", config_yaml)?;

    let sample_post = include_str!("../templates/blog/first-post.md");
    fs::write("content/first-post.md", sample_post)?;

    println!("✅ Proyek blog berhasil dibuat.");
    Ok(())
}
```
## ./src/serve.rs

```rust
use anyhow::Result;
use std::sync::mpsc;
use std::thread;
use std::path::{Path, PathBuf};
use std::fs;
use tiny_http::{Server, Response, Header};
use notify::{Watcher, RecursiveMode, Event, EventKind};

pub fn start_server(output_dir: &str, port: u16) -> Result<()> {
    let (tx, rx) = mpsc::channel();
    let tx_watcher = tx.clone();

    // Watcher thread
    let watch_dirs = vec!["content", "templates", "config.yaml"];
    thread::spawn(move || {
        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)) {
                    tx_watcher.send(()).ok();
                }
            }
        }).unwrap();
        for dir in &watch_dirs {
            let path = Path::new(dir);
            if path.is_dir() {
                watcher.watch(path, RecursiveMode::Recursive).ok();
            } else if path.is_file() {
                watcher.watch(path, RecursiveMode::NonRecursive).ok();
            }
        }
        loop { thread::park(); }
    });

    // Rebuild signal handler
    let rebuild_tx = tx.clone();
    thread::spawn(move || {
        loop {
            rx.recv().ok();
            println!("📝 Perubahan terdeteksi, rebuild...");
            if let Err(e) = super::compiler::compile_site("content", "dist") {
                eprintln!("Rebuild error: {}", e);
            } else {
                rebuild_tx.send(()).ok(); // kasih tahu server timestamp baru
            }
        }
    });

    // Simple static file server + long polling endpoint
    let server = Server::http(format!("0.0.0.0:{}", port)).unwrap();
    println!("🚀 Server berjalan di http://localhost:{}", port);

    let dist_path = PathBuf::from(output_dir);
    let reload_counter = std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0));
    let reload_counter_clone = reload_counter.clone();

    // Thread untuk mengupdate counter saat rebuild selesai
    thread::spawn(move || {
        loop {
            rx.recv().ok(); // terima sinyal rebuild selesai
            reload_counter_clone.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        }
    });

    for request in server.incoming_requests() {
        let url = request.url().to_string();
        let path = if url == "/" {
            dist_path.join("index.html")
        } else {
            dist_path.join(&url[1..]) // hilangkan leading '/'
        };

        // Long polling untuk auto-reload
        if url == "/__rawssg_reload" {
            let counter = reload_counter.load(std::sync::atomic::Ordering::SeqCst);
            let start = std::time::Instant::now();
            let timeout = std::time::Duration::from_secs(25);
            // Tunggu sampai counter berubah atau timeout
            while start.elapsed() < timeout {
                if reload_counter.load(std::sync::atomic::Ordering::SeqCst) != counter {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(200));
            }
            let response = Response::from_string("reload");
            request.respond(response).ok();
            continue;
        }

        // Serve file statis
        if path.is_file() {
            let content = fs::read(&path).unwrap_or_else(|_| b"File not found".to_vec());
            let mut response = Response::from_data(content);
            // Tentukan MIME type sederhana
            if path.extension().map_or(false, |ext| ext == "html") {
                response = response.with_header("Content-Type: text/html; charset=utf-8".parse::<Header>().unwrap());
            } else if path.extension().map_or(false, |ext| ext == "css") {
                response = response.with_header("Content-Type: text/css".parse().unwrap());
            } else if path.extension().map_or(false, |ext| ext == "js") {
                response = response.with_header("Content-Type: application/javascript".parse().unwrap());
            }
            request.respond(response).ok();
        } else {
            let response = Response::from_string("404 Not Found").with_status_code(404);
            request.respond(response).ok();
        }
    }

    Ok(())
}
```
## ./Cargo.lock

```
# This file is automatically @generated by Cargo.
# It is not intended for manual editing.
version = 4

[[package]]
name = "android_system_properties"
version = "0.1.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "819e7219dbd41043ac279b19830f2efc897156490d7fd6ea916720117ee66311"
dependencies = [
 "libc",
]

[[package]]
name = "anstream"
version = "1.0.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "824a212faf96e9acacdbd09febd34438f8f711fb84e09a8916013cd7815ca28d"
dependencies = [
 "anstyle",
 "anstyle-parse",
 "anstyle-query",
 "anstyle-wincon",
 "colorchoice",
 "is_terminal_polyfill",
 "utf8parse",
]

[[package]]
name = "anstyle"
version = "1.0.14"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "940b3a0ca603d1eade50a4846a2afffd5ef57a9feac2c0e2ec2e14f9ead76000"

[[package]]
name = "anstyle-parse"
version = "1.0.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "52ce7f38b242319f7cabaa6813055467063ecdc9d355bbb4ce0c68908cd8130e"
dependencies = [
 "utf8parse",
]

[[package]]
name = "anstyle-query"
version = "1.1.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "40c48f72fd53cd289104fc64099abca73db4166ad86ea0b4341abe65af83dadc"
dependencies = [
 "windows-sys 0.61.2",
]

[[package]]
name = "anstyle-wincon"
version = "3.0.11"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "291e6a250ff86cd4a820112fb8898808a366d8f9f58ce16d1f538353ad55747d"
dependencies = [
 "anstyle",
 "once_cell_polyfill",
 "windows-sys 0.61.2",
]

[[package]]
name = "anyhow"
version = "1.0.103"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "2a4385e2e34eb35d6b3efe798b9eb88096925d87726c0798709bf56d9ed84af3"

[[package]]
name = "ascii"
version = "1.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d92bec98840b8f03a5ff5413de5293bfcd8bf96467cf5452609f939ec6f5de16"

[[package]]
name = "autocfg"
version = "1.5.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f2032f911046de80f0a198e0901378627c33f59ea0ac00e363d481118bd70a53"

[[package]]
name = "bitflags"
version = "2.13.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b4388bee8683e3d04af747c73422af53102d2bd24d9eadb6cbc100baef4b43f8"

[[package]]
name = "built"
version = "0.8.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5c0e531d93d39c34eef561e929e8a7f86d77a5af08aac4f6d6e39976c51858e9"
dependencies = [
 "chrono",
]

[[package]]
name = "bumpalo"
version = "3.20.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "72f5acc6cb2ba439de613abc23857ec3d78374d8ed5ac84e9d11336e87da8649"

[[package]]
name = "cc"
version = "1.2.66"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f5d6cac793997bd970000024b2934968efe83b382de4fdcf4fcb46b6ee4ad996"
dependencies = [
 "find-msvc-tools",
 "shlex",
]

[[package]]
name = "cfg-if"
version = "1.0.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9330f8b2ff13f34540b44e946ef35111825727b38d33286ef986142615121801"

[[package]]
name = "chrono"
version = "0.4.45"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1aa79e62e7697b8e29b513a68abacf485adcd1fe8284a4316c5ae868e6633327"
dependencies = [
 "iana-time-zone",
 "js-sys",
 "num-traits",
 "wasm-bindgen",
 "windows-link",
]

[[package]]
name = "chunked_transfer"
version = "1.5.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6e4de3bc4ea267985becf712dc6d9eed8b04c953b3fcfb339ebc87acd9804901"

[[package]]
name = "clap"
version = "4.6.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1ddb117e43bbf7dacf0a4190fef4d345b9bad68dfc649cb349e7d17d28428e51"
dependencies = [
 "clap_builder",
 "clap_derive",
]

[[package]]
name = "clap_builder"
version = "4.6.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "714a53001bf66416adb0e2ef5ac857140e7dc3a0c48fb28b2f10762fc4b5069f"
dependencies = [
 "anstream",
 "anstyle",
 "clap_lex",
 "strsim",
]

[[package]]
name = "clap_derive"
version = "4.6.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f2ce8604710f6733aa641a2b3731eaa1e8b3d9973d5e3565da11800813f997a9"
dependencies = [
 "heck",
 "proc-macro2",
 "quote",
 "syn",
]

[[package]]
name = "clap_lex"
version = "1.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c8d4a3bb8b1e0c1050499d1815f5ab16d04f0959b233085fb31653fbfc9d98f9"

[[package]]
name = "colorchoice"
version = "1.0.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1d07550c9036bf2ae0c684c4297d503f838287c83c53686d05370d0e139ae570"

[[package]]
name = "core-foundation-sys"
version = "0.8.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "773648b94d0e5d620f64f280777445740e61fe701025087ec8b57f45c791888b"

[[package]]
name = "equivalent"
version = "1.0.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "877a4ace8713b0bcf2a4e7eec82529c029f1d0619886d18145fea96c3ffe5c0f"

[[package]]
name = "find-msvc-tools"
version = "0.1.9"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5baebc0774151f905a1a2cc41989300b1e6fbb29aff0ceffa1064fdd3088d582"

[[package]]
name = "fsevent-sys"
version = "4.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "76ee7a02da4d231650c7cea31349b889be2f45ddb3ef3032d2ec8185f6313fd2"
dependencies = [
 "libc",
]

[[package]]
name = "futures-core"
version = "0.3.32"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7e3450815272ef58cec6d564423f6e755e25379b217b0bc688e295ba24df6b1d"

[[package]]
name = "futures-task"
version = "0.3.32"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "037711b3d59c33004d3856fbdc83b99d4ff37a24768fa1be9ce3538a1cde4393"

[[package]]
name = "futures-util"
version = "0.3.32"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "389ca41296e6190b48053de0321d02a77f32f8a5d2461dd38762c0593805c6d6"
dependencies = [
 "futures-core",
 "futures-task",
 "pin-project-lite",
 "slab",
]

[[package]]
name = "getopts"
version = "0.2.24"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "cfe4fbac503b8d1f88e6676011885f34b7174f46e59956bba534ba83abded4df"
dependencies = [
 "unicode-width",
]

[[package]]
name = "hashbrown"
version = "0.17.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ed5909b6e89a2db4456e54cd5f673791d7eca6732202bbf2a9cc504fe2f9b84a"

[[package]]
name = "heck"
version = "0.5.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "2304e00983f87ffb38b55b444b5e3b60a884b5d30c0fca7d82fe33449bbe55ea"

[[package]]
name = "httpdate"
version = "1.0.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "df3b46402a9d5adb4c86a0cf463f42e19994e3ee891101b1841f30a545cb49a9"

[[package]]
name = "iana-time-zone"
version = "0.1.65"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e31bc9ad994ba00e440a8aa5c9ef0ec67d5cb5e5cb0cc7f8b744a35b389cc470"
dependencies = [
 "android_system_properties",
 "core-foundation-sys",
 "iana-time-zone-haiku",
 "js-sys",
 "log",
 "wasm-bindgen",
 "windows-core",
]

[[package]]
name = "iana-time-zone-haiku"
version = "0.1.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f31827a206f56af32e590ba56d5d2d085f558508192593743f16b2306495269f"
dependencies = [
 "cc",
]

[[package]]
name = "indexmap"
version = "2.14.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d466e9454f08e4a911e14806c24e16fba1b4c121d1ea474396f396069cf949d9"
dependencies = [
 "equivalent",
 "hashbrown",
]

[[package]]
name = "inotify"
version = "0.11.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "153be1941a183ec9ccd095ddbe17a8b8d435ef6c76e9e02451b933c3999af2c8"
dependencies = [
 "bitflags",
 "inotify-sys",
 "libc",
]

[[package]]
name = "inotify-sys"
version = "0.1.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c033f80b2c113cdf91ab7a33faa9cbc014726dcad99880c8609af2a370edf37d"
dependencies = [
 "libc",
]

[[package]]
name = "is_terminal_polyfill"
version = "1.70.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a6cb138bb79a146c1bd460005623e142ef0181e3d0219cb493e02f7d08a35695"

[[package]]
name = "itoa"
version = "1.0.18"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8f42a60cbdf9a97f5d2305f08a87dc4e09308d1276d28c869c684d7777685682"

[[package]]
name = "js-sys"
version = "0.3.103"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "53b44bfcdb3f8d5837a46dae1ca9660a837176eee74a28b229bc626816589102"
dependencies = [
 "cfg-if",
 "futures-util",
 "wasm-bindgen",
]

[[package]]
name = "kqueue"
version = "1.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "273c0752728918e0ac4976f2b275b6fefb9ecd400585dec929419f3844cd87b5"
dependencies = [
 "kqueue-sys",
 "libc",
]

[[package]]
name = "kqueue-sys"
version = "1.1.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "07293a4e297ac234359b510362495713f75ea345d5307140414f20c69ffeb087"
dependencies = [
 "bitflags",
 "libc",
]

[[package]]
name = "libc"
version = "0.2.186"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "68ab91017fe16c622486840e4c83c9a37afeff978bd239b5293d61ece587de66"

[[package]]
name = "log"
version = "0.4.33"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0ceec5bc11778974d1bcb055b18002eba7f4b3518b6a0081b3af5f21666da9ad"

[[package]]
name = "memchr"
version = "2.8.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "cf8baf1c55e62ffcace7a9f06f4bd9cd3f0c4beb022d3b367256b91b87513d98"

[[package]]
name = "mio"
version = "1.2.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "02bd0af71c67b473010cbbc60715ee815645a4dc942899111f494b4b737d6fda"
dependencies = [
 "libc",
 "log",
 "wasi",
 "windows-sys 0.61.2",
]

[[package]]
name = "notify"
version = "8.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4d3d07927151ff8575b7087f245456e549fea62edf0ec4e565a5ee50c8402bc3"
dependencies = [
 "bitflags",
 "fsevent-sys",
 "inotify",
 "kqueue",
 "libc",
 "log",
 "mio",
 "notify-types",
 "walkdir",
 "windows-sys 0.60.2",
]

[[package]]
name = "notify-types"
version = "2.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "42b8cfee0e339a0337359f3c88165702ac6e600dc01c0cc9579a92d62b08477a"
dependencies = [
 "bitflags",
]

[[package]]
name = "num-traits"
version = "0.2.19"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "071dfc062690e90b734c0b2273ce72ad0ffa95f0c74596bc250dcfd960262841"
dependencies = [
 "autocfg",
]

[[package]]
name = "once_cell"
version = "1.21.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9f7c3e4beb33f85d45ae3e3a1792185706c8e16d043238c593331cc7cd313b50"

[[package]]
name = "once_cell_polyfill"
version = "1.70.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "384b8ab6d37215f3c5301a95a4accb5d64aa607f1fcb26a11b5303878451b4fe"

[[package]]
name = "pin-project-lite"
version = "0.2.17"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a89322df9ebe1c1578d689c92318e070967d1042b512afbe49518723f4e6d5cd"

[[package]]
name = "proc-macro2"
version = "1.0.106"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8fd00f0bb2e90d81d1044c2b32617f68fcb9fa3bb7640c23e9c748e53fb30934"
dependencies = [
 "unicode-ident",
]

[[package]]
name = "pulldown-cmark"
version = "0.13.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e9f068eba8e7071c5f9511831b44f32c740d5adf574e990f946ddb53db2f314e"
dependencies = [
 "bitflags",
 "getopts",
 "memchr",
 "pulldown-cmark-escape",
 "unicase",
]

[[package]]
name = "pulldown-cmark-escape"
version = "0.11.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "007d8adb5ddab6f8e3f491ac63566a7d5002cc7ed73901f72057943fa71ae1ae"

[[package]]
name = "quote"
version = "1.0.46"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "dfbc457d0c7a0759a614551b11a6409e5951f6c7537be1f1b7682b9ae9230368"
dependencies = [
 "proc-macro2",
]

[[package]]
name = "rawssg"
version = "0.1.0"
dependencies = [
 "anyhow",
 "built",
 "chrono",
 "clap",
 "notify",
 "pulldown-cmark",
 "serde",
 "serde_yaml",
 "thiserror",
 "tiny_http",
 "walkdir",
]

[[package]]
name = "rustversion"
version = "1.0.23"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "cf54715a573b99ac80df0bc206da022bcd442c974952c7b9720069370852e21f"

[[package]]
name = "ryu"
version = "1.0.23"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9774ba4a74de5f7b1c1451ed6cd5285a32eddb5cccb8cc655a4e50009e06477f"

[[package]]
name = "same-file"
version = "1.0.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "93fc1dc3aaa9bfed95e02e6eadabb4baf7e3078b0bd1b4d7b6b0b68378900502"
dependencies = [
 "winapi-util",
]

[[package]]
name = "serde"
version = "1.0.228"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9a8e94ea7f378bd32cbbd37198a4a91436180c5bb472411e48b5ec2e2124ae9e"
dependencies = [
 "serde_core",
 "serde_derive",
]

[[package]]
name = "serde_core"
version = "1.0.228"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "41d385c7d4ca58e59fc732af25c3983b67ac852c1a25000afe1175de458b67ad"
dependencies = [
 "serde_derive",
]

[[package]]
name = "serde_derive"
version = "1.0.228"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d540f220d3187173da220f885ab66608367b6574e925011a9353e4badda91d79"
dependencies = [
 "proc-macro2",
 "quote",
 "syn",
]

[[package]]
name = "serde_yaml"
version = "0.9.34+deprecated"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6a8b1a1a2ebf674015cc02edccce75287f1a0130d394307b36743c2f5d504b47"
dependencies = [
 "indexmap",
 "itoa",
 "ryu",
 "serde",
 "unsafe-libyaml",
]

[[package]]
name = "shlex"
version = "2.0.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f8fadd59c855ef2080decdef8ff161eb6661b86933c9d82e5ba29dc602a55aba"

[[package]]
name = "slab"
version = "0.4.12"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0c790de23124f9ab44544d7ac05d60440adc586479ce501c1d6d7da3cd8c9cf5"

[[package]]
name = "strsim"
version = "0.11.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7da8b5736845d9f2fcb837ea5d9e2628564b3b043a70948a3f0b778838c5fb4f"

[[package]]
name = "syn"
version = "2.0.118"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1b9ae57f904213ebb649ce6895b8a66c66f0203b9319718f69a5612a065b1422"
dependencies = [
 "proc-macro2",
 "quote",
 "unicode-ident",
]

[[package]]
name = "thiserror"
version = "2.0.18"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4288b5bcbc7920c07a1149a35cf9590a2aa808e0bc1eafaade0b80947865fbc4"
dependencies = [
 "thiserror-impl",
]

[[package]]
name = "thiserror-impl"
version = "2.0.18"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ebc4ee7f67670e9b64d05fa4253e753e016c6c95ff35b89b7941d6b856dec1d5"
dependencies = [
 "proc-macro2",
 "quote",
 "syn",
]

[[package]]
name = "tiny_http"
version = "0.12.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "389915df6413a2e74fb181895f933386023c71110878cd0825588928e64cdc82"
dependencies = [
 "ascii",
 "chunked_transfer",
 "httpdate",
 "log",
]

[[package]]
name = "unicase"
version = "2.9.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "dbc4bc3a9f746d862c45cb89d705aa10f187bb96c76001afab07a0d35ce60142"

[[package]]
name = "unicode-ident"
version = "1.0.24"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e6e4313cd5fcd3dad5cafa179702e2b244f760991f45397d14d4ebf38247da75"

[[package]]
name = "unicode-width"
version = "0.2.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b4ac048d71ede7ee76d585517add45da530660ef4390e49b098733c6e897f254"

[[package]]
name = "unsafe-libyaml"
version = "0.2.11"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "673aac59facbab8a9007c7f6108d11f63b603f7cabff99fabf650fea5c32b861"

[[package]]
name = "utf8parse"
version = "0.2.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "06abde3611657adf66d383f00b093d7faecc7fa57071cce2578660c9f1010821"

[[package]]
name = "walkdir"
version = "2.5.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "29790946404f91d9c5d06f9874efddea1dc06c5efe94541a7d6863108e3a5e4b"
dependencies = [
 "same-file",
 "winapi-util",
]

[[package]]
name = "wasi"
version = "0.11.1+wasi-snapshot-preview1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ccf3ec651a847eb01de73ccad15eb7d99f80485de043efb2f370cd654f4ea44b"

[[package]]
name = "wasm-bindgen"
version = "0.2.126"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4b067c0c11094aef6b7a801c1e34a26affafdf3d051dba08456b868789aaf9a4"
dependencies = [
 "cfg-if",
 "once_cell",
 "rustversion",
 "wasm-bindgen-macro",
 "wasm-bindgen-shared",
]

[[package]]
name = "wasm-bindgen-macro"
version = "0.2.126"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "167ce5e579f6bcf889c4f7175a8a5a585de84e8ff93976ce393efa5f2837aab1"
dependencies = [
 "quote",
 "wasm-bindgen-macro-support",
]

[[package]]
name = "wasm-bindgen-macro-support"
version = "0.2.126"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f3997c7839262f4ef12cf90b818d6340c18e80f263f1a94bf157d0ec4420380e"
dependencies = [
 "bumpalo",
 "proc-macro2",
 "quote",
 "syn",
 "wasm-bindgen-shared",
]

[[package]]
name = "wasm-bindgen-shared"
version = "0.2.126"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "dc1b4cb0cc549fcf58d7dfc081778139b3d283a081644e833e84682ad71cea24"
dependencies = [
 "unicode-ident",
]

[[package]]
name = "winapi-util"
version = "0.1.11"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c2a7b1c03c876122aa43f3020e6c3c3ee5c05081c9a00739faf7503aeba10d22"
dependencies = [
 "windows-sys 0.61.2",
]

[[package]]
name = "windows-core"
version = "0.62.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b8e83a14d34d0623b51dce9581199302a221863196a1dde71a7663a4c2be9deb"
dependencies = [
 "windows-implement",
 "windows-interface",
 "windows-link",
 "windows-result",
 "windows-strings",
]

[[package]]
name = "windows-implement"
version = "0.60.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "053e2e040ab57b9dc951b72c264860db7eb3b0200ba345b4e4c3b14f67855ddf"
dependencies = [
 "proc-macro2",
 "quote",
 "syn",
]

[[package]]
name = "windows-interface"
version = "0.59.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3f316c4a2570ba26bbec722032c4099d8c8bc095efccdc15688708623367e358"
dependencies = [
 "proc-macro2",
 "quote",
 "syn",
]

[[package]]
name = "windows-link"
version = "0.2.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f0805222e57f7521d6a62e36fa9163bc891acd422f971defe97d64e70d0a4fe5"

[[package]]
name = "windows-result"
version = "0.4.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7781fa89eaf60850ac3d2da7af8e5242a5ea78d1a11c49bf2910bb5a73853eb5"
dependencies = [
 "windows-link",
]

[[package]]
name = "windows-strings"
version = "0.5.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7837d08f69c77cf6b07689544538e017c1bfcf57e34b4c0ff58e6c2cd3b37091"
dependencies = [
 "windows-link",
]

[[package]]
name = "windows-sys"
version = "0.60.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f2f500e4d28234f72040990ec9d39e3a6b950f9f22d3dba18416c35882612bcb"
dependencies = [
 "windows-targets",
]

[[package]]
name = "windows-sys"
version = "0.61.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ae137229bcbd6cdf0f7b80a31df61766145077ddf49416a728b02cb3921ff3fc"
dependencies = [
 "windows-link",
]

[[package]]
name = "windows-targets"
version = "0.53.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4945f9f551b88e0d65f3db0bc25c33b8acea4d9e41163edf90dcd0b19f9069f3"
dependencies = [
 "windows-link",
 "windows_aarch64_gnullvm",
 "windows_aarch64_msvc",
 "windows_i686_gnu",
 "windows_i686_gnullvm",
 "windows_i686_msvc",
 "windows_x86_64_gnu",
 "windows_x86_64_gnullvm",
 "windows_x86_64_msvc",
]

[[package]]
name = "windows_aarch64_gnullvm"
version = "0.53.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a9d8416fa8b42f5c947f8482c43e7d89e73a173cead56d044f6a56104a6d1b53"

[[package]]
name = "windows_aarch64_msvc"
version = "0.53.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b9d782e804c2f632e395708e99a94275910eb9100b2114651e04744e9b125006"

[[package]]
name = "windows_i686_gnu"
version = "0.53.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "960e6da069d81e09becb0ca57a65220ddff016ff2d6af6a223cf372a506593a3"

[[package]]
name = "windows_i686_gnullvm"
version = "0.53.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "fa7359d10048f68ab8b09fa71c3daccfb0e9b559aed648a8f95469c27057180c"

[[package]]
name = "windows_i686_msvc"
version = "0.53.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1e7ac75179f18232fe9c285163565a57ef8d3c89254a30685b57d83a38d326c2"

[[package]]
name = "windows_x86_64_gnu"
version = "0.53.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9c3842cdd74a865a8066ab39c8a7a473c0778a3f29370b5fd6b4b9aa7df4a499"

[[package]]
name = "windows_x86_64_gnullvm"
version = "0.53.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0ffa179e2d07eee8ad8f57493436566c7cc30ac536a3379fdf008f47f6bb7ae1"

[[package]]
name = "windows_x86_64_msvc"
version = "0.53.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d6bbff5f0aada427a1e5a6da5f1f98158182f26556f345ac9e04d36d0ebed650"
```
## ./templates/styles.css

```css
/* =========================================================
   Manpage Terminal Template – styles.css
   Full‑featured, accessible, responsive, with sidebar &
   search. Works with rawssg placeholders.
   ========================================================= */

:root {
  --bg: #0a0a0a;
  --text: #b0b0b0;
  --muted: #777;
  --heading: #e5e5e5;
  --accent: #8be9fd;
  --accent-hover: #ffffff;
  --border: #2a2a2a;
  --code-bg: #141414;
  --pre-bg: #0d0d0d;
  --pre-border: #2e2e2e;
  --meta-label: #d0d0d0;
  --synopsis-color: #999;
  --blockquote-bg: #111;
  --blockquote-text: #aaa;
  --button-muted: #666;
  --progress-bg: rgba(139, 233, 253, 0.3);
  --toc-bg: rgba(10, 10, 10, 0.97);
  --search-bg: #0f0f0f;
  --term-success: #50fa7b;
  --term-error: #ff5555;
  --term-warning: #f1fa8c;
  --strong-color: #e8e8e8;
  --em-color: #cccccc;
  --code-text: #c5c8c6;
  --pre-text: #c0c0c0;
  --table-header-bg: #0f0f0f;
  --overlay-bg: rgba(0, 0, 0, 0.8);
  --focus-ring: var(--accent);
  --sidebar-width: 220px;
  --transition: 0.2s ease;
}

[data-theme="light"],
html.light {
  --bg: #f5f5f0;
  --text: #333;
  --muted: #666;
  --heading: #111;
  --accent: #0066cc;
  --accent-hover: #004499;
  --border: #ccc;
  --code-bg: #e8e8e8;
  --pre-bg: #f0f0f0;
  --pre-border: #ccc;
  --meta-label: #222;
  --synopsis-color: #555;
  --blockquote-bg: #eee;
  --blockquote-text: #444;
  --button-muted: #888;
  --progress-bg: rgba(0, 102, 204, 0.3);
  --toc-bg: rgba(245, 245, 240, 0.97);
  --search-bg: #fafaf5;
  --strong-color: #111;
  --em-color: #333;
  --code-text: #1f2937;
  --pre-text: #222;
  --table-header-bg: #eaeaea;
  --overlay-bg: rgba(0, 0, 0, 0.5);
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 100%;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  scroll-behavior: smooth;
}

body {
  background-color: var(--bg);
  color: var(--text);
  font-family: "JetBrains Mono", "IBM Plex Mono", "Fira Code", monospace;
  line-height: 1.7;
  padding: 2rem 1.5rem;
  min-height: 100vh;
  transition:
    background-color var(--transition),
    color var(--transition);
  position: relative;
}

body.no-transition,
body.no-transition * {
  transition: none !important;
}

/* ---------- Skip link ---------- */
.skip-link {
  position: absolute;
  top: -100px;
  left: 0;
  background: var(--accent);
  color: #000;
  padding: 0.5rem 1rem;
  z-index: 100;
  text-decoration: none;
}
.skip-link:focus {
  top: 0;
}

/* ---------- Progress bar ---------- */
.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background: var(--progress-bg);
  width: 0;
  z-index: 99;
  transition: width 0.1s linear;
}

/* ---------- Navbar (dari rawssg) ---------- */
.top-nav {
  max-width: 56rem;
  margin: 0 auto 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border);
}
.top-nav ul {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}
.top-nav a {
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
  border-bottom: 1px solid transparent;
  transition: border-color var(--transition);
}
.top-nav a:hover {
  border-bottom-color: var(--accent);
}

/* ---------- Sidebar ---------- */
.sidebar {
  position: fixed;
  top: 0;
  right: 0;
  width: var(--sidebar-width);
  height: 100vh;
  background: var(--bg);
  border-left: 1px solid var(--border);
  padding: 2rem 1rem;
  transform: translateX(100%);
  transition: transform 0.3s ease;
  z-index: 90;
  overflow-y: auto;
}
.sidebar.open {
  transform: translateX(0);
}
.sidebar ul {
  list-style: none;
  padding: 0;
  margin-top: 1rem;
}
.sidebar li {
  margin-bottom: 0.8rem;
}
.sidebar a {
  color: var(--text);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition:
    color var(--transition),
    border-color var(--transition);
}
.sidebar a:hover,
.sidebar a.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.sidebar-toggle {
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  color: var(--accent);
  font-size: 1.4rem;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  z-index: 91;
  display: none; /* muncul hanya di layar kecil */
}

@media (max-width: 850px) {
  .sidebar {
    width: 100%;
    max-width: 300px;
  }
  .sidebar-toggle {
    display: block;
  }
}

/* ---------- Layout utama ---------- */
.manpage {
  max-width: 48rem;
  margin: 0 auto;
  padding: 2rem 0;
  position: relative;
}

.ascii-decor {
  color: var(--border);
  font-size: 0.9rem;
  text-align: center;
  margin-bottom: 1rem;
  user-select: none;
}

.title {
  font-size: clamp(2rem, 5vw, 2.8rem);
  font-weight: 700;
  color: var(--heading);
  letter-spacing: -0.02em;
  line-height: 1.2;
  margin-bottom: 1rem;
}

.blinking-cursor {
  color: var(--accent);
  animation: blink 1s step-end infinite;
  margin-left: 2px;
  font-weight: 400;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.synopsis {
  font-style: italic;
  color: var(--synopsis-color);
  margin-bottom: 1.5rem;
  line-height: 1.6;
  min-height: 1.6em;
}

.separator {
  border: 0;
  height: 1px;
  background: var(--border);
  margin: 1.5rem 0 2rem;
}

.meta p {
  display: flex;
  align-items: baseline;
  margin-bottom: 0.4rem;
  font-size: 0.95rem;
}
.meta strong {
  display: inline-block;
  min-width: 10rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
  color: var(--meta-label);
  font-size: 0.9rem;
}

.repo-link {
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px dashed var(--accent);
  transition:
    color var(--transition),
    border-color var(--transition);
}
.repo-link:hover {
  color: var(--accent-hover);
  border-bottom-color: var(--accent-hover);
}

/* ---------- Page tools (search & TOC) ---------- */
.page-tools {
  margin: 2rem 0 1rem;
}
.term-search {
  display: flex;
  align-items: center;
  background: var(--search-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.4rem 0.8rem;
  margin-bottom: 1rem;
  opacity: 0.9;
  transition: opacity var(--transition);
}
.term-search:hover {
  opacity: 1;
}
.search-prompt {
  color: var(--accent);
  margin-right: 0.5rem;
  white-space: nowrap;
  font-weight: 500;
  user-select: none;
}
#search-input {
  background: transparent;
  border: none;
  color: var(--text);
  font-family: inherit;
  font-size: 0.95rem;
  flex: 1;
  outline: none;
  padding: 0.2rem 0;
}
#search-input::placeholder {
  color: var(--muted);
  font-style: italic;
}
.search-results {
  color: var(--muted);
  margin-left: 0.5rem;
  white-space: nowrap;
}
.search-clear {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0 0.3rem;
  transition: color var(--transition);
}
.search-clear:hover {
  color: var(--accent);
}

/* Highlight */
.search-highlight {
  background: rgba(139, 233, 253, 0.35);
  color: var(--heading);
  border-radius: 2px;
  padding: 0 0.1em;
}
.search-highlight.current {
  background: var(--accent);
  color: #000;
  border-radius: 2px;
}

/* TOC */
.toc-toggle {
  background: none;
  border: 1px solid var(--border);
  color: var(--accent);
  font-family: inherit;
  font-size: 0.85rem;
  padding: 0.3rem 0.8rem;
  border-radius: 3px;
  cursor: pointer;
  margin-bottom: 0.8rem;
  transition: background var(--transition);
}
.toc-toggle:hover {
  background: var(--code-bg);
}
.man-toc {
  background: var(--toc-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1rem;
  max-height: 60vh;
  overflow-y: auto;
  font-size: 0.9rem;
  display: none;
  backdrop-filter: blur(5px);
}
.man-toc.visible {
  display: block;
}
.man-toc ul {
  list-style: none;
  padding-left: 0;
}
.man-toc li {
  margin-bottom: 0.4rem;
}
.man-toc a {
  color: var(--text);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition:
    border-color var(--transition),
    color var(--transition);
}
.man-toc a:hover,
.man-toc a.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

/* ---------- Content (markdown) ---------- */
.content {
  margin-top: 2rem;
  line-height: 1.8;
}
.content > * + * {
  margin-top: 1.5rem;
}
.content h1,
.content h2,
.content h3,
.content h4,
.content h5,
.content h6 {
  color: var(--heading);
  font-weight: 700;
  margin-top: 2.5rem;
  margin-bottom: 0.75rem;
  line-height: 1.3;
  scroll-margin-top: 2rem; /* for anchor scroll */
}
.content h1 {
  font-size: 1.9rem;
}
.content h2 {
  font-size: 1.6rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.35rem;
}
.content h3 {
  font-size: 1.3rem;
  font-weight: 600;
}
.content h4 {
  font-size: 1.1rem;
  font-style: italic;
}
.content h5 {
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.content h6 {
  font-size: 0.95rem;
  text-transform: uppercase;
  color: var(--muted);
}
.content p {
  margin-bottom: 1.2rem;
}
.content strong,
.content b {
  color: var(--strong-color);
  font-weight: 600;
}
.content em,
.content i {
  color: var(--em-color);
}
.content del {
  text-decoration: line-through;
  opacity: 0.7;
}
.content a {
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px dashed var(--accent);
  transition:
    color var(--transition),
    border-color var(--transition);
}
.content a:hover {
  color: var(--accent-hover);
  border-bottom-color: var(--accent-hover);
}
.content ul,
.content ol {
  padding-left: 2rem;
  list-style: none;
  margin-bottom: 1.2rem;
}
.content li {
  position: relative;
  padding-left: 1.5em;
  margin-bottom: 0.5rem;
}
.content ul li::before {
  content: "—";
  position: absolute;
  left: 0;
  color: var(--muted);
}
.content ol {
  counter-reset: item;
}
.content ol li::before {
  counter-increment: item;
  content: counter(item) ".";
  position: absolute;
  left: 0;
  color: var(--muted);
  min-width: 1.5em;
}
.content blockquote {
  margin: 1.5rem 0;
  padding: 1rem 1.5rem;
  background: var(--blockquote-bg);
  border-left: 3px solid var(--accent);
  color: var(--blockquote-text);
  border-radius: 2px;
}
.content code {
  font-family: inherit;
  background: var(--code-bg);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
  color: var(--code-text);
}
.content pre {
  background: var(--pre-bg);
  border: 1px solid var(--pre-border);
  border-radius: 4px;
  padding: 1.2rem;
  overflow-x: auto;
  margin: 1.5rem 0;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--pre-text);
  position: relative;
}
.content pre code {
  background: none;
  padding: 0;
  font-size: inherit;
  color: inherit;
}
.content table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5rem 0;
}
.content th,
.content td {
  padding: 0.7rem 0.8rem;
  border-bottom: 1px solid var(--border);
}
.content th {
  background: var(--table-header-bg);
  color: var(--heading);
  font-weight: 600;
}
.content img {
  max-width: 100%;
  height: auto;
  border-radius: 2px;
}
.content hr {
  border: 0;
  height: 1px;
  background: var(--border);
  margin: 2rem 0;
}
.content dl {
  margin: 1.5rem 0;
}
.content dt {
  font-weight: 600;
  color: var(--heading);
  margin-top: 1rem;
}
.content dd {
  margin-left: 1.5rem;
  color: var(--text);
}

/* ---------- Copy button ---------- */
.code-block {
  position: relative;
  margin: 1.5rem 0;
}
.code-block pre {
  margin: 0;
}
.copy-btn {
  position: absolute;
  top: 0.6rem;
  right: 0.75rem;
  background: none;
  border: none;
  color: var(--button-muted);
  font-family: inherit;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity var(--transition),
    color var(--transition);
  padding: 0.2rem 0.4rem;
  display: flex;
  align-items: center;
  gap: 0.2rem;
}
.code-block:hover .copy-btn,
.copy-btn.visible {
  opacity: 1;
}
.copy-btn:hover,
.copy-btn.copied {
  color: var(--accent);
}
.copy-btn .copy-check {
  opacity: 0;
  font-size: 0.9rem;
  transition: opacity var(--transition);
  margin-left: 0.2rem;
}
.copy-btn.copied .copy-check {
  opacity: 1;
}

/* ---------- Back to top ---------- */
.back-to-top {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  color: var(--accent);
  padding: 0.3rem 0.7rem;
  font-family: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity var(--transition),
    visibility var(--transition);
  border-radius: 3px;
  z-index: 50;
}
.back-to-top.visible {
  opacity: 1;
  visibility: visible;
}

/* ---------- Help modal ---------- */
.help-modal {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}
.help-modal[hidden] {
  display: none;
}
.help-content {
  background: var(--bg);
  border: 1px solid var(--border);
  padding: 2rem;
  max-width: 30rem;
  width: 90%;
  border-radius: 4px;
  color: var(--text);
}
.help-content h2 {
  margin-bottom: 1rem;
  color: var(--heading);
}
.help-content ul {
  list-style: none;
  margin-bottom: 1.5rem;
}
.help-content li {
  margin-bottom: 0.5rem;
}
.help-content kbd {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 0.1em 0.4em;
  font-family: inherit;
  font-size: 0.85em;
}
.help-close {
  background: none;
  border: 1px solid var(--border);
  color: var(--accent);
  padding: 0.4rem 1rem;
  font-family: inherit;
  cursor: pointer;
  display: block;
  margin-left: auto;
  transition: background var(--transition);
}
.help-close:hover {
  background: var(--code-bg);
}

.no-js-warning {
  color: var(--term-warning);
  text-align: center;
  margin-top: 2rem;
  font-style: italic;
}

.page-footer {
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
  font-size: 0.85rem;
  color: var(--muted);
  text-align: left;
}

/* ---------- Focus visible ---------- */
a:focus-visible,
button:focus-visible,
input:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: 2px;
}

/* ---------- Reduced motion ---------- */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  .blinking-cursor {
    animation: none;
    opacity: 1;
  }
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}

/* ---------- Print ---------- */
@media print {
  body {
    background: white;
    color: black;
    padding: 0;
  }
  .progress-bar,
  .ascii-decor,
  .page-tools,
  .back-to-top,
  .help-modal,
  .copy-btn,
  .sidebar-toggle,
  .sidebar,
  .skip-link,
  .top-nav {
    display: none !important;
  }
  .manpage {
    max-width: 100%;
  }
  .title,
  .synopsis,
  .meta,
  .content {
    color: black;
  }
  .content pre {
    border: 1px solid #ccc;
    background: #fafafa;
  }
  a::after {
    content: " (" attr(href) ")";
    font-size: 0.8em;
    color: #555;
  }
  .repo-link::after {
    content: "";
  }
}

/* ---------- Responsive ---------- */
@media (max-width: 600px) {
  body {
    padding: 1rem;
  }
  .title {
    font-size: 1.8rem;
  }
  .meta strong {
    min-width: 8rem;
  }
  .term-search {
    flex-wrap: wrap;
  }
  .man-toc {
    max-height: 40vh;
  }
  .back-to-top {
    bottom: 1rem;
    right: 1rem;
  }
}
```
## ./templates/script.js

```javascript
(function () {
  "use strict";

  var body = document.body;

  // Hindari flash transisi tema
  body.classList.add("no-transition");

  /* -------------------------------------------------------
     Utilities
  ------------------------------------------------------- */
  function debounce(fn, delay) {
    var timer;
    return function () {
      var context = this,
        args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }

  /* -------------------------------------------------------
     Date modified / current year
  ------------------------------------------------------- */
  var dateEl = document.getElementById("date_modified");
  if (dateEl) {
    var months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    var now = new Date();
    dateEl.textContent =
      ("0" + now.getDate()).slice(-2) +
      " " +
      months[now.getMonth()] +
      " " +
      now.getFullYear();
  }
  var yearSpan = document.getElementById("current-year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  /* =========================================================
     THEME
  ========================================================= */
  function initTheme() {
    var saved = localStorage.getItem("manpage-theme");
    if (saved === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
    // Aktifkan transisi setelah tema diterapkan
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        body.classList.remove("no-transition");
      });
    });
  }

  function toggleTheme() {
    var html = document.documentElement;
    if (html.classList.contains("light")) {
      html.classList.remove("light");
      html.setAttribute("data-theme", "dark");
      localStorage.setItem("manpage-theme", "dark");
    } else {
      html.classList.add("light");
      html.setAttribute("data-theme", "light");
      localStorage.setItem("manpage-theme", "light");
    }
  }

  initTheme();

  /* =========================================================
     SIDEBAR TOGGLE
  ========================================================= */
  var sidebar = document.getElementById("sidebar");
  var sidebarToggle = document.getElementById("sidebar-toggle");
  if (sidebar && sidebarToggle) {
    sidebarToggle.addEventListener("click", function () {
      sidebar.classList.toggle("open");
    });
    // Tutup sidebar jika klik di luar (opsional)
    document.addEventListener("click", function (e) {
      if (
        !sidebar.contains(e.target) &&
        e.target !== sidebarToggle &&
        !sidebarToggle.contains(e.target)
      ) {
        sidebar.classList.remove("open");
      }
    });
  }

  /* =========================================================
     TABLE OF CONTENTS (Auto‑generate dari h2,h3)
  ========================================================= */
  function buildTOC() {
    var tocList = document.getElementById("toc-list");
    var content = document.getElementById("content");
    if (!tocList || !content) return;

    var headings = content.querySelectorAll("h2, h3");
    if (headings.length === 0) {
      document.getElementById("toc-toggle").style.display = "none";
      return;
    }

    var items = [];
    headings.forEach(function (h, i) {
      // Buat id jika belum ada
      if (!h.id) {
        h.id = "section-" + i;
      }
      var level = h.tagName === "H2" ? 0 : 1; // 0 = top, 1 = sub
      items.push({ level: level, text: h.textContent, id: h.id });
    });

    // Buat nested list sederhana (indentasi dengan margin)
    var html = "";
    var stack = [];
    items.forEach(function (item) {
      if (item.level === 0) {
        html +=
          '<li><a href="#' +
          item.id +
          '">' +
          escapeHtml(item.text) +
          "</a></li>";
      } else {
        // Masukkan dalam <ul> jika belum ada sublist
        if (!html.endsWith("</ul>")) {
          html += "<ul>";
        }
        html +=
          '<li style="padding-left:1.5em;"><a href="#' +
          item.id +
          '">' +
          escapeHtml(item.text) +
          "</a></li>";
      }
    });
    // Tutup sublist terakhir
    if (html.indexOf("<ul>") !== -1 && !html.endsWith("</ul>")) {
      html += "</ul>";
    }
    tocList.innerHTML = html;

    // Event listener untuk smooth scroll & active class
    var links = tocList.querySelectorAll("a");
    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        var target = document.getElementById(
          link.getAttribute("href").substring(1),
        );
        if (target) {
          target.scrollIntoView({ behavior: "smooth" });
          // Update active
          links.forEach((l) => l.classList.remove("active"));
          link.classList.add("active");
        }
        // Tutup TOC jika mobile? opsional
      });
    });

    // Toggle TOC
    var tocToggle = document.getElementById("toc-toggle");
    var manToc = document.getElementById("man-toc");
    if (tocToggle && manToc) {
      tocToggle.addEventListener("click", function () {
        var visible = manToc.classList.toggle("visible");
        tocToggle.setAttribute("aria-expanded", visible);
      });
    }

    // Highligt active TOC on scroll
    var tocAnchors = Array.from(links).map((l) =>
      document.getElementById(l.getAttribute("href").substring(1)),
    );
    window.addEventListener(
      "scroll",
      debounce(function () {
        var scrollPos = window.scrollY + 100;
        var current = null;
        for (var i = tocAnchors.length - 1; i >= 0; i--) {
          if (tocAnchors[i] && tocAnchors[i].offsetTop <= scrollPos) {
            current = tocAnchors[i].id;
            break;
          }
        }
        links.forEach(function (link) {
          link.classList.toggle(
            "active",
            link.getAttribute("href") === "#" + current,
          );
        });
      }, 100),
    );
  }

  function escapeHtml(text) {
    var map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, function (m) {
      return map[m];
    });
  }

  buildTOC();

  /* =========================================================
     CLIENT‑SIDE SEARCH (dengan highlight & navigasi)
  ========================================================= */
  var searchInput = document.getElementById("search-input");
  var searchClear = document.getElementById("search-clear");
  var searchResults = document.getElementById("search-results");
  var contentArea = document.getElementById("content");

  var currentHighlightIndex = -1;
  var allHighlights = [];

  function clearHighlights() {
    // Hapus semua highlight span, kembalikan teks asli
    var highlights = contentArea.querySelectorAll(".search-highlight");
    highlights.forEach(function (span) {
      var parent = span.parentNode;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize(); // gabungkan teks terpisah
    });
    allHighlights = [];
    currentHighlightIndex = -1;
  }

  function performSearch() {
    clearHighlights();
    var query = searchInput.value.trim();
    if (!query) {
      searchResults.textContent = "";
      return;
    }

    // Regex case‑insensitive
    var regex = new RegExp(
      "(" + query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")",
      "gi",
    );
    highlightTextNodes(contentArea, regex);

    // Kumpulkan semua highlight yang dihasilkan
    allHighlights = Array.from(
      contentArea.querySelectorAll(".search-highlight"),
    );
    if (allHighlights.length > 0) {
      searchResults.textContent = allHighlights.length + " matches";
      currentHighlightIndex = 0;
      setCurrentHighlight(0);
    } else {
      searchResults.textContent = "No matches";
    }
  }

  // Rekursif cari teks dalam node, ganti dengan span highlight
  function highlightTextNodes(node, regex) {
    if (node.nodeType === 3) {
      // text node
      var text = node.textContent;
      var match;
      var lastIndex = 0;
      var fragment = document.createDocumentFragment();
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        // Teks sebelum match
        if (match.index > lastIndex) {
          fragment.appendChild(
            document.createTextNode(text.substring(lastIndex, match.index)),
          );
        }
        var span = document.createElement("span");
        span.className = "search-highlight";
        span.textContent = match[0];
        fragment.appendChild(span);
        lastIndex = regex.lastIndex;
        if (match[0].length === 0) regex.lastIndex++; // hindari infinite loop
      }
      // Sisa teks
      if (lastIndex < text.length) {
        fragment.appendChild(
          document.createTextNode(text.substring(lastIndex)),
        );
      }
      if (fragment.childNodes.length > 0) {
        node.parentNode.replaceChild(fragment, node);
      }
    } else if (
      node.nodeType === 1 &&
      !/(script|style|textarea|select|button|code)/i.test(node.tagName)
    ) {
      // Hindari modifikasi di dalam script/style/textarea dll.
      // Juga hindari highlight ulang span yang sudah ada
      if (node.classList.contains("search-highlight")) return;
      // Rekursi ke anak-anak (harus static NodeList agar tidak berubah saat modifikasi)
      var children = Array.from(node.childNodes);
      children.forEach(function (child) {
        highlightTextNodes(child, regex);
      });
    }
  }

  function setCurrentHighlight(index) {
    allHighlights.forEach(function (span, i) {
      span.classList.toggle("current", i === index);
    });
    if (allHighlights.length > 0) {
      allHighlights[index].scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }

  function navigateHighlights(direction) {
    if (allHighlights.length === 0) return;
    currentHighlightIndex += direction;
    if (currentHighlightIndex >= allHighlights.length)
      currentHighlightIndex = 0;
    if (currentHighlightIndex < 0)
      currentHighlightIndex = allHighlights.length - 1;
    setCurrentHighlight(currentHighlightIndex);
  }

  if (searchInput) {
    searchInput.addEventListener("input", debounce(performSearch, 300));
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          navigateHighlights(-1);
        } else {
          navigateHighlights(1);
        }
      } else if (e.key === "Escape") {
        clearHighlights();
        searchInput.value = "";
        searchResults.textContent = "";
      }
    });
    searchClear.addEventListener("click", function () {
      searchInput.value = "";
      clearHighlights();
      searchResults.textContent = "";
      searchInput.focus();
    });
  }

  /* =========================================================
     COPY BUTTONS
  ========================================================= */
  function enhanceCopyButtons() {
    var pres = document.querySelectorAll(".content pre");
    for (var i = 0; i < pres.length; i++) {
      var pre = pres[i];
      if (pre.closest(".code-block")) continue;

      var wrapper = document.createElement("div");
      wrapper.className = "code-block";
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      var btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Copy code to clipboard");

      var label = document.createElement("span");
      label.className = "copy-label";
      label.textContent = "Copy";
      btn.appendChild(label);

      var check = document.createElement("span");
      check.className = "copy-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";
      btn.appendChild(check);

      btn.addEventListener(
        "click",
        (function (preEl, btnEl, labelEl) {
          return function () {
            var codeEl = preEl.querySelector("code");
            var code = codeEl ? codeEl.textContent : preEl.textContent;
            copyToClipboard(code, btnEl, labelEl);
          };
        })(pre, btn, label),
      );

      wrapper.appendChild(btn);

      if ("ontouchstart" in window) {
        btn.classList.add("visible");
      }
    }
  }

  function copyToClipboard(text, btn, labelEl) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          indicateCopySuccess(btn, labelEl);
        })
        .catch(function () {
          fallbackCopy(text, btn, labelEl);
        });
    } else {
      fallbackCopy(text, btn, labelEl);
    }
  }

  function fallbackCopy(text, btn, labelEl) {
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    var succeeded = false;
    try {
      succeeded = document.execCommand("copy");
    } catch (e) {}
    document.body.removeChild(textarea);
    if (succeeded) {
      indicateCopySuccess(btn, labelEl);
    } else {
      labelEl.textContent = "Select & copy manually";
      btn.setAttribute(
        "aria-label",
        "Copy failed, please select and copy the code manually",
      );
      setTimeout(function () {
        labelEl.textContent = "Copy";
        btn.setAttribute("aria-label", "Copy code to clipboard");
      }, 3000);
    }
  }

  function indicateCopySuccess(btn, labelEl) {
    btn.classList.add("copied");
    btn.setAttribute("aria-label", "Copied to clipboard");
    labelEl.textContent = "Copied";
    setTimeout(function () {
      btn.classList.remove("copied");
      btn.setAttribute("aria-label", "Copy code to clipboard");
      labelEl.textContent = "Copy";
    }, 2000);
  }

  enhanceCopyButtons();

  /* =========================================================
     SCROLL UI: progress bar + back‑to‑top
  ========================================================= */
  var backToTopBtn = document.getElementById("back-to-top");
  var progressBar = document.getElementById("progress-bar");
  var scrollTicking = false;

  function updateScrollUI() {
    var scrollTop = window.scrollY;
    if (progressBar) {
      var docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      var scrolled = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      progressBar.style.width = scrolled + "%";
    }
    if (backToTopBtn) {
      backToTopBtn.classList.toggle("visible", scrollTop > 300);
    }
    scrollTicking = false;
  }

  function onScroll() {
    if (!scrollTicking) {
      scrollTicking = true;
      window.requestAnimationFrame(updateScrollUI);
    }
  }

  if (progressBar || backToTopBtn) {
    window.addEventListener("scroll", onScroll, { passive: true });
    updateScrollUI();
  }

  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
      backToTopBtn.blur();
    });
  }

  /* =========================================================
     TYPEWRITER EFFECT
  ========================================================= */
  var synopsis = document.querySelector(".synopsis[data-typewriter]");
  var prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (synopsis) {
    var originalText = synopsis.getAttribute("data-typewriter") || "";
    var typeIndex = 0;
    var isTyping = false;
    var typeInterval = null;

    function typeStep() {
      typeIndex++;
      synopsis.textContent = originalText.substring(0, typeIndex);
      if (typeIndex >= originalText.length) {
        clearInterval(typeInterval);
        isTyping = false;
      }
    }

    function playTyping() {
      isTyping = true;
      typeInterval = setInterval(typeStep, 30);
    }

    function pauseTyping() {
      clearInterval(typeInterval);
      isTyping = false;
    }

    if (prefersReducedMotion) {
      synopsis.textContent = originalText;
      typeIndex = originalText.length;
    } else {
      synopsis.textContent = "";
      playTyping();
    }

    window.toggleTypewriterEffect = function () {
      if (isTyping) {
        pauseTyping();
      } else if (typeIndex >= originalText.length) {
        typeIndex = 0;
        synopsis.textContent = "";
        playTyping();
      } else {
        playTyping();
      }
    };
  }

  /* =========================================================
     HELP MODAL (focus trap)
  ========================================================= */
  var helpModal = document.getElementById("help-modal");
  var helpClose = document.getElementById("help-close");
  var lastFocusedBeforeModal = null;

  function getFocusableInModal() {
    if (!helpModal) return [];
    var selector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(helpModal.querySelectorAll(selector));
  }

  function trapTabKey(e) {
    if (e.key !== "Tab") return;
    var focusable = getFocusableInModal();
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function showHelp() {
    if (!helpModal) return;
    lastFocusedBeforeModal = document.activeElement;
    helpModal.hidden = false;
    helpModal.addEventListener("keydown", trapTabKey);
    var focusable = getFocusableInModal();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      helpModal.setAttribute("tabindex", "-1");
      helpModal.focus();
    }
  }

  function hideHelp() {
    if (!helpModal || helpModal.hidden) return;
    helpModal.hidden = true;
    helpModal.removeEventListener("keydown", trapTabKey);
    if (
      lastFocusedBeforeModal &&
      typeof lastFocusedBeforeModal.focus === "function"
    ) {
      lastFocusedBeforeModal.focus();
    }
    lastFocusedBeforeModal = null;
  }

  function toggleHelp() {
    if (!helpModal) return;
    if (helpModal.hidden) showHelp();
    else hideHelp();
  }

  if (helpModal) {
    helpModal.addEventListener("click", function (e) {
      if (e.target === e.currentTarget) hideHelp();
    });
  }
  if (helpClose) {
    helpClose.addEventListener("click", hideHelp);
  }

  /* =========================================================
     KEYBOARD SHORTCUTS
  ========================================================= */
  document.addEventListener("keydown", function (e) {
    var targetTag = e.target.tagName;
    if (
      targetTag === "INPUT" ||
      targetTag === "TEXTAREA" ||
      e.target.isContentEditable
    ) {
      // Izinkan Escape dan ? untuk input search (kita tangani di search)
      if (e.key === "Escape" || e.key === "?") {
        // tidak return, biarkan switch handle
      } else {
        return;
      }
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    switch (e.key) {
      case "j":
      case "ArrowDown":
        e.preventDefault();
        window.scrollBy({ top: 100, behavior: "smooth" });
        break;
      case "k":
      case "ArrowUp":
        e.preventDefault();
        window.scrollBy({ top: -100, behavior: "smooth" });
        break;
      case "g":
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "G":
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
        break;
      case "p":
        window.print();
        break;
      case "l":
        toggleTheme();
        break;
      case "c":
        if (typeof window.toggleTypewriterEffect === "function") {
          window.toggleTypewriterEffect();
        }
        break;
      case "s":
        // Fokus search
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
        break;
      case "?":
        toggleHelp();
        break;
      case "Escape":
        if (helpModal && !helpModal.hidden) {
          hideHelp();
        } else {
          // Clear search
          if (searchInput) {
            searchInput.value = "";
            clearHighlights();
            searchResults.textContent = "";
          }
        }
        break;
      default:
        break;
    }
  });
})();
```
## ./templates/index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="{{ desc }}" />
    <title>{{ title }}</title>

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,700;1,400;1,500&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body data-terminal="full">
    <div
      class="progress-bar"
      id="progress-bar"
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow="0"
    ></div>
    <a class="skip-link" href="#main-content">Skip to content</a>

    {{ navbar }}

    <!-- Sidebar dengan tombol toggle -->
    <button
      class="sidebar-toggle"
      id="sidebar-toggle"
      aria-label="Toggle sidebar"
    >
      <span class="sidebar-toggle-icon" aria-hidden="true">☰</span>
    </button>
    <aside class="sidebar" id="sidebar">{{ sidebar }}</aside>

    <main class="manpage" id="main-content">
      <header class="page-header">
        <div class="ascii-decor" aria-hidden="true">
          ════════════════════════════════════════
        </div>

        <h1 class="title">
          {{ title }}<span class="blinking-cursor" aria-hidden="true">_</span>
        </h1>

        <p class="synopsis" data-typewriter="{{ desc }}">{{ desc }}</p>

        <hr class="separator" />

        <div class="meta">
          <p><strong>Author</strong> {{ author }}</p>
          <p>
            <strong>Repository</strong>
            <a
              href="{{ repo_url }}"
              class="repo-link"
              target="_blank"
              rel="noopener noreferrer"
              >{{ repo_url }}</a
            >
          </p>
          <p><strong>License</strong> {{ license }}</p>
          <p><strong>Date Modified</strong> <span id="date_modified"></span></p>
        </div>

        <!-- Search & TOC -->
        <div class="page-tools" id="page-tools">
          <div class="term-search">
            <span class="search-prompt" aria-hidden="true"
              >$ man snapcat | grep</span
            >
            <input
              type="text"
              id="search-input"
              placeholder="Search documentation..."
              autocomplete="off"
              aria-label="Search within page"
            />
            <span
              class="search-results"
              id="search-results"
              aria-live="polite"
            ></span>
            <button
              class="search-clear"
              id="search-clear"
              aria-label="Clear search"
            >
              ×
            </button>
          </div>

          <button
            class="toc-toggle"
            id="toc-toggle"
            aria-expanded="false"
            aria-controls="man-toc"
          >
            📑 Table of Contents
          </button>
          <nav class="man-toc" id="man-toc" aria-label="Table of contents">
            <ul id="toc-list"></ul>
          </nav>
        </div>
      </header>

      <article class="content" id="content">{{ content }}</article>

      <footer class="page-footer">
        <p>{{ footer }} &copy; <span id="current-year"></span></p>
      </footer>

      <button
        class="back-to-top"
        id="back-to-top"
        type="button"
        aria-label="Back to top of page"
      >
        <span aria-hidden="true">[^]</span>
      </button>
    </main>

    <!-- Help Modal -->
    <div
      id="help-modal"
      class="help-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      hidden
    >
      <div class="help-content">
        <h2 id="help-title">Shortcut Keys</h2>
        <ul>
          <li><kbd>j</kbd> / <kbd>↓</kbd> : scroll down</li>
          <li><kbd>k</kbd> / <kbd>↑</kbd> : scroll up</li>
          <li><kbd>g</kbd> : go to top</li>
          <li><kbd>G</kbd> : go to bottom</li>
          <li><kbd>p</kbd> : print page</li>
          <li><kbd>c</kbd> : toggle typewriter</li>
          <li><kbd>l</kbd> : toggle light theme</li>
          <li><kbd>s</kbd> : focus search</li>
          <li><kbd>?</kbd> : show/hide this help</li>
          <li><kbd>Escape</kbd> : close help / clear search</li>
        </ul>
        <button
          class="help-close"
          id="help-close"
          type="button"
          aria-label="Close help"
        >
          [x]
        </button>
      </div>
    </div>

    <noscript>
      <p class="no-js-warning">
        JavaScript is disabled. Some interactive features are unavailable.
      </p>
    </noscript>

    <script src="./script.js"></script>
  </body>
</html>
```
## ./templates/homepage/config.yml

```yaml
navbar:
  - label: Home
    url: index.html
  - label: Blog
    url: blog.html
sidebar: []
```
## ./templates/homepage/index.md

```markdown
---
title: "My Homepage"
desc: "Welcome to the terminal-styled homepage"
author: "Your Name"
repo_url: "https://github.com/username/repo"
license: "MIT"
footer: "Powered by rawssg"
---

# Hello, World!

This is your new homepage. Edit `content/index.md` to change this.

## Latest Blog Posts

{{ blog_list }}
```
## ./templates/homepage/first-post.md

```markdown
---
title: "First Blog Post"
desc: "My first post"
author: "Your Name"
repo_url: "https://github.com/username/repo"
license: "MIT"
footer: "Powered by rawssg"
---

## Getting Started

This is your first blog post. Write something awesome!
```
## ./templates/blog/config.yaml

```yaml
navbar:
  - label: Home
    url: index.html
sidebar: []
```
## ./templates/blog/first-post.md

```markdown
---
title: "My First Blog"
desc: "Starting a simple blog"
author: "Your Name"
repo_url: "https://github.com/username/repo"
license: "MIT"
footer: "Powered by rawssg"
---

## Hello Blog

Minimal blog content here.
```
## ./snapcat.md

```markdown

```
## ./build.rs

```rust
fn main() {
    let now = chrono::Local::now();
    println!("cargo:rustc-env=BUILD_DATE={}", now.format("%Y-%m-%d %H:%M:%S"));
    println!("cargo:rustc-env=PROFILE={}", std::env::var("PROFILE").unwrap());
    println!("cargo:rustc-env=TARGET={}", std::env::var("TARGET").unwrap());
}
```
## ./Cargo.toml

```toml
[package]
name = "rawssg"
version = "0.1.0"
edition = "2024"

[dependencies]
anyhow = "1.0.103"
built = { version = "0.8.1", features = ["chrono"] }
clap = { version = "4.6.1", features = ["derive"] }
notify = { version = "8.2.0", features = ["macos_kqueue"] }
pulldown-cmark = "0.13.4"
serde = { version = "1.0.228", features = ["derive"] }
serde_yaml = "0.9.34"
thiserror = "2.0.18"
tiny_http = "0.12.0"
walkdir = "2.5.0"

[build-dependencies]
chrono = "0.4.45"
```
