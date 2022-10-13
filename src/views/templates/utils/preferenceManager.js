/*
 * File: preferenceManager.js
 * Description: Describes the preference manger to read and write Syng preferences.
 * An instance of PreferenceManager class is created from a desired pouchdb.
 * After initialization the preference values are ready to be read and written. 
 * Initialization must occur as Syng prefers to operate over a cache of the preferences
 * from the db during the session.
 */
import { handleError } from './error.js';

/*
 * Description: Construct a preference entry.
 * Param: restart: Boolean: True if a restart is required for this change
 * to take effect. False otherwise.
 * Param: value: Any: An arbitrary JSON value to store. Must be valid JSON,
 * so things like Date objects are invalid and will not be stored properly.
 * Return: Object: Returns an object representing a preferences entry with
 * the values provided.
 */
const createPreference = (restart, value) => {
	return {
		requiresRestart: restart,
		value: value
	};
};

export class PreferenceManager {
	/*
	 * Description: Construct an instance of the preference manager.
	 * Param: dbName: String: The name of the db to be loaded.
	 * Return: PreferenceManager: The PreferenceManager instance.
	 */
	constructor(dbName) {
		this._name = dbName;
		this._config = {};
		this.initialized = false; 
	}

	/*
	 * Description: Load and cache the user configuration. If no user configuration is found
	 * create one with the default configuration.
	 * Return: Promise: Returns a Promise that resolves to undefined when the config file
	 * finishes loading; rejects if the file doesn't exist or can't be created.
	 */
	init() {
		return new Promise((resolve, reject) => {
			/* eslint-disable no-undef */
			this._db = new PouchDB(this._name);
			this._db.get('config').catch(err => {
				if(err.name === 'not_found') {
					return {
						_id: 'config',
						transparency: createPreference(true, false),
						beta: createPreference(true, false),
						toneColors: createPreference(true, {
							colors: ['--sy-color--blue-3', 
								'--sy-color--yellow-1',
								'--sy-color--red-1', 
								'--sy-color--green-3', 
								'--sy-color--grey-4'],
							hasCustomColors: false
						})
					};
				} else {
					console.error(err);
					reject('There was an error loading user preferences. Check the logs for more details.');
				}
			}).then(configuration => {
				this._config = configuration;
				this.initialized = true;
				resolve();
			}).catch(err => {
				console.error(err);
				reject('There was an error loading user preferences. Check the logs for more details.');
			});
		});
	}

	/*
 	 * Description: A function that resolves a promise once the database has been initalized.
 	 * Should be used when data is required at application load when it is reasonable
 	 * that there may be a race condition with db initialization. Internally just polls the
 	 * value of `initialized` until initialization has completed.
 	 * Return: Promise: Returns a promise that resolves once initialization has been completed.
 	 */ 
	waitForInit() {
		/* eslint-disable no-unused-vars */
		return new Promise((resolve, reject) => {
			const pollInit = () => {
				if(this.initialized) {
					resolve();
				} else {
					setTimeout(pollInit, 10);
				}
			};
			pollInit();
		});
	}

	/*
	 * Description: Get a given preference value from the cached preferences.
	 * Param: property: String: The name of the preference to return the value for.
	 * Return: Any: The value of the given preoperty. Could be any valid type.
	 */
	get(property) {
		if(!this.initialized) {
			handleError('Cannot read preferences. Preferences not yet initialized.');
			console.log('Trying to access property ' + property);
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

		this._config[property].value = value;
		this._db.put(this._config).then(response => {
			if(response.ok) {
				this._config._rev = response.rev;
			} else {
				handleError('Cannot save preferences. An unknown error occurred. Check the log for more details.', response);
			}
		}).catch(err => {
			handleError('Cannot save preferences. An unknown error occurred. Check the logs for more details.', err);
			return;
		});
	}
}
