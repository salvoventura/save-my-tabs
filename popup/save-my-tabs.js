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


async function bookmarkMyTabs(folderId) {
  /* Loop through all open tabs, and then save them in the new/existing
     bookmark toolbar subfolder selected, passed here via folderId
  */

  // try-catch wrapper to make Chrome happy
  try {
      let allbookmarks = {};

      // get list of existing bookmarks in this folder and delete them as we go
      let existingBookmarks = await browser.bookmarks.getChildren(folderId);
      for (let existing of existingBookmarks) {
          // allbookmarks[existing.title] = existing.url;  // this would always keep tabs that you bookmarked but now closed
          await browser.bookmarks.remove(existing.id);
      }

      // get list of currently open tabs
      let openTabs = await browser.tabs.query({currentWindow: true});
      for (let tab of openTabs) {
          allbookmarks[tab.title] = tab.url;
      }

      // save all bookmarks
      for(let thetitle in allbookmarks) {
          let theurl = allbookmarks[thetitle];
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
      // Now use this folderId to save in it all tabs
      // then close the popup window (as completion indicator)
      bookmarkMyTabs(folderId).then(()=>{window.close()});
  } catch(error) {
      console.error(`An error occurred while loading existing folders: ${error.message}`);
  }
}

/* MAIN */
// Prepare user interface:
// - populate the select box in the popup
// - attach click handler to the button
prepareSaveFolderSelect();
document.getElementById("btnSave").onclick = onSaveBtnClick;
