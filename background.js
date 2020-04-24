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
 Version : 1.1.0
           Fix issue #4 (https://github.com/salvoventura/save-my-tabs/issues/4)
               Duplicate tabs are detected by URL instead of Tab Title

           Implemented enhancement for issue #2 (https://github.com/salvoventura/save-my-tabs/issues/2)
               Default behavior is now to append new tabs to existing folder.
               Option given to delete all existing bookmarks if desired.
            



******************************************************************************/
"use strict";
// Prepare user interface:
// - populate the select box in the popup
// - attach click handler to the button
// prepareSaveFolderSelect();
// document.getElementById("btnSave").onclick = onSaveBtnClick;

async function messageHandler(request, sender, sendResponse) {
  console.log("Background scripts received: " + request.message);
  if (request.message == "Configuration was updated") {
    initializeAlarms();
  }
}

async function initializeAlarms() {
  // retrieve configuration and decide what to do
  let settings = await browser.storage.local.get("settings");
  let is_checked = settings.settings.autosave;
  let interval = settings.settings.interval;
  
  console.log(`Background script retrieved settings as ${is_checked} ${interval}`)

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
}

async function doSomething(alarm) {
  console.log('Logging upon alarm ' + alarm.name);
  let openTabs = await browser.tabs.query({currentWindow: true});
  for (let tab of openTabs) {
      console.log(' --> ' + tab.title);
  }

}

console.debug("Background script starting up");
initializeAlarms();
browser.runtime.onMessage.addListener(messageHandler);
