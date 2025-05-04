/******************************************************************************
  Author : Salvatore Ventura <salvoventura@gmail.com>
    Date : 25 Apr 2020
   AddOn : Save my tabs!
 Purpose : Common functions library.
 Version : 1.2.3
           Prevent an empty window from erasing the current autosave day folder 
 Version : 1.2.2
           Introduce configuration flag to skip pinned tabs 
 Version : 1.2.1
           Skipping pinned tabs
 Version : 1.2.0
           Introducing autosave
******************************************************************************/


/**
 * https://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser
 * chrome detection from this post triggers true on FF as well, hence using Firefox detection
 * Firefox 1.0+
 * 
 */
var isFirefox = typeof InstallTrigger !== 'undefined';


/**
 * Predefined bookmark folders have different IDs in different browsers.
 * Need to set this accordingly
 *
 *                    Chrome    Firefox
 * 'Bookmarks Bar':       "1"    "toolbar_____"
 * 'Other Bookmarks':     "2"    "unfiled_____"
 *
 */ 
var TOOLBAR_ID = isFirefox ? "toolbar_____" : "1";


/**
 * AUTOSAVE values: constant name
 * Folder ID will be determined at runtime
 * 
 */
const AUTOSAVE_ROOT_NAME = "AUTOSAVE";


/**
 * newTabUrls: used to check if a tab is a new tab page
 * The list excludes the trailing slash, as the comparison
 * will be done after normalizing the URLs.
 * 
 */
const newTabUrls = [
    // Chrome-based
    "chrome://newtab",
    "chrome-search://local-ntp/local-ntp.html",
    "chrome://startpage",
    
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
    
    // Generic and fallback
    "",
    "about:home",        // Firefox home page
    "chrome://blank",   // very rare fallback
    "chrome://home",    // home page on some setups
  ];
  

/**
 Normalize the URL by removing trailing slashes and converting to lowercase
*/
const normalizeUrl = url => url.replace(/\/+$/, '').toLowerCase();


/**
 * Find the id of 'folderName'
 * If 'root' is not null, then create if not found
 * and append from 'root'.
 * 
 */
async function getFolderId(folderName, rootId=null) {

    try {
        let folderId = null;
        let results = await browser.bookmarks.search({title: folderName});
        
        if (results.length) {
          folderId = results[0].id;
          console.log(`Found ${folderName} with id ${folderId}`);
          
        } else {
            console.log(`I did not find ${folderName}`);
            if (rootId !== null) {
                console.log(`Going to create ${folderName}`);
                let creation = await browser.bookmarks.create({
                    parentId: rootId,
                    title: folderName,
                    url: null
                });
                folderId = creation.id;
            }
        }
        console.log(`Returning folder ${folderName} with id ${folderId}`);
        return folderId;
    
    } catch(error) {
        console.error(`An error occurred during getFolderId: ${error.message}`);
    }
}


/**
 * Read saved options from local storage and return in Map
 * 
 */
async function getSavedOptions() {

    try {
        let options = new Map();
        let saved = await browser.storage.local.get("settings");

        if (saved.settings !== undefined) {
            // read saved values
            options.set('autosave', saved.settings.autosave);    
            options.set('interval', saved.settings.interval);    
            options.set('overwrite', saved.settings.overwrite);  
            options.set('savepinned', saved.settings.savepinned);
        } else {
            // apply defaults
            options.set('autosave', false);     // default false
            options.set('interval', "5");       // default 5 min
            options.set('overwrite', false);   // default false
            options.set('savepinned', false);  // default false
        }

        console.log('getSavedOptions returning ', [...options]);
        return options;
        
    } catch (error) {
        console.error(`An error occurred during getSavedOptions: ${error.message}`);
        
    }
}
  
  
/**
 * Save options to local storage
 * 
 */

async function saveOptions(options) {

    try {
        console.log('Saving options ', [...options]);

        let settings = {
            autosave: options.get('autosave'),
            interval: options.get('interval'),
            overwrite: options.get('overwrite'),
            savepinned: options.get('savepinned')
        }

        // if you do set(options) each key/value pair is expanded
        // if you do set({options}) you find ONE key `options` with (k,v) inside
        await browser.storage.local.set({settings});

    } catch(error) {
        console.error(`An error occurred during saveOptions: ${error.message}`);
    }
}


/**
 * Bookmark currently open tabs under folder with id folderId.
 * If 'overwrite', then existing bookmarks are erased before 
 * saving the new ones, otherwise it's a merge.
 * 
 */
async function saveCurrentTabs(folderId, options, tabsquery={currentWindow: true}) {

    try {
        var existingBookmarks = new Map();  // holds already bookmarked links
        var missingBookmarks = new Map();   // holds tabs open not already bookmarked

        // get values from options
        var overwrite = options.get('overwrite');
        var savepinned = options.get('savepinned');
        
        // get list of currently open tabs
        // tabsquery can be:
        //      {currentWindow: true}  --> only the current browser window
        //      {}                     --> all tabs in any browser window
        var openTabs = await browser.tabs.query(tabsquery);

        /**
         * In the manual mode, if seleceted, a new folder would still be created,
         * but it would be empty, since the tabs will be skipped.
         * In the autosave mode, it will prevent overwriting the current day's 
         * folder with an empty list.
         */
        // Check if the open tabs is empty (or just the empty tab)
        if (openTabs.length === 0) {
            console.log('No tabs are open: nothing to do');
            return;
        }

        /**
         * If the open tabs is just the empty tab,
         * then there is nothing to do.
         */
        // Check if the open tabs is just the empty tab
        if (openTabs.length === 1 && newTabUrls.includes(normalizeUrl(openTabs[0].url))) {
            console.log('Just the empty tab is open: nothing to do');
            return;
        }

        // get list of already saved bookmarks in this folder
        console.log('folderId ', folderId);
        var savedBookmarks = await browser.bookmarks.getChildren(folderId);

        // store saved bookmarks as lookup list
        for (let saved of savedBookmarks) {
            existingBookmarks.set(saved.url, saved.title);
        }

        // split for performance/readability
        if (!overwrite) {  // just add missing tabs

            // compare open tabs to existingBookmarks and skip existing ones
            for (let tab of openTabs) {

                // skip pinned tabs: they are automatically saved by the browser
                if ( tab.pinned && !savepinned ) {
                    continue;
                }

                if ( !existingBookmarks.has(tab.url) ) {
                    await browser.bookmarks.create({
                        parentId: folderId,
                        title: tab.title,
                        url: tab.url
                    });
                }
            }

        } else {  // overwrite original content
            
            // Many ways:
            // - completely remove existing saved tabs and add everything open
            // - remove the subtree, and recreate the folder
            // - remove and add only the diff between desired and existing (implemented below)

            // This is the full final list we want to have stored
            let allBookmarks = new Map();
            for (let tab of openTabs) {

                // skip pinned tabs if the setting is false: they are automatically saved by the browser
                if ( tab.pinned && !savepinned ) {
                    continue;
                }

                allBookmarks.set(tab.url, tab.title);
            }

            // remove saved bookmarks if they are not in allBookmarks
            for (let saved of savedBookmarks) {
                if (allBookmarks.has(saved.url)) {
                    // do not delete from bookmarks but remove from allBookmarks
                    // since it's already there (we don't need to add it back)
                    allBookmarks.delete(saved.url)
                    continue;
                }
                await browser.bookmarks.remove(saved.id);  
            }

            // save the remaining open tabs
            for (let [url, title] of allBookmarks) {
                await browser.bookmarks.create({
                    parentId: folderId,
                    title: title,
                    url: url
                });
            }
        }

    } catch(error) {
        console.error(`An error occurred during saveCurrentTabs: ${error.message}`);
    }
}
