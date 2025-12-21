# Makefile for Save My Tabs extension
# Version: 2.1.0

# Read version from manifest.json (single source of truth)
VERSION := $(shell grep '"version"' manifest.json | sed 's/.*"version": "\(.*\)".*/\1/')
EXTENSION_NAME := save-my-tabs
BUILD_DIR := build
DIST_DIR := dist

# Directories and files to include
SOURCE_DIRS := background css icons lib options popup
SOURCE_FILES := manifest.json

# Files to exclude from packages
EXCLUDE_PATTERNS := .git* .DS_Store *.md *.txt node_modules Makefile

# Package names
CHROME_ZIP := $(EXTENSION_NAME)-chrome-$(VERSION).zip
FIREFOX_XPI := $(EXTENSION_NAME)-firefox-$(VERSION).xpi
FIREFOX_ZIP := $(EXTENSION_NAME)-firefox-$(VERSION).zip

# Default target
.PHONY: all
all: dist

# Build Chrome version
.PHONY: build-chrome
build-chrome:
	@echo "Building Chrome version $(VERSION)..."
	@mkdir -p $(BUILD_DIR)/chrome
	@for dir in $(SOURCE_DIRS); do \
		if [ -d $$dir ]; then \
			echo "  - Copying $$dir/"; \
			cp -r $$dir $(BUILD_DIR)/chrome/; \
		fi \
	done
	@echo "Creating Chrome manifest.json..."
	@if command -v jq > /dev/null 2>&1; then \
		cat manifest.json | jq 'del(.background.scripts, .browser_specific_settings) | .permissions |= map(select(. != "contextMenus"))' > $(BUILD_DIR)/chrome/manifest.json; \
		echo "  ✓ Manifest processed with jq (removed Firefox-specific settings and contextMenus)"; \
	else \
		cp manifest.json $(BUILD_DIR)/chrome/manifest.json; \
		echo "  ⚠ jq not found, using original manifest (may have warnings)"; \
	fi
	@echo "Chrome build complete: $(BUILD_DIR)/chrome/"

# Build Firefox version
.PHONY: build-firefox
build-firefox:
	@echo "Building Firefox version $(VERSION)..."
	@mkdir -p $(BUILD_DIR)/firefox
	@for dir in $(SOURCE_DIRS); do \
		if [ -d $$dir ]; then \
			echo "  - Copying $$dir/"; \
			cp -r $$dir $(BUILD_DIR)/firefox/; \
		fi \
	done
	@echo "Creating Firefox manifest.json..."
	@if command -v jq > /dev/null 2>&1; then \
		cat manifest.json | jq 'del(.background.service_worker)' > $(BUILD_DIR)/firefox/manifest.json; \
		echo "  ✓ Manifest processed with jq"; \
	else \
		cp manifest.json $(BUILD_DIR)/firefox/manifest.json; \
		echo "  ⚠ jq not found, using original manifest (may have warnings)"; \
	fi
	@echo "Firefox build complete: $(BUILD_DIR)/firefox/"

# Build both versions
.PHONY: build
build: build-chrome build-firefox

# Create Chrome distributable ZIP
.PHONY: package-chrome
package-chrome: build-chrome
	@echo "Creating Chrome package..."
	@mkdir -p $(DIST_DIR)
	@cd $(BUILD_DIR)/chrome && zip -r ../../$(DIST_DIR)/$(CHROME_ZIP) . -x $(EXCLUDE_PATTERNS)
	@echo "Chrome package created: $(DIST_DIR)/$(CHROME_ZIP)"

# Create Firefox distributable packages
.PHONY: package-firefox
package-firefox: build-firefox
	@echo "Creating Firefox packages..."
	@mkdir -p $(DIST_DIR)
	@cd $(BUILD_DIR)/firefox && zip -r ../../$(DIST_DIR)/$(FIREFOX_XPI) . -x $(EXCLUDE_PATTERNS)
	@cd $(BUILD_DIR)/firefox && zip -r ../../$(DIST_DIR)/$(FIREFOX_ZIP) . -x $(EXCLUDE_PATTERNS)
	@echo "Firefox packages created:"
	@echo "  - $(DIST_DIR)/$(FIREFOX_XPI) (for installation)"
	@echo "  - $(DIST_DIR)/$(FIREFOX_ZIP) (for AMO submission)"

# Create both Chrome and Firefox packages
.PHONY: package
package: package-chrome package-firefox

# Alias for package
.PHONY: dist
dist: package
	@echo ""
	@echo "=========================================="
	@echo "Distribution packages created!"
	@echo "Chrome:  $(DIST_DIR)/$(CHROME_ZIP)"
	@echo "Firefox: $(DIST_DIR)/$(FIREFOX_XPI)"
	@echo "         $(DIST_DIR)/$(FIREFOX_ZIP)"
	@echo "=========================================="

# Create Chrome ZIP only
.PHONY: dist-chrome
dist-chrome: package-chrome

# Create Firefox packages only
.PHONY: dist-firefox
dist-firefox: package-firefox

# XPI is an alias for Firefox package
.PHONY: xpi
xpi: package-firefox

# Clean build artifacts
.PHONY: clean
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(BUILD_DIR) $(DIST_DIR)
	@echo "Clean complete"

# Show current version
.PHONY: version
version:
	@echo "Current version: $(VERSION)"

# Validate manifest.json
.PHONY: validate
validate:
	@echo "Validating manifest.json..."
	@if command -v jq > /dev/null 2>&1; then \
		jq empty manifest.json && echo "✓ manifest.json is valid JSON"; \
	else \
		echo "⚠ jq not found, install with: brew install jq (macOS) or apt-get install jq (Linux)"; \
	fi

# Interactive version update
.PHONY: bump-version
bump-version:
	@echo "Current version: $(VERSION)"
	@read -p "Enter new version (e.g., 2.1.0): " NEW_VERSION; \
	if [ -n "$$NEW_VERSION" ]; then \
		sed -i.bak 's/"version": "$(VERSION)"/"version": "'$$NEW_VERSION'"/' manifest.json; \
		rm -f manifest.json.bak; \
		echo "Version updated from $(VERSION) to $$NEW_VERSION"; \
		echo "Don't forget to update CHANGELOG and commit changes!"; \
	else \
		echo "Version update cancelled"; \
	fi

# Install extension locally for testing (Firefox)
.PHONY: install-firefox
install-firefox: build-firefox
	@echo "Loading extension in Firefox..."
	@web-ext run --source-dir=$(BUILD_DIR)/firefox

# Help target
.PHONY: help
help:
	@echo "Save My Tabs - Build System v2.1.0"
	@echo ""
	@echo "Available targets:"
	@echo "  make dist           - Create both Chrome and Firefox packages (default)"
	@echo "  make dist-chrome    - Create Chrome ZIP package only"
	@echo "  make dist-firefox   - Create Firefox XPI and ZIP packages only"
	@echo "  make build          - Build both Chrome and Firefox versions"
	@echo "  make build-chrome   - Build Chrome version only"
	@echo "  make build-firefox  - Build Firefox version only"
	@echo "  make package        - Create all distribution packages"
	@echo "  make clean          - Remove build artifacts"
	@echo "  make version        - Show current version"
	@echo "  make validate       - Validate manifest.json syntax"
	@echo "  make bump-version   - Update version in manifest.json"
	@echo "  make install-firefox- Test extension in Firefox"
	@echo "  make help           - Show this help message"
	@echo ""
	@echo "Current version: $(VERSION)"
	@echo "Output:"
	@echo "  Chrome:  $(DIST_DIR)/$(CHROME_ZIP)"
	@echo "  Firefox: $(DIST_DIR)/$(FIREFOX_XPI) and $(DIST_DIR)/$(FIREFOX_ZIP)"