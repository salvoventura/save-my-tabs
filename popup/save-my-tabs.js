/******************************************************************************
  Author : Salvatore Ventura <salvoventura@gmail.com>
    Date : 26 May 2019
 Purpose : Save all browser open tabs to a folder in the Bookmarks Toolbar.
           Give options to the user on which folder to use, in particular:
           - list of currently existing bookmark folder
             - includes predefined names for convenience (in green), like:
               - today's date in YYYY-mm-dd format
               - today's date in YYYY-mm-dd HH:MM:SS
               - 'Save my tabs!' string
           - input field for user to write desired (new) folder name
             - this overrides any selection on the list
           Compatible with Chrome and Firefox, via webextension-polyfill v.0.4.0
 Version : 1.2.0
           Implemented autosave for issue #2 (https://github.com/salvoventura/save-my-tabs/issues/2)
               Default behavior is now to append new tabs to existing folder.
               Option given to delete all existing bookmarks if desired.

 Version : 1.1.0
           Fix issue #4 (https://github.com/salvoventura/save-my-tabs/issues/4)
               Duplicate tabs are detected by URL instead of Tab Title

           Implemented enhancement for issue #2 (https://github.com/salvoventura/save-my-tabs/issues/2)
               Default behavior is now to append new tabs to existing folder.
               Option given to delete all existing bookmarks if desired.
 Version : 1.0
            



******************************************************************************/
"use strict";
// https://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser
// chrome detection from this post triggers true on FF as well, hence using Firefox detection
// Firefox 1.0+
var isFirefox = typeof InstallTrigger !== 'undefined';

/*
 Predefined bookmark folders have different IDs in different browsers.
 Need to set this accordingly

                     Chrome    Firefox
 'Bookmarks Bar':       "1"    "toolbar_____"
 'Other Bookmarks':     "2"    "unfiled_____"
*/
let TOOLBAR_ID = isFirefox ? "toolbar_____" : "1";


async function bookmarkMyTabs(folderId, replaceAll) {
  /* Loop through all open tabs, and then save them in the new/existing
     bookmark toolbar subfolder selected, passed here via folderId
     If replaceAll is true, first delete all existing bookmarks
  */

  // try-catch wrapper to make Chrome happy
  try {
      var allbookmarks = {};  // must use var instead of let because of the conditional block w/ replaceAll

      // get list of existing bookmarks in this folder and delete them as we go
      let existingBookmarks = await browser.bookmarks.getChildren(folderId);
      for (let existing of existingBookmarks) {
          allbookmarks[existing.url] = existing.title;  // store existing bookmarks in global list first
          await browser.bookmarks.remove(existing.id);  // remove from the browser
      }

      if (replaceAll) {
          // reset the allbookmarks list
          allbookmarks = {};
      }

      // get list of currently open tabs
      let openTabs = await browser.tabs.query({currentWindow: true});
      for (let tab of openTabs) {
          allbookmarks[tab.url] = tab.title;
      }

      // save all bookmarks
      for(let theurl in allbookmarks) {
          let thetitle = allbookmarks[theurl];
          await browser.bookmarks.create({
              parentId: folderId,
              title: thetitle,
              url: theurl
          });
      }

  } catch(error) {
      console.error(`An error occurred during bookmarkMyTabs ${folderId}: ${error.message}`);
  }
}


async function prepareSaveFolderSelect() {
  /* Populate the addon popup select element with the list of bookmark folders
     already present on the Toolbar.
     Add some presets as convenient new folder names (in green).
  */

  // try-catch wrapper to make Chrome happy
  try {
      // Get list of subfolders of the Bookmark Toolbar
      let selectFolder = document.getElementById("folder-list");
      let toolbarFolders = await browser.bookmarks.getChildren(TOOLBAR_ID);

      // Append values as items to the select element of the popup
      for (let folder of toolbarFolders) {
          if (folder.url !== undefined) continue;
          let option = new Option(folder.title, folder.id, false, false);
          selectFolder.appendChild(option);
      }

      // Add preset options: these folders, if selected, need to be created
      var additionalOptions = [
        new Date(new Date().toString().split('GMT')[0]+' UTC').toISOString().split('.')[0].replace('T',' '),
        new Date().toISOString().slice(0, 10),
        'Save my tabs!'
      ];

      // Create a list of existing folder names, for the next step
      let checklist = [];
      for (let folder of toolbarFolders) {
          checklist.push(folder.title);
      }

      // Skip additionalOptions folders that have been created already.
      // These would have been picked up already by the first loop.
      for (let folder of additionalOptions) {
          if (checklist.indexOf(folder) != -1) {
              continue; // already exists: skip
          }
          let option = new Option(folder, "tobecreated", false, false); // use "tobecreated" as special id
          option.classList.add("green");
          selectFolder.appendChild(option);
      }

  } catch(error) {
      console.error(`An error occurred during prepareSaveFolderSelect: ${error.message}`);
  }
}


async function onSaveBtnClick() {
  /* Initiate the save process:
     1. detect user's desired folder to be used
     2. if necessary, create the bookmark folder
     3. save all open tabs in it
     4. close the popup window
  */

  // try-catch wrapper to make Chrome happy
  try {
      // detect user's desired folder to be used and
      // if necessary, create the bookmark folder
      let folderId;
      let folderName = document.getElementById("folder-name").value.trim();
      if (folderName === "") {
          // use value from the select box
          let folderList = document.getElementById("folder-list");
          folderId = folderList.value;
          if (folderId === "tobecreated") {
              // retrieve the folder name from the select box
              folderName = folderList.options[folderList.selectedIndex].text;
          }
      } else {
          // use value from input box
          folderId = "tobecreated";
      }
      // Here folderName is not empty.
      // If folderId is == "tobecreated", we need to create it
      if (folderId === "tobecreated") {
          // create the folder, then retrieve the folder id
          let bookmarkFolder = await browser.bookmarks.create({
              parentId: TOOLBAR_ID,
              title: folderName,
              url: null
          });
          folderId = bookmarkFolder.id;
      }

      // Check if user wants to delete existing bookmarks first
      let replaceAll = document.getElementById("folder-replace-all").checked
      console.log(`replaceAll ${replaceAll}`)

      // Now use this folderId to save in it all tabs, and respect replaceAll user selection
      // then close the popup window (as completion indicator)
      bookmarkMyTabs(folderId, replaceAll).then(()=>{window.close()});

  } catch(error) {
      console.error(`An error occurred during onSaveBtnClick: ${error.message}`);
  }
}


async function toggleAutosaveSection() {
  /**
   * Event listener to update UI and save settings
   * upon changes in autosave section.
   */

   // try-catch wrapper to make Chrome happy
  try {
    let autoSaveList = document.getElementById('autosave-list');
    let autoSaveOverwrite = document.getElementById('autosave-replace-all');
    let autoSaveSwitch = document.getElementById('autosave-switch');
  
    if (autoSaveSwitch.checked) {
      console.log('Autosave turned ON');
      autoSaveList.disabled = false;
      autoSaveOverwrite.disabled = false;
  
    } else {
      console.log('Autosave turned OFF');
      autoSaveList.disabled = true;
      autoSaveOverwrite.disabled = true;
    }

  } catch(error) {
      console.error(`An error occurred during toggleAutosaveSection ${error.message}`);
  }

}


async function saveOptions() {
  /**
   * Retrieve options from UI and save them in storage
   */
  
   // try-catch wrapper to make Chrome happy
  try {
    let autosave_on = document.getElementById('autosave-switch').checked;
    let autosave_interval = document.getElementById("autosave-list").value;
    let autosave_overwrite_on = document.getElementById('autosave-replace-all').checked;
    
    console.log(`Saving options as auto-save ${autosave_on} interval ${autosave_interval} overwrite ${autosave_overwrite_on}`);
  
    // prepare data for saving
    let settings = {
        autosave: autosave_on,
        interval: autosave_interval,
        overwrite: autosave_overwrite_on
    } 
  
    // if you do set(settings) you find two keys in storage: `autosave` and `interval`
    // if you do set({settings}) you find ONE key `settings` with two (k,v)
    await browser.storage.local.set({settings});

  } catch(error) {
      console.error(`An error occurred during saveOptions: ${error.message}`);
  }
}


async function tellBackendScript() {
  /**
   * Send a wake-up message to backend script to handle Alarms
   */

   // try-catch wrapper to make Chrome happy
  try {

    console.log('Sending wake-up message to backend');
    await browser.runtime.sendMessage(
      {
        message: "Configuration was updated"
      }
    );

  } catch(error) {
      console.error(`An error occurred during tellBackendScript: ${error.message}`);
  }

}


async function loadSavedOptions() {
  /**
   * Retrieve options value save in storage and apply them to UI
   */

   // try-catch wrapper to make Chrome happy
  try {
    let settings = await browser.storage.local.get("settings");
    console.log(`Retrieved settings as ${settings.settings.autosave} ${settings.settings.interval} ${settings.settings.overwrite}`)
    
    document.getElementById('autosave-switch').checked = settings.settings.autosave;
    document.getElementById("autosave-list").value = settings.settings.interval;
    document.getElementById("autosave-replace-all").checked = settings.settings.overwrite;

  } catch(error) {
      console.error(`An error occurred during loadSavedOptions: ${error.message}`);
  }
}


// async function setIcon(name) {
//   /**
//    * Change the icon during tab saving
//    */
//   let icon = {path: "icons/iconfinder_tab_new_raised_18931.png"};
//   if (name == "save") {
//     icon = {path: "icons/iconfinder_history_15533.png"};
//   }
//   return browser.browserAction.setIcon(icon);
// }
  

function all_well_log() {
  /**
   * Logging function to close any async call chain
   */
  console.log('Operation completed');
}


function some_error_log() {
  /**
   * Logging function to close any async call chain
   */
  console.log('An error occurred');
}


async function registerAutosaveToggle() {
  /**
   * Attach event handler to any options-related UI element
   * that requires saving.
   */

   // try-catch wrapper to make Chrome happy
  try {
    let optionElements = document.getElementsByClassName("options");
    for (let i=0; i < optionElements.length; i++ ) {
    
      optionElements[i].addEventListener(
          'change',
          function() { 
            toggleAutosaveSection()
            .then(saveOptions(), some_error_log)
            .then(tellBackendScript(), some_error_log)
            .then(all_well_log, some_error_log); 
          },
          false
      );
    }
      
  } catch(error) {
    console.error(`An error occurred during registerAutosaveToggle: ${error.message}`);
  }
}


function toggleMoreSettingsSection() {
  /**
   * Handler to toggle the more-settings section upon click
   */
  let moreSettingsSwitch = document.getElementById("more-settings-switch");
  let moreSettingsSection = document.getElementById("more-settings-section");
  if (moreSettingsSection.classList.contains('hidden')) {
    moreSettingsSection.classList.remove('hidden');
    moreSettingsSwitch.text = 'Close settings';
    

  } else {
    moreSettingsSection.classList.add('hidden');
    moreSettingsSwitch.text = 'More settings';

  }
}


/**
 *  MAIN
 *  Prepare user interface:
 *  - populate the select box in the popup
 *  - attach change handler to options elements
 *  - attach click handler to the save button
 *  - load saved options to UI
 */ 
prepareSaveFolderSelect();
registerAutosaveToggle();
document.getElementById("more-settings-switch").onclick = toggleMoreSettingsSection;
document.getElementById("btnSave").onclick = onSaveBtnClick;
loadSavedOptions().then(toggleAutosaveSection, some_error_log);
