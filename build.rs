use std::process::Command;

fn main() {
    // Tanggal & jam build
    let now = chrono::Local::now();
    println!(
        "cargo:rustc-env=BUILD_DATE={}",
        now.format("%Y-%m-%d %H:%M:%S")
    );

    // Profil & target dari Cargo
    println!(
        "cargo:rustc-env=PROFILE={}",
        std::env::var("PROFILE").unwrap()
    );
    println!(
        "cargo:rustc-env=TARGET={}",
        std::env::var("TARGET").unwrap()
    );

    // Versi compiler Rust
    let rustc_version = Command::new("rustc")
        .arg("--version")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "unknown".into());
    println!("cargo:rustc-env=RUST_VERSION={}", rustc_version);

    // Informasi Git
    let git_hash = Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "unknown".into());
    println!("cargo:rustc-env=GIT_HASH={}", git_hash);

    let git_branch = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "unknown".into());
    println!("cargo:rustc-env=GIT_BRANCH={}", git_branch);

    let dirty = Command::new("git")
        .args(["diff-index", "--quiet", "HEAD", "--"])
        .status()
        .map(|s| !s.success())
        .unwrap_or(false);
    println!(
        "cargo:rustc-env=GIT_DIRTY={}",
        if dirty { "yes" } else { "no" }
    );

    // Rebuild hanya jika file ini atau HEAD berubah
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=.git/HEAD");
}
