use crate::config;
use crate::embedded;
use crate::embedded::INDEX_TEMPLATE;
use crate::types::{GlobalConfig, NavItem, PageFrontMatter};
use anyhow::{Context, Result};
use pulldown_cmark::{Options, Parser, html};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use base64::Engine;

fn relative_prefix(depth: usize) -> String {
    if depth == 0 {
        "./".to_string()
    } else {
        "../".repeat(depth)
    }
}

fn gen_navbar(items: &[NavItem], base_path: &str) -> String {
    if items.is_empty() {
        return String::new();
    }
    let mut html = String::from("<nav class=\"top-nav\"><ul>");
    for item in items {
        // Jika URL adalah absolute (http/https) atau dimulai '/', biarkan
        let url = if item.url.starts_with("http") || item.url.starts_with('/') {
            item.url.clone()
        } else {
            format!("{}{}", base_path, item.url)
        };
        html.push_str(&format!(
            "<li><a href=\"{}\">{}</a></li>",
            url, item.label
        ));
    }
    html.push_str("</ul></nav>");
    html
}

fn gen_sidebar(items: &[NavItem], base_path: &str) -> String {
    if items.is_empty() {
        return String::new();
    }
    let mut html = String::from(
        "<aside class=\"sidebar\" id=\"sidebar\">\
         <button id=\"sidebar-toggle\">☰</button><ul>",
    );
    for item in items {
        let url = if item.url.starts_with("http") || item.url.starts_with('/') {
            item.url.clone()
        } else {
            format!("{}{}", base_path, item.url)
        };
        html.push_str(&format!(
            "<li><a href=\"{}\">{}</a></li>",
            url, item.label
        ));
    }
    html.push_str("</ul></aside>");
    html
}

/// Parse Markdown + frontmatter
pub fn parse_markdown(raw: &str) -> Result<(PageFrontMatter, String)> {
    let trimmed = raw.trim_start();
    if !trimmed.starts_with("---") {
        anyhow::bail!("Frontmatter tidak ditemukan (harus diawali '---')");
    }

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

pub fn build_html(
    config: &GlobalConfig,
    fm: &PageFrontMatter,
    content_html: &str,
    base_path: &str,
    favicon_uri: &str,
    is_blog: bool,
) -> String {
    let navbar_html = if is_blog {
        String::new()
    } else {
        gen_navbar(&config.navbar, base_path)
    };
    let sidebar_html = if is_blog {
        String::new()
    } else {
        gen_sidebar(&config.sidebar, base_path)
    };

    INDEX_TEMPLATE
        .replace("{{ base_path }}", base_path)
        .replace("{{ favicon }}", &format!("<link rel=\"icon\" href=\"{}\" />", favicon_uri))
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

fn collect_md_files(content_dir: &str) -> Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    for entry in WalkDir::new(content_dir) {
        let entry = entry?;
        if entry.path().extension().unwrap_or_default() == "md" {
            files.push(entry.path().to_path_buf());
        }
    }
    Ok(files)
}

/// Buat daftar blog untuk ditampilkan di homepage
fn generate_blog_list(content_dir: &str, base_path: &str, all_md: &[PathBuf]) -> Result<String> {
    let mut posts = Vec::new();
    for path in all_md {
        // Hanya file di dalam content/blog/
        if path.starts_with(Path::new(content_dir).join("blog")) {
            let raw = fs::read_to_string(path)?;
            let (fm, _) = parse_markdown(&raw)?;
            let rel = path.strip_prefix(content_dir)?.with_extension("html");
            let url = format!("{}{}", base_path, rel.display());
            posts.push((fm.title, url));
        }
    }

    if posts.is_empty() {
        return Ok("<p>No blog posts yet.</p>".to_string());
    }

    let mut list = String::from("<ul class=\"blog-list\">");
    for (title, url) in posts {
        list.push_str(&format!("<li><a href=\"{}\">{}</a></li>", url, title));
    }
    list.push_str("</ul>");
    Ok(list)
}

pub fn compile_site(content_dir: &str, output_dir: &str) -> Result<()> {
    // 1. Bersihkan direktori output jika ada
    if Path::new(output_dir).exists() {
        fs::remove_dir_all(output_dir)?;
    }
    fs::create_dir_all(output_dir)?;

    // 2. Salin aset statis
    let css_dest = Path::new(output_dir).join("styles.css");
    fs::write(&css_dest, embedded::STYLES_CSS)?;
    let js_dest = Path::new(output_dir).join("script.js");
    fs::write(&js_dest, embedded::SCRIPT_JS)?;

    // 3. Muat konfigurasi global
    let global_config = config::load_config("config.yaml")?;
    let site_name = &global_config.site_name;
    let favicon_data_uri = generate_favicon_data_uri(site_name);

    // 4. Kumpulkan semua file markdown
    let md_files = collect_md_files(content_dir)?;
    

    // 5. Proses setiap file
    for path in &md_files {


        let raw = fs::read_to_string(path)
            .with_context(|| format!("Gagal membaca {}", path.display()))?;
        let (fm, content_html) = parse_markdown(&raw)?;

        let rel_path = path.strip_prefix(content_dir)?;
        // Hitung kedalaman: jumlah komponen direktori sebelum file
        let depth = rel_path.components().count().saturating_sub(1);
        let base_path = relative_prefix(depth);

        // Jika ini adalah index.md di root, proses blog_list
        let final_content = if rel_path == Path::new("index.md") {
            let blog_list = generate_blog_list(content_dir, &base_path, &md_files)?;
            content_html.replace("{{ blog_list }}", &blog_list)
        } else {
            content_html
        };
        let is_blog = rel_path.starts_with("blog");
        let html = build_html(&global_config, &fm, &final_content, &base_path, &favicon_data_uri, is_blog);
        let out_path = Path::new(output_dir).join(rel_path.with_extension("html"));
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&out_path, html)?;
        println!("✅ Generated: {}", out_path.display());
    }

    println!("\n🎉 Situs selesai di-generate di folder '{}'", output_dir);
    Ok(())
}

pub fn generate_favicon_data_uri(name: &str) -> String {
    let first_char = name.chars().next().unwrap_or('R').to_uppercase().to_string();
    let hue = (name.bytes().fold(0u32, |a, b| a.wrapping_add(b as u32)) % 360) as u16;
    let bg_color = format!("hsl({}, 70%, 50%)", hue);

    let svg = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\">\
            <circle cx=\"50\" cy=\"50\" r=\"45\" fill=\"{}\" />\
            <text x=\"50\" y=\"50\" text-anchor=\"middle\" dy=\".35em\" font-size=\"55\" font-weight=\"bold\" fill=\"#fff\" font-family=\"system-ui, sans-serif\">{}</text>\
        </svg>",
        bg_color, first_char
    );

    let encoded = base64::engine::general_purpose::STANDARD.encode(svg);
    format!("data:image/svg+xml;base64,{}", encoded)
}
