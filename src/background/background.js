/******************************************************************************
  Author : Salvatore Ventura <salvoventura@gmail.com>
    Date : 25 Apr 2020
   AddOn : Save my tabs!
 Purpose : Background script. This is needed to keep alarms running.
           Alarms are the events that will trigger the tab save for autosave.
           Listens to local storage changes to trigger Alarm resetting.
 Version : 1.2.0
           Introducing autosave
******************************************************************************/


/**
 * Initialize alarms according to saved options
 * 
 * TODO: maybe set defaults. First run, this will error out,
 *       which is harmless: no settings, no autosave; but it
 *       gets enabled once you check the autosave box.
 */
async function initializeAlarms(options, listener) {

  try {
    console.log("Updating alarms for ", [...options]);

    // kill any alarms first
    await browser.alarms.clearAll()

    if (options.get('autosave') === true) {
      // create a new alarm
      await browser.alarms.create(
        "autosave", 
        {
          periodInMinutes: Number(options.get('interval'))
        }
      );

      if (!browser.alarms.onAlarm.hasListener(listener)) {
        browser.alarms.onAlarm.addListener(listener);
      }
    }

  } catch(error) {
      console.error(`An error occurred during initializeAlarms: ${error.message}`);
  }

}


/**
 * Alarm event handler: performs the tab save
 * 
 */
async function PeriodicSave(alarm) {

  try {
    console.log(`PeriodicSave triggered by alarm ${alarm.name}`);

    // Redundant, but need to make sure all folders exist.
    // There is a possibility somebody deletes/renames them.
    let autoSaveRootId = await getFolderId(AUTOSAVE_ROOT_NAME, TOOLBAR_ID);
    let folderName = new Date(new Date().toString().split('GMT')[0]+' UTC').toISOString().split('.')[0].replace('T',' ').slice(0, 10);
    let folderId = await getFolderId(folderName, autoSaveRootId);
    console.log(`Going to use daily folder ${folderName} with id ${folderId}`);

    // Before we go further, load options and check again
    console.log('Checking options before we go further');

    let options = await getSavedOptions();

    if (options.get('autosave') === true) {
      // Now use this folderId to save in it all tabs, and respect replaceAll user selection
      console.log("Let's save tabs");
      await saveCurrentTabs(folderId, options, {});
    
    } else {
      // Nothing to do
      console.log("Apparently nothing we should be doing now.");
    }

  } catch(error) {
      console.error(`An error occurred during doSomething: ${error.message}`);
  }
}


/**
 * Listen to storage change to activate Alarms updates
 * 
 */
async function storageChangeListener() {

  try {
    // could leverage the onChanged parameters, but going for reuse
    let options = await getSavedOptions();
    await initializeAlarms(options, PeriodicSave);
    
  } catch (error) {
      console.error(`An error occurred during storageChangeListener: ${error.message}`);
  }
}


/**
 * MAIN
 * Retrieve saved options
 * Initialize Alarms
 * Install listener to browser.storage.onChanged
 * 
 */
async function main() {

  try {
    console.debug("Background script starting up");

    let options = await getSavedOptions();
    await initializeAlarms(options, PeriodicSave);
    
    if (!browser.storage.onChanged.hasListener(storageChangeListener)) {
      browser.storage.onChanged.addListener(storageChangeListener)
    }
      
  } catch (error) {
      console.error(`An error occurred during background main: ${error.message}`);
  }
}

/**
 * Call Main: needed because of async call
 * 
 */
main();