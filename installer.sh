#!/usr/bin/env bash
# -------------------------------------------------------------------
# RawSSG – Quick installer (production‑ready, no emoji, verbose mode)
# -------------------------------------------------------------------
set -euo pipefail

# ---------- Default configuration ----------
BINARY_NAME="rawssg"
GITHUB_REPOSITORY="mroczect/rawssg"   # fallback if placeholder not replaced
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
RELEASE_TAG="latest"                   # can be overridden by --tag or CI injection
DEBUG=false

# ---------- Helper functions (colour outputs, no emoji) ----------
log_info()    { printf "\033[1;34m[INFO]\033[0m  %s\n" "$*"; }
log_success() { printf "\033[1;32m[ OK ]\033[0m %s\n" "$*"; }
log_error()   { printf "\033[1;31m[ERROR]\033[0m %s\n" "$*" >&2; }
log_debug()   {
    if $DEBUG; then
        printf "\033[1;90m[DEBUG]\033[0m %s\n" "$*"
    fi
}

# ---------- Usage ----------
usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Options:
  --tag <release_tag>    Install a specific release tag (e.g. v0.1.0, cli-v0.1.0).
                         Without this flag the latest release will be fetched.
  --dir <install_dir>    Installation directory (default: /usr/local/bin).
                         Can also be set via INSTALL_DIR environment variable.
  --debug                Enable verbose debug output.
  --help                 Show this help message.

Examples:
  $0                           # install latest release to /usr/local/bin
  $0 --tag v0.1.0              # install release v0.1.0
  $0 --dir ~/.local/bin        # install to custom directory
EOF
    exit 0
}

# ---------- Parse arguments ----------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --tag)
            RELEASE_TAG="$2"
            shift 2
            ;;
        --dir)
            INSTALL_DIR="$2"
            shift 2
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        --help)
            usage
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            ;;
    esac
done

# ---------- Platform detection ----------
OS="$(uname -s)"
case "$OS" in
    Linux)  PLATFORM="ubuntu-latest" ;;
    Darwin) PLATFORM="macos-latest" ;;
    *)
        log_error "Unsupported OS: $OS. Only Linux and macOS are supported."
        exit 1
        ;;
esac

ARCHIVE="${BINARY_NAME}-${PLATFORM}.tar.gz"

# ---------- Determine download URL ----------
if $DEBUG; then
    log_debug "Release tag: $RELEASE_TAG"
    log_debug "Platform: $PLATFORM"
    log_debug "Archive name: $ARCHIVE"
fi

if [[ "$RELEASE_TAG" == "latest" ]]; then
    DOWNLOAD_URL="https://github.com/${GITHUB_REPOSITORY}/releases/latest/download/${ARCHIVE}"
    log_info "Fetching latest release: $DOWNLOAD_URL"
else
    DOWNLOAD_URL="https://github.com/${GITHUB_REPOSITORY}/releases/download/${RELEASE_TAG}/${ARCHIVE}"
    log_info "Fetching release '$RELEASE_TAG': $DOWNLOAD_URL"
fi

# ---------- Prerequisite checks ----------
for cmd in curl tar mktemp; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        log_error "'$cmd' is required but not installed. Aborting."
        exit 1
    fi
done

# ---------- Download ----------
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

log_info "Downloading archive..."
log_debug "Temp directory: $TMP_DIR"

HTTP_CODE=$(curl -fsSL -w "%{http_code}" -o "${TMP_DIR}/${ARCHIVE}" "$DOWNLOAD_URL" || true)
log_debug "HTTP status: $HTTP_CODE"

if [[ "$HTTP_CODE" != "200" ]]; then
    log_error "Failed to download (HTTP $HTTP_CODE). The release or asset may not exist."
    if [[ "$RELEASE_TAG" != "latest" ]]; then
        log_info "Attempting to fall back to latest release..."
        DOWNLOAD_URL="https://github.com/${GITHUB_REPOSITORY}/releases/latest/download/${ARCHIVE}"
        HTTP_CODE=$(curl -fsSL -w "%{http_code}" -o "${TMP_DIR}/${ARCHIVE}" "$DOWNLOAD_URL" || true)
        if [[ "$HTTP_CODE" != "200" ]]; then
            log_error "Fallback also failed (HTTP $HTTP_CODE). Please check your network or the repository."
            exit 1
        fi
        log_success "Downloaded latest release instead."
    else
        log_error "Could not download latest release either. Exiting."
        exit 1
    fi
else
    log_success "Download completed."
fi

# ---------- Extract ----------
log_info "Extracting archive..."
tar -xzf "${TMP_DIR}/${ARCHIVE}" -C "$TMP_DIR"
log_debug "Extracted files:"
$DEBUG && ls -la "$TMP_DIR"

if [[ ! -f "${TMP_DIR}/${BINARY_NAME}" ]]; then
    log_error "Binary '$BINARY_NAME' not found inside the archive."
    exit 1
fi

# ---------- Install ----------
log_info "Installing $BINARY_NAME to $INSTALL_DIR ..."
mkdir -p "$INSTALL_DIR" 2>/dev/null || true

if [[ -w "$INSTALL_DIR" ]]; then
    install -m 755 "${TMP_DIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
else
    log_info "Need superuser privileges to write to $INSTALL_DIR."
    sudo install -m 755 "${TMP_DIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
fi

# ---------- Verify ----------
if command -v "$BINARY_NAME" >/dev/null 2>&1; then
    log_success "$BINARY_NAME installed successfully!"
    echo "----------------------------------------"
    "$BINARY_NAME" info 2>&1 || true
    echo "----------------------------------------"
    log_info "Run '$BINARY_NAME help' to get started."
else
    log_error "Installation failed. Make sure '$INSTALL_DIR' is in your PATH."
    exit 1
fi
