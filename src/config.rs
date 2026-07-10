use crate::compiler; // <-- tambahkan ini
use crate::types::GlobalConfig;
use anyhow::{Context, Result};
use std::fs;
use walkdir::WalkDir;
use crate::types::NavItem;

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


pub fn show_current_config() -> Result<()> {
    let config = load_config("config.yaml")?;
    println!("{}", serde_yaml::to_string(&config)?);
    Ok(())
}

pub fn save_config(config: &GlobalConfig) -> Result<()> {
    let yaml = serde_yaml::to_string(config)?;
    fs::write("config.yaml", yaml)?;
    Ok(())
}

pub fn set_config_value(key: &str, value: &str) -> Result<()> {
    let mut config = load_config("config.yaml")?;
    match key {
        "site_name" => config.site_name = value.to_string(),
        // Bisa ditambah field lain
        _ => {
            // Coba parsing navbar.0.label atau navbar.0.url
            if key.starts_with("navbar.") {
                let parts: Vec<&str> = key.split('.').collect();
                if parts.len() == 3 {
                    if let Ok(index) = parts[1].parse::<usize>() {
                        let field = parts[2];
                        if index < config.navbar.len() {
                            match field {
                                "label" => config.navbar[index].label = value.to_string(),
                                "url" => config.navbar[index].url = value.to_string(),
                                _ => anyhow::bail!("Field navbar tidak dikenal: {}", field),
                            }
                        } else {
                            anyhow::bail!("Index navbar di luar jangkauan");
                        }
                    } else {
                        anyhow::bail!("Index navbar harus angka");
                    }
                } else {
                    anyhow::bail!("Format key navbar tidak valid. Gunakan navbar.<index>.<label|url>");
                }
            } else {
                anyhow::bail!("Key tidak dikenali: {}", key);
            }
        }
    }
    save_config(&config)?;
    println!("✅ Konfigurasi diperbarui.");
    Ok(())
}

pub fn add_nav_item(label: &str, url: &str) -> Result<()> {
    let mut config = load_config("config.yaml")?;
    config.navbar.push(NavItem {
        label: label.to_string(),
        url: url.to_string(),
    });
    save_config(&config)?;
    println!("✅ Item navigasi '{}' ditambahkan.", label);
    Ok(())
}

pub fn remove_nav_item(index: usize) -> Result<()> {
    let mut config = load_config("config.yaml")?;
    if index >= config.navbar.len() {
        anyhow::bail!("Index {} di luar jangkauan (jumlah item: {})", index, config.navbar.len());
    }
    let removed = config.navbar.remove(index);
    save_config(&config)?;
    println!("✅ Item navigasi '{}' dihapus.", removed.label);
    Ok(())
}
