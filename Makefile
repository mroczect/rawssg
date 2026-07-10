# Makefile for rawssg - Static site generator with terminal vibes
# Usage:
#   make                build release binary
#   make debug          build debug binary
#   make run            build and run with default args
#   make check          check code without building
#   make test           run tests
#   make clean          remove build artifacts
#   make install        install binary to /usr/local/bin (requires sudo)
#   make uninstall      remove installed binary
#   make fmt            format code
#   make lint           run clippy lints
#   make watch          auto-build on file changes (requires cargo-watch)
#   make help           show this help

# ---------- Configuration ----------
BINARY_NAME := rawssg
CARGO := cargo
TARGET_DIR := target
RELEASE_FLAGS := --release
DEBUG_FLAGS :=
INSTALL_DIR := /usr/local/bin

# ---------- Default target ----------
.PHONY: all
all: release

# ---------- Build targets ----------
.PHONY: debug release build
debug:
	$(CARGO) build $(DEBUG_FLAGS)

release:
	$(CARGO) build $(RELEASE_FLAGS)

build: release

# ---------- Run targets ----------
.PHONY: run run-release
run: debug
	./$(TARGET_DIR)/debug/$(BINARY_NAME) help

run-release: release
	./$(TARGET_DIR)/release/$(BINARY_NAME) help

# ---------- Code quality ----------
.PHONY: check test fmt lint
check:
	$(CARGO) check

test:
	$(CARGO) test

fmt:
	$(CARGO) fmt

lint:
	$(CARGO) clippy -- -D warnings

# ---------- Cleanup ----------
.PHONY: clean distclean
clean:
	$(CARGO) clean

distclean:
	$(CARGO) clean
	rm -rf dist content config.yaml

# ---------- Install / uninstall ----------
.PHONY: install uninstall
install: release
	@echo "Installing $(BINARY_NAME) to $(INSTALL_DIR)..."
	sudo cp "$(TARGET_DIR)/release/$(BINARY_NAME)" "$(INSTALL_DIR)/"
	@echo "Done."

uninstall:
	@echo "Removing $(BINARY_NAME) from $(INSTALL_DIR)..."
	sudo rm -f "$(INSTALL_DIR)/$(BINARY_NAME)"
	@echo "Done."

# ---------- Watch mode (auto rebuild) ----------
.PHONY: watch
watch:
	@command -v cargo-watch >/dev/null 2>&1 || { \
		echo "cargo-watch not found, installing..."; \
		cargo install cargo-watch; \
	}
	cargo watch -x check -x build

# ---------- Extended utilities ----------
# Build for a specific target (e.g., make target=x86_64-unknown-linux-gnu)
.PHONY: target
target:
	@[ "${target}" ] || ( echo "Usage: make target target=<triple>"; exit 1 )
	$(CARGO) build $(RELEASE_FLAGS) --target $(target)

# ---------- Project-specific helpers ----------
# These use "cargo run --" to execute the built binary commands.
.PHONY: init-homepage init-blog config-check config-init config-show compile serve help-rawssg

create:
	$(CARGO) run -- create

create-blog:
	$(CARGO) run -- create blog

config-check:
	$(CARGO) run -- config check

config-init:
	$(CARGO) run -- config init

config-show:
	$(CARGO) run -- config show

compile:
	$(CARGO) run -- compile

serve:
	$(CARGO) run -- serve

# Show the help from rawssg itself
help-rawssg:
	$(CARGO) run -- help

# ---------- Help ----------
.PHONY: help
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Common targets:"
	@echo "  debug          Build debug binary"
	@echo "  release        Build release binary (default)"
	@echo "  run            Run debug binary with 'help' command"
	@echo "  check          Check code (fast, no binary)"
	@echo "  test           Run tests"
	@echo "  clean          Remove build artifacts"
	@echo "  fmt            Format code"
	@echo "  lint           Run clippy"
	@echo "  watch          Auto-build on changes (needs cargo-watch)"
	@echo "  install        Install to /usr/local/bin"
	@echo "  uninstall      Remove from /usr/local/bin"
	@echo "  distclean      Clean everything including generated content"
	@echo ""
	@echo "Project tasks (via cargo run):"
	@echo "  init-homepage  Scaffold a homepage project"
	@echo "  init-blog      Scaffold a blog project"
	@echo "  config-check   Validate config and markdown"
	@echo "  config-init    Create default config.yaml"
	@echo "  config-show    Display current config"
	@echo "  compile        Build site (default content/ -> dist/)"
	@echo "  serve          Start dev server with live-reload"
	@echo "  help-rawssg    Show rawssg's own help"
	@echo ""
	@echo "Advanced:"
	@echo "  target=<triple>        Build for specific target"
	@echo ""
	@echo "Examples:"
	@echo "  make"
	@echo "  make debug run"
	@echo "  make serve"
	@echo "  make clean release"
