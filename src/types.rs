use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct NavItem {
    pub label: String,
    pub url: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GlobalConfig {
    pub navbar: Vec<NavItem>,
    pub sidebar: Vec<NavItem>,
    #[serde(default = "default_site_name")]
    pub site_name: String,
    pub description: Option<String>,
    pub language: Option<String>,
    pub base_url: Option<String>,
    pub author: Option<String>,
    pub repo_url: Option<String>,
    pub license: Option<String>,
}

fn default_site_name() -> String {
    "rawssg".to_string()
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct PageFrontMatter {
    pub title: String,
    pub desc: String,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub repo_url: Option<String>,
    #[serde(default)]
    pub license: Option<String>,
    #[serde(default)]
    pub date: Option<NaiveDate>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub draft: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct PageContext {
    pub frontmatter: PageFrontMatter,
    pub content_html: String,
    pub url: String,
    pub file_path: String,
    pub depth: usize,
    pub pub_date: Option<String>,
}
