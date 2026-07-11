---
title: "RawSSG"
desc: "Simple Static Site Generator  Terminal-themed blogs & docs"
author: "mroczect"
repo_url: "https://github.com/mroczect/rawssg.git"
license: "MIT"
---

# RawSSG

**Terminal-themed static site generator for blogs and project documentation.**
Written in Rust. Fast, lightweight, and ready to use without external dependencies.
---

## Why RawSSG?

- Terminal aesthetics a man page-style theme with dark/light mode, progress bar, and keyboard shortcuts.
- Markdown + YAML write content with frontmatter, let RawSSG convert it to HTML.
- Ready-to-use blog posts sorted by date, automatic RSS feed of the 10 most recent posts.
- Live reload built-in development server, auto-reloads when files change.
- No runtime dependencies the final output is pure HTML/CSS/JS, can be hosted anywhere.
- Interactive CLI create pages, configure navigation, validate content, and compile from the terminal.
- Automatic favicon generated from the site name, no additional image files required.
- Full configuration site name, description, language, base URL, author, license, all in `config.yaml`.

---

## Quick Start

### Prerequisites

- Rust toolchain (install via [rustup](https://rustup.rs)) 2024 edition.
- Cargo (comes with Rust).
- Git (optional, for version information in binaries).

### Install & Build

```bash
git clone https://github.com/mroczect/rawssg.git
cd rawssg
cargo build --release
```

### Create a New Project

```bash
./target/release/rawssg create # index page + config.yaml
./target/release/rawssg create blog # new blog post
```

### Build & View Results

```bash
./target/release/rawssg compile # results in dist/
./target/release/rawssg serve # dev server on port 3000
```

Go to `http://localhost:3000` and view your site live. As files change, the browser will reload automatically.

---

## Project Structure

```
your-project/
 config.yaml # site settings
 content/
  index.md # home page
  blog/
  hello.md # blog posts
 static/ # (optional) custom assets
 dist/ # build results (no need to edit)
```

---

## Configuration

All settings are in `config.yaml`. The _default_ values work right out of the box, but you can customize them:

```yaml
site_name: "RawSSG"
description: "Terminal-themed static site generator"
language: "en"
base_url: "http://localhost:3000"
author: "mroczect"
repo_url: "https://github.com/mroczect/rawssg"
license: "MIT"
navbar:
- label: "Home"
url: "index.html"
- label: "Blog"
url: "blog.html"
```

To change via CLI:

```bash
rawssg config set site_name "New Name"
rawssg config add-nav "GitHub" "https://github.com/..."
rawssg config check # validate all .md files
```

---

## Page Frontmatter

Every The `.md` file must have a YAML block at the beginning:

```yaml
---
title: "Page Title"
desc: "Short Description"
author: "Your Name"
date: 2026-07-11
draft: false
---
```

> Pages with `draft: true` will be ignored during the build process.

---

## Complete CLI

| Command          | Description                                  |
| ---------------- | -------------------------------------------- |
| `info`           | Version and build information.               |
| `create`         | Create a new page (index or blog).           |
| `config show`    | Show the current configuration.              |
| `config set`     | Change configuration values.                 |
| `config add-nav` | Add a navigation item.                       |
| `config check`   | Check content validity.                      |
| `compile`        | Build a static site.                         |
| `serve`          | Start a development server with live reload. |

---

## Customization

The _default_ assets (CSS, JS, HTML templates) are embedded in the binary. To change them:

- Place `styles.css` or `script.js` in the `static/` directory (prioritized).
- HTML templates (such as `index.html`) currently need to be changed in the source code (`embedded.rs`). External template support is planned.

---

## Build Variables

Use `rawssg info` unTo view:

- Build date
- Profile (`debug`/`release`)
- Target triple
- Rust version & Git commit hash
- Working directory status (clean/dirty)

---

## Contribution

Please open an issue or submit a pull request on [GitHub](https://github.com/mroczect/rawssg). Make sure:

- The code passes `cargo check` and `cargo clippy`.
- It doesn't break existing features.
- The documentation is updated if necessary.

---

## License

This project is licensed under the [MIT License](LICENSE).
