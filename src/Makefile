# Save My Tabs - Makefile
# Version: 2.0.0

# Variables
EXTENSION_NAME = save-my-tabs
VERSION = 2.0.0
BUILD_DIR = build
DIST_DIR = dist
CHROME_ZIP = $(EXTENSION_NAME)-chrome-$(VERSION).zip
FIREFOX_XPI = $(EXTENSION_NAME)-firefox-$(VERSION).xpi
FIREFOX_ZIP = $(EXTENSION_NAME)-firefox-$(VERSION).zip

# Source directories and files
SRC_DIRS = background css icons lib options popup
SRC_FILES = manifest.json

# Files to exclude from the package
EXCLUDE_PATTERNS = .git* .DS_Store *.md *.txt node_modules Makefile

.PHONY: all clean build-chrome build-firefox dist-chrome dist-firefox dist help validate

# Default target - build both
all: dist

# Help target
help:
	@echo "Save My Tabs - Build System"
	@echo ""
	@echo "Available targets:"
	@echo "  make dist           - Create both Chrome and Firefox packages (default)"
	@echo "  make dist-chrome    - Create Chrome distributable ZIP package"
	@echo "  make dist-firefox   - Create Firefox distributable ZIP package"
	@echo "  make build-chrome   - Create Chrome build directory only"
	@echo "  make build-firefox  - Create Firefox build directory only"
	@echo "  make clean          - Remove build and dist directories"
	@echo "  make validate       - Validate manifest.json syntax"
	@echo "  make help           - Show this help message"
	@echo ""
	@echo "Output:"
	@echo "  Chrome:  $(DIST_DIR)/$(CHROME_ZIP)"
	@echo "  Firefox: $(DIST_DIR)/$(FIREFOX_XPI) and $(DIST_DIR)/$(FIREFOX_ZIP)"

# Build both distributions
dist: dist-chrome dist-firefox
	@echo ""
	@echo "=========================================="
	@echo "Both packages created successfully!"
	@echo "Chrome:  $(DIST_DIR)/$(CHROME_ZIP) ($(du -h $(DIST_DIR)/$(CHROME_ZIP) | cut -f1))"
	@echo "Firefox: $(DIST_DIR)/$(FIREFOX_XPI) ($(du -h $(DIST_DIR)/$(FIREFOX_XPI) | cut -f1))"
	@echo "         $(DIST_DIR)/$(FIREFOX_ZIP) ($(du -h $(DIST_DIR)/$(FIREFOX_ZIP) | cut -f1))"
	@echo "=========================================="

# Create Chrome build directory
build-chrome: clean
	@echo "Creating Chrome build directory..."
	@mkdir -p $(BUILD_DIR)/chrome
	
	@echo "Copying source files..."
	@for dir in $(SRC_DIRS); do \
		if [ -d $$dir ]; then \
			echo "  - Copying $$dir/"; \
			cp -r $$dir $(BUILD_DIR)/chrome/; \
		fi \
	done
	
	@echo "Creating Chrome manifest.json..."
	@cat manifest.json | \
		jq 'del(.background.scripts)' > $(BUILD_DIR)/chrome/manifest.json || \
		(cat manifest.json > $(BUILD_DIR)/chrome/manifest.json && \
		 echo "  ⚠ jq not found, using original manifest (may have warnings)")
	
	@echo "Chrome build directory created successfully!"

# Create Firefox build directory
build-firefox:
	@echo ""
	@echo "Creating Firefox build directory..."
	@mkdir -p $(BUILD_DIR)/firefox
	
	@echo "Copying source files..."
	@for dir in $(SRC_DIRS); do \
		if [ -d $$dir ]; then \
			echo "  - Copying $$dir/"; \
			cp -r $$dir $(BUILD_DIR)/firefox/; \
		fi \
	done
	
	@echo "Creating Firefox manifest.json..."
	@cat manifest.json | \
		jq 'del(.background.service_worker)' > $(BUILD_DIR)/firefox/manifest.json || \
		(cat manifest.json > $(BUILD_DIR)/firefox/manifest.json && \
		 echo "  ⚠ jq not found, using original manifest (may have warnings)")
	
	@echo "Firefox build directory created successfully!"

# Create Chrome distributable ZIP package
dist-chrome: build-chrome
	@echo ""
	@echo "Creating Chrome distribution package..."
	@mkdir -p $(DIST_DIR)
	
	@cd $(BUILD_DIR)/chrome && \
		zip -r ../../$(DIST_DIR)/$(CHROME_ZIP) . \
		-x $(EXCLUDE_PATTERNS)
	
	@echo "Chrome package created: $(DIST_DIR)/$(CHROME_ZIP)"

# Create Firefox distributable ZIP package
dist-firefox: build-firefox
	@echo ""
	@echo "Creating Firefox distribution packages..."
	@mkdir -p $(DIST_DIR)
	
	@cd $(BUILD_DIR)/firefox && \
		zip -r ../../$(DIST_DIR)/$(FIREFOX_XPI) . \
		-x $(EXCLUDE_PATTERNS)
	
	@cd $(BUILD_DIR)/firefox && \
		zip -r ../../$(DIST_DIR)/$(FIREFOX_ZIP) . \
		-x $(EXCLUDE_PATTERNS)
	
	@echo "Firefox packages created:"
	@echo "  - $(DIST_DIR)/$(FIREFOX_XPI) (for Firefox installation)"
	@echo "  - $(DIST_DIR)/$(FIREFOX_ZIP) (for AMO submission)"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(BUILD_DIR)
	@rm -rf $(DIST_DIR)
	@echo "Clean complete!"

# Validate manifest.json
validate:
	@echo "Validating manifest.json..."
	@if command -v jq > /dev/null; then \
		jq empty manifest.json && echo "✓ manifest.json is valid JSON"; \
	else \
		echo "⚠ jq not found, install with: brew install jq (macOS) or apt-get install jq (Linux)"; \
	fi
