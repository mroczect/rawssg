use crate::config;
use crate::embedded;
use crate::embedded::INDEX_TEMPLATE;
use crate::types::{GlobalConfig, NavItem, PageFrontMatter};
use anyhow::{Context, Result};
use pulldown_cmark::{Options, Parser, html};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

fn gen_navbar(items: &[NavItem]) -> String {
    if items.is_empty() {
        return String::new();
    }
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
    if items.is_empty() {
        return String::new();
    }
    let mut html = String::from(
        "<aside class=\"sidebar\" id=\"sidebar\">\
         <button id=\"sidebar-toggle\">☰</button><ul>",
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
    let end = without_first
        .find("\n---")
        .or_else(|| without_first.find("\r\n---"))
        .unwrap_or(without_first.len());

    let yaml_str = &without_first[..end];
    let markdown_str = without_first[end..]
        .trim_start_matches("\n---")
        .trim_start_matches("\r\n---")
        .trim();

    let fm: PageFrontMatter =
        serde_yaml::from_str(yaml_str).context("Gagal parsing frontmatter YAML")?;

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

pub fn build_html(config: &GlobalConfig, fm: &PageFrontMatter, content_html: &str) -> String {
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
