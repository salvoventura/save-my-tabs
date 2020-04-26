/******************************************************************************
  Author : Salvatore Ventura <salvoventura@gmail.com>
    Date : 26 May 2019
   AddOn : Save my tabs!
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
            Implemented autosave for issue #1 (https://github.com/salvoventura/save-my-tabs/issues/1)
              Default autosave folder is AUTOSAVE. User can chose whether to append or replace content.
            Updated webextension-polyfill to v.0.6.0
            Updated bootstrap to v4.4.1
           
  Version : 1.1.0
            Fix issue #4 (https://github.com/salvoventura/save-my-tabs/issues/4)
              Duplicate tabs are detected by URL instead of Tab Title

            Implemented enhancement for issue #2 (https://github.com/salvoventura/save-my-tabs/issues/2)
              Default behavior is now to append new tabs to existing folder.
              Option given to delete all existing bookmarks if desired.
  Version : 1.0
******************************************************************************/


/**
 * Populate the addon popup select element with the list of bookmark folders
 * already present on the Toolbar.
 * 
 * Add some presets as convenient new folder names (in green).
 *  
 */ 
 async function ui_prepareSaveFolderSelect() {

  try {
      // Get list of subfolders of the Bookmark Toolbar
      let selectFolder = document.getElementById("folder-list");
      let toolbarFolders = await browser.bookmarks.getChildren(TOOLBAR_ID);

      // Append values as items to the select element of the popup
      let checklist = new Set(); // Create a list of existing folder names, for the next step
      for (let folder of toolbarFolders) {
          if (folder.url !== undefined) { 
            continue;  // it's a bookmark, not a folder: skip
          }
          let option = new Option(folder.title, folder.id, false, false);
          selectFolder.appendChild(option);
          checklist.add(folder.title);
      }

      // Add preset options: these folders, if selected, need to be created:
      // - Date+time
      // - Date
      // - Save my tabs!
      let dateTime = new Date(new Date().toString().split('GMT')[0]+' UTC').toISOString().split('.')[0].replace('T',' ');
      var additionalOptions = [
        dateTime,
        dateTime.slice(0, 10),
        'Save my tabs!'
      ];

      // Skip additionalOptions folders that have been created already.
      // These would have been picked up already by the first loop.
      for (let folder of additionalOptions) {
          if (checklist.has(folder)) {
              continue; // already exists: skip
          }
          let option = new Option(folder, "tobecreated", false, false); // use "tobecreated" as special id
          option.classList.add("green");
          selectFolder.appendChild(option);
      }

  } catch(error) {
      console.error(`An error occurred during ui_prepareSaveFolderSelect: ${error.message}`);
  }
}


/**
 * Save Button onClick handler:
 *  1. detect user's desired folder to be used
 *  2. if necessary, create the bookmark folder
 *  3. check overwrite flag
 *  4. save all open tabs in the folder
 *  5. close the popup window
 *  
 */
async function onSaveBtnClick() {

  try {
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
    // If folderId == "tobecreated", we need to create it
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
    let overwrite = document.getElementById("folder-overwrite").checked
    console.log("Got overwrite as ", overwrite);

    // Now use this folderId to save in it all tabs
    // then close the popup window (also a completion indicator)
    saveCurrentTabs(folderId, overwrite)
      .then( ()=>{
                  window.close()
                 }
      );

  } catch(error) {
      console.error(`An error occurred during onSaveBtnClick: ${error.message}`);
  }
}


/**
 * Settings Button onClick handler
 * 
 */
function onSettingsBtnClick() {
  browser.runtime.openOptionsPage()
    .then( ()=>{
      window.close()
    }
  );
}


/**
 * Check if more than one browser window is open
 * and display a warning message if user checks
 * the overwrite box
 */
async function ui_displayMultiWindowOverwriteWarning() {
  var gettingAll = await browser.windows.getAll();
  if (gettingAll.length > 1) {
    if (document.getElementById("folder-overwrite").checked) {
      document.getElementById("folder-overwrite-warning").classList.remove('hidden');
    } else {
      document.getElementById("folder-overwrite-warning").classList.add('hidden');
    }
  }
}


/**
 * MAIN
 * Prepare user interface:
 * - populate the select box in the popup
 * - attach click handler to the save button
 * - attach options handler to Settings link
 * 
 */
async function main() {

  try {
    console.debug("Popup script starting up");
    await ui_prepareSaveFolderSelect();

    document.getElementById("folder-overwrite").onchange = ui_displayMultiWindowOverwriteWarning;
    document.getElementById("btnSave").onclick = onSaveBtnClick;
    document.getElementById("btnSettings").onclick = onSettingsBtnClick;
      
  } catch (error) {
    console.error(`An error occurred during popup main: ${error.message}`);
  }
}


/**
 * Call Main: needed because of async call
 * 
 */
main();