---
title: "Quick Start"
desc: "Create your first terminal‑themed site in under five minutes with RawSSG"
author: "mroczect"
repo_url: "https://github.com/mroczect/rawssg.git"
license: "MIT"
---

# Quick Start

This guide walks you through creating a complete static site with RawSSG — from a blank folder to a live development server.

---

## 1. Install RawSSG

If you haven't installed RawSSG yet, follow the [installation guide](installation.html). Verify the binary is available:

```bash
rawssg info
```

---

## 2. Create a New Project

Navigate to an empty folder and scaffold the project:

```bash
mkdir my-site
cd my-site

# Create the homepage and a default config.yaml
rawssg create
```

You will be prompted for the site title, description, author, etc. After completion you'll have:

```
my-site/
├── config.yaml
└── content/
    └── index.md
```

The `config.yaml` contains your site settings and a single navigation item pointing to the homepage.

---

## 3. Add a Blog Post

Create your first blog entry with:

```bash
rawssg create blog
```

Answer the prompts. RawSSG generates a slug from the title and places the file in `content/blog/`:

```
my-site/
├── config.yaml
└── content/
    ├── index.md
    └── blog/
        └── my-first-post.md
```

---

## 4. Write Some Content

Open `content/index.md` and `content/blog/my-first-post.md` in your editor. Frontmatter is at the top, followed by Markdown. For example, your blog post might look like:

```yaml
---
title: "My First Post"
desc: "A short introduction"
author: "Jane"
date: 2026-07-11
draft: false
---
# Welcome

This is my first blog post. RawSSG makes it easy to write **terminal‑themed** pages!
```

The homepage (`content/index.md`) automatically shows the five most recent blog posts when built.

---

## 5. Build the Site

Compile your Markdown into a static site:

```bash
rawssg compile
```

By default, it reads from `content/` and outputs to `dist/`. You can specify custom directories:

```bash
rawssg compile my-content my-output
```

After running, check the `dist/` folder – it contains your HTML files, CSS, JS, RSS feed, and sitemap.

---

## 6. Preview Locally

Start the built‑in development server with live reload:

```bash
rawssg serve
```

Open `http://localhost:3000` in your browser. As you edit files in `content/`, `templates/`, or `config.yaml`, the server automatically rebuilds the site and refreshes the page.

Change the port if needed:

```bash
rawssg serve 8080
```

---

## 7. Customise the Look & Navigation

- Edit `config.yaml` to add more nav links or change the theme colours (via custom CSS).
- Place your own `styles.css` or `script.js` in a `static/` folder to override the defaults.
- Use the CLI to quickly add navigation:

```bash
rawssg config add-nav "About" "about.html"
```

Then create `content/about.md` and rebuild.

---

## 8. Deploy

The `dist/` directory is a complete static website. You can upload it to any hosting provider (Netlify, Vercel, GitHub Pages, or a plain web server). No server‑side runtime is needed.

For production, remember to set the correct `base_url` in `config.yaml` before building.

---

## Next Steps

- Read the [Configuration Reference](configuration.html) for all available settings.
- Explore the [API Reference](api-reference.html) to understand every CLI command.
- Customise templates by modifying the source (`embedded.rs`) or waiting for external template support.

Happy writing!
