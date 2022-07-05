/*
 * File: preferenceManager.js
 * Description: Describes the preference manger to read and write Syng preferences.
 *  An instance of PreferenceManager class is created from a configuration file from
 *  the user data directory for the operating platform. After initialization the
 *  preference values are ready to be read and written. Initialization must occur.
 *  Changes must be saved with the save method in order to persist across sessions.
 *
 * Configuration file entries should conform to the following format. An example of
 *  this format can also be found at app/src/resources/defaults.json, which contains
 *  the default values for Syng.
 *  {
 *     "property": {               // The name of the preference. Must be a String.
 *        "value": "Some value",   // The value of the preference. Can be any type.
 *        "requiresRestart": false // Whether or not Syng needs to restart for this change to take effect. Must be a Boolean.
 *     }
 *  }
 */
import { handleError } from './error.js';
import { underTest } from './process.js';
const fs = require('fs');

const DEFAULTS_BASE = 'resources/defaults.json';
const DEFAULTS_PATH = underTest ? `../../${DEFAULTS_BASE}` : `./${DEFAULTS_BASE}`;
const DEFAULTS = require(DEFAULTS_PATH);

export class PreferenceManager {
	/*
	 * Description: Construct an instance of the preference manager
	 * Param: configurationFile: String: The name of the configuration file to load
	 * Return: PreferenceManager: The PreferenceManager instance
	 */
	constructor(configurationFile) {
		this._file = configurationFile;
		this._config;
		this.initialized = false; 
	}

	/*
	 * Description: Load the configuration file
	 * Return: Promise: Returns a Promise that resolves to undefined when the config file
	 *  finishes loading; rejects if the file doesn't exist or can't be created.
	 */
	init() {
		return new Promise((resolve, reject) => {
			const filePath = this._file;
			if(fs.existsSync(filePath) && !underTest) {
				// The configuration file exists and we should load it
				const content = fs.readFileSync(filePath);
				try {
					this._config = JSON.parse(content);
					this.initialized = true;
					resolve();
				} catch(e) {
					console.error(e);
					reject('There was an error loading user preferences. The file contains invalid JSON. Check the log for more details.');
				}
			} else {
				// The configuration file does not exist
				//  so we should load the defaults and
				//  save the defaults to a file so the user
				//  can save their preferences later

				// Optimistically use the defaults for this run
				this._config = DEFAULTS;
				this.initialized = true;

				// Create the configuration file for subsequent runs
				if(!underTest) {
					fs.writeFile(filePath, JSON.stringify(DEFAULTS), err => {
						if(err) {
							console.error(err);
							reject('There was an error loading user preferences. Could not initialize config file. Check the log for more details.');
						} else {
							resolve();
						}
					});

				}
			}
		});
	}

	/*
	 * Description: Get a given preference value from the loaded preference file.
	 * Param: property: String: The name of the preference to return the value for.
	 * Return: Any: The value of the given preoperty. Could be any valid type.
	 */
	get(property) {
		if(!this.initialized) {
			handleError('Cannot read preferences. Preferences not yet initialized.');
			return;
		}

		const preference = this._config[property];
		if(!preference) {
			handleError(`Requested preference ${property} does not exist!`);
		}
		return preference.value;
	}

	/*
	 * Description: Set a given preference to a given value.
	 * Param: property: String: The name of the preference to set.
	 * Param: value: Any: The value to set as the value of the given preference.
	 */
	set(property, value) {
		if(!this.initialized) {
			handleError('Cannot save preferences. Preferences not yet initialized.');
			return;
		}

		const preference = this._config[property];
		if(!preference) {
			handleError(`Requested preference ${property} does not exist!`);
			return;
		}
		if(preference.requiresRestart) {
			alert('You must restart Syng for this change to take effect.');
		}
		preference.value = value;
		if(!underTest) this.save();
	}

	/*
	 * Description: Save the working config. Changes must be saved to persist across sessions.
	 *  Handles errors if any occur while attempting to save the config.
	 */
	save() {
		if(!this.initialized) {
			handleError('Cannot save preferences. Preferences not yet initialized.');
			return;
		}

		fs.writeFile(this._file, JSON.stringify(this._config), err => {
			if(err) {
				handleError('Cannot save preferences. An unexpected error occurred. Check the log for more details.', err);
			} 
		});
	}
}
