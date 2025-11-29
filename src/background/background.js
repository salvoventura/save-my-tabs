/******************************************************************************
 * Save My Tabs
 * File: background/background.js
 * 
 * Author: Salvatore Ventura <salvoventura@gmail.com>
 * Copyright 2025 Salvatore Ventura <salvoventura@gmail.com>
 * Code assisted by Claude.ai
 * 
 * Purpose: Background service worker for Manifest V3 - handles auto-save
 *          alarms, cleanup of old auto-save folders, and extension lifecycle
 ******************************************************************************/
// Polyfill for Chrome/Edge
if (typeof browser === 'undefined') {
  globalThis.browser = chrome;
}

const AUTOSAVE_ROOT_NAME = "AUTOSAVE";

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
 * Get root folder ID based on user preference
 */
function getRootFolderId(preference = "default", customFolderId = null) {
  const isFirefox = typeof InstallTrigger !== 'undefined';
  
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

/**
 * Get current date in YYYY-MM-DD format
 */
function getCurrentDate() {
  const now = new Date(new Date().toString().split('GMT')[0] + ' UTC');
  const iso = now.toISOString();
  return iso.split('T')[0];
}

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

/**
 * Save tabs to folder
 */
async function saveTabsToFolder(folderId, options, tabsQuery = {}) {
  try {
    const overwrite = options.get('overwrite') || false;
    const savepinned = options.get('savepinned') || false;

    const allTabs = await browser.tabs.query(tabsQuery);
    
    if (allTabs.length === 0) {
      console.log('No tabs to save');
      return;
    }
    
    if (allTabs.length === 1 && isNewTabUrl(allTabs[0].url)) {
      console.log('Only new tab page open');
      return;
    }

    const tabsToSave = allTabs.filter(tab => {
      if (tab.pinned && !savepinned) return false;
      if (isNewTabUrl(tab.url)) return false;
      return true;
    });

    if (tabsToSave.length === 0) {
      console.log('No tabs to save after filtering');
      return;
    }

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
    } else {
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

    console.log(`Successfully saved ${tabsToSave.length} tabs`);
  } catch (error) {
    console.error(`Error in saveTabsToFolder: ${error.message}`);
    throw error;
  }
}

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
    const rootFolderId = getRootFolderId(autoSaveRootFolderPreference, customAutoSaveFolderId);
    
    console.log('Auto-save root folder preference:', autoSaveRootFolderPreference);
    console.log('Custom auto-save folder ID:', customAutoSaveFolderId);
    console.log('Resolved root folder ID:', rootFolderId);
    
    const autoSaveRootId = await getFolderId(AUTOSAVE_ROOT_NAME, rootFolderId);

    const folderName = getCurrentDate();
    const folderId = await getFolderId(folderName, autoSaveRootId);

    console.log(`Using autosave folder: ${folderName} (${folderId})`);

    await saveTabsToFolder(folderId, options, {});

    const allTabs = await browser.tabs.query({});
    const savepinned = options.get('savepinned') || false;
    const tabsToSave = allTabs.filter(tab => {
      if (tab.pinned && !savepinned) return false;
      if (isNewTabUrl(tab.url)) return false;
      return true;
    });
    
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
    stats.tabsSaved = (stats.tabsSaved || 0) + tabsToSave.length;
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
}

/**
 * Initialize service worker
 */
async function initialize() {
  try {
    console.log('Service worker starting up');

    browser.alarms.onAlarm.addListener(handleAlarm);
    browser.storage.onChanged.addListener(handleStorageChange);
    browser.runtime.onInstalled.addListener(handleInstalled);

    await initializeAlarms();

    console.log('Service worker initialized successfully');
  } catch (error) {
    console.error(`Error initializing service worker: ${error.message}`);
  }
}

initialize();
