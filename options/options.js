/******************************************************************************
  Author : Salvatore Ventura <salvoventura@gmail.com>
    Date : 25 Apr 2020
   AddOn : Save my tabs!
 Purpose : Options script. This handles the options page.
 Version : 1.2.0
           Introducing autosave
******************************************************************************/


/**
 * Retrieve options value save in storage and apply them to UI
 * 
 */
async function ui_loadSavedOptions() {

    try {
      let options = await getSavedOptions();
     
      document.getElementById("autosave-switch").checked = options.get("autosave");
      document.getElementById("autosave-options").value = options.get("interval");
      document.getElementById("autosave-overwrite").checked = options.get("overwrite");
      toggleControls();
  
    } catch(error) {
        console.error(`An error occurred during ui_loadSavedOptions: ${error.message}`);
    }
}


/**
 * Event listener to update UI and save settings
 * upon changes in autosave section.
 * 
 */
async function ui_getOptionsAndSave() {
  
    try {
        let options = new Map();

        options.set('autosave', document.getElementById('autosave-switch').checked );
        options.set('interval', document.getElementById("autosave-options").value );
        options.set('overwrite', document.getElementById('autosave-overwrite').checked);

        await saveOptions(options);
  
    } catch(error) {
        console.error(`An error occurred during toggleAutosaveSection ${error.message}`);
    }
 }


 /**
  * Handle enable/disable controls in UI based on autosave being on/off
  */
function toggleControls() {
    let autosaveOn = document.getElementById("autosave-switch").checked;
    document.getElementById("autosave-options").disabled = !autosaveOn;
    document.getElementById("autosave-overwrite").disabled = !autosaveOn;
}
  
  
/**
 * Attach event handler to any options-related UI element
 * that requires saving.
 */
ui_loadSavedOptions();
document.getElementById("autosave-switch").addEventListener('change', ui_getOptionsAndSave);
document.getElementById("autosave-switch").addEventListener('change', toggleControls);
document.getElementById("autosave-options").addEventListener('change', ui_getOptionsAndSave);
document.getElementById("autosave-overwrite").addEventListener('change', ui_getOptionsAndSave);
document.getElementById("btnSave").addEventListener('click', ui_getOptionsAndSave);