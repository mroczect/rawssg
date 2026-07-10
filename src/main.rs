mod compiler;
mod config;
mod create;
mod embedded;
mod serve;
mod types;

use anyhow::Result;
use clap::{Parser, Subcommand};

fn print_manual() { /* ... tetap ... */ }
fn print_build_info() { /* ... tetap ... */ }

#[derive(Parser)]
#[command(name = "rawssg")]
#[command(about = "Static site generator dengan vibe terminal", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Help,
    Version,
    Info,
    /// Buat halaman baru secara interaktif
    Create {
        /// Jenis halaman: kosong untuk index, "blog" untuk posting blog
        kind: Option<String>,
    },
    /// Manajemen konfigurasi
    Config {
        #[command(subcommand)]
        action: ConfigAction,
    },
    /// Build situs statis
    Compile {
        content_dir: Option<String>,
        output_dir: Option<String>,
    },
    /// Jalankan server lokal
    Serve {
        port: Option<u16>,
    },
}

#[derive(Subcommand)]
enum ConfigAction {
    /// Tampilkan konfigurasi saat ini
    Show,
    /// Atur nilai konfigurasi: config set <key> <value>
    Set {
        key: String,
        value: String,
    },
    /// Tambah item navigasi: config add-nav <label> <url>
    AddNav {
        label: String,
        url: String,
    },
    /// Hapus item navigasi berdasarkan indeks: config remove-nav <index>
    RemoveNav {
        index: usize,
    },
    /// Validasi semua file markdown
    Check,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Help => print_manual(),
        Commands::Version => println!("rawssg v{}", env!("CARGO_PKG_VERSION")),
        Commands::Info => print_build_info(),
        Commands::Create { kind } => {
            match kind.as_deref() {
                Some("blog") => create::create_blog_post()?,
                _ => create::create_index_page()?,
            }
        }
        Commands::Config { action } => match action {
            ConfigAction::Show => config::show_current_config()?,
            ConfigAction::Set { key, value } => config::set_config_value(&key, &value)?,
            ConfigAction::AddNav { label, url } => config::add_nav_item(&label, &url)?,
            ConfigAction::RemoveNav { index } => config::remove_nav_item(index)?,
            ConfigAction::Check => config::validate_all()?,
        },
        Commands::Compile { content_dir, output_dir } => {
            let content = content_dir.as_deref().unwrap_or("content");
            let output = output_dir.as_deref().unwrap_or("dist");
            compiler::compile_site(content, output)?;
        }
        Commands::Serve { port } => {
            let port = port.unwrap_or(3000);
            let output_dir = "dist";
            if !std::path::Path::new(output_dir).exists() {
                compiler::compile_site("content", output_dir)?;
            }
            serve::start_server(output_dir, port)?;
        }
    }

    Ok(())
}
