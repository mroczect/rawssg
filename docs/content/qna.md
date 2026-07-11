---
title: "Q&A"
desc: "Frequently asked questions about rawssg – usage, customisation, and troubleshooting"
author: "mroczect"
repo_url: "https://github.com/mroczect/rawssg.git"
license: "MIT"
---

# Questions & Answers

## General

### What is rawssg?

Rawssg is a terminal‑themed static site generator written in Rust. It converts Markdown files (with YAML frontmatter) into a complete, ready‑to‑deploy static website. It includes a built‑in development server with live reload, RSS and sitemap generation, and a command‑line interface for scaffolding and configuration.

### Why isn’t rawssg published on crates.io?

Rawssg is still in its early stages (v0.1.0). The author prefers distributing pre‑built binaries and source code via GitHub Releases until the API stabilises. You can still install it with Cargo directly from the Git repository – see the [Installation](installation.html) guide.

### Does rawssg work on Windows?

Rawssg has not been fully tested on Windows, but it contains no platform‑specific code. It should compile and run without issues. If you encounter problems, please open an issue on GitHub.

---

## Installation & Updating

### How do I install rawssg without building from source?

Pre‑built binaries for Linux and macOS are attached to every [GitHub Release](https://github.com/mroczect/rawssg/releases). You can also use the one‑line installer:

```bash
curl -fsSL https://raw.githubusercontent.com/mroczect/rawssg/master/installer.sh | bash
```

### How do I update rawssg to the latest version?

If you installed via the installer script, simply run it again – it will overwrite the existing binary. If you built from source, pull the latest changes and rebuild:

```bash
git pull
cargo build --release
```

---

## Creating Content

### How do I create a new page that is not a blog post?

Use the interactive scaffolder:

```bash
rawssg create        # homepage (index.md)
rawssg create blog   # blog post
```

For any other page (e.g., About, Contact), manually create a `.md` file in the `content/` directory with the required frontmatter:

```yaml
---
title: "About"
desc: "Learn more about this site"
---
```

Then run `rawssg compile`. The file will be rendered as `about.html`.

### Can I use subdirectories inside `content/`?

Yes. The directory structure is preserved in the output. For example, `content/guide/installation.md` becomes `guide/installation.html`.

### My new page doesn’t appear. Why?

Check the frontmatter for `draft: true`. Draft pages are skipped during compilation. Set `draft: false` or remove the field entirely.

### How are blog posts sorted?

Blog posts are sorted by the `date` field in descending order (newest first). Pages without a `date` will appear at the end.

### Is there support for tags or categories?

Not yet. The `tags` field exists in frontmatter but is currently ignored. Tag support is planned for a future release.

---

## Configuration

### How do I change the site name?

Edit `config.yaml`:

```yaml
site_name: "My Site"
```

Or use the CLI:

```bash
rawssg config set site_name "My Site"
```

### How do I add links to the navigation bar?

```bash
rawssg config add-nav "Blog" "blog.html"
```

You can also edit the `navbar` list directly in `config.yaml`.

### Can I change the port used by `rawssg serve`?

Yes. Pass the port as an argument:

```bash
rawssg serve 8080
```

### The search prompt says “$ man snapcat”. Can I change that?

The search prompt text (“$ man snapcat | grep”) is currently hard‑coded in the default template (`templates/index.html`). To change it, you must modify the template source (`embedded.rs`) and rebuild the binary. External template support is planned.

---

## Live Reload & Development

### How does live reload work?

`rawssg serve` watches `content/`, `templates/`, and `config.yaml` for changes. When a file is modified, it automatically rebuilds the site and notifies the browser through a long‑polling endpoint (`/__rawssg_reload`). No browser extensions are required.

### Changes are not reflected in the browser. What’s wrong?

- Make sure you are running `rawssg serve` (not just viewing the output folder).
- The live reload script is included in the default template. If you override `index.html`, ensure you include `<script src="{{ base_path }}script.js"></script>`.
- Hard refresh the browser (`Ctrl+Shift+R`) if the connection times out.

---

## Customisation

### How do I change the look and feel?

Rawssg uses embedded CSS (`styles.css`). You can override it by placing your own `styles.css` in the `static/` directory. The static files are copied to the output *before* the embedded defaults, so for full control you must also remove or override the embedded asset logic in `compiler.rs`.

### Can I use a custom HTML template?

Currently, the HTML template is embedded in the binary (`embedded.rs`). External template support is planned. For now, you need to modify `index.html` in the source and recompile.

### How do I change the favicon?

The favicon is automatically generated from the first letter of `site_name` and a colour derived from the name. There is no way to use a custom image file without modifying the source (`compiler.rs` – `generate_favicon_data_uri`).

---

## Deployment

### Where can I deploy my rawssg site?

The `dist/` folder contains static HTML, CSS, JS, and XML files. You can host it anywhere: GitHub Pages, Netlify, Vercel, a VPS, or even an S3 bucket.

### How do I deploy to GitHub Pages?

Build your site, set the correct `base_url`, and push the contents of `dist/` to a `gh-pages` branch (or configure your repository to serve from the `docs/` folder or a custom workflow).

Example:
```bash
rawssg compile
# then copy dist/ to your deployment branch
```

### Do I need to set `base_url` for local development?

No. The default `http://localhost:3000` is fine for local use. Change it to your production URL before deploying so that RSS and sitemap links are correct.

---

## Troubleshooting

### `rawssg: command not found`

The binary is not in your `PATH`. Add the installation directory (e.g., `/usr/local/bin`) to your `PATH` or use the full path to the binary.

### `Permission denied` when running the installer

Run the installer with `sudo`, or choose a writable directory:

```bash
bash installer.sh --dir ~/.local/bin
```

### `Error: Frontmatter not found`

Every content file must start with a frontmatter block delimited by `---`. Ensure your Markdown file begins exactly like this:

```yaml
---
title: "My Page"
desc: "A description"
---
```

### Build takes too long

Run `cargo build --release` only when you are ready to use the binary. During development, use `cargo check` for fast error feedback or `cargo run -- serve` which compiles in debug mode by default.

---

## Contributing

### How can I contribute?

Contributions are welcome! See the [GitHub repository](https://github.com/mroczect/rawssg) and the [README](https://github.com/mroczect/rawssg#contributing). Ensure your code passes `cargo fmt`, `cargo clippy`, and `cargo test` before submitting a pull request.

### Where do I report bugs or request features?

Open an issue on [GitHub Issues](https://github.com/mroczect/rawssg/issues). Please include steps to reproduce the bug or a clear description of the feature you’d like to see.

---

Still have questions? Feel free to open a discussion or issue on the repository.
