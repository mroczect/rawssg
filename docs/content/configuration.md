---
title: "Configuration"
desc: "Complete reference for rawssg configuration – site settings, navigation, frontmatter, and CLI management"
author: "mroczect"
repo_url: "https://github.com/mroczect/rawssg.git"
license: "MIT"
---

# Configuration

RawSSG is driven by a single YAML file, **`config.yaml`**, located in the project root. This file controls site‑wide settings, navigation bars, and fallback metadata. Additionally, each Markdown page can override or extend some of these values through its own **frontmatter** block.

You can manage the configuration either by directly editing `config.yaml` or by using the built‑in CLI commands (`rawssg config …`).

---

## The `config.yaml` File

If you run `rawssg create` (to scaffold an index page), a default `config.yaml` is generated automatically. You can also create it manually. All fields are optional; missing fields fall back to sensible defaults.

### Complete Configuration Reference

| Field         | Type              | Default                   | Description                                                                                                                             |
| ------------- | ----------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `site_name`   | string            | `"rawssg"`                | The site’s name. Used as the HTML `<title>` suffix, RSS channel title, and automatically generated favicon letter.                      |
| `description` | string            | `""`                      | A short site description. Used as the meta description and RSS channel description.                                                     |
| `language`    | string            | `"en"`                    | The language code (e.g., `en`, `id`, `fr`). Sets the `lang` attribute on the `<html>` element and the RSS language field.               |
| `base_url`    | string            | `"http://localhost:3000"` | The absolute base URL of the site. Essential for RSS feed and sitemap generation. Change this to your production domain when deploying. |
| `author`      | string            | `""`                      | Default author name. Used in page meta information if a page does not specify its own `author`.                                         |
| `repo_url`    | string            | `""`                      | Default repository or source URL. Displayed in the page meta section and as a link. Pages can override this with their own `repo_url`.  |
| `license`     | string            | `""`                      | Default licence name (e.g., `"MIT"`, `"Apache-2.0"`). Used in page footer if the page does not provide its own `license`.               |
| `navbar`      | list of `NavItem` | `[]`                      | A list of navigation items shown in the top navigation bar. Each item has a `label` and a `url`.                                        |
| `sidebar`     | list of `NavItem` | `[]`                      | A list of navigation items shown in the sidebar (toggleable). Each item has a `label` and a `url`.                                      |

#### `NavItem` Object

| Field   | Type   | Description                                                                           |
| ------- | ------ | ------------------------------------------------------------------------------------- |
| `label` | string | The display text for the link (e.g., `"Home"`, `"Blog"`).                             |
| `url`   | string | The relative URL the link points to (e.g., `"index.html"`, `"blog/first-post.html"`). |

### Example `config.yaml`

```yaml
site_name: "My Awesome Docs"
description: "A terminal‑themed knowledge base"
language: "en"
base_url: "https://docs.example.com"
author: "Jane Doe"
repo_url: "https://github.com/janedoe/docs"
license: "CC BY 4.0"
navbar:
  - label: "Home"
    url: "index.html"
  - label: "Guide"
    url: "guide.html"
  - label: "Blog"
    url: "blog.html"
sidebar:
  - label: "Installation"
    url: "installation.html"
  - label: "Configuration"
    url: "configuration.html"
```

---

## Managing Configuration via CLI

RawSSG provides several subcommands to inspect and modify the configuration without editing the file by hand.

### Show the current configuration

```bash
rawssg config show
```

Prints the entire `config.yaml` content to the terminal.

### Set a configuration value

```bash
rawssg config set <key> <value>
```

Currently supported keys for `set`:

- `site_name` – updates the site name.

**Example:**

```bash
rawssg config set site_name "New Site Name"
```

#### Changing nested navigation items

You can update the `label` or `url` of an existing navigation item using a dot‑notation key:

- `navbar.<index>.label`
- `navbar.<index>.url`

`<index>` is the zero‑based position in the navbar list.

**Examples:**

```bash
# Change the first navbar item's label
rawssg config set navbar.0.label "Homepage"

# Change the second navbar item's URL
rawssg config set navbar.1.url "/about.html"
```

Other configuration fields (`description`, `language`, `base_url`, `author`, `repo_url`, `license`, and the entire `sidebar`) must be edited directly in `config.yaml` for now.

### Add a navigation item

```bash
rawssg config add-nav <label> <url>
```

Appends a new `NavItem` to the **navbar** list.

**Example:**

```bash
rawssg config add-nav "GitHub" "https://github.com/user/repo"
```

### Remove a navigation item

```bash
rawssg config remove-nav <index>
```

Removes the navbar item at the given (zero‑based) index.

**Example:**

```bash
rawssg config remove-nav 0
```

### Validate all Markdown content

```bash
rawssg config check
```

Recursively walks the `content/` directory, parses every `.md` file, and reports any frontmatter or Markdown errors. This does not modify `config.yaml`.

---

## Page Frontmatter

Every Markdown source file must start with a YAML frontmatter block delimited by `---`. The frontmatter defines metadata for that specific page and can override the site‑wide defaults.

### Supported Frontmatter Fields

| Field      | Type              | Required | Default           | Description                                                                                                                                      |
| ---------- | ----------------- | -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`    | string            | **Yes**  | –                 | The page title, used in the browser tab (`<title>`) and as the main heading (`<h1>`).                                                            |
| `desc`     | string            | **Yes**  | –                 | A short description of the page. Used as the meta description, RSS item description, and the typewriter synopsis on the page itself.             |
| `author`   | string            | No       | global `author`   | Overrides the site‑wide author for this page. Shown in the meta section.                                                                         |
| `repo_url` | string            | No       | global `repo_url` | Overrides the site‑wide repository URL for this page.                                                                                            |
| `license`  | string            | No       | global `license`  | Overrides the site‑wide licence for this page.                                                                                                   |
| `date`     | date (YYYY‑MM‑DD) | No       | –                 | Publication date. Blog posts **must** have a date to appear sorted; the most recent posts appear first. Also used as `<lastmod>` in the sitemap. |
| `tags`     | list of strings   | No       | `[]`              | Reserved for future use (currently ignored by the generator).                                                                                    |
| `draft`    | boolean           | No       | `false`           | If `true`, the page is excluded from the build entirely. Useful for works in progress.                                                           |

### Example Frontmatter

```yaml
---
title: "Getting Started"
desc: "A complete walkthrough for new users"
author: "Jane Doe"
date: 2026-07-11
draft: false
tags: ["intro", "beginner"]
---
```

### Behaviour Notes

- Pages with `draft: true` are silently skipped during compilation. They will not appear in the site, RSS feed, or sitemap.
- If a field is omitted, the global value from `config.yaml` is used (if available). If neither is set, an empty string is used.
- The homepage (`content/index.md`) is treated specially: it receives a list of the 5 most recent blog posts (if any) that can be accessed in the template as `blog_posts`. No other page receives this list automatically.

---

## Environment Variables and Overrides

Currently RawSSG does not support environment variables for configuration. All settings come from `config.yaml` or page frontmatter. For different environments (e.g., local development vs. production), you should maintain separate `config.yaml` files or use a build script to swap the `base_url` value.

---

## Best Practices

- **Keep `base_url` correct** – this value is embedded directly into the RSS feed and sitemap. If you change your domain after generating the site, the old links may break.
- **Use `rawssg config check`** before a final build to catch frontmatter typos or broken Markdown.
- **Add navigation items via CLI** when you need quick edits, but for large changes (like the whole sidebar), editing `config.yaml` directly is faster.
- **Blog post dates** are parsed in `YYYY-MM-DD` format. They must be valid; otherwise the page will fail to build.

Now that your configuration is understood, you can dive into the [Quick Start](quick-start.html) to scaffold your first project.
