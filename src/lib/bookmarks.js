/******************************************************************************
  Module  : bookmarks.js
  Purpose : Handle all bookmark-related operations
  Version : 2.0.0 (Manifest V3)
******************************************************************************/

import { BrowserDetection } from './browser-detection.js';

/**
 * Bookmarks module - handles all browser.bookmarks operations
 */
export const BookmarksService = {
  /**
   * Get a folder ID by name, optionally creating it
   * @param {string} folderName - Name of the folder
   * @param {string|null} rootId - Parent folder ID (null to skip creation)
   * @returns {Promise<string|null>} Folder ID or null
   */
  async getFolderId(folderName, rootId = null) {
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

      console.log(`Returning folder ${folderName} with id ${folderId}`);
      return folderId;
    } catch (error) {
      console.error(`Error in BookmarksService.getFolderId: ${error.message}`);
      throw error;
    }
  },

  /**
   * Get children of a bookmark folder
   * @param {string} folderId - Folder ID
   * @returns {Promise<Array>} Array of bookmarks
   */
  async getChildren(folderId) {
    try {
      return await browser.bookmarks.getChildren(folderId);
    } catch (error) {
      console.error(`Error in BookmarksService.getChildren: ${error.message}`);
      throw error;
    }
  },

  /**
   * Create a bookmark
   * @param {Object} bookmarkInfo - Bookmark information
   * @returns {Promise<Object>} Created bookmark
   */
  async create(bookmarkInfo) {
    try {
      return await browser.bookmarks.create(bookmarkInfo);
    } catch (error) {
      console.error(`Error in BookmarksService.create: ${error.message}`);
      throw error;
    }
  },

  /**
   * Remove a bookmark
   * @param {string} bookmarkId - Bookmark ID to remove
   * @returns {Promise<void>}
   */
  async remove(bookmarkId) {
    try {
      await browser.bookmarks.remove(bookmarkId);
    } catch (error) {
      console.error(`Error in BookmarksService.remove: ${error.message}`);
      throw error;
    }
  },

  /**
   * Get all folders in the toolbar
   * @returns {Promise<Array>} Array of folder objects
   */
  async getToolbarFolders() {
    try {
      const toolbarId = BrowserDetection.getToolbarId();
      const items = await browser.bookmarks.getChildren(toolbarId);
      return items.filter(item => item.url === undefined);
    } catch (error) {
      console.error(`Error in BookmarksService.getToolbarFolders: ${error.message}`);
      throw error;
    }
  }
};
