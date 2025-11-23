/******************************************************************************
  Module  : storage.js
  Purpose : Handle all storage-related operations
  Version : 2.0.0 (Manifest V3)
******************************************************************************/

/**
 * Default settings for the extension
 */
const DEFAULT_SETTINGS = {
  autosave: false,
  interval: "5",
  overwrite: false,
  savepinned: false,
  rootfolder: "default",
  customrootfolder: null,
  autosaverootfolder: "default",
  customautosaverootfolder: null,
  lastfolder: null,
  rememberlast: true,
  closepinned: false,
  closetabs: false,
  prefixenabled: false,
  prefixtype: "custom",
  prefixcustom: "",
  autosavekeeplimit: false,
  autosavekeepdays: 30
};

/**
 * Default statistics
 */
const DEFAULT_STATS = {
  totalSaves: 0,
  tabsSaved: 0,
  autoSaves: 0,
  foldersCreated: 0,
  lastSave: null,
  installDate: null
};

/**
 * Storage module - handles all browser.storage operations
 */
export const StorageService = {
  /**
   * Get saved options from storage
   * @returns {Promise<Map>} Map of settings
   */
  async getOptions() {
    try {
      const saved = await browser.storage.local.get("settings");
      const options = new Map();

      if (saved.settings !== undefined) {
        options.set('autosave', saved.settings.autosave);
        options.set('interval', saved.settings.interval);
        options.set('overwrite', saved.settings.overwrite);
        options.set('savepinned', saved.settings.savepinned);
        options.set('rootfolder', saved.settings.rootfolder || 'default');
        options.set('customrootfolder', saved.settings.customrootfolder || null);
        options.set('autosaverootfolder', saved.settings.autosaverootfolder || 'default');
        options.set('customautosaverootfolder', saved.settings.customautosaverootfolder || null);
        options.set('lastfolder', saved.settings.lastfolder || null);
        options.set('rememberlast', saved.settings.rememberlast !== undefined ? saved.settings.rememberlast : true);
        options.set('closepinned', saved.settings.closepinned || false);
        options.set('closetabs', saved.settings.closetabs || false);
        options.set('prefixenabled', saved.settings.prefixenabled || false);
        options.set('prefixtype', saved.settings.prefixtype || 'custom');
        options.set('prefixcustom', saved.settings.prefixcustom || '');
        options.set('autosavekeeplimit', saved.settings.autosavekeeplimit || false);
        options.set('autosavekeepdays', saved.settings.autosavekeepdays || 30);
      } else {
        // Apply defaults
        Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
          options.set(key, value);
        });
      }

      console.log('StorageService.getOptions returning', [...options]);
      return options;
    } catch (error) {
      console.error(`Error in StorageService.getOptions: ${error.message}`);
      throw error;
    }
  },

  /**
   * Save options to storage
   * @param {Map} options - Settings to save
   * @returns {Promise<void>}
   */
  async saveOptions(options) {
    try {
      console.log('StorageService.saveOptions saving', [...options]);

      const settings = {
        autosave: options.get('autosave'),
        interval: options.get('interval'),
        overwrite: options.get('overwrite'),
        savepinned: options.get('savepinned'),
        rootfolder: options.get('rootfolder'),
        customrootfolder: options.get('customrootfolder'),
        autosaverootfolder: options.get('autosaverootfolder'),
        customautosaverootfolder: options.get('customautosaverootfolder'),
        lastfolder: options.get('lastfolder'),
        rememberlast: options.get('rememberlast'),
        closepinned: options.get('closepinned'),
        closetabs: options.get('closetabs'),
        prefixenabled: options.get('prefixenabled'),
        prefixtype: options.get('prefixtype'),
        prefixcustom: options.get('prefixcustom'),
        autosavekeeplimit: options.get('autosavekeeplimit'),
        autosavekeepdays: options.get('autosavekeepdays')
      };

      console.log('Settings object to save:', settings);

      await browser.storage.local.set({ settings });
      console.log('Settings saved successfully to storage');
    } catch (error) {
      console.error(`Error in StorageService.saveOptions: ${error.message}`);
      throw error;
    }
  },

  /**
   * Save just the last used folder (quick save without loading all options)
   * @param {string} folderId - Last used folder ID
   * @returns {Promise<void>}
   */
  async saveLastFolder(folderId) {
    try {
      const saved = await browser.storage.local.get("settings");
      const settings = saved.settings || {};
      settings.lastfolder = folderId;
      await browser.storage.local.set({ settings });
      console.log('Last folder saved:', folderId);
    } catch (error) {
      console.error(`Error in StorageService.saveLastFolder: ${error.message}`);
      throw error;
    }
  },

  /**
   * Listen for storage changes
   * @param {Function} callback - Callback function for changes
   */
  addChangeListener(callback) {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.settings) {
        callback(changes.settings.newValue);
      }
    });
  },

  /**
   * Get statistics from storage
   * @returns {Promise<Object>} Statistics object
   */
  async getStats() {
    try {
      const saved = await browser.storage.local.get("stats");
      return saved.stats || { ...DEFAULT_STATS };
    } catch (error) {
      console.error(`Error in StorageService.getStats: ${error.message}`);
      throw error;
    }
  },

  /**
   * Update statistics
   * @param {Object} updates - Partial stats object to update
   * @returns {Promise<void>}
   */
  async updateStats(updates) {
    try {
      const currentStats = await this.getStats();
      
      // Set install date if not set
      if (!currentStats.installDate) {
        currentStats.installDate = new Date().toISOString();
      }
      
      const newStats = { ...currentStats, ...updates };
      await browser.storage.local.set({ stats: newStats });
      console.log('Statistics updated:', newStats);
    } catch (error) {
      console.error(`Error in StorageService.updateStats: ${error.message}`);
      throw error;
    }
  },

  /**
   * Increment a stat counter
   * @param {string} statName - Name of the stat to increment
   * @param {number} amount - Amount to increment by (default 1)
   * @returns {Promise<void>}
   */
  async incrementStat(statName, amount = 1) {
    try {
      const stats = await this.getStats();
      stats[statName] = (stats[statName] || 0) + amount;
      await this.updateStats(stats);
    } catch (error) {
      console.error(`Error in StorageService.incrementStat: ${error.message}`);
      throw error;
    }
  },

  /**
   * Reset all statistics
   * @returns {Promise<void>}
   */
  async resetStats() {
    try {
      const stats = { ...DEFAULT_STATS };
      stats.installDate = new Date().toISOString();
      await browser.storage.local.set({ stats });
      console.log('Statistics reset');
    } catch (error) {
      console.error(`Error in StorageService.resetStats: ${error.message}`);
      throw error;
    }
  }
};
