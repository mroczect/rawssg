RAWSSG
======

A terminal‑themed static site generator for blogs and project documentation,
written in Rust. RawSSG compiles Markdown files into a complete static website
with built‑in development server, live reload, and a man‑page aesthetic.

OVERVIEW
--------

RawSSG reads Markdown sources (with YAML frontmatter) from a content directory,
applies a configurable site layout, and produces a ready‑to‑deploy static site.
It includes:

- A command‑line interface for scaffolding, configuration, and building.
- A local development server with automatic rebuild on file changes.
- Embedded default templates and assets that can be overridden.
- RSS feed and sitemap generation.
- Automatic favicon generation from the site name.
- Configurable navigation and sidebar.

The generator is built around a simple philosophy: write Markdown, configure a
YAML file, and let RawSSG do the rest. The output is a fast, self‑contained
site with zero runtime dependencies.

FEATURES
--------

- **Terminal aesthetics** – default theme mimics a UNIX man page with light/dark
  mode, progress bar, and keyboard shortcuts.
- **Static site generation** – Markdown → HTML with full frontmatter support.
- **Blog support** – posts are sorted by date and rendered as lists on the
  homepage; RSS feed includes the 10 most recent posts.
- **Interactive CLI** – create pages, manage navigation, validate content, and
  build the site, all from the terminal.
- **Live reload dev server** – automatically rebuilds and notifies the browser
  when source files change.
- **Embedded assets** – default CSS, JavaScript, and HTML templates are compiled
  into the binary, so a fresh project works immediately.
- **Configurable** – site name, description, language, base URL, author,
  repository URL, licence, and navigation are all set in `config.yaml`.
- **No external runtime** – the generated site is pure HTML/CSS/JS, hostable
  anywhere.
- **Cross‑platform** – works on Linux, macOS, and Windows (untested, but no
  platform‑specific code).
- **Makefile included** – convenience targets for building, testing, and
  deploying.

GETTING STARTED
---------------

### Prerequisites

- Rust toolchain (install via [rustup](https://rustup.rs)) – edition 2024.
- Cargo (comes with Rust).
- Git (optional, for version info in the binary).

### Building from Source

```bash
git clone https://github.com/mroczect/rawssg.git
cd rawssg
cargo build --release
```

The binary will be at `target/release/rawssg` (or `rawssg.exe` on Windows).

### Makefile Targets

A `Makefile` is provided for convenience. Run `make help` for a full list.
Common targets:

| Target        | Description                                         |
| ------------- | --------------------------------------------------- |
| `debug`       | Build debug binary.                                 |
| `release`     | Build release binary (default).                     |
| `run`         | Run debug binary with `help` command.               |
| `check`       | Check code without producing a binary.              |
| `test`        | Run tests.                                          |
| `fmt`         | Format source code.                                 |
| `lint`        | Run clippy lints.                                   |
| `clean`       | Remove build artefacts.                             |
| `distclean`   | Remove build artefacts and generated content.       |
| `install`     | Install binary to `/usr/local/bin` (requires sudo). |
| `uninstall`   | Remove installed binary.                            |
| `watch`       | Auto‑build on changes (needs `cargo‑watch`).        |
| `serve`       | Start the dev server (calls `cargo run -- serve`).  |
| `compile`     | Build the site.                                     |
| `help-rawssg` | Show RawSSG’s own help.                             |

### Running the Binary

After building, you can run the binary directly:

```bash
./target/release/rawssg help
```

To create a new project interactively:

```bash
rawssg create          # scaffold an index page and config.yaml
rawssg create blog     # create a new blog post
```

Then build and serve:

```bash
rawssg compile         # build site to dist/
rawssg serve           # start dev server on port 3000
```

USAGE
-----

RawSSG is driven by subcommands. Run `rawssg help` to see all options.

### `info`

Display build metadata (version, compiler, commit hash, etc.).

```
rawssg info
```

### `create`

Interactively create a new page.

```
rawssg create                # create an index page (content/index.md)
rawssg create blog           # create a new blog post (content/blog/<slug>.md)
```

Both commands prompt for title, description, author, repository URL, and
license. The `create` (index) command also creates a default `config.yaml` if
none exists.

### `config`

Manage site configuration stored in `config.yaml`.

```
rawssg config show           # display current configuration
rawssg config set <key> <value>   # set a top-level or nested key
rawssg config add-nav <label> <url>  # add a navigation item
rawssg config remove-nav <index>    # remove a navigation item by index
rawssg config check          # validate all Markdown files in content/
```

Supported configuration keys for `set`:

- `site_name`
- `navbar.<index>.label` / `navbar.<index>.url` (e.g., `navbar.0.label`)
  Other keys are not directly settable via `set`; edit `config.yaml` manually for
  `description`, `language`, `base_url`, `author`, `repo_url`, `license`.

### `compile`

Build the static site.

```
rawssg compile [content_dir] [output_dir]
```

- `content_dir` – path to the content directory (default: `content`)
- `output_dir` – path to the output directory (default: `dist`)

The command:

1. Reads `config.yaml` (or uses defaults).
2. Walks `content_dir` for `.md` files, parses frontmatter and converts
   Markdown to HTML.
3. Renders each page using the embedded `index.html` template.
4. Generates `feed.xml` (RSS) and `sitemap.xml`.
5. Copies any `static/` directory into the output root.
6. Writes `styles.css` and `script.js` from embedded defaults.

### `serve`

Start a development server with live reload.

```
rawssg serve [port]
```

- `port` – port to listen on (default: 3000)

If the output directory (`dist`) does not exist, `serve` first runs a full
`compile`. It then watches `content/`, `templates/`, and `config.yaml` for
changes, automatically rebuilding the site. A long‑polling endpoint
(`/__rawssg_reload`) is used to notify the browser (the included JavaScript
handles this automatically when the page is open).

API REFERENCE
-------------

### Configuration File (`config.yaml`)

The site‑wide configuration is stored in YAML at the project root. All fields
are optional except `navbar` and `sidebar` when you want them. Default values
are shown below.

```yaml
navbar: [] # list of NavItem objects (label, url)
sidebar: [] # list of NavItem objects
site_name: "rawssg" # used for the <title> and RSS channel title
description: "" # meta description and RSS description
language: "en" # HTML lang attribute and RSS language
base_url: "http://localhost:3000" # used for RSS and sitemap absolute URLs
author: "" # default author for pages that don't set their own
repo_url: "" # default repository URL
license: "" # default licence name
```

**NavItem** fields:

- `label` – string displayed in the navigation.
- `url` – relative URL (e.g., `index.html` or `blog/first-post.html`).

### Page Frontmatter

Every Markdown file must begin with a YAML frontmatter block delimited by
`---`. The following fields are recognised:

| Field      | Type              | Required | Description                                                 |
| ---------- | ----------------- | -------- | ----------------------------------------------------------- |
| `title`    | string            | yes      | Page title (used in `<title>` and heading).                 |
| `desc`     | string            | yes      | Meta description and teaser text.                           |
| `author`   | string            | no       | Overrides the site‑wide author.                             |
| `repo_url` | string            | no       | Overrides the site‑wide repository URL.                     |
| `license`  | string            | no       | Overrides the site‑wide licence.                            |
| `date`     | date (YYYY‑MM‑DD) | no       | Publication date; required for blog posts to appear sorted. |
| `tags`     | list of strings   | no       | Not currently used, reserved for future features.           |
| `draft`    | boolean           | no       | If `true`, the page is excluded from the build.             |

### Generated Output

- **Page URLs** are derived from the Markdown file path relative to the content
  directory, with `.md` replaced by `.html`. Example:
  `content/blog/my-post.md` → `blog/my-post.html`.
- The **homepage** (`content/index.md`) renders as `index.html` and includes a
  list of the 5 most recent blog posts (if any).
- **RSS feed** (`feed.xml`) contains the 10 most recent blog posts.
- **Sitemap** (`sitemap.xml`) lists all generated pages with their last
  modification date (if `date` is set).
- A **favicon** is generated as an inline SVG data URI: a circle with the
  first letter of `site_name` and a hue derived from the name.
- Default **assets** (`styles.css`, `script.js`) are written to the output
  root. You can override them by placing your own `styles.css` or `script.js`
  in the `static/` directory (the static copy happens first, and then the
  embedded files overwrite if they exist; for full control, remove the embedded
  asset logic in `compiler.rs`).

### Embedded Templates

The binary includes default templates that are used when no custom template
directory is provided. They are:

| Template      | Purpose                                          |
| ------------- | ------------------------------------------------ |
| `index.html`  | Main page layout (Tera template).                |
| `rss.xml`     | RSS 2.0 feed template.                           |
| `sitemap.xml` | Sitemap XML template.                            |
| `styles.css`  | Terminal‑themed CSS (light/dark, responsive).    |
| `script.js`   | Interactive features (search, TOC, theme, etc.). |

To customise, create a `templates/` directory with your own files. The
compiler currently ignores external templates; customisation requires modifying
the source (`embedded.rs` and `compiler.rs`) or using the `static/` override
for CSS/JS. A future version may support a `--templates` flag.

PROJECT STRUCTURE
-----------------

```
rawssg/
├── Cargo.toml
├── Cargo.lock
├── build.rs                 # sets build‑time environment variables
├── Makefile
├── src/
│   ├── main.rs              # CLI definition and routing
│   ├── compiler.rs          # site compilation logic
│   ├── config.rs            # configuration loading and management
│   ├── create.rs            # interactive page scaffolding
│   ├── embedded.rs          # embeds default templates and assets
│   ├── error.rs             # (placeholder for custom error types)
│   ├── serve.rs             # development server with live reload
│   └── types.rs             # shared data structures
├── templates/
│   ├── index.html           # default page template
│   ├── styles.css           # default stylesheet
│   ├── script.js            # default client‑side JavaScript
│   ├── rss.xml              # RSS feed template
│   ├── sitemap.xml          # sitemap template
│   ├── homepage/            # example scaffold for a homepage project
│   └── blog/                # example scaffold for a blog project
├── docs/
│   ├── config.yaml          # documentation site config (example)
│   └── content/
│       └── index.md         # documentation homepage
└── snapcat.md               # (project notes)
```

BUILD VARIABLES
---------------

The build script (`build.rs`) injects compile‑time information that is
displayed by `rawssg info`:

- `BUILD_DATE` – date and time of compilation.
- `PROFILE` – build profile (`debug` or `release`).
- `TARGET` – target triple.
- `RUST_VERSION` – output of `rustc --version`.
- `GIT_HASH` – short commit hash.
- `GIT_BRANCH` – current branch name.
- `GIT_DIRTY` – “yes” if the working tree has uncommitted changes.

VERSIONING
----------

This project follows Semantic Versioning. The current version is **0.1.0**.

CONTRIBUTING
------------

Contributions are welcome. Please open an issue or submit a pull request on
GitHub. Ensure that:

- Code compiles cleanly with `cargo check` and `cargo clippy`.
- Existing functionality is not broken.
- New features are documented in this README.

Before submitting, run:

```bash
cargo fmt
cargo clippy -- -D warnings
cargo test
```
