/******************************************************************************
 * Save My Tabs
 * File: popup/popup.js
 * 
 * Author: Salvatore Ventura <salvoventura@gmail.com>
 * Copyright 2025 Salvatore Ventura <salvoventura@gmail.com>
 * Code assisted by Claude.ai
 * 
 * Purpose: Popup script - handles main extension UI, folder selection,
 *          tab saving for current window and all windows, and user interactions
 ******************************************************************************/

import { BookmarksService } from '../lib/bookmarks.js';
import { TabsService } from '../lib/tabs.js';
import { BrowserDetection } from '../lib/browser-detection.js';
import { Utils } from '../lib/utils.js';
import { StorageService } from '../lib/storage.js';

/**
 * UI Controller for the popup
 */
const PopupUI = {
  /**
   * Generate prefix based on settings
   */
  async generatePrefix() {
    try {
      const options = await StorageService.getOptions();
      
      if (!options.get('prefixenabled')) {
        return '';
      }

      const prefixType = options.get('prefixtype');
      
      switch (prefixType) {
        case 'custom':
          return options.get('prefixcustom') || '';
        
        case 'date':
          return Utils.getCurrentDate();
        
        case 'datetime':
          const dt = Utils.getCurrentDateTime();
          return dt.replace('T', ' ').substring(0, 16); // YYYY-MM-DD HH:MM
        
        case 'windowtitle':
          try {
            const currentWindow = await browser.windows.getCurrent();
            // Use window title/name if available
            if (currentWindow.title) {
              return currentWindow.title;
            }
            // Fallback to window ID
            return `Window[${currentWindow.id}]`;
          } catch (error) {
            console.error('Error getting window name:', error);
            return 'Window[UNKNOWN]';
          }
        
        default:
          return '';
      }
    } catch (error) {
      console.error('Error generating prefix:', error);
      return '';
    }
  },

  /**
   * Populate the folder select dropdown
   */
  async populateFolderSelect() {
    try {
      const selectFolder = document.getElementById("folder-list");
      
      // Get user's root folder preference and last used folder
      const options = await StorageService.getOptions();
      const rootFolderPreference = options.get('rootfolder') || 'default';
      const customRootFolderId = options.get('customrootfolder');
      
      console.log('Root folder preference:', rootFolderPreference);
      console.log('Custom root folder ID:', customRootFolderId);
      
      const rootFolderId = BrowserDetection.getRootFolderId(rootFolderPreference, customRootFolderId);
      const lastFolderId = options.get('lastfolder');
      
      console.log('Resolved root folder ID:', rootFolderId);
      console.log('Populating folder list from root:', rootFolderId, 'preference:', rootFolderPreference);
      
      // Verify the root folder exists
      let rootFolderExists = false;
      try {
        const rootFolder = await browser.bookmarks.get(rootFolderId);
        rootFolderExists = rootFolder && rootFolder.length > 0;
        console.log('Root folder exists:', rootFolderExists, rootFolder);
      } catch (error) {
        console.error('Root folder does not exist:', error);
      }
      
      // Get folders from the selected root
      let allBookmarks;
      try {
        allBookmarks = await browser.bookmarks.getChildren(rootFolderId);
        console.log('Found', allBookmarks.length, 'items in root folder');
      } catch (error) {
        console.error('Failed to get children of root folder:', rootFolderId, error);
        // Fall back to default toolbar
        const defaultRootId = BrowserDetection.getToolbarId();
        console.log('Falling back to default toolbar:', defaultRootId);
        allBookmarks = await browser.bookmarks.getChildren(defaultRootId);
      }
      
      const folders = allBookmarks.filter(item => item.url === undefined);
      console.log('Found', folders.length, 'folders');

      // Add existing folders
      const checklist = new Set();
      for (const folder of folders) {
        const option = new Option(folder.title, folder.id, false, false);
        selectFolder.appendChild(option);
        checklist.add(folder.title);
      }

      // Add preset options
      const dateTime = Utils.getCurrentDateTime();
      const presetOptions = [
        dateTime,
        dateTime.slice(0, 10),
        'Save my tabs!'
      ];

      // Add presets that don't exist yet
      for (const folderName of presetOptions) {
        if (!checklist.has(folderName)) {
          const option = new Option(folderName, "tobecreated", false, false);
          option.classList.add("green");
          selectFolder.appendChild(option);
        }
      }

      // Select the last used folder if it exists in the list and feature is enabled
      const rememberLastEnabled = options.get('rememberlast') !== false;
      
      if (rememberLastEnabled && lastFolderId) {
        const lastFolderOption = Array.from(selectFolder.options).find(
          opt => opt.value === lastFolderId
        );
        if (lastFolderOption) {
          selectFolder.value = lastFolderId;
          console.log('Pre-selected last used folder:', lastFolderId);
          
          // Show hint that we pre-selected the last folder
          const hint = document.getElementById('last-folder-hint');
          if (hint) {
            hint.classList.remove('d-none');
          }
        }
      }
    } catch (error) {
      console.error(`Error populating folder select: ${error.message}`, error);
      this.showError('Failed to load bookmark folders');
    }
  },

  /**
   * Load default checkbox states from settings
   */
  async loadDefaultStates() {
    try {
      const options = await StorageService.getOptions();
      
      // Set checkbox default states from saved settings
      document.getElementById("close-tabs-after-save").checked = options.get('closetabs') || false;
      
      // Set prefix in folder name input if enabled
      if (options.get('prefixenabled')) {
        const prefix = await this.generatePrefix();
        if (prefix) {
          const folderInput = document.getElementById('folder-name');
          folderInput.value = prefix;
          // Position cursor at the end
          folderInput.setSelectionRange(folderInput.value.length, folderInput.value.length);
        }
      }
      
      console.log('Loaded default checkbox states from settings');
    } catch (error) {
      console.error(`Error loading default states: ${error.message}`);
    }
  },

  /**
   * Show/hide multi-window warning
   */
  async toggleMultiWindowWarning() {
    try {
      const windows = await browser.windows.getAll();
      const warningElement = document.getElementById("folder-overwrite-warning");
      const overwriteChecked = document.getElementById("folder-overwrite").checked;

      if (windows.length > 1 && overwriteChecked) {
        warningElement.classList.remove('d-none');
      } else {
        warningElement.classList.add('d-none');
      }
    } catch (error) {
      console.error(`Error toggling warning: ${error.message}`);
    }
  },

  /**
   * Get the selected or custom folder ID
   */
  async getTargetFolderId() {
    const customFolderName = document.getElementById("folder-name").value.trim();
    const folderList = document.getElementById("folder-list");

    let folderId;
    let folderName;

    if (customFolderName === "") {
      // Use selection from dropdown
      folderId = folderList.value;
      folderName = folderList.options[folderList.selectedIndex].text;
    } else {
      // Use custom folder name (already contains prefix if enabled)
      folderId = "tobecreated";
      folderName = customFolderName;
    }

    // Create folder if needed
    if (folderId === "tobecreated") {
      // Get user's root folder preference
      const options = await StorageService.getOptions();
      const rootFolderPreference = options.get('rootfolder') || 'default';
      const customRootFolderId = options.get('customrootfolder');
      const rootFolderId = BrowserDetection.getRootFolderId(rootFolderPreference, customRootFolderId);
      
      const created = await BookmarksService.create({
        parentId: rootFolderId,
        title: folderName,
        url: null
      });
      folderId = created.id;
    }

    return folderId;
  },

  /**
   * Get options from UI (user can override saved settings here)
   */
  getOptions() {
    const options = new Map();
    options.set('overwrite', document.getElementById("folder-overwrite").checked);
    options.set('savepinned', document.getElementById("folder-savepinned").checked);
    options.set('closetabs', document.getElementById("close-tabs-after-save").checked);
    return options;
  },

  /**
   * Show error message
   */
  showError(message) {
    console.error(message);
    alert(message);
  },

  /**
   * Show success message
   */
  showSuccess(message) {
    console.log(message);
  }
};

/**
 * Event Handlers
 */
const EventHandlers = {
  /**
   * Handle save button click
   */
  async onSaveClick() {
    try {
      // Disable button to prevent double-clicks
      const saveBtn = document.getElementById("btnSave");
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      // Get target folder
      const folderId = await PopupUI.getTargetFolderId();
      
      // Get options (user can override settings in the popup)
      const options = PopupUI.getOptions();
      
      // Save tabs
      await TabsService.saveToFolder(folderId, options);
      console.log('Tabs saved successfully to folder:', folderId);
      
      // Update statistics
      const allTabs = await browser.tabs.query({ currentWindow: true });
      const tabsToSave = TabsService.filterTabs(allTabs, { 
        savepinned: options.get('savepinned') 
      });
      
      await StorageService.incrementStat('totalSaves');
      await StorageService.incrementStat('tabsSaved', tabsToSave.length);
      await StorageService.incrementStat('foldersCreated');
      await StorageService.updateStats({ lastSave: new Date().toISOString() });
      
      // Remember this folder for next time (if feature is enabled)
      const settings = await StorageService.getOptions();
      const rememberLastEnabled = settings.get('rememberlast') !== false;
      
      if (rememberLastEnabled) {
        await StorageService.saveLastFolder(folderId);
        console.log('Saved last used folder:', folderId);
      }

      // Close tabs if option is checked
      const shouldCloseTabs = options.get('closetabs');
      if (shouldCloseTabs) {
        saveBtn.textContent = 'Closing tabs...';
        
        // Get the closepinned setting from storage
        const closePinnedSetting = settings.get('closepinned') || false;
        
        console.log(`Closing tabs (closePinned: ${closePinnedSetting})`);
        await TabsService.closeAllTabs(closePinnedSetting);
        console.log('Tabs closed successfully');
      }
      
      // Show success and close
      PopupUI.showSuccess('Tabs saved successfully!');
      window.close();
    } catch (error) {
      console.error(`Error saving tabs: ${error.message}`);
      PopupUI.showError('Failed to save tabs. Please try again.');
      
      // Re-enable button
      const saveBtn = document.getElementById("btnSave");
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<img src="../icons/floppy.svg" alt="Save icon" />Save My Tabs';
    }
  },

  /**
   * Handle save all windows button click
   */
  async onSaveAllClick() {
    try {
      // Disable buttons to prevent double-clicks
      const saveBtns = document.querySelectorAll('.btn-save');
      saveBtns.forEach(btn => {
        btn.disabled = true;
        btn.textContent = 'Saving...';
      });

      // Get target folder (parent folder for window subfolders)
      const parentFolderId = await PopupUI.getTargetFolderId();
      
      // Get options
      const options = PopupUI.getOptions();
      
      // Get all windows
      const windows = await browser.windows.getAll({ populate: true });
      
      console.log(`Saving tabs from ${windows.length} windows`);
      
      let totalTabsSaved = 0;
      let foldersCreated = 0;
      
      // Iterate over each window
      for (const window of windows) {
        // Generate window folder name
        const windowFolderName = window.name || `Window[${window.id}]`;
        
        // Check if subfolder already exists
        const existingSubfolders = await BookmarksService.getChildren(parentFolderId);
        let windowFolder = existingSubfolders.find(
          item => item.url === undefined && item.title === windowFolderName
        );
        
        if (windowFolder) {
          console.log(`Reusing existing folder: ${windowFolderName} (${windowFolder.id})`);
        } else {
          // Create subfolder for this window
          windowFolder = await BookmarksService.create({
            parentId: parentFolderId,
            title: windowFolderName,
            url: null
          });
          foldersCreated++;
          console.log(`Created folder for window: ${windowFolderName} (${windowFolder.id})`);
        }
        
        // Get tabs from this window
        const windowTabs = window.tabs;
        const tabsToSave = TabsService.filterTabs(windowTabs, { 
          savepinned: options.get('savepinned') 
        });
        
        // Save tabs to this window's folder
        if (tabsToSave.length > 0) {
          await TabsService.saveTabsToWindowFolder(windowFolder.id, tabsToSave, options);
          totalTabsSaved += tabsToSave.length;
          console.log(`Saved ${tabsToSave.length} tabs from window ${window.id}`);
        }
      }
      
      // Update statistics
      await StorageService.incrementStat('totalSaves');
      await StorageService.incrementStat('tabsSaved', totalTabsSaved);
      await StorageService.incrementStat('foldersCreated', foldersCreated);
      await StorageService.updateStats({ lastSave: new Date().toISOString() });
      
      // Remember parent folder for next time
      const settings = await StorageService.getOptions();
      const rememberLastEnabled = settings.get('rememberlast') !== false;
      
      if (rememberLastEnabled) {
        await StorageService.saveLastFolder(parentFolderId);
        console.log('Saved last used folder:', parentFolderId);
      }
      
      // Close tabs if option is checked (from all windows)
      const shouldCloseTabs = options.get('closetabs');
      if (shouldCloseTabs) {
        const closePinnedSetting = settings.get('closepinned') || false;
        
        // Close tabs from all windows
        for (const window of windows) {
          const tabsToClose = window.tabs.filter(tab => {
            if (tab.pinned && !closePinnedSetting) return false;
            if (TabsService.isNewTabUrl(tab.url)) return false;
            return true;
          });
          
          if (tabsToClose.length > 0) {
            // Create a new tab in this window before closing all tabs
            await browser.tabs.create({ windowId: window.id, active: true });
            
            const tabIds = tabsToClose.map(tab => tab.id);
            await browser.tabs.remove(tabIds);
            console.log(`Closed ${tabIds.length} tabs from window ${window.id}`);
          }
        }
      }
      
      console.log(`Successfully saved ${totalTabsSaved} tabs from ${windows.length} windows`);
      window.close();
    } catch (error) {
      console.error(`Error saving all windows: ${error.message}`);
      PopupUI.showError('Failed to save all windows. Please try again.');
      
      // Re-enable buttons
      document.getElementById("btnSave").disabled = false;
      document.getElementById("btnSave").innerHTML = '<img src="../icons/floppy.svg" alt="Save icon" />Save My Tabs';
      document.getElementById("btnSaveAll").disabled = false;
      document.getElementById("btnSaveAll").innerHTML = '<img src="../icons/floppy.svg" alt="Save icon" />Save All Windows';
    }
  },

  /**
   * Handle settings button click
   */
  onSettingsClick() {
    browser.runtime.openOptionsPage().then(() => {
      window.close();
    });
  },

  /**
   * Handle overwrite checkbox change
   */
  onOverwriteChange() {
    PopupUI.toggleMultiWindowWarning();
  },

  /**
   * Handle Enter key in folder name input
   */
  onFolderNameKeyPress(event) {
    // Only trigger save on Enter key
    if (event.key === 'Enter' || event.keyCode === 13) {
      event.preventDefault();
      
      // Only proceed if there's text in the input
      const folderNameInput = document.getElementById('folder-name');
      if (folderNameInput && folderNameInput.value.trim() !== '') {
        console.log('Enter pressed in folder name input, triggering save');
        EventHandlers.onSaveClick();
      }
    }
  },

  /**
   * Handle clear folder name button click
   */
  onClearFolderName() {
    const folderNameInput = document.getElementById('folder-name');
    if (folderNameInput) {
      folderNameInput.value = '';
      folderNameInput.focus();
    }
  }
};

/**
 * Initialize popup
 */
async function initialize() {
  try {
    console.log('Popup initializing');

    // Populate UI
    await PopupUI.populateFolderSelect();
    
    // Load default checkbox states from settings
    await PopupUI.loadDefaultStates();

    // Attach event listeners
    document.getElementById("btnSave").addEventListener('click', EventHandlers.onSaveClick);
    document.getElementById("btnSaveAll").addEventListener('click', EventHandlers.onSaveAllClick);
    document.getElementById("btnSettings").addEventListener('click', EventHandlers.onSettingsClick);
    document.getElementById("folder-overwrite").addEventListener('change', EventHandlers.onOverwriteChange);
    
    // Add Enter key listener to folder name input
    document.getElementById("folder-name").addEventListener('keypress', EventHandlers.onFolderNameKeyPress);
    
    // Add clear button listener
    document.getElementById("clear-folder-name").addEventListener('click', EventHandlers.onClearFolderName);

    console.log('Popup initialized successfully');
  } catch (error) {
    console.error(`Error initializing popup: ${error.message}`);
    PopupUI.showError('Failed to initialize popup');
  }
}

// Start initialization
initialize();
