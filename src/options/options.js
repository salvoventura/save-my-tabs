/******************************************************************************
  AddOn   : Save my tabs!
  Purpose : Options page script for Manifest V3
  Version : 2.0.0
            Refactored with ES6 modules and auto-save functionality
******************************************************************************/

import { StorageService } from '../lib/storage.js';
import { BrowserDetection } from '../lib/browser-detection.js';

/**
 * UI Controller for the options page
 */
const OptionsUI = {
  /**
   * Initialize browser-specific UI elements
   */
  initializeBrowserSpecific() {
    // Hide "Bookmarks Menu" option for non-Firefox browsers
    if (!BrowserDetection.isFirefox()) {
      const menuOption = document.getElementById('menu-option');
      if (menuOption) {
        menuOption.style.display = 'none';
      }
      const autosaveMenuOption = document.getElementById('autosave-menu-option');
      if (autosaveMenuOption) {
        autosaveMenuOption.style.display = 'none';
      }
    }
  },

  /**
   * Update the current location display
   */
  async updateLocationDisplay() {
    const select = document.getElementById('root-folder-select');
    const locationName = document.getElementById('current-location-name');
    
    if (select && locationName) {
      const preference = select.value;
      
      if (preference === 'custom') {
        const customFolderId = document.getElementById('custom-folder-list').value;
        if (customFolderId) {
          try {
            const folder = await browser.bookmarks.get(customFolderId);
            locationName.textContent = folder[0].title;
          } catch (error) {
            locationName.textContent = "Custom folder not selected";
          }
        } else {
          locationName.textContent = "Custom folder not selected";
        }
      } else {
        const name = BrowserDetection.getRootFolderName(preference);
        locationName.textContent = name;
      }
    }

    const autosaveSelect = document.getElementById('autosave-root-folder-select');
    const autosaveLocationName = document.getElementById('autosave-current-location-name');
    
    if (autosaveSelect && autosaveLocationName) {
      const preference = autosaveSelect.value;
      
      if (preference === 'custom') {
        const customFolderId = document.getElementById('autosave-custom-folder-list').value;
        if (customFolderId) {
          try {
            const folder = await browser.bookmarks.get(customFolderId);
            autosaveLocationName.textContent = folder[0].title;
          } catch (error) {
            autosaveLocationName.textContent = "Custom folder not selected";
          }
        } else {
          autosaveLocationName.textContent = "Custom folder not selected";
        }
      } else {
        const name = BrowserDetection.getRootFolderName(preference);
        autosaveLocationName.textContent = name;
      }
    }
  },

  /**
   * Load saved options and update UI
   */
  async loadOptions() {
    try {
      const options = await StorageService.getOptions();
      
      console.log('Loading options:', [...options]);
      
      document.getElementById("autosave-switch").checked = options.get("autosave");
      document.getElementById("autosave-options").value = options.get("interval");
      document.getElementById("autosave-overwrite").checked = options.get("overwrite");
      document.getElementById("autosave-savepinned").checked = options.get("savepinned");
      
      const rootFolder = options.get("rootfolder") || "default";
      document.getElementById("root-folder-select").value = rootFolder;
      
      const autosaveRootFolder = options.get("autosaverootfolder") || "default";
      document.getElementById("autosave-root-folder-select").value = autosaveRootFolder;
      
      document.getElementById("remember-last-folder").checked = options.get("rememberlast") !== false;
      document.getElementById("close-pinned-tabs").checked = options.get("closepinned") || false;
      document.getElementById("close-tabs-after-save-default").checked = options.get("closetabs") || false;
      document.getElementById("prefix-enabled").checked = options.get("prefixenabled") || false;
      document.getElementById("prefix-type-select").value = options.get("prefixtype") || "custom";
      document.getElementById("prefix-custom-input").value = options.get("prefixcustom") || "";
      document.getElementById("autosave-keep-limit").checked = options.get("autosavekeeplimit") || false;
      document.getElementById("autosave-keep-days").value = options.get("autosavekeepdays") || 30;
      
      console.log('Root folder setting:', rootFolder);
      console.log('Auto-save root folder setting:', autosaveRootFolder);
      
      // Load custom folder for manual save if set
      if (rootFolder === "custom") {
        await this.populateCustomFolderList();
        
        const customFolderId = options.get("customrootfolder");
        console.log('Custom folder ID from settings:', customFolderId);
        
        if (customFolderId) {
          const customFolderList = document.getElementById("custom-folder-list");
          customFolderList.value = customFolderId;
          console.log('Set custom folder list to:', customFolderId);
          
          if (customFolderList.value !== customFolderId) {
            console.error('Failed to set custom folder value. Folder may not exist in list.');
          }
        } else {
          console.warn('Custom folder selected but no ID saved');
        }
      }

      // Load custom folder for auto-save if set
      if (autosaveRootFolder === "custom") {
        await this.populateAutosaveCustomFolderList();
        
        const customAutosaveFolderId = options.get("customautosaverootfolder");
        console.log('Custom auto-save folder ID from settings:', customAutosaveFolderId);
        
        if (customAutosaveFolderId) {
          const customAutosaveFolderList = document.getElementById("autosave-custom-folder-list");
          customAutosaveFolderList.value = customAutosaveFolderId;
          console.log('Set custom auto-save folder list to:', customAutosaveFolderId);
          
          if (customAutosaveFolderList.value !== customAutosaveFolderId) {
            console.error('Failed to set custom auto-save folder value. Folder may not exist in list.');
          }
        } else {
          console.warn('Custom auto-save folder selected but no ID saved');
        }
      }
      
      this.updateControlStates();
      this.updatePrefixControlStates();
      this.updateRetentionControlStates();
      this.updateCustomFolderVisibility();
      this.updateAutosaveCustomFolderVisibility();
      await this.updateLocationDisplay();
    } catch (error) {
      console.error(`Error loading options: ${error.message}`);
      this.showStatus('Failed to load settings', 'danger');
    }
  },

  /**
   * Save current options from UI
   */
  async saveOptions() {
    try {
      const options = new Map();
      options.set('autosave', document.getElementById('autosave-switch').checked);
      options.set('interval', document.getElementById("autosave-options").value);
      options.set('overwrite', document.getElementById('autosave-overwrite').checked);
      options.set('savepinned', document.getElementById('autosave-savepinned').checked);
      options.set('rootfolder', document.getElementById('root-folder-select').value);
      options.set('customrootfolder', document.getElementById('custom-folder-list').value);
      options.set('autosaverootfolder', document.getElementById('autosave-root-folder-select').value);
      options.set('customautosaverootfolder', document.getElementById('autosave-custom-folder-list').value);
      options.set('rememberlast', document.getElementById('remember-last-folder').checked);
      options.set('closepinned', document.getElementById('close-pinned-tabs').checked);
      options.set('closetabs', document.getElementById('close-tabs-after-save-default').checked);
      options.set('prefixenabled', document.getElementById('prefix-enabled').checked);
      options.set('prefixtype', document.getElementById('prefix-type-select').value);
      options.set('prefixcustom', document.getElementById('prefix-custom-input').value);
      options.set('autosavekeeplimit', document.getElementById('autosave-keep-limit').checked);
      
      // Validate and set keep days
      let keepDays = parseInt(document.getElementById('autosave-keep-days').value);
      if (isNaN(keepDays) || keepDays < 1) {
        keepDays = 1;
      } else if (keepDays > 366) {
        keepDays = 366;
      }
      document.getElementById('autosave-keep-days').value = keepDays;
      options.set('autosavekeepdays', keepDays);
      
      // If remember last is disabled, clear the saved last folder
      if (!options.get('rememberlast')) {
        options.set('lastfolder', null);
      }

      await StorageService.saveOptions(options);
      this.showStatus('Settings saved successfully!', 'success');
      this.updateLocationDisplay();
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        this.hideStatus();
      }, 3000);
    } catch (error) {
      console.error(`Error saving options: ${error.message}`);
      this.showStatus('Failed to save settings', 'danger');
    }
  },

  /**
   * Enable/disable controls based on autosave state
   */
  updateControlStates() {
    const autosaveEnabled = document.getElementById("autosave-switch").checked;
    document.getElementById("autosave-options").disabled = !autosaveEnabled;
    document.getElementById("autosave-overwrite").disabled = !autosaveEnabled;
    document.getElementById("autosave-savepinned").disabled = !autosaveEnabled;
  },

  /**
   * Enable/disable prefix controls based on prefix enabled state
   */
  updatePrefixControlStates() {
    const prefixEnabled = document.getElementById("prefix-enabled").checked;
    const prefixType = document.getElementById("prefix-type-select").value;
    
    document.getElementById("prefix-type-select").disabled = !prefixEnabled;
    document.getElementById("prefix-custom-input").disabled = !prefixEnabled;
    
    // Show/hide custom input based on type
    const customContainer = document.getElementById("prefix-custom-input-container");
    if (prefixType === "custom") {
      customContainer.style.display = "block";
    } else {
      customContainer.style.display = "none";
    }
  },

  /**
   * Enable/disable retention controls based on retention enabled state
   */
  updateRetentionControlStates() {
    const retentionEnabled = document.getElementById("autosave-keep-limit").checked;
    document.getElementById("autosave-keep-days").disabled = !retentionEnabled;
  },

  /**
   * Show/hide custom folder picker for manual save
   */
  updateCustomFolderVisibility() {
    const rootFolderSelect = document.getElementById("root-folder-select");
    const customFolderPicker = document.getElementById("custom-folder-picker");
    
    if (rootFolderSelect.value === "custom") {
      customFolderPicker.style.display = "block";
    } else {
      customFolderPicker.style.display = "none";
    }
  },

  /**
   * Show/hide custom folder picker for auto-save
   */
  updateAutosaveCustomFolderVisibility() {
    const autosaveRootFolderSelect = document.getElementById("autosave-root-folder-select");
    const autosaveCustomFolderPicker = document.getElementById("autosave-custom-folder-picker");
    
    if (autosaveRootFolderSelect.value === "custom") {
      autosaveCustomFolderPicker.style.display = "block";
    } else {
      autosaveCustomFolderPicker.style.display = "none";
    }
  },

  /**
   * Populate custom folder list with all available bookmark folders
   */
  async populateCustomFolderList() {
    try {
      const customFolderList = document.getElementById("custom-folder-list");
      customFolderList.innerHTML = '<option value="">-- Choose a folder --</option>';
      
      const allFolders = [];
      const processNode = async (node, depth = 0) => {
        if (node.url === undefined) {
          const indent = '\u00A0\u00A0\u00A0\u00A0'.repeat(depth);
          allFolders.push({
            id: node.id,
            title: indent + node.title,
            depth: depth
          });
          
          if (node.children) {
            for (const child of node.children) {
              await processNode(child, depth + 1);
            }
          }
        }
      };
      
      const tree = await browser.bookmarks.getTree();
      for (const node of tree) {
        if (node.children) {
          for (const child of node.children) {
            await processNode(child, 0);
          }
        }
      }
      
      for (const folder of allFolders) {
        const option = new Option(folder.title, folder.id);
        customFolderList.appendChild(option);
      }
      
      console.log(`Populated ${allFolders.length} folders in custom folder list`);
    } catch (error) {
      console.error('Error populating custom folder list:', error);
    }
  },

  /**
   * Populate auto-save custom folder list with all available bookmark folders
   */
  async populateAutosaveCustomFolderList() {
    try {
      const autosaveCustomFolderList = document.getElementById("autosave-custom-folder-list");
      autosaveCustomFolderList.innerHTML = '<option value="">-- Choose a folder --</option>';
      
      const allFolders = [];
      const processNode = async (node, depth = 0) => {
        if (node.url === undefined) {
          const indent = '\u00A0\u00A0\u00A0\u00A0'.repeat(depth);
          allFolders.push({
            id: node.id,
            title: indent + node.title,
            depth: depth
          });
          
          if (node.children) {
            for (const child of node.children) {
              await processNode(child, depth + 1);
            }
          }
        }
      };
      
      const tree = await browser.bookmarks.getTree();
      for (const node of tree) {
        if (node.children) {
          for (const child of node.children) {
            await processNode(child, 0);
          }
        }
      }
      
      for (const folder of allFolders) {
        const option = new Option(folder.title, folder.id);
        autosaveCustomFolderList.appendChild(option);
      }
      
      console.log(`Populated ${allFolders.length} folders in auto-save custom folder list`);
    } catch (error) {
      console.error('Error populating auto-save custom folder list:', error);
    }
  },

  /**
   * Show status message
   */
  showStatus(message, type = 'info') {
    const statusElement = document.getElementById("status-message");
    statusElement.textContent = message;
    statusElement.className = `alert alert-${type}`;
    statusElement.classList.remove('d-none');
  },

  /**
   * Hide status message
   */
  hideStatus() {
    const statusElement = document.getElementById("status-message");
    statusElement.classList.add('d-none');
  },

  /**
   * Load and display statistics
   */
  async loadStatistics() {
    try {
      const stats = await StorageService.getStats();
      
      document.getElementById('stat-total-saves').textContent = stats.totalSaves || 0;
      document.getElementById('stat-tabs-saved').textContent = stats.tabsSaved || 0;
      document.getElementById('stat-auto-saves').textContent = stats.autoSaves || 0;
      document.getElementById('stat-folders-created').textContent = stats.foldersCreated || 0;
      
      if (stats.lastSave) {
        const lastSaveDate = new Date(stats.lastSave);
        document.getElementById('stat-last-save').textContent = lastSaveDate.toLocaleString();
      } else {
        document.getElementById('stat-last-save').textContent = 'Never';
      }
      
      if (stats.installDate) {
        const installDate = new Date(stats.installDate);
        document.getElementById('stat-install-date').textContent = installDate.toLocaleDateString();
      } else {
        document.getElementById('stat-install-date').textContent = '-';
      }
      
      console.log('Statistics loaded:', stats);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  }
};

/**
 * Event Handlers
 */
const EventHandlers = {
  onAutosaveChange() {
    OptionsUI.updateControlStates();
    OptionsUI.saveOptions();
  },

  onIntervalChange() {
    OptionsUI.saveOptions();
  },

  onOverwriteChange() {
    OptionsUI.saveOptions();
  },

  onSavePinnedChange() {
    OptionsUI.saveOptions();
  },

  async onRootFolderChange() {
    await OptionsUI.updateCustomFolderVisibility();
    if (document.getElementById('root-folder-select').value === 'custom') {
      await OptionsUI.populateCustomFolderList();
    }
    await OptionsUI.saveOptions();
  },

  onRememberLastChange() {
    OptionsUI.saveOptions();
  },

  onClosePinnedChange() {
    OptionsUI.saveOptions();
  },

  onCloseTabsDefaultChange() {
    OptionsUI.saveOptions();
  },

  async onAutosaveRootFolderChange() {
    await OptionsUI.updateAutosaveCustomFolderVisibility();
    if (document.getElementById('autosave-root-folder-select').value === 'custom') {
      await OptionsUI.populateAutosaveCustomFolderList();
    }
    await OptionsUI.saveOptions();
  },

  onPrefixEnabledChange() {
    OptionsUI.updatePrefixControlStates();
    OptionsUI.saveOptions();
  },

  onPrefixTypeChange() {
    OptionsUI.updatePrefixControlStates();
    OptionsUI.saveOptions();
  },

  onPrefixCustomChange() {
    OptionsUI.saveOptions();
  },

  onClearPrefixCustom() {
    const prefixInput = document.getElementById('prefix-custom-input');
    if (prefixInput) {
      prefixInput.value = '';
      prefixInput.focus();
      OptionsUI.saveOptions();
    }
  },

  onRetentionLimitChange() {
    OptionsUI.updateRetentionControlStates();
    OptionsUI.saveOptions();
  },

  onRetentionDaysChange() {
    OptionsUI.saveOptions();
  },

  async onCustomFolderChange() {
    const customFolderValue = document.getElementById('custom-folder-list').value;
    console.log('Custom folder changed to:', customFolderValue);
    await OptionsUI.updateLocationDisplay();
    await OptionsUI.saveOptions();
  },

  async onAutosaveCustomFolderChange() {
    const customFolderValue = document.getElementById('autosave-custom-folder-list').value;
    console.log('Auto-save custom folder changed to:', customFolderValue);
    await OptionsUI.updateLocationDisplay();
    await OptionsUI.saveOptions();
  },

  async onResetStats() {
    if (confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
      try {
        await StorageService.resetStats();
        await OptionsUI.loadStatistics();
        OptionsUI.showStatus('Statistics reset successfully', 'success');
        setTimeout(() => {
          OptionsUI.hideStatus();
        }, 3000);
      } catch (error) {
        console.error('Error resetting statistics:', error);
        OptionsUI.showStatus('Failed to reset statistics', 'danger');
      }
    }
  }
};

/**
 * Initialize options page
 */
async function initialize() {
  try {
    console.log('Options page initializing');

    OptionsUI.initializeBrowserSpecific();
    await OptionsUI.loadOptions();

    document.getElementById("autosave-switch").addEventListener('change', EventHandlers.onAutosaveChange);
    document.getElementById("autosave-options").addEventListener('change', EventHandlers.onIntervalChange);
    document.getElementById("autosave-overwrite").addEventListener('change', EventHandlers.onOverwriteChange);
    document.getElementById("autosave-savepinned").addEventListener('change', EventHandlers.onSavePinnedChange);
    document.getElementById("root-folder-select").addEventListener('change', EventHandlers.onRootFolderChange);
    document.getElementById("remember-last-folder").addEventListener('change', EventHandlers.onRememberLastChange);
    document.getElementById("close-pinned-tabs").addEventListener('change', EventHandlers.onClosePinnedChange);
    document.getElementById("close-tabs-after-save-default").addEventListener('change', EventHandlers.onCloseTabsDefaultChange);
    document.getElementById("autosave-root-folder-select").addEventListener('change', EventHandlers.onAutosaveRootFolderChange);
    document.getElementById("prefix-enabled").addEventListener('change', EventHandlers.onPrefixEnabledChange);
    document.getElementById("prefix-type-select").addEventListener('change', EventHandlers.onPrefixTypeChange);
    document.getElementById("prefix-custom-input").addEventListener('input', EventHandlers.onPrefixCustomChange);
    document.getElementById("clear-prefix-custom").addEventListener('click', EventHandlers.onClearPrefixCustom);
    document.getElementById("autosave-keep-limit").addEventListener('change', EventHandlers.onRetentionLimitChange);
    document.getElementById("autosave-keep-days").addEventListener('input', EventHandlers.onRetentionDaysChange);
    document.getElementById("custom-folder-list").addEventListener('change', EventHandlers.onCustomFolderChange);
    document.getElementById("autosave-custom-folder-list").addEventListener('change', EventHandlers.onAutosaveCustomFolderChange);
    document.getElementById("reset-stats").addEventListener('click', EventHandlers.onResetStats);

    await OptionsUI.loadStatistics();

    console.log('Options page initialized successfully');
  } catch (error) {
    console.error(`Error initializing options page: ${error.message}`);
    OptionsUI.showStatus('Failed to initialize settings page', 'danger');
  }
}

initialize();
