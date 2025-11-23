/******************************************************************************
  Module  : utils.js
  Purpose : Utility functions
  Version : 2.0.0 (Manifest V3)
******************************************************************************/

/**
 * Utility functions
 */
export const Utils = {
  /**
   * Get current date/time in ISO format without milliseconds
   * @returns {string} Date string in format "YYYY-MM-DD HH:MM:SS"
   */
  getCurrentDateTime() {
    return new Date(new Date().toString().split('GMT')[0] + ' UTC')
      .toISOString()
      .split('.')[0]
      .replace('T', ' ');
  },

  /**
   * Get current date in YYYY-MM-DD format
   * @returns {string} Date string
   */
  getCurrentDate() {
    return this.getCurrentDateTime().slice(0, 10);
  },

  /**
   * Format date for folder name
   * @param {Date} date - Date object
   * @returns {string} Formatted date string
   */
  formatDateForFolder(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Debounce function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Deep clone an object
   * @param {Object} obj - Object to clone
   * @returns {Object} Cloned object
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * Check if two maps are equal
   * @param {Map} map1 - First map
   * @param {Map} map2 - Second map
   * @returns {boolean}
   */
  mapsEqual(map1, map2) {
    if (map1.size !== map2.size) return false;
    for (const [key, val] of map1) {
      if (!map2.has(key) || map2.get(key) !== val) {
        return false;
      }
    }
    return true;
  }
};
