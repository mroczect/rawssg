mod compiler;
mod config;
mod create;
mod embedded;
mod serve;
mod types;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::sync::LazyLock;

fn build_info_string() -> String {
    let version = option_env!("CARGO_PKG_VERSION").unwrap_or("unknown");
    let build_date = option_env!("BUILD_DATE").unwrap_or("unknown");
    let profile = option_env!("PROFILE").unwrap_or("unknown");
    let target = option_env!("TARGET").unwrap_or("unknown");
    let rust_version = option_env!("RUST_VERSION").unwrap_or("unknown");
    let git_hash = option_env!("GIT_HASH").unwrap_or("unknown");
    let git_branch = option_env!("GIT_BRANCH").unwrap_or("unknown");
    let git_dirty = option_env!("GIT_DIRTY").unwrap_or("no");

    format!(
        "rawssg v{}\n\
         Build date       : {}\n\
         Profile          : {}\n\
         Target           : {}\n\
         Rust compiler    : {}\n\
         Git commit       : {}\n\
         Git branch       : {}\n\
         Working tree     : {}",
        version,
        build_date,
        profile,
        target,
        rust_version,
        git_hash,
        git_branch,
        if git_dirty == "yes" {
            "dirty (uncommitted changes)"
        } else {
            "clean"
        }
    )
}

static VERSION_INFO: LazyLock<String> = LazyLock::new(build_info_string);

/// A static site generator with terminal aesthetics.
#[derive(Parser)]
#[command(name = "rawssg")]
#[command(version = VERSION_INFO.as_str())]
#[command(about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Display build metadata
    Info,

    /// Create a new page interactively.
    /// kind: "blog" for a blog post, "page" for a generic page, omit for index.
    Create { kind: Option<String> },

    /// Manage site configuration
    Config {
        #[command(subcommand)]
        action: ConfigAction,
    },

    /// Build the static site from markdown sources
    Compile {
        /// Source content directory (default: "content")
        content_dir: Option<String>,
        /// Output directory (default: "dist")
        output_dir: Option<String>,
    },

    /// Start a local development server
    Serve {
        /// Port to listen on (default: 3000)
        port: Option<u16>,
    },
}

#[derive(Subcommand)]
enum ConfigAction {
    /// Show the current configuration
    Show,

    /// Set a configuration value: key value
    Set {
        /// Configuration key
        key: String,
        /// Value to set
        value: String,
    },

    /// Add a navigation item: label url
    AddNav { label: String, url: String },

    /// Remove a navigation item by its index
    RemoveNav { index: usize },

    /// Add a sidebar item: label url
    AddSidebar { label: String, url: String },

    /// Remove a sidebar item by its index
    RemoveSidebar { index: usize },

    /// Validate all markdown files in the content directory
    Check,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Info => {
            println!("{}", build_info_string());
        }
        Commands::Create { kind } => match kind.as_deref() {
            Some("blog") => create::create_blog_post()?,
            Some("page") => create::create_page()?,
            _ => create::create_index_page()?,
        },
        Commands::Config { action } => match action {
            ConfigAction::Show => config::show_current_config()?,
            ConfigAction::Set { key, value } => config::set_config_value(&key, &value)?,
            ConfigAction::AddNav { label, url } => config::add_nav_item(&label, &url)?,
            ConfigAction::RemoveNav { index } => config::remove_nav_item(index)?,
            ConfigAction::AddSidebar { label, url } => config::add_sidebar_item(&label, &url)?,
            ConfigAction::RemoveSidebar { index } => config::remove_sidebar_item(index)?,
            ConfigAction::Check => config::validate_all()?,
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
                println!("Output directory not found, building site first...");
                compiler::compile_site("content", output_dir)
                    .context("Failed to build site before serving")?;
            }
            serve::start_server(output_dir, port)?;
        }
    }

    Ok(())
}
