---
title: "API Reference"
desc: "Complete reference for rawssg CLI commands, template variables, and build information"
author: "mroczect"
repo_url: "https://github.com/mroczect/rawssg.git"
license: "MIT"
---

# API Reference

This document is the authoritative reference for RawSSG’s command‑line interface (CLI) and the data available when rendering templates. It covers every subcommand, their arguments, exit codes, and the template context you can use inside `index.html`, `rss.xml`, and `sitemap.xml`.

---

## CLI Global Behaviour

The general syntax is:

```
rawssg [COMMAND] [OPTIONS]
```

- RawSSG exits with **0** on success and **non‑zero** on any error (missing files, parse failures, etc.).
- The `--help` flag can be appended to any subcommand for inline help (e.g., `rawssg compile --help`).
- The `info` command is special: it prints build metadata and exits, ignoring any other arguments.

---

## Commands

### `info`

Displays detailed build metadata. This information is embedded at compile time.

```bash
rawssg info
```

**Output example:**

```
rawssg v0.1.0
Build date       : 2026-07-11 18:31:25
Profile          : release
Target           : x86_64-unknown-linux-gnu
Rust compiler    : rustc 1.85.0 (4d91de4e4 2026-01-01)
Git commit       : a1b2c3d
Git branch       : master
Working tree     : clean
```

| Field           | Description                                                                 |
| --------------- | --------------------------------------------------------------------------- |
| `rawssg v...`   | Crate version from `Cargo.toml`.                                            |
| `Build date`    | Local date and time when the binary was compiled.                           |
| `Profile`       | `debug` or `release`.                                                       |
| `Target`        | Target triple (e.g., `x86_64-unknown-linux-gnu`).                           |
| `Rust compiler` | Full `rustc --version` output used during compilation.                      |
| `Git commit`    | Short hash of the commit the binary was built from.                         |
| `Git branch`    | Branch name.                                                                |
| `Working tree`  | `clean` if no uncommitted changes, otherwise `dirty (uncommitted changes)`. |

---

### `create`

Interactively scaffolds new pages. Prompts the user for metadata and writes the file(s) to the `content/` directory.

```bash
rawssg create [kind]
```

- If no `kind` is given, creates an **index page** (`content/index.md`) and, if `config.yaml` does not exist, a default configuration file.
- If `kind` is `blog`, creates a **blog post** inside `content/blog/` with a URL‑friendly slug derived from the title.

#### Create an Index Page

```bash
rawssg create
```

Prompts for:

- `Title` (required)
- `Description` (required)
- `Author`, `Repository URL`, `License` (optional – leave empty to use global defaults later)

After writing `content/index.md`, if no `config.yaml` exists, it creates one with the site name set to the chosen title and a single navbar entry pointing to `index.html`.

#### Create a Blog Post

```bash
rawssg create blog
```

Prompts for:

- `Title`
- `Description`
- `Author`
- `Repository URL`
- `License`
- `Footer text` (this extra field is not directly used by the generator but is stored in frontmatter)

The resulting file is placed in `content/blog/<slug>.md`. The slug is generated from the title: lowercased, non‑alphanumeric characters replaced by hyphens, and consecutive hyphens collapsed.

---

### `config`

Manages the site‑wide configuration (`config.yaml`). The subcommand requires an action.

```
rawssg config <ACTION> [OPTIONS]
```

#### `config show`

Prints the entire `config.yaml` file to stdout.

```bash
rawssg config show
```

---

#### `config set`

Updates a specific key in the configuration.

```bash
rawssg config set <KEY> <VALUE>
```

**Supported keys:**

- `site_name` – Sets the site name.
- `navbar.<index>.<field>` – Modify a navbar item’s `label` or `url`.  
  `<index>` is zero‑based. Example: `navbar.0.label`, `navbar.1.url`.

**Examples:**

```bash
rawssg config set site_name "My New Site"
rawssg config set navbar.0.url "/new-home.html"
```

Any other key will result in an error.

---

#### `config add-nav`

Adds a new item to the navbar list.

```bash
rawssg config add-nav <LABEL> <URL>
```

**Example:**

```bash
rawssg config add-nav "Docs" "/docs.html"
```

The new item is appended to the end of the navbar.

---

#### `config remove-nav`

Removes a navbar item by its zero‑based index.

```bash
rawssg config remove-nav <INDEX>
```

**Example:**

```bash
rawssg config remove-nav 0
```

If the index is out of bounds, an error is returned.

---

#### `config check`

Validates all Markdown files in the `content/` directory by attempting to parse their frontmatter and Markdown body.

```bash
rawssg config check
```

- Prints `OK: path/to/file.md` for every valid file.
- Prints an error message for any file that fails parsing.

This is useful for catching syntax errors before a full build.

---

### `compile`

Builds the complete static site.

```bash
rawssg compile [CONTENT_DIR] [OUTPUT_DIR]
```

| Argument      | Default   | Description                                                                            |
| ------------- | --------- | -------------------------------------------------------------------------------------- |
| `CONTENT_DIR` | `content` | Path to the directory containing `.md` source files.                                   |
| `OUTPUT_DIR`  | `dist`    | Path to the output directory. Existing contents will be **deleted** before generation. |

**What it does:**

1. Reads `config.yaml` (or uses defaults if absent).
2. Walks `CONTENT_DIR` and parses every `.md` file. Draft pages are skipped.
3. Generates an HTML page for each file using the embedded `index.html` Tera template.
4. Creates `feed.xml` (RSS 2.0) with the 10 most recent blog posts.
5. Creates `sitemap.xml` listing all generated pages.
6. Copies any `static/` directory into the output root (if it exists).
7. Writes `styles.css` and `script.js` from embedded defaults into the output root.

The homepage (`content/index.md`) receives a special variable `blog_posts` containing the 5 most recent blog posts (sorted by date descending).

---

### `serve`

Starts a local development server with live‑reload.

```bash
rawssg serve [PORT]
```

| Argument | Default | Description               |
| -------- | ------- | ------------------------- |
| `PORT`   | `3000`  | Port number to listen on. |

**Behaviour:**

- If the output directory (`dist`) does not exist, a full `compile` is executed first.
- Then an HTTP server starts on `0.0.0.0:PORT`.
- File watchers are set on `content/`, `templates/`, and `config.yaml`.
- On any change, the site is automatically rebuilt, and a counter is incremented.
- The included JavaScript polls `/__rawssg_reload` for that counter change and triggers a browser reload.
- Long‑polling timeout is 25 seconds.

---

## Template Variables

When RawSSG renders pages, it provides a Tera context with the following variables. These can be used inside `index.html`, `rss.xml`, and `sitemap.xml`.

### Base Template (`index.html`)

| Variable      | Type               | Description                                                                                       |
| ------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| `title`       | string             | Page title (from frontmatter).                                                                    |
| `desc`        | string             | Page description.                                                                                 |
| `author`      | string             | Page author (falls back to global config).                                                        |
| `repo_url`    | string             | Repository URL (page or global config).                                                           |
| `license`     | string             | Licence name (page or global config).                                                             |
| `content`     | string             | HTML‑rendered Markdown body.                                                                      |
| `base_path`   | string             | Relative path prefix to resolve assets (e.g., `"./"` for root pages, `"../"` for one level deep). |
| `favicon`     | string             | Inline SVG data URI of the generated favicon.                                                     |
| `navbar`      | array of `NavItem` | Navigation bar items from `config.yaml`.                                                          |
| `sidebar`     | array of `NavItem` | Sidebar items from `config.yaml`.                                                                 |
| `is_blog`     | boolean            | `true` if the page is under `blog/`.                                                              |
| `site_name`   | string             | Site name from config.                                                                            |
| `description` | string             | Site description from config.                                                                     |
| `language`    | string             | Language code from config.                                                                        |

**Additional variable on the homepage (`index.html` only):**

| Variable     | Type                   | Description                                    |
| ------------ | ---------------------- | ---------------------------------------------- |
| `blog_posts` | array of `PageContext` | The 5 most recent blog posts (sorted by date). |

Each `blog_posts` object is a `PageContext` with:

- `frontmatter` (title, desc, date, etc.)
- `content_html`
- `url`
- `file_path`
- `depth`
- `pub_date` (RFC 2822 formatted date)

### RSS Template (`rss.xml`)

| Variable   | Type                   | Description                             |
| ---------- | ---------------------- | --------------------------------------- |
| `config`   | `GlobalConfig`         | The complete site configuration object. |
| `posts`    | array of `PageContext` | Up to 10 most recent blog posts.        |
| `base_url` | string                 | The base URL from config (or default).  |

### Sitemap Template (`sitemap.xml`)

| Variable   | Type                   | Description                          |
| ---------- | ---------------------- | ------------------------------------ |
| `pages`    | array of `PageContext` | All generated pages (except drafts). |
| `base_url` | string                 | The base URL from config.            |

---

## Embedded Assets

RawSSG ships with default CSS and JavaScript embedded in the binary. They are written to the output directory as:

- `styles.css` – terminal‑themed stylesheet with light/dark mode, responsive layout, sidebar, and print styles.
- `script.js` – interactive features: search, table of contents, theme toggle, keyboard shortcuts, code copy buttons, and live‑reload integration.

You can override these by placing your own `styles.css` or `script.js` in the `static/` directory. The embedded versions are still written afterwards, so to fully replace them you would need to modify the compiler logic or rely on the static copy overwriting (currently static is copied first, then embedded files overwrite).

---

## Exit Codes

| Code | Meaning                                                          |
| ---- | ---------------------------------------------------------------- |
| 0    | Success.                                                         |
| 1    | General error (e.g., file not found, parse failure, CLI misuse). |

All errors are written to stderr before exit.

---

## Environment Variables

RawSSG does not read any environment variables at runtime. All settings come from `config.yaml` and page frontmatter. The build script (`build.rs`) uses environment variables provided by Cargo (`PROFILE`, `TARGET`) and Git to inject compile‑time metadata.

---

This reference should cover every public interface of RawSSG. For usage examples and tutorials, refer to the [Quick Start](quick-start.html) and [Installation](installation.html) guides.
