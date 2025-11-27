/******************************************************************************
 * Save My Tabs
 * File: lib/tabs.js
 * 
 * Author: Salvatore Ventura <salvoventura@gmail.com>
 * Copyright 2025 Salvatore Ventura <salvoventura@gmail.com>
 * Code assisted by Claude.ai
 * 
 * Purpose: Tabs service module - handles tab querying, filtering, saving to
 *          bookmarks, and closing operations
 ******************************************************************************/


import { CONSTANTS } from './browser-detection.js';
import { BookmarksService } from './bookmarks.js';

/**
 * Tabs module - handles tab querying and bookmark saving
 */
export const TabsService = {
  /**
   * Normalize URL by removing trailing slashes and converting to lowercase
   * @param {string} url - URL to normalize
   * @returns {string} Normalized URL
   */
  normalizeUrl(url) {
    return url.replace(/\/+$/, '').toLowerCase();
  },

  /**
   * Check if a URL is a new tab page
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  isNewTabUrl(url) {
    const normalized = this.normalizeUrl(url);
    return CONSTANTS.NEW_TAB_URLS.includes(normalized);
  },

  /**
   * Get all open tabs based on query
   * @param {Object} query - Tab query object
   * @returns {Promise<Array>} Array of tabs
   */
  async getTabs(query = { currentWindow: true }) {
    try {
      return await browser.tabs.query(query);
    } catch (error) {
      console.error(`Error in TabsService.getTabs: ${error.message}`);
      throw error;
    }
  },

  /**
   * Check if tabs list is empty or only contains new tab page
   * @param {Array} tabs - Array of tab objects
   * @returns {boolean}
   */
  isEmptyTabSet(tabs) {
    if (tabs.length === 0) {
      return true;
    }
    if (tabs.length === 1 && this.isNewTabUrl(tabs[0].url)) {
      return true;
    }
    return false;
  },

  /**
   * Filter tabs based on options
   * @param {Array} tabs - Array of tab objects
   * @param {Object} options - Filter options
   * @returns {Array} Filtered tabs
   */
  filterTabs(tabs, options = {}) {
    const { savepinned = false } = options;
    
    return tabs.filter(tab => {
      // Skip pinned tabs if option is false
      if (tab.pinned && !savepinned) {
        return false;
      }
      // Skip new tab pages
      if (this.isNewTabUrl(tab.url)) {
        return false;
      }
      return true;
    });
  },

  /**
   * Save tabs to a bookmark folder
   * @param {string} folderId - Target folder ID
   * @param {Map} options - Options map (overwrite, savepinned)
   * @param {Object} tabsQuery - Query for tabs to save
   * @returns {Promise<void>}
   */
  async saveToFolder(folderId, options, tabsQuery = { currentWindow: true }) {
    try {
      const overwrite = options.get('overwrite') || false;
      const savepinned = options.get('savepinned') || false;

      // Get all open tabs
      const allTabs = await this.getTabs(tabsQuery);
      
      // Check if tabs list is empty
      if (this.isEmptyTabSet(allTabs)) {
        console.log('No tabs to save');
        return;
      }

      // Filter tabs based on options
      const tabsToSave = this.filterTabs(allTabs, { savepinned });

      if (tabsToSave.length === 0) {
        console.log('No tabs to save after filtering');
        return;
      }

      // Get existing bookmarks in the folder
      const savedBookmarks = await BookmarksService.getChildren(folderId);
      const existingBookmarks = new Map();
      
      for (const bookmark of savedBookmarks) {
        existingBookmarks.set(bookmark.url, bookmark.title);
      }

      if (!overwrite) {
        // Append mode: only add new tabs
        await this._appendTabs(folderId, tabsToSave, existingBookmarks);
      } else {
        // Overwrite mode: replace with current tabs
        await this._replaceTabs(folderId, tabsToSave, savedBookmarks);
      }

      console.log(`Successfully saved ${tabsToSave.length} tabs to folder ${folderId}`);
    } catch (error) {
      console.error(`Error in TabsService.saveToFolder: ${error.message}`);
      throw error;
    }
  },

  /**
   * Append tabs to folder (skip existing)
   * @private
   */
  async _appendTabs(folderId, tabs, existingBookmarks) {
    for (const tab of tabs) {
      if (!existingBookmarks.has(tab.url)) {
        await BookmarksService.create({
          parentId: folderId,
          title: tab.title,
          url: tab.url
        });
      }
    }
  },

  /**
   * Replace folder contents with tabs
   * @private
   */
  async _replaceTabs(folderId, tabs, savedBookmarks) {
    // Create map of desired bookmarks
    const desiredBookmarks = new Map();
    for (const tab of tabs) {
      desiredBookmarks.set(tab.url, tab.title);
    }

    // Remove bookmarks not in desired set
    for (const bookmark of savedBookmarks) {
      if (desiredBookmarks.has(bookmark.url)) {
        // Keep this bookmark, remove from desired set
        desiredBookmarks.delete(bookmark.url);
      } else {
        // Remove this bookmark
        await BookmarksService.remove(bookmark.id);
      }
    }

    // Add remaining desired bookmarks
    for (const [url, title] of desiredBookmarks) {
      await BookmarksService.create({
        parentId: folderId,
        title: title,
        url: url
      });
    }
  },

  /**
   * Save tabs directly to a folder (used by Save All Windows)
   * @param {string} folderId - Target folder ID
   * @param {Array} tabs - Array of tab objects (already filtered)
   * @param {Map} options - Options map (overwrite)
   * @returns {Promise<void>}
   */
  async saveTabsToWindowFolder(folderId, tabs, options) {
    try {
      const overwrite = options.get('overwrite') || false;

      // Get existing bookmarks in the folder
      const savedBookmarks = await BookmarksService.getChildren(folderId);
      const existingBookmarks = new Map();
      
      for (const bookmark of savedBookmarks) {
        existingBookmarks.set(bookmark.url, bookmark.title);
      }

      if (!overwrite) {
        // Append mode: only add new tabs
        await this._appendTabs(folderId, tabs, existingBookmarks);
      } else {
        // Overwrite mode: replace with current tabs
        await this._replaceTabs(folderId, tabs, savedBookmarks);
      }

      console.log(`Successfully saved ${tabs.length} tabs to folder ${folderId}`);
    } catch (error) {
      console.error(`Error in TabsService.saveTabsToWindowFolder: ${error.message}`);
      throw error;
    }
  },

  /**
   * Close all tabs in current window
   * @param {boolean} closePinned - Whether to also close pinned tabs
   * @returns {Promise<void>}
   */
  async closeAllTabs(closePinned = false) {
    try {
      // Get all tabs in current window
      const tabs = await browser.tabs.query({ currentWindow: true });
      
      // Filter tabs to close
      const tabsToClose = tabs.filter(tab => {
        // Skip pinned tabs if setting says so
        if (tab.pinned && !closePinned) {
          return false;
        }
        // Skip new tab pages
        if (this.isNewTabUrl(tab.url)) {
          return false;
        }
        return true;
      });

      // If we're closing all tabs, create a new empty tab first
      // to prevent the window from closing
      if (tabsToClose.length === tabs.length || 
          (tabsToClose.length > 0 && tabs.length - tabsToClose.length === 0)) {
        console.log('Creating new empty tab to prevent window close');
        await browser.tabs.create({ active: true });
      }

      // Close the tabs
      const tabIds = tabsToClose.map(tab => tab.id);
      if (tabIds.length > 0) {
        console.log(`Closing ${tabIds.length} tabs`);
        await browser.tabs.remove(tabIds);
      }

      console.log(`Closed ${tabIds.length} tabs successfully`);
    } catch (error) {
      console.error(`Error in TabsService.closeAllTabs: ${error.message}`);
      throw error;
    }
  }
};
