/******************************************************************************
 * Save My Tabs
 * File: background/background.js
 * 
 * Author: Salvatore Ventura <salvoventura@gmail.com>
 * Copyright 2025 Salvatore Ventura <salvoventura@gmail.com>
 * Code assisted by Claude.ai and Cursor.
 * 
 * Purpose: Background service worker for Manifest V3 - handles auto-save
 *          alarms, cleanup of old auto-save folders, context menus, and
 *          extension lifecycle
 ******************************************************************************/

// Polyfill for Chrome compatibility
if (typeof browser === "undefined") {
  globalThis.browser = chrome;
}

const AUTOSAVE_ROOT_NAME = "AUTOSAVE";

/******************************************************************************
 * Date and Folder Utilities
 ******************************************************************************/

/**
 * Check if a folder name matches the date format YYYY-MM-DD
 */
function isDateFolder(folderName) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(folderName);
}

/**
 * Parse date from folder name (YYYY-MM-DD format)
 */
function parseDateFromFolder(folderName) {
  try {
    const parts = folderName.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      return new Date(year, month, day);
    }
  } catch (error) {
    console.error(`Error parsing date from folder name: ${error.message}`);
  }
  return null;
}

/**
 * Get current date in YYYY-MM-DD format
 */
function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if URL is a new tab page
 */
function isNewTabUrl(url) {
  const normalized = url.replace(/\/+$/, '').toLowerCase();
  const newTabUrls = [
    "chrome://newtab", "chrome-search://local-ntp/local-ntp.html",
    "chrome://startpage", "chrome://blank", "chrome://home",
    "edge://newtab", "brave://newtab", "opera://startpage",
    "vivaldi://newtab", "about:newtab", "about:blank", "about:home", ""
  ];
  return newTabUrls.includes(normalized);
}

/******************************************************************************
 * Browser Detection
 ******************************************************************************/

/**
 * Detect if running in Firefox
 */
async function isFirefoxBrowser() {
  try {
    await browser.bookmarks.get("toolbar_____");
    return true;
  } catch {
    return false;
  }
}

/**
 * Get root folder ID based on user preference
 */
async function getRootFolderId(preference = "default", customFolderId = null) {
  const isFirefox = await isFirefoxBrowser();
  
  if (preference === "custom" && customFolderId) {
    return customFolderId;
  }
  
  if (preference === "custom" && !customFolderId) {
    console.warn('Custom folder selected but no ID provided, using default');
    return isFirefox ? "toolbar_____" : "1";
  }
  
  if (preference === "default" || preference === "toolbar") {
    return isFirefox ? "toolbar_____" : "1";
  } else if (preference === "other") {
    return isFirefox ? "unfiled_____" : "2";
  } else if (preference === "menu" && isFirefox) {
    return "menu________";
  }
  
  return isFirefox ? "toolbar_____" : "1";
}

/******************************************************************************
 * Storage and Settings
 ******************************************************************************/

/**
 * Get saved options from storage
 */
async function getSavedOptions() {
  try {
    const saved = await browser.storage.local.get("settings");
    const options = new Map();

    if (saved.settings !== undefined) {
      options.set('autosave', saved.settings.autosave);
      options.set('interval', saved.settings.interval);
      options.set('overwrite', saved.settings.overwrite);
      options.set('savepinned', saved.settings.savepinned);
      options.set('rootfolder', saved.settings.rootfolder || 'default');
      options.set('autosaverootfolder', saved.settings.autosaverootfolder || 'default');
      options.set('customautosaverootfolder', saved.settings.customautosaverootfolder || null);
      options.set('autosavekeeplimit', saved.settings.autosavekeeplimit || false);
      options.set('autosavekeepdays', saved.settings.autosavekeepdays || 30);
    } else {
      options.set('autosave', false);
      options.set('interval', "5");
      options.set('overwrite', false);
      options.set('savepinned', false);
      options.set('rootfolder', 'default');
      options.set('autosaverootfolder', 'default');
      options.set('customautosaverootfolder', null);
      options.set('autosavekeeplimit', false);
      options.set('autosavekeepdays', 30);
    }

    return options;
  } catch (error) {
    console.error(`Error in getSavedOptions: ${error.message}`);
    throw error;
  }
}

/******************************************************************************
 * Bookmark Operations
 ******************************************************************************/

/**
 * Get folder ID by name, create if needed
 */
async function getFolderId(folderName, rootId = null) {
  try {
    let folderId = null;
    const results = await browser.bookmarks.search({ title: folderName });

    if (results.length) {
      folderId = results[0].id;
      console.log(`Found ${folderName} with id ${folderId}`);
    } else {
      console.log(`Folder ${folderName} not found`);
      if (rootId !== null) {
        console.log(`Creating ${folderName}`);
        const creation = await browser.bookmarks.create({
          parentId: rootId,
          title: folderName,
          url: null
        });
        folderId = creation.id;
      }
    }

    return folderId;
  } catch (error) {
    console.error(`Error in getFolderId: ${error.message}`);
    throw error;
  }
}

/**
 * Clean up old auto-save folders
 */
async function cleanupOldAutoSaveFolders(autoSaveRootId, keepDays) {
  try {
    console.log(`Cleaning up auto-save folders older than ${keepDays} days`);

    const folders = await browser.bookmarks.getChildren(autoSaveRootId);
    
    const dateFolders = folders.filter(folder => 
      folder.url === undefined && isDateFolder(folder.title)
    );

    if (dateFolders.length === 0) {
      console.log('No date folders found to clean up');
      return;
    }

    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);
    console.log(`Cutoff date: ${cutoffDate.toISOString().split('T')[0]}`);

    const foldersToDelete = [];
    for (const folder of dateFolders) {
      const folderDate = parseDateFromFolder(folder.title);
      if (folderDate && folderDate < cutoffDate) {
        foldersToDelete.push(folder);
      }
    }

    for (const folder of foldersToDelete) {
      console.log(`Deleting old auto-save folder: ${folder.title} (${folder.id})`);
      await browser.bookmarks.removeTree(folder.id);
    }

    if (foldersToDelete.length > 0) {
      console.log(`Deleted ${foldersToDelete.length} old auto-save folder(s)`);
    } else {
      console.log('No old folders to delete');
    }
  } catch (error) {
    console.error(`Error cleaning up old auto-save folders: ${error.message}`);
  }
}

/**
 * Filter tabs based on settings (ignore pinned when disabled, and new tab URLs).
 */
function filterSavableTabs(tabs, options) {
  const savepinned = options.get('savepinned') || false;
  return tabs.filter(tab => {
    if (tab.pinned && !savepinned) return false;
    if (isNewTabUrl(tab.url)) return false;
    return true;
  });
}

/**
 * Upsert bookmarks for a set of tabs into a folder, honoring overwrite.
 */
async function upsertBookmarks(folderId, tabsToSave, overwrite) {
  const savedBookmarks = await browser.bookmarks.getChildren(folderId);
  const existingBookmarks = new Map();

  for (const bookmark of savedBookmarks) {
    existingBookmarks.set(bookmark.url, bookmark.title);
  }

  if (!overwrite) {
    for (const tab of tabsToSave) {
      if (!existingBookmarks.has(tab.url)) {
        await browser.bookmarks.create({
          parentId: folderId,
          title: tab.title,
          url: tab.url
        });
      }
    }
    return;
  }

  // Overwrite mode: remove extras, add missing.
  const desiredBookmarks = new Map();
  for (const tab of tabsToSave) {
    desiredBookmarks.set(tab.url, tab.title);
  }

  for (const bookmark of savedBookmarks) {
    if (desiredBookmarks.has(bookmark.url)) {
      desiredBookmarks.delete(bookmark.url);
    } else {
      await browser.bookmarks.remove(bookmark.id);
    }
  }

  for (const [url, title] of desiredBookmarks) {
    await browser.bookmarks.create({
      parentId: folderId,
      title: title,
      url: url
    });
  }
}

/**
 * Format a window folder name from titlePreface or fall back to Window[ID].
 * Ensures a single pair of brackets around the name.
 */
function formatWindowFolderName(window) {
  if (window.titlePreface) {
    const nameWithoutBrackets = window.titlePreface.replace(/^\[|\]$/g, '').trim();
    return `[${nameWithoutBrackets}]`;
  }
  return `Window[${window.id}]`;
}

/**
 * Set window titlePreface with retries (Firefox). No-ops if unsupported.
 */
async function setWindowTitlePrefaceWithRetry(windowId, folderName) {
  // Remove existing brackets to avoid double wrapping.
  const cleanFolderName = folderName.replace(/^\[|\]$/g, '').trim();
  const titlePreface = `[${cleanFolderName}] `;
  const maxRetries = 5;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      await browser.windows.update(windowId, { titlePreface });
      const windowInfo = await browser.windows.get(windowId);
      if (windowInfo.titlePreface === titlePreface) {
        console.log(`Set window titlePreface to: ${titlePreface} (attempt ${retryCount + 1})`);
        return;
      }
      console.log(`titlePreface not set correctly, retrying... (attempt ${retryCount + 1})`);
    } catch (error) {
      console.warn(`Could not set window titlePreface (attempt ${retryCount + 1}):`, error.message);
    }
    retryCount++;
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.error("Failed to set window titlePreface after all retries");
}

/**
 * Save tabs to folder
 */
async function saveTabsToFolder(folderId, options, tabsQuery = {}) {
  try {
    const overwrite = options.get('overwrite') || false;

    const allTabs = await browser.tabs.query(tabsQuery);
    
    if (allTabs.length === 0) {
      console.log('No tabs to save');
      return;
    }
    
    if (allTabs.length === 1 && isNewTabUrl(allTabs[0].url)) {
      console.log('Only new tab page open');
      return;
    }

    const tabsToSave = filterSavableTabs(allTabs, options);

    if (tabsToSave.length === 0) {
      console.log('No tabs to save after filtering');
      return;
    }

    await upsertBookmarks(folderId, tabsToSave, overwrite);

    console.log(`Successfully saved ${tabsToSave.length} tabs`);
  } catch (error) {
    console.error(`Error in saveTabsToFolder: ${error.message}`);
    throw error;
  }
}

/**
 * Save all windows to folder (same behavior as "Save All Windows" button)
 */
async function saveAllWindowsToFolder(folderId, options) {
  try {
    const overwrite = options.get('overwrite') || false;

    const windows = await browser.windows.getAll({ populate: true });

    // Get existing folders in the target folder
    const existingFolders = await browser.bookmarks.getChildren(folderId);
    const folderMap = new Map();
    for (const item of existingFolders) {
      if (item.url === undefined) {
        // It's a folder
        folderMap.set(item.title, item.id);
      }
    }

    if (overwrite) {
      // In overwrite mode, clear all existing folders
      for (const bookmark of existingFolders) {
        if (bookmark.url === undefined) {
          await browser.bookmarks.removeTree(bookmark.id);
        } else {
          await browser.bookmarks.remove(bookmark.id);
        }
      }
      folderMap.clear();
      console.log(`Cleared folder ${folderId} (overwrite mode)`);
    }

    let totalTabsSaved = 0;
    let foldersCreated = 0;

    for (const window of windows) {
      const windowFolderName = formatWindowFolderName(window);

      // Check if window folder already exists, reuse it if it does
      let windowFolder;
      if (folderMap.has(windowFolderName)) {
        windowFolder = { id: folderMap.get(windowFolderName) };
        console.log(`Reusing existing window folder: ${windowFolderName}`);
      } else {
        windowFolder = await browser.bookmarks.create({
          parentId: folderId,
          title: windowFolderName
        });
        folderMap.set(windowFolderName, windowFolder.id);
        foldersCreated++;
        console.log(`Created new window folder: ${windowFolderName}`);
      }

      const tabsToSave = filterSavableTabs(window.tabs, options);

      if (tabsToSave.length === 0) {
        console.log(`No tabs to save for window ${window.id}`);
        continue;
      }

      await upsertBookmarks(windowFolder.id, tabsToSave, overwrite);
      totalTabsSaved += tabsToSave.length;

      console.log(`Saved ${tabsToSave.length} tabs from window ${window.id}`);
    }

    console.log(`Saved all windows to folder ${folderId}: ${totalTabsSaved} tabs, ${foldersCreated} folders`);
    
    return { totalTabsSaved, foldersCreated };
  } catch (error) {
    console.error(`Error in saveAllWindowsToFolder: ${error.message}`);
    throw error;
  }
}

/******************************************************************************
 * Auto-Save Functionality
 ******************************************************************************/

/**
 * Handle alarm events
 */
async function handleAlarm(alarm) {
  try {
    console.log(`Alarm triggered: ${alarm.name}`);

    if (alarm.name !== 'autosave') {
      return;
    }

    const options = await getSavedOptions();

    if (!options.get('autosave')) {
      console.log('Autosave is disabled, skipping');
      return;
    }

    const autoSaveRootFolderPreference = options.get('autosaverootfolder') || 'default';
    const customAutoSaveFolderId = options.get('customautosaverootfolder');
    const rootFolderId = await getRootFolderId(autoSaveRootFolderPreference, customAutoSaveFolderId);
    
    console.log('Auto-save root folder preference:', autoSaveRootFolderPreference);
    console.log('Custom auto-save folder ID:', customAutoSaveFolderId);
    console.log('Resolved root folder ID:', rootFolderId);
    
    const autoSaveRootId = await getFolderId(AUTOSAVE_ROOT_NAME, rootFolderId);

    const folderName = getCurrentDate();
    const folderId = await getFolderId(folderName, autoSaveRootId);

    console.log(`Using autosave folder: ${folderName} (${folderId})`);

    const result = await saveAllWindowsToFolder(folderId, options);

    const allTabs = await browser.tabs.query({});
    const tabsToSave = filterSavableTabs(allTabs, options);
    
    const statsData = await browser.storage.local.get("stats");
    const stats = statsData.stats || {
      totalSaves: 0,
      tabsSaved: 0,
      autoSaves: 0,
      foldersCreated: 0,
      lastSave: null,
      installDate: new Date().toISOString()
    };
    
    stats.totalSaves = (stats.totalSaves || 0) + 1;
    stats.autoSaves = (stats.autoSaves || 0) + 1;
    stats.tabsSaved = (stats.tabsSaved || 0) + result.totalTabsSaved;
    stats.foldersCreated = (stats.foldersCreated || 0) + result.foldersCreated;
    stats.lastSave = new Date().toISOString();
    
    await browser.storage.local.set({ stats });

    console.log('Autosave completed successfully');

    if (options.get('autosavekeeplimit')) {
      const keepDays = options.get('autosavekeepdays') || 30;
      await cleanupOldAutoSaveFolders(autoSaveRootId, keepDays);
    }
  } catch (error) {
    console.error(`Error in handleAlarm: ${error.message}`);
  }
}

/**
 * Initialize or update alarms
 */
async function initializeAlarms() {
  try {
    const options = await getSavedOptions();
    console.log('Initializing alarms with options:', [...options]);

    await browser.alarms.clearAll();

    if (options.get('autosave')) {
      const interval = Number(options.get('interval'));
      await browser.alarms.create('autosave', {
        periodInMinutes: interval
      });
      console.log(`Autosave alarm created with ${interval} minute interval`);
    } else {
      console.log('Autosave is disabled');
    }
  } catch (error) {
    console.error(`Error in initializeAlarms: ${error.message}`);
  }
}

/**
 * Ensure alarms exist without relying on startup events.
 * MV3 service workers may wake at arbitrary times, so we
 * recreate alarms when the worker is alive and they are missing.
 */
async function restoreAlarmsIfNeeded() {
  try {
    const existing = await browser.alarms.getAll();
    if (existing && existing.length > 0) {
      return;
    }

    console.log('No alarms found, attempting restore');
    await initializeAlarms();
  } catch (error) {
    console.error('Error restoring alarms:', error);
  }
}

/******************************************************************************
 * Context Menu Functionality
 ******************************************************************************/

/**
 * Create context menus on startup
 */
async function createContextMenus() {
  const isFirefox = await isFirefoxBrowser();
  if (!isFirefox) {
    // Context menus not supported in Chrome
    return;
  }
  
  // Check if contextMenus API is available
  if (!browser.contextMenus) {
    console.log("contextMenus API not available");
    return;
  }
  
  try {
    await browser.contextMenus.removeAll();

    // Parent menu
    await browser.contextMenus.create({
      id: "save-my-tabs-folder",
      title: "Save My Tabs",
      contexts: ["bookmark"]
    });

    // Save current tab
    await browser.contextMenus.create({
      id: "save-current-tab",
      parentId: "save-my-tabs-folder",
      title: "Save Current Tab",
      contexts: ["bookmark"],
      icons: {
        "16": "icons/file.svg" 
      }      
    });

    // Save current window
    await browser.contextMenus.create({
      id: "save-current-window",
      parentId: "save-my-tabs-folder",
      title: "Save Current Window",
      contexts: ["bookmark"],
      icons: {
        "16": "icons/window.svg" 
      }      
    });

    // Save all windows
    await browser.contextMenus.create({
      id: "save-all-windows",
      parentId: "save-my-tabs-folder",
      title: "Save All Windows",
      contexts: ["bookmark"],
      icons: {
        "16": "icons/window-stack.svg" 
      }      
    });

    // Separator
    await browser.contextMenus.create({
      id: "separator",
      parentId: "save-my-tabs-folder",
      type: "separator",
      contexts: ["bookmark"]
    });

    // Open links in named window
    await browser.contextMenus.create({
      id: "open-in-named-window",
      parentId: "save-my-tabs-folder",
      title: "Open Links in Named Window",
      contexts: ["bookmark"],
      icons: {
        "16": "icons/upload.svg" 
      }      
    });

    console.log("Context menus created successfully");
  } catch (error) {
    console.error("Error creating context menus:", error);
  }
}

/**
 * Handle context menu clicks
 */
async function handleContextMenuClick(info, tab) {
  try {
    const bookmarkId = info.bookmarkId;
    
    if (!bookmarkId) {
      console.error("No bookmark ID provided");
      return;
    }

    const bookmarkNodes = await browser.bookmarks.get(bookmarkId);
    const bookmark = bookmarkNodes[0];

    if (!bookmark || bookmark.url) {
      console.log("Not a folder, ignoring");
      return;
    }

    console.log(`Context menu action: ${info.menuItemId} on folder: ${bookmark.title}`);

    switch (info.menuItemId) {
      case "save-current-tab":
        await saveCurrentTab(bookmarkId, tab);
        break;

      case "save-current-window":
        await saveCurrentWindow(bookmarkId, tab);
        break;

      case "save-all-windows":
        await saveAllWindows(bookmarkId);
        break;

      case "open-in-named-window":
        await openInNamedWindow(bookmarkId, bookmark.title);
        break;
    }
  } catch (error) {
    console.error("Error handling context menu click:", error);
  }
}

/**
 * Save current tab to folder
 */
async function saveCurrentTab(folderId, tab) {
  try {
    // If tab is not provided (e.g., from bookmark context menu), get the active tab
    if (!tab) {
      const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (activeTabs.length === 0) {
        console.log("No active tab found");
        return;
      }
      tab = activeTabs[0];
    }

    if (isNewTabUrl(tab.url)) {
      console.log("Not saving new tab URL");
      return;
    }

    await browser.bookmarks.create({
      parentId: folderId,
      title: tab.title,
      url: tab.url
    });

    console.log(`Saved current tab to folder ${folderId}`);
  } catch (error) {
    console.error("Error saving current tab:", error);
  }
}

/**
 * Save current window to folder
 */
async function saveCurrentWindow(folderId, currentTab) {
  try {
    const options = await getSavedOptions();
    const overwrite = options.get('overwrite') || false;

    // If currentTab is not provided (e.g., from bookmark context menu), query current window
    let allTabs;
    if (currentTab && currentTab.windowId) {
      allTabs = await browser.tabs.query({ windowId: currentTab.windowId });
    } else {
      allTabs = await browser.tabs.query({ currentWindow: true });
    }

    const tabsToSave = filterSavableTabs(allTabs, options);

    if (tabsToSave.length === 0) {
      console.log("No tabs to save");
      return;
    }

    await upsertBookmarks(folderId, tabsToSave, overwrite);

    console.log(`Saved ${tabsToSave.length} tabs from current window to folder ${folderId}`);
  } catch (error) {
    console.error("Error saving current window:", error);
  }
}

/**
 * Save all windows to folder
 */
async function saveAllWindows(folderId) {
  try {
    const options = await getSavedOptions();
    const overwrite = options.get('overwrite') || false;

    const windows = await browser.windows.getAll({ populate: true });

    // Get existing folders in the target folder
    const existingFolders = await browser.bookmarks.getChildren(folderId);
    const folderMap = new Map();
    for (const item of existingFolders) {
      if (item.url === undefined) {
        // It's a folder
        folderMap.set(item.title, item.id);
      }
    }

    if (overwrite) {
      // In overwrite mode, clear all existing folders
      for (const bookmark of existingFolders) {
        if (bookmark.url === undefined) {
          await browser.bookmarks.removeTree(bookmark.id);
        } else {
          await browser.bookmarks.remove(bookmark.id);
        }
      }
      folderMap.clear();
      console.log(`Cleared folder ${folderId} (overwrite mode)`);
    }

    for (const window of windows) {
      const windowFolderName = formatWindowFolderName(window);

      // Check if window folder already exists, reuse it if it does
      let windowFolder;
      if (folderMap.has(windowFolderName)) {
        windowFolder = { id: folderMap.get(windowFolderName) };
        console.log(`Reusing existing window folder: ${windowFolderName}`);
      } else {
        windowFolder = await browser.bookmarks.create({
          parentId: folderId,
          title: windowFolderName
        });
        folderMap.set(windowFolderName, windowFolder.id);
        console.log(`Created new window folder: ${windowFolderName}`);
      }

      const tabsToSave = filterSavableTabs(window.tabs, options);

      if (tabsToSave.length === 0) {
        console.log(`No tabs to save for window ${window.id}`);
        continue;
      }

      await upsertBookmarks(windowFolder.id, tabsToSave, overwrite);

      console.log(`Saved ${tabsToSave.length} tabs from window ${window.id}`);
    }

    console.log(`Saved all windows to folder ${folderId}`);
  } catch (error) {
    console.error("Error saving all windows:", error);
  }
}

/**
 * Open all bookmarks from folder in a new named window
 */
async function openInNamedWindow(folderId, folderName) {
  try {
    const bookmarks = await browser.bookmarks.getChildren(folderId);

    // Get only direct bookmarks (items with URLs), ignore subfolders
    const urls = bookmarks
      .filter(bookmark => bookmark.url && !isNewTabUrl(bookmark.url))
      .map(bookmark => bookmark.url);

    if (urls.length === 0) {
      console.log("No URLs to open in folder");
      return;
    }

    // Create a new window with the first URL
    const newWindow = await browser.windows.create({
      url: urls[0]
    });

    // Add remaining URLs as tabs in the new window
    for (let i = 1; i < urls.length; i++) {
      await browser.tabs.create({
        windowId: newWindow.id,
        url: urls[i]
      });
    }

    // Set the window title preface (Firefox). No-op elsewhere if unsupported.
    await new Promise(resolve => setTimeout(resolve, 200));
    await setWindowTitlePrefaceWithRetry(newWindow.id, folderName);

    console.log(`Opened ${urls.length} bookmarks in new window: ${folderName}`);
  } catch (error) {
    console.error("Error opening bookmarks in named window:", error);
  }
}

/******************************************************************************
 * Event Handlers
 ******************************************************************************/

/**
 * Handle storage changes
 */
function handleStorageChange(changes, areaName) {
  if (areaName === 'local' && changes.settings) {
    console.log('Settings changed, reinitializing alarms');
    initializeAlarms();
  }
}

/**
 * Handle extension installation or update
 */
function handleInstalled(details) {
  console.log('Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    console.log('First installation, initializing defaults');
  } else if (details.reason === 'update') {
    console.log(`Updated from version ${details.previousVersion}`);
  }
  
  initializeAlarms();
  createContextMenus();
}

/******************************************************************************
 * Initialize Service Worker
 ******************************************************************************/

async function initialize() {
  try {
    console.log('Service worker starting up');

    browser.alarms.onAlarm.addListener(handleAlarm);
    browser.storage.onChanged.addListener(handleStorageChange);
    browser.runtime.onInstalled.addListener(handleInstalled);
    
    // Only add context menu listener if API is available
    if (browser.contextMenus && browser.contextMenus.onClicked) {
      browser.contextMenus.onClicked.addListener(handleContextMenuClick);
    }
    
    // Lightweight wake triggers: tabs activity can wake the service worker.
    // Restore alarms/context menus if missing.
    const wakeRestore = () => {
      restoreAlarmsIfNeeded();
      createContextMenus();
    };
    browser.tabs.onCreated.addListener(wakeRestore);
    // browser.tabs.onUpdated.addListener(wakeRestore);

    await initializeAlarms();
    await createContextMenus();
    await restoreAlarmsIfNeeded();

    console.log('Service worker initialized successfully');
  } catch (error) {
    console.error(`Error initializing service worker: ${error.message}`);
  }
}

initialize();