/******************************************************************************
 * Save My Tabs
 * File: lib/browser-detection.js
 * 
 * Author: Salvatore Ventura <salvoventura@gmail.com>
 * Copyright 2025 Salvatore Ventura <salvoventura@gmail.com>
 * Code assisted by Claude.ai
 * 
 * Purpose: Browser detection utilities and constants - provides cross-browser
 *          compatibility for Firefox, Chrome, Edge, and other browsers
 ******************************************************************************/

/**
 * Browser detection and constants
 */
export const BrowserDetection = {
  /**
   * Check if browser is Firefox
   * @returns {boolean}
   */
  isFirefox() {
    return typeof InstallTrigger !== 'undefined';
  },

  /**
   * Check if browser is Chrome
   * @returns {boolean}
   */
  isChrome() {
    return typeof chrome !== 'undefined' && 
           typeof chrome.runtime !== 'undefined' &&
           !this.isFirefox();
  },

  /**
   * Check if browser is Edge
   * @returns {boolean}
   */
  isEdge() {
    return navigator.userAgent.indexOf('Edg') !== -1;
  },

  /**
   * Get the toolbar bookmark folder ID for the current browser
   * @returns {string}
   */
  getToolbarId() {
    return this.isFirefox() ? "toolbar_____" : "1";
  },

  /**
   * Get the "Other Bookmarks" folder ID for the current browser
   * @returns {string}
   */
  getOtherBookmarksId() {
    return this.isFirefox() ? "unfiled_____" : "2";
  },

  /**
   * Get the "Bookmarks Menu" folder ID (Firefox only)
   * @returns {string|null}
   */
  getMenuId() {
    return this.isFirefox() ? "menu________" : null;
  },

  /**
   * Get root folder ID based on user preference
   * @param {string} preference - "default", "toolbar", "other", "menu", or "custom"
   * @param {string|null} customFolderId - Custom folder ID if preference is "custom"
   * @returns {string}
   */
  getRootFolderId(preference = "default", customFolderId = null) {
    // If custom folder is specified and we have an ID, use it
    if (preference === "custom" && customFolderId) {
      return customFolderId;
    }
    
    // If custom is selected but no ID provided, fall back to default
    if (preference === "custom" && !customFolderId) {
      console.warn('Custom folder selected but no ID provided, using default');
      return this.getToolbarId();
    }
    
    // "default" means Bookmarks Toolbar/Bar (the original behavior)
    if (preference === "default" || preference === "toolbar") {
      return this.getToolbarId();
    } else if (preference === "other") {
      return this.getOtherBookmarksId();
    } else if (preference === "menu" && this.isFirefox()) {
      return this.getMenuId();
    }
    // Fallback to toolbar
    return this.getToolbarId();
  },

  /**
   * Get human-readable name for root folder
   * @param {string} preference - "default", "toolbar", "other", "menu", or "custom"
   * @param {string|null} customFolderName - Custom folder name if preference is "custom"
   * @returns {string}
   */
  getRootFolderName(preference = "default", customFolderName = null) {
    const isFF = this.isFirefox();
    
    if (preference === "custom" && customFolderName) {
      return customFolderName;
    }
    
    if (preference === "default" || preference === "toolbar") {
      return isFF ? "Bookmarks Toolbar" : "Bookmarks Bar";
    } else if (preference === "other") {
      return "Other Bookmarks";
    } else if (preference === "menu") {
      return isFF ? "Bookmarks Menu" : "Other Bookmarks"; // Chrome doesn't have menu
    }
    
    return isFF ? "Bookmarks Toolbar" : "Bookmarks Bar";
  },

  /**
   * Get browser name
   * @returns {string}
   */
  getBrowserName() {
    if (this.isFirefox()) return 'Firefox';
    if (this.isEdge()) return 'Edge';
    if (this.isChrome()) return 'Chrome';
    return 'Unknown';
  }
};

/**
 * Predefined constants
 */
export const CONSTANTS = {
  AUTOSAVE_ROOT_NAME: "AUTOSAVE",
  
  // New tab URLs for various browsers
  NEW_TAB_URLS: [
    // Chrome-based
    "chrome://newtab",
    "chrome-search://local-ntp/local-ntp.html",
    "chrome://startpage",
    "chrome://blank",
    "chrome://home",
    
    // Edge
    "edge://newtab",
    
    // Brave
    "brave://newtab",
    
    // Opera
    "opera://startpage",
    
    // Vivaldi
    "vivaldi://newtab",
    
    // Firefox
    "about:newtab",
    "about:blank",
    "about:home",
    
    // Empty
    ""
  ]
};
