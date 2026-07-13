use anyhow::{Context, Result};
use chrono::Local;
use std::fs;
use std::io::{self, Write};
use std::path::Path;

fn escape_yaml(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

fn prompt(question: &str) -> Result<String> {
    print!("{}: ", question);
    io::stdout().flush()?;
    let mut input = String::new();
    io::stdin().read_line(&mut input)?;
    Ok(input.trim().to_string())
}

pub fn create_index_page() -> Result<()> {
    println!("Creating index page (homepage)...");

    let title = prompt("Title")?;
    if title.trim().is_empty() {
        anyhow::bail!("Title cannot be empty");
    }

    let desc = prompt("Description")?;
    let author = prompt("Author (leave empty to use config default)")?;
    let repo_url = prompt("Repository URL (leave empty to use config default)")?;
    let license = prompt("License (leave empty to use config default)")?;

    let mut fm = format!(
        "---\ntitle: \"{}\"\ndesc: \"{}\"",
        escape_yaml(&title),
        escape_yaml(&desc)
    );
    if !author.is_empty() {
        fm.push_str(&format!("\nauthor: \"{}\"", escape_yaml(&author)));
    }
    if !repo_url.is_empty() {
        fm.push_str(&format!("\nrepo_url: \"{}\"", escape_yaml(&repo_url)));
    }
    if !license.is_empty() {
        fm.push_str(&format!("\nlicense: \"{}\"", escape_yaml(&license)));
    }
    fm.push_str(&format!("\n---\n\n# {}\n\n{}", title, desc));

    fs::create_dir_all("content").context("Failed to create content directory")?;
    fs::write("content/index.md", &fm).context("Failed to write index.md")?;

    if !Path::new("config.yaml").exists() {
        let default_config = format!(
            "navbar:\n  - label: Home\n    url: index.html\nsidebar: []\nsite_name: \"{}\"\n",
            escape_yaml(&title)
        );
        fs::write("config.yaml", default_config).context("Failed to write config.yaml")?;
        println!("Default config.yaml created.");
    } else {
        println!("config.yaml already exists, skipping creation.");
    }

    println!("Index page created at content/index.md");
    Ok(())
}

pub fn create_blog_post() -> Result<()> {
    println!("Creating new blog post...");

    let title = prompt("Title")?;
    if title.trim().is_empty() {
        anyhow::bail!("Title cannot be empty");
    }

    let desc = prompt("Description")?;
    let author = prompt("Author")?;
    let repo_url = prompt("Repository URL")?;
    let license = prompt("License")?;

    let slug = title
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' {
                c
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    if slug.is_empty() {
        anyhow::bail!("Cannot generate a valid slug from the title");
    }

    let today = Local::now().date_naive().format("%Y-%m-%d").to_string();
    let blog_dir = "content/blog";
    fs::create_dir_all(blog_dir).context("Failed to create blog directory")?;

    let frontmatter = format!(
        "---\ntitle: \"{}\"\ndesc: \"{}\"\ndate: {}\nauthor: \"{}\"\nrepo_url: \"{}\"\nlicense: \"{}\"\n---\n\n# {}\n\n{}",
        escape_yaml(&title),
        escape_yaml(&desc),
        today,
        escape_yaml(&author),
        escape_yaml(&repo_url),
        escape_yaml(&license),
        title,
        desc
    );

    let file_path = Path::new(blog_dir).join(format!("{}.md", slug));
    fs::write(&file_path, &frontmatter)
        .with_context(|| format!("Failed to write {}", file_path.display()))?;

    println!("Blog post created at {}", file_path.display());
    Ok(())
}

pub fn create_page() -> Result<()> {
    println!("Creating new page...");

    let title = prompt("Title")?;
    if title.trim().is_empty() {
        anyhow::bail!("Title cannot be empty");
    }

    let desc = prompt("Description")?;
    let author = prompt("Author")?;
    let repo_url = prompt("Repository URL")?;
    let license = prompt("License")?;

    let slug = title
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' {
                c
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    if slug.is_empty() {
        anyhow::bail!("Cannot generate a valid slug from the title");
    }

    let file_path = Path::new("content").join(format!("{}.md", slug));
    if file_path.exists() {
        anyhow::bail!("File already exists: {}", file_path.display());
    }

    let frontmatter = format!(
        "---\ntitle: \"{}\"\ndesc: \"{}\"\nauthor: \"{}\"\nrepo_url: \"{}\"\nlicense: \"{}\"\n---\n\n# {}\n\n{}",
        escape_yaml(&title),
        escape_yaml(&desc),
        escape_yaml(&author),
        escape_yaml(&repo_url),
        escape_yaml(&license),
        title,
        desc
    );

    fs::write(&file_path, &frontmatter)
        .with_context(|| format!("Failed to write {}", file_path.display()))?;

    println!("Page created at {}", file_path.display());
    Ok(())
}
