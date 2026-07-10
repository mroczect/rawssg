mod compiler;
mod config;
mod embedded;
mod init;
mod serve;
mod types;

use anyhow::Result;
use clap::{Parser, Subcommand};

// --- Fungsi bantuan ---
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
    println!("Build date: {}", env!("BUILD_DATE"));
    println!("Profile: {}", env!("PROFILE"));
    println!("Target: {}", env!("TARGET"));
}

// --- Struktur CLI ---
#[derive(Parser)]
#[command(name = "rawssg")]
#[command(about = "Static site generator dengan vibe terminal", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Menampilkan panduan penggunaan (manpage)
    Help,
    /// Menampilkan versi rawssg
    Version,
    /// Menampilkan metadata build
    Info,
    /// Inisialisasi proyek baru
    Init {
        #[command(subcommand)]
        template: InitTemplate,
    },
    /// Manajemen konfigurasi
    Config {
        #[command(subcommand)]
        action: ConfigAction,
    },
    /// Build situs statis
    Compile {
        /// Folder konten (default: content)
        content_dir: Option<String>,
        /// Folder output (default: dist)
        output_dir: Option<String>,
    },
    /// Jalankan server lokal dengan live-reload
    Serve {
        /// Port (default: 3000)
        port: Option<u16>,
    },
}

#[derive(Subcommand)]
enum InitTemplate {
    /// Landing page keren ala VitePress + daftar blog
    Homepage,
    /// Halaman blog minimalis
    Blog,
}

#[derive(Subcommand)]
enum ConfigAction {
    /// Validasi frontmatter dan struktur proyek
    Check,
    /// Buat config.yaml default
    Init,
    /// Tampilkan konfigurasi saat ini
    Show,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Help => print_manual(),
        Commands::Version => println!("rawssg v{}", env!("CARGO_PKG_VERSION")),
        Commands::Info => print_build_info(),
        Commands::Init { template } => match template {
            InitTemplate::Homepage => init::create_homepage_project()?,
            InitTemplate::Blog => init::create_blog_project()?,
        },
        Commands::Config { action } => match action {
            ConfigAction::Check => config::validate_all()?,
            ConfigAction::Init => config::create_default_config()?,
            ConfigAction::Show => config::show_current_config()?,
        },
        Commands::Compile {
            content_dir,
            output_dir,
        } => {
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
