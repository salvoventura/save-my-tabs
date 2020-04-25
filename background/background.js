/******************************************************************************
  Author : Salvatore Ventura <salvoventura@gmail.com>
    Date : 23 Apr 2020
 Purpose : Background script
           This is needed to keep alarms running.
           Alarms are the events that will trigger the tab save for autosave.
           Background and popup need to communicate.
           Storage is used to save settings for autosave.
 Version : 1.2.0
           Introducing autosave
******************************************************************************/
"use strict";

var isFirefox = typeof InstallTrigger !== 'undefined';
let TOOLBAR_ID = isFirefox ? "toolbar_____" : "1";


async function messageHandler(request, sender, sendResponse) {
  console.log("Background scripts received: " + request.message);
  if (request.message == "Configuration was updated") {
    initializeAlarms();
  }
}


async function initializeAlarms() {
  /**
   * Retrieve saved options and initialize alarms accordingly
   * 
   * TODO: maybe set defaults. First run, this will error out,
   *       which is harmless: no settings, no autosave; but it
   *       gets enabled once you check the autosave box.
   */

  // try-catch wrapper to make Chrome happy
  try {
    let settings = await browser.storage.local.get("settings");
    let is_checked = settings.settings.autosave;
    let interval = settings.settings.interval;
    let overwrite = settings.settings.overwrite;
    
    console.log(`Background script retrieved settings as ${is_checked} ${interval} ${overwrite}`)

    // kill any alarms first
    await browser.alarms.clearAll()

    if (is_checked) {
      // create a new alarm
      await browser.alarms.create(
        "auto-save", 
        {
          periodInMinutes: Number(interval)
        }
      );
      await browser.alarms.onAlarm.addListener(doSomething);
    }

  } catch(error) {
    console.error(`Background: an error occurred during initializeAlarms: ${error.message}`);
  }

}


async function bookmarkMyTabs(folderId, replaceAll) {
  /* Loop through all open tabs, and then save them in the new/existing
     bookmark toolbar subfolder selected, passed here via folderId
     If replaceAll is true, first delete all existing bookmarks
  */

  // try-catch wrapper to make Chrome happy
  try {
      console.log('Starting bookmarkMyTabs');

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

      /**
       * IMPORTANT
       * tabs.query returns a list of tabs.
       *    'currentWindow: true' means "only pick tabs in the current window"
       * 
       * This is ok if you only have ONE browser window. If you have more windows open
       * then there might be a disaster
       * 
       * Scenario
       *  - multiple browser windows open
       *  - use the overwrite options
       *  - User presses "save tabs" on window 1: list of tabs gets saved
       *  - User moves to window 2, and presses "save tabs" to same folder as above
       * 
       * Result
       *  - only tabs from Window 2 have been persisted
       * 
       * It's a tricky situation. I'd rather have more than lost something.
       * We will remove the filter or give a warning option to users.
       * 
       */
      
      
      // get list of currently open tabs
      // let openTabs = await browser.tabs.query({currentWindow: true});
      let openTabs = await browser.tabs.query();  // from any open window
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
      console.error(`Background: an error occurred during bookmarkMyTabs ${folderId}: ${error.message}`);
  }
}


async function getAutosaveRoot() {
  /**
   * Make sure we have an AUTOSAVE folder
   * Return the folderId
   */

  try {
    // Check if folder exists, otherwise create
    let folderId ='';
    let folderName = 'AUTOSAVE';
    let results = await browser.bookmarks.search({title: folderName});
    
    if (results.length) {
      folderId = results[0].id;
      console.log(`Found ${folderName} with id ${folderId}`);
      
    } else {
      console.log(`I did not find ${folderName}: need to create it`)
      let creation = await browser.bookmarks.create({
        parentId: TOOLBAR_ID,
        title: folderName,
        url: null
      });
      folderId = creation.id;
      console.log(`Background: folder ${folderName} created with id ${folderId}`);
    }
    return folderId;
     
  } catch(error) {
    console.error(`Background: an error occurred during getAutosaveRoot: ${error.message}`);
  }
}

async function getDailyFolder(autosaveroot) {
  /**
   * Make sure we have a daily folder for backups and create one if not.
   */
  try {
    let folderId ='';
    let folderName = new Date().toISOString().slice(0, 10);
    let results = await browser.bookmarks.search({title: folderName});
    
    if (results.length) {
      folderId = results[0].id;
      console.log(`Found ${folderName} with id ${folderId}`);
      
    } else {
      console.log(`I did not find ${folderName}: need to create it`)
      let creation = await browser.bookmarks.create({
        parentId: autosaveroot,
        title: folderName,
        url: null
      });
      folderId = creation.id;
      console.log(`Background: folder ${folderName} created with id ${folderId}`);
    }
    return folderId;

  } catch(error) {
    console.error(`Background: an error occurred during getDailyFolder: ${error.message}`);
  }
}


async function doSomething(alarm) {
  /**
   * Alarm event handler: performs the tab save
   */
  console.log('Waking upon alarm ' + alarm.name);

  // try-catch wrapper to make Chrome happy
  try {

    let rootId = await getAutosaveRoot();
    let folderId = await getDailyFolder(rootId);
    console.log(`Background: going to use folder with id ${folderId}`);

    // Before we go further, load settings and check again
    console.log('Checking settings before we go further');
    let settings = await browser.storage.local.get("settings");
    let is_checked = settings.settings.autosave;
    // let interval = settings.settings.interval;
    let overwrite = settings.settings.overwrite;

    if (is_checked) {
      // Now use this folderId to save in it all tabs, and respect replaceAll user selection
      console.log("It's a go: let's save tabs");
      await bookmarkMyTabs(folderId, overwrite);
    
    } else {
      // potential for race condition, should not do much harm
      console.log("Apparently nothing we should be doing now.");
    }

  } catch(error) {
    console.error(`Background: an error occurred while loading existing folders: ${error.message}`);
  }
}

console.debug("Background script starting up");
initializeAlarms();
browser.runtime.onMessage.addListener(messageHandler);
