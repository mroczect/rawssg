use anyhow::Result;
use std::fs;

pub fn create_homepage_project() -> Result<()> {
    let dirs = ["content/blog", "templates"];
    for d in &dirs {
        fs::create_dir_all(d)?;
    }

    // Buat config.yaml
    let config_yaml = include_str!("../templates/homepage/config.yml");
    fs::write("config.yaml", config_yaml)?;

    // Buat halaman depan (index.md)
    let index_md = include_str!("../templates/homepage//index.md");
    fs::write("content/index.md", index_md)?;

    // Buat contoh post blog
    let sample_post = include_str!("../templates/homepage/first-post.md");
    fs::write("content/blog/first-post.md", sample_post)?;

    println!("✅ Proyek homepage berhasil dibuat. Silakan edit konten di folder 'content/'.");
    Ok(())
}

pub fn create_blog_project() -> Result<()> {
    fs::create_dir_all("content")?;

    let config_yaml = include_str!("../templates/blog/config.yaml");
    fs::write("config.yaml", config_yaml)?;

    let sample_post = include_str!("../templates/blog/first-post.md");
    fs::write("content/first-post.md", sample_post)?;

    println!("✅ Proyek blog berhasil dibuat.");
    Ok(())
}
