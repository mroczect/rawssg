use crate::config;
use crate::embedded;
use crate::types::{GlobalConfig, PageContext, PageFrontMatter};
use anyhow::{Context, Result};
use base64::Engine;
use chrono::{NaiveTime, TimeZone, Utc};
use pulldown_cmark::{html, Options, Parser};
use std::fs;
use std::path::Path;
use tera::{Context as TeraContext, Tera};
use walkdir::WalkDir;

pub fn compile_site(content_dir: &str, output_dir: &str) -> Result<()> {
    // 1. Bersihkan & siapkan direktori output
    if Path::new(output_dir).exists() {
        fs::remove_dir_all(output_dir)
            .with_context(|| format!("Failed to clean output directory '{}'", output_dir))?;
    }
    fs::create_dir_all(output_dir)
        .with_context(|| format!("Failed to create output directory '{}'", output_dir))?;

    // 2. Salin folder static jika ada
    if Path::new("static").exists() {
        copy_dir_all("static", output_dir)?;
    }

    // 3. Tulis file CSS & JS bawaan
    let css_dest = Path::new(output_dir).join("styles.css");
    fs::write(&css_dest, embedded::STYLES_CSS)
        .with_context(|| format!("Failed to write {}", css_dest.display()))?;
    let js_dest = Path::new(output_dir).join("script.js");
    fs::write(&js_dest, embedded::SCRIPT_JS)
        .with_context(|| format!("Failed to write {}", js_dest.display()))?;

    // 4. Muat konfigurasi global
    let global_config = config::load_config_or_default("config.yaml")?;
    let site_name = &global_config.site_name;
    let favicon_data_uri = generate_favicon_data_uri(site_name);
    let base_url = global_config
        .base_url
        .as_deref()
        .unwrap_or("http://localhost:3000");

    // 5. Siapkan Tera
    let mut tera = Tera::default();
    tera.add_raw_template("base.html", embedded::INDEX_TEMPLATE)?;
    tera.add_raw_template("rss.xml", embedded::RSS_TEMPLATE)?;
    tera.add_raw_template("sitemap.xml", embedded::SITEMAP_TEMPLATE)?;

    // 6. Kumpulkan semua halaman dari file .md
    let mut pages: Vec<PageContext> = Vec::new();
    for entry in WalkDir::new(content_dir) {
        let entry = entry?;
        let path = entry.path();

        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }

        let raw = match fs::read_to_string(path) {
            Ok(r) => r,
            Err(e) => {
                eprintln!("Warning: skipping {} ({})", path.display(), e);
                continue;
            }
        };

        let (fm, content_html) = match parse_markdown(&raw) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("Warning: skipping {} ({})", path.display(), e);
                continue;
            }
        };

        if fm.draft {
            continue;
        }

        let rel_path = path
            .strip_prefix(content_dir)
            .with_context(|| format!("Path '{}' not inside content directory", path.display()))?;
        let out_name = rel_path.with_extension("html");
        let url = out_name.to_string_lossy().to_string();
        let depth = rel_path.components().count().saturating_sub(1);

        let pub_date = fm.date.map(|d| {
            let dt = Utc.from_utc_datetime(
                &d.and_time(NaiveTime::from_hms_opt(0, 0, 0)
                    .expect("00:00:00 is a valid time")),
            );
            dt.format("%a, %d %b %Y %H:%M:%S %z").to_string()
        });

        pages.push(PageContext {
            frontmatter: fm,
            content_html,
            url: url.clone(),
            file_path: path.to_string_lossy().to_string(),
            depth,
            pub_date,
        });
    }

    // 7. Bangun daftar posting blog (owned, agar bebas memodifikasi pages nanti)
    let mut blog_posts: Vec<PageContext> = pages
        .iter()
        .filter(|p| p.url.starts_with("blog/"))
        .cloned()
        .collect();
    blog_posts.sort_by(|a, b| {
        b.frontmatter
            .date
            .cmp(&a.frontmatter.date)
            .then_with(|| a.frontmatter.title.cmp(&b.frontmatter.title))
    });

    // 8. Buat halaman indeks blog (jika ada posting & belum ada file index.md khusus)
    if !blog_posts.is_empty() && !pages.iter().any(|p| p.url == "blog/index.html") {
        let mut list_html = String::from("<ul>\n");
        for post in &blog_posts {
            list_html.push_str(&format!(
                "<li><a href=\"{}\">{}</a> — {}</li>\n",
                post.url, post.frontmatter.title, post.frontmatter.desc
            ));
        }
        list_html.push_str("</ul>");

        let blog_index = PageContext {
            frontmatter: PageFrontMatter {
                title: "Blog".into(),
                desc: "All blog posts".into(),
                author: None,
                repo_url: None,
                license: None,
                date: None,
                tags: vec![],
                draft: false,
            },
            content_html: list_html,
            url: "blog/index.html".to_string(),
            file_path: "[generated]".to_string(),
            depth: 1,
            pub_date: None,
        };
        pages.push(blog_index);
    }

    // 9. Render setiap halaman
    for page in &pages {
        let mut context = build_base_context(&global_config, page, &favicon_data_uri)?;

        // Tampilkan 5 posting terbaru di halaman utama
        if page.url == "index.html" {
            let recent: Vec<&PageContext> = blog_posts.iter().take(5).collect();
            context.insert("blog_posts", &recent);
        }

        let html = tera
            .render("base.html", &context)
            .with_context(|| format!("Failed to render template for {}", page.url))?;

        let out_path = Path::new(output_dir).join(&page.url);
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&out_path, html)
            .with_context(|| format!("Failed to write {}", out_path.display()))?;
        println!("Generated: {}", out_path.display());
    }

    // 10. RSS feed
    let mut rss_context = TeraContext::new();
    rss_context.insert("config", &global_config);
    let rss_items: Vec<&PageContext> = blog_posts.iter().take(10).collect();
    rss_context.insert("posts", &rss_items);
    rss_context.insert("base_url", &base_url);
    let rss = tera.render("rss.xml", &rss_context)?;
    fs::write(Path::new(output_dir).join("feed.xml"), rss)?;
    println!("Generated: feed.xml");

    // 11. Sitemap
    let mut sitemap_context = TeraContext::new();
    sitemap_context.insert("pages", &pages);
    sitemap_context.insert("base_url", &base_url);
    let sitemap = tera.render("sitemap.xml", &sitemap_context)?;
    fs::write(Path::new(output_dir).join("sitemap.xml"), sitemap)?;
    println!("Generated: sitemap.xml");

    println!("Site generated in '{}'", output_dir);
    Ok(())
}

fn build_base_context(
    config: &GlobalConfig,
    page: &PageContext,
    favicon_uri: &str,
) -> Result<TeraContext> {
    let mut ctx = TeraContext::new();
    ctx.insert("title", &page.frontmatter.title);
    ctx.insert("desc", &page.frontmatter.desc);

    let author = page
        .frontmatter
        .author
        .as_deref()
        .or(config.author.as_deref())
        .unwrap_or("");
    let repo_url = page
        .frontmatter
        .repo_url
        .as_deref()
        .or(config.repo_url.as_deref())
        .unwrap_or("");
    let license = page
        .frontmatter
        .license
        .as_deref()
        .or(config.license.as_deref())
        .unwrap_or("");

    ctx.insert("author", author);
    ctx.insert("repo_url", repo_url);
    ctx.insert("license", license);

    ctx.insert("content", &page.content_html);
    ctx.insert("base_path", &relative_prefix(page.depth));
    ctx.insert("favicon", &favicon_uri);
    ctx.insert("navbar", &config.navbar);
    ctx.insert("sidebar", &config.sidebar);
    ctx.insert("is_blog", &page.url.starts_with("blog/"));
    ctx.insert("site_name", &config.site_name);
    ctx.insert("description", &config.description.as_deref().unwrap_or(""));
    ctx.insert("language", &config.language.as_deref().unwrap_or("en"));
    Ok(ctx)
}

fn relative_prefix(depth: usize) -> String {
    if depth == 0 {
        "./".to_string()
    } else {
        "../".repeat(depth)
    }
}

pub fn parse_markdown(raw: &str) -> Result<(PageFrontMatter, String)> {
    let trimmed = raw.trim_start();
    if !trimmed.starts_with("---") {
        anyhow::bail!("Frontmatter not found (must start with '---')");
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
        serde_yaml::from_str(yaml_str).context("Failed to parse frontmatter YAML")?;

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

pub fn generate_favicon_data_uri(name: &str) -> String {
    let first_char = name
        .chars()
        .next()
        .unwrap_or('R')
        .to_uppercase()
        .to_string();
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

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}
