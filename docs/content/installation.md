---
title: "Installation"
desc: "Complete guide to installing rawssg – pre-built binaries, installer script, or build from source"
author: "mroczect"
repo_url: "https://github.com/mroczect/rawssg.git"
license: "MIT"
---

# Installation

RawSSG is not published on **crates.io**, but you can obtain it via **GitHub Releases** (pre‑built binaries) or by **building from source** with Cargo. This guide covers every supported method.

---

## Prerequisites

- **Linux** or **macOS** (Windows may work but has not been fully tested).
- If building from source: **Rust toolchain** 2024 edition ([rustup](https://rustup.rs)).
- Optional: **Git** (for cloning the repository and including build metadata).

---

## 1. Quick Install via Installer Script

The easiest way to install RawSSG is with the provided shell script. It automatically detects your operating system, downloads the correct archive, and copies the binary to a directory in your `PATH`.

### One‑liner

```bash
curl -fsSL https://raw.githubusercontent.com/mroczect/rawssg/master/installer.sh | bash
```

The script will install `rawssg` into `/usr/local/bin` by default. You can customise the installation directory with the `--dir` option (see below).

### Review the script before running (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/mroczect/rawssg/master/installer.sh -o installer.sh
less installer.sh
bash installer.sh
```

### Script options

| Option       | Description                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| `--tag TAG`  | Install a specific release tag (e.g., `v0.1.0`, `cli-v0.1.0`). Defaults to the latest release.                      |
| `--dir PATH` | Install the binary into `PATH` (default: `/usr/local/bin`). Can also be set via environment variable `INSTALL_DIR`. |
| `--debug`    | Enable verbose output showing every step, including HTTP status codes and extracted files.                          |
| `--help`     | Print usage information.                                                                                            |

**Examples:**

```bash
# Install latest release to a custom directory
bash installer.sh --dir ~/.local/bin

# Install a specific version with debug output
bash installer.sh --tag v0.1.0 --debug
```

After the installation completes, verify it with:

```bash
rawssg info
```

---

## 2. Manual Download of Pre‑built Binaries

If you prefer not to use the installer script, you can download the binary directly from [GitHub Releases](https://github.com/mroczect/rawssg/releases). Two platform archives are provided:

| Platform                                                | Archive name                  |
| ------------------------------------------------------- | ----------------------------- |
| Linux (x86_64)                                          | `rawssg-ubuntu-latest.tar.gz` |
| macOS (Apple Silicon, also runs on Intel via Rosetta 2) | `rawssg-macos-latest.tar.gz`  |

Each archive contains a single statically‑linked executable named `rawssg`.

### Step‑by‑step (Linux example)

```bash
# Download a specific version (replace v0.1.0 with the desired tag)
curl -LO https://github.com/mroczect/rawssg/releases/download/v0.1.0/rawssg-ubuntu-latest.tar.gz

# Extract the binary
tar -xzf rawssg-ubuntu-latest.tar.gz

# Install to /usr/local/bin (requires sudo)
sudo install -m 755 rawssg /usr/local/bin/

# Verify the installation
rawssg info
```

For macOS, use the `rawssg-macos-latest.tar.gz` archive and follow the same steps.

### Verify the integrity of the download

Every release includes a `SHA256SUMS` file. You can verify the archive’s checksum with:

```bash
# Download checksums for the specific release
curl -LO https://github.com/mroczect/rawssg/releases/download/v0.1.0/SHA256SUMS

# Compare with the actual file
sha256sum -c SHA256SUMS 2>&1 | grep rawssg
```

A successful verification prints `rawssg-<platform>.tar.gz: OK`.

---

## 3. Build from Source (with Cargo)

Building from source is the best option if you want to modify the code, contribute, or run on a platform for which no pre‑built binary exists.

```bash
# Clone the repository
git clone https://github.com/mroczect/rawssg.git
cd rawssg

# Build an optimised release binary
cargo build --release

# The binary is located at target/release/rawssg
./target/release/rawssg info
```

### Using the included Makefile

A `Makefile` is provided for convenience. Run `make help` to see all targets.

| Target                  | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| `make` / `make release` | Build a release binary.                                      |
| `make debug`            | Build a debug binary (faster compile, no optimisations).     |
| `make check`            | Check the code for errors without producing a binary.        |
| `make test`             | Run the test suite.                                          |
| `make fmt`              | Format source code.                                          |
| `make lint`             | Run Clippy lints with strict warnings.                       |
| `make install`          | Build release binary and copy it to `/usr/local/bin` (sudo). |
| `make clean`            | Remove build artifacts.                                      |
| `make distclean`        | Remove build artifacts and any generated site content.       |

```bash
# Build and install in one step
sudo make install
```

---

## 4. Verify the Installation

No matter which method you used, confirm that `rawssg` is correctly installed and executable:

```bash
rawssg help
rawssg info
```

The `info` subcommand prints the version, build date, compiler version, target triple, Git commit, and whether the working tree was clean. If you see a similar output without errors, the installation is successful.

Example output:

```
rawssg v0.1.0
Build date       : 2026-07-11 15:04:05
Profile          : release
Target           : x86_64-unknown-linux-gnu
Rust compiler    : rustc 1.85.0 (4d91de4e4 2026-01-01)
Git commit       : a1b2c3d
Git branch       : master
Working tree     : clean
```

---

## Troubleshooting

### `rawssg: command not found`

- Ensure the installation directory (e.g., `/usr/local/bin`) is listed in your `PATH`.
  ```bash
  echo $PATH
  ```
  If not, add the following line to your shell configuration (`~/.bashrc`, `~/.zshrc`):
  ```bash
  export PATH="$PATH:/usr/local/bin"
  ```
  Then reload the configuration: `source ~/.bashrc` (or restart your terminal).

### `Permission denied` during installation

- If you see `Permission denied` when copying the binary, run the command with `sudo` or choose a writable directory like `~/.local/bin`.  
  Example with the installer script:
  ```bash
  bash installer.sh --dir ~/.local/bin
  ```
  Make sure `~/.local/bin` is in your `PATH`.

### Download errors or “HTTP 404”

- Check that the release tag exists on the [Releases](https://github.com/mroczect/rawssg/releases) page. If you used `--tag`, verify the spelling.
- The pre‑built archives are only generated for tags matching `v*` or `cli-v*`. Other tags will not have binaries attached.

### Build failures from source

- Make sure your Rust toolchain is up to date:
  ```bash
  rustup update
  ```
- RawSSG is a pure Rust project; no system dependencies are required. If you encounter a linker error, ensure you have a C compiler installed (`gcc` or `clang`).
- Run `cargo check` to see detailed error messages.

---

## Development / Nightly Versions

To try the latest (unreleased) features from the `master` branch:

```bash
git clone https://github.com/mroczect/rawssg.git
cd rawssg
cargo build --release
```

Or run directly without installing:

```bash
cargo run --release -- serve
```

Remember that the `master` branch may be unstable. Use at your own risk, and please report any bugs you encounter.

---

Now you are ready to start using RawSSG. Head over to the [Quick Start](quick-start.html) guide to create your first project.
