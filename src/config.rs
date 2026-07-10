use crate::compiler; // <-- tambahkan ini
use crate::types::GlobalConfig;
use anyhow::{Context, Result};
use std::fs;
use walkdir::WalkDir; // <-- ganti glob

pub fn load_config(path: &str) -> Result<GlobalConfig> {
    let yaml = fs::read_to_string(path)
        .with_context(|| format!("Gagal membaca config file '{}'", path))?;
    let config: GlobalConfig = serde_yaml::from_str(&yaml).context("Gagal parsing config.yaml")?;
    Ok(config)
}

pub fn validate_all() -> Result<()> {
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
