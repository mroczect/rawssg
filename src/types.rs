use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)] // <-- tambahkan Serialize
pub struct NavItem {
    pub label: String,
    pub url: String,
}

#[derive(Debug, Deserialize, Serialize)] // <-- tambahkan Serialize
pub struct GlobalConfig {
    pub navbar: Vec<NavItem>,
    pub sidebar: Vec<NavItem>,
}

#[derive(Debug, Deserialize)]
pub struct PageFrontMatter {
    pub title: String,
    pub desc: String,
    pub author: String,
    pub repo_url: String,
    pub license: String,
    pub footer: String,
}
