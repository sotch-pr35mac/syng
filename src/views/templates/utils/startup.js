/*
 * Description: Will run these commands at UI-load. Assume that the user already has access to the
 * UI at this point. Therefore, these actions should be quick to complete, if an action is mission
 * critical it should have fatal error handling, and where the results of these actions are used
 * throughout the application, checks and fallbacks should be in place in case the user requests
 * something from an action that hasn't completed yet. 
 */
import { inDebugMode } from './process.js';
import { handleError } from './error.js';
import { PreferenceManager } from './preferenceManager.js';
import { BookmarkManager } from './bookmarkManager.js';
import elasticScroll from 'elastic-scroll-polyfill';

// This should be run on all windows, not just the main window. Therefore
// it is run outside of the `runStartupActions` context.
window.onload = () => {
	elasticScroll({ appleDevicesOnly: false, intensity: 1});
};

// Startup actions to only be run once per application start.
export const runStartupActions = () => {
	const debugMode = inDebugMode();
	const configDb = debugMode ? 'development_config' : 'config';
	const listDb = debugMode ? 'development_word-lists' : 'word-lists';
	const bookmarkDb = debugMode ? 'development_bookmarks' : 'bookmarks';
	window.preferenceManager = new PreferenceManager(configDb);
	window.bookmarkManager = new BookmarkManager(listDb, bookmarkDb);

	const startupActions = [
		{
			name: 'init-dictionary',
			action: window.__TAURI__.invoke('init_dictionary')
		},
		{
			name: 'init-preference-manager',
			action: window.preferenceManager.init()
		},
		{
			name: 'cache-platform',
			action: window.__TAURI__.os.platform()
		},
		{
			name: 'init-bookmark-manager',
			action: window.bookmarkManager.init()
		}
	];
	const parseStartupResults = results => {
		return results.map((result, index) => {
			return {
				name: startupActions[index].name,
				result: result
			};
		});
	};
	const findResultByName = (name, results) => {
		const found = results.find(item => item.name === name);
		return found ? found.result : undefined;
	};

	const initializeStyles = () => {
		const colorSettings = window.preferenceManager.get('toneColors');
		if(colorSettings.hasCustomColors) {
			const globalStyles = document.querySelector(':root').style;
			const toneColors = colorSettings.colors;
			for(let i = 0; i < toneColors.length; i++) {
				globalStyles.setProperty(`--sy-tone-color--${i+1}`, toneColors[i]);
			}
		}
	};

	Promise.all(startupActions.map(item => item.action)).then(res => {
		const results = parseStartupResults(res);
		window.platform = findResultByName('cache-platform', results);
		document.dispatchEvent(new Event('init'));
		initializeStyles();
	}).catch(e => {
		handleError('There was an error starting Syng. Please quit and try again. If this problem persists please file a bug report.', e);
	});
};
