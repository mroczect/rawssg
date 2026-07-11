use anyhow::Result;
use std::fs;
use std::io::{self, Write};
use std::path::Path;

fn prompt(question: &str) -> String {
    print!("{}: ", question);
    io::stdout().flush().unwrap();
    let mut input = String::new();
    io::stdin().read_line(&mut input).unwrap();
    input.trim().to_string()
}

pub fn create_index_page() -> Result<()> {
    println!("Creating index page (homepage)...");
    let title = prompt("Title");
    let desc = prompt("Description");
    let author = prompt("Author");
    let repo_url = prompt("Repository URL");
    let license = prompt("License");
    let footer = prompt("Footer text");

    let frontmatter = format!(
        "---\ntitle: \"{}\"\ndesc: \"{}\"\nauthor: \"{}\"\nrepo_url: \"{}\"\nlicense: \"{}\"\nfooter: \"{}\"\n---\n\n# {}\n\n{}",
        title, desc, author, repo_url, license, footer, title, desc
    );

    fs::create_dir_all("content")?;
    fs::write("content/index.md", frontmatter)?;

    if !Path::new("config.yaml").exists() {
        let default_config = format!(
            "navbar:\n  - label: Home\n    url: index.html\nsidebar: []\nsite_name: \"{}\"\n",
            title
        );
        fs::write("config.yaml", default_config)?;
    } else {
        println!("config.yaml already exists, skipping creation.");
    }

    println!("Index page created at content/index.md");
    Ok(())
}

pub fn create_blog_post() -> Result<()> {
    println!("Creating new blog post...");
    let title = prompt("Title");
    let desc = prompt("Description");
    let author = prompt("Author");
    let repo_url = prompt("Repository URL");
    let license = prompt("License");
    let footer = prompt("Footer text");

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

    let blog_dir = "content/blog";
    fs::create_dir_all(blog_dir)?;

    let frontmatter = format!(
        "---\ntitle: \"{}\"\ndesc: \"{}\"\nauthor: \"{}\"\nrepo_url: \"{}\"\nlicense: \"{}\"\nfooter: \"{}\"\n---\n\n# {}\n\n{}",
        title, desc, author, repo_url, license, footer, title, desc
    );

    fs::write(
        Path::new(blog_dir).join(&(slug.clone() + ".md")),
        frontmatter,
    )?;
    println!("Blog post created at {}/{}.md", blog_dir, slug);
    Ok(())
}
