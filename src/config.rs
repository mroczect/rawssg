use crate::compiler;
use crate::types::{GlobalConfig, NavItem};
use anyhow::{Context, Result};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

pub fn load_config(path: &str) -> Result<GlobalConfig> {
    let yaml = fs::read_to_string(path)
        .with_context(|| format!("Failed to read config file '{}'", path))?;
    let config: GlobalConfig =
        serde_yaml::from_str(&yaml).context("Failed to parse config.yaml")?;
    Ok(config)
}

pub fn load_config_or_default(path: &str) -> Result<GlobalConfig> {
    if !Path::new(path).exists() {
        return Ok(GlobalConfig {
            navbar: Vec::new(),
            sidebar: Vec::new(),
            site_name: "rawssg".into(),
            description: None,
            language: None,
            base_url: None,
        });
    }
    load_config(path)
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
        _ => {
            if key.starts_with("navbar.") {
                let parts: Vec<&str> = key.split('.').collect();
                if parts.len() == 3 {
                    let index: usize = parts[1].parse().context("Navbar index must be a number")?;
                    let field = parts[2];
                    if index >= config.navbar.len() {
                        anyhow::bail!("Navbar index out of bounds");
                    }
                    match field {
                        "label" => config.navbar[index].label = value.to_string(),
                        "url" => config.navbar[index].url = value.to_string(),
                        _ => anyhow::bail!("Unknown navbar field: {}", field),
                    }
                } else {
                    anyhow::bail!("Invalid navbar key format. Use navbar.<index>.<label|url>");
                }
            } else {
                anyhow::bail!("Unknown configuration key: {}", key);
            }
        }
    }
    save_config(&config)?;
    println!("Configuration updated.");
    Ok(())
}

pub fn add_nav_item(label: &str, url: &str) -> Result<()> {
    let mut config = load_config("config.yaml")?;
    config.navbar.push(NavItem {
        label: label.to_string(),
        url: url.to_string(),
    });
    save_config(&config)?;
    println!("Navigation item '{}' added.", label);
    Ok(())
}

pub fn remove_nav_item(index: usize) -> Result<()> {
    let mut config = load_config("config.yaml")?;
    if index >= config.navbar.len() {
        anyhow::bail!(
            "Index {} is out of bounds (total items: {})",
            index,
            config.navbar.len()
        );
    }
    let removed = config.navbar.remove(index);
    save_config(&config)?;
    println!("Navigation item '{}' removed.", removed.label);
    Ok(())
}

pub fn validate_all() -> Result<()> {
    for entry in WalkDir::new("content") {
        let entry = entry?;
        let path = entry.path();
        if path.extension().unwrap_or_default() == "md" {
            let raw = fs::read_to_string(path)?;
            match compiler::parse_markdown(&raw) {
                Ok(_) => println!("OK: {}", path.display()),
                Err(e) => eprintln!("Error in {}: {}", path.display(), e),
            }
        }
    }
    Ok(())
}
