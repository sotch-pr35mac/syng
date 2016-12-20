'use strict';

const electron = require('electron');
const ipc = require('electron').ipcMain;
const app = electron.app; //Module to control application life.
const BrowserWindow = electron.BrowserWindow; //Module to create native browser window.
const dialog = require('electron').dialog;
var fs = require('fs');
var path = require('path');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null; 	// The main "search/dictionary" window. Has no parent.
var aboutWindow = null; // The about window with program information. Has no parent.
var splashWindow = null; // The splash page to display while Syng is loading. Has no parent.
var bookmarksWindow = null; // The bookmarks window with all the saved searches. Has no parent.
var flashcardsWindow = null; // The window to display study flash cards (not testing feature). Has `bookmarksWindow` as parent.
var testWindow = null; // The test window (to test the learner on their ability). Has `bookmarksWindow` as parent.
var lgChars = null; // The window for displaying large characters for better visibility. Has `mainWindow` as parent.
var pinyinConvertWindow = null; // The Pinyin Converter Window. Has no parent.
var characterConvertWindow = null; // The Traditional to Simplified and vice versa character converter window. Has no parent.

// Quit when all windows are closed.
app.on('window-all-closed', function() {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicity with CMD + Q
	/*if(process.platform != "darwin") {
		app.quit();
	}*/

	// Fixed startup and shut down behavior on macOS
	app.quit();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
	// Main Window Size will be different on Windows because of button rendering differences
	// Determine the size of the window here
	var mainWindowWidth = 950;
	if(process.platform == "win32") {
		mainWindowWidth = 990;
	}

	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: mainWindowWidth,
		height: 420,
		show: false,
		title: 'Syng | Chinese to English Dictionary'
	});

	// and load the index.html of the app.
	mainWindow.loadURL('file://'+ __dirname + '/../views/index.html');

	// DEBUG
	mainWindow.openDevTools();

	// Emitted when the window is closed.
	mainWindow.on('closed', function() {
		// Derefernce the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null;
		if(aboutWindow != null) {
			aboutWindow.close();
		}
		if(bookmarksWindow != null) {
			bookmarksWindow.close();
		}
		if(lgChars != null) {
			lgChars.close();
		}
		if(flashcardsWindow != null) {
			flashcardsWindow.close();
		}
		if(testWindow != null) {
			testWindow.close();
		}
		if(pinyinConvertWindow != null) {
			pinyinConvertWindow.close();
		}
		if(characterConvertWindow != null) {
			characterConvertWindow.close();
		}
	});

	ipc.on("switch-input", function(event, args) {
		mainWindow.send("toggle-search-input", args);
	});

	ipc.on('hide-syng', function(event, args) {
		if(mainWindow.isVisible()) {
			mainWindow.hide();
		}
	});

	ipc.on('show-syng', function(event, args) {
		if(!mainWindow.isVisible()) {
			mainWindow.show();
		}
	});

	// About Dialog Window
	aboutWindow = new BrowserWindow({
		width: 500,
		height: 500,
		show: false,
		resizable: false,
		title: 'About Syng'
	});

	aboutWindow.setMenu(null);

	aboutWindow.loadURL('file://'+__dirname+'/../views/about.html');

	aboutWindow.on('close', function(event) {
		if(mainWindow != null) {
			aboutWindow.hide();
			event.preventDefault();
			event.returnValue = false;
		}
	});

	aboutWindow.on('closed', function() {
		aboutWindow = null;
	});

	ipc.on('open-about-window', function(event, args) {
		if(!aboutWindow.isVisible()) {
			aboutWindow.show();
		}
	});

	// Splash Screen Window
	splashWindow = new BrowserWindow({
		width: 900,
		height: 600,
		show: true,
		frame: false,
		resizable: false
	});

	splashWindow.loadURL('file://'+__dirname+'/../views/splash.html');

	splashWindow.on('closed', function() {
		splashWindow = null;
	});

	ipc.on('finished-loading-dictinoary', function(event, args) {
		splashWindow.close();

		mainWindow.show();
	});

	// Bookmarks Window Settings
	bookmarksWindow = new BrowserWindow({
		width: 950,
		height: 420,
		show: false,
		title: 'Syng Bookmarks'
	});

	bookmarksWindow.loadURL('file://'+__dirname+'/../views/bookmarks.html');

	ipc.on('open-bookmarks-window', function(event, args) {
		if(!bookmarksWindow.isVisible()) {
			bookmarksWindow.show();
		}
	});

	ipc.on('refresh-bookmarks-window', function(event, args) {
		bookmarksWindow.send('refresh-page', args);
	});

	bookmarksWindow.on('close', function(event) {
		if(mainWindow != null) {
			bookmarksWindow.hide();
			event.preventDefault();
			event.returnValue = false;
		}
	});

	bookmarksWindow.on('closed', function(event) {
		bookmarksWindow = null;
	});

	// Import and Export bookmarks
	ipc.on('start-bookmarks-import', function(event, args) {
		dialog.showOpenDialog({ title: "Import Bookmarks", properties: ['openFile'], filters: [{name: 'Syng Dictionary Bookmarks Backup', extensions: ['sdb']}]}, function(file) {
			if(file == undefined || file == null) {
				console.log("There was an error opening the file.");
				console.log(file);
				dialog.showErrorBox("Open File Error", "There was an error opening the file.");
			}
			else {
				fs.readFile(file[0], 'utf-8', function(err, data) {
					if(err) {
						console.log("There was an error reading in the file.");
						console.log(err);
						dialog.showErrorBox("File Read Error", "There was an error reading the selected file. Error: "+err);
					}
					else {
						fs.appendFile(path.join(__dirname, "db/syng/bookmarks"), data, function(err) {
							if(err) {
								console.log("There was an error appending the database file.");
								console.log(err);
								dialog.showErrorBox("File Write Error", "There was an error appending the database. Error: "+err);
							}
							else {
								bookmarksWindow.send('successfully-imported-bookmarks');
							}
						});
					}
				});
			}
		});
	});

	ipc.on('bookmarks-export-data', function(event, args) {
		dialog.showSaveDialog({ title: 'Export Bookmarks', filters: [ {name: 'Syng Dictionary Bookmarks Backup', extensions: ['sdb']}] }, function(file) {
			if(file == undefined || file == null) {
				console.log("There was an error with the chosen file.");
				console.log(file);
				dialog.showErrorBox("File Selection Error", "There was an error with the chosen file.");
			}
			else {
				fs.readFile(path.join(__dirname, "db/syng/bookmarks"), "utf-8", function(err, data) {
					if(err) {
						console.log("There was an error reading the bookmarks file that syng is stored.");
						console.log(err);
						dialog.showErrorBox("File Read Error", "There was an error reading the bookmarks database file. Error: "+err);
					}
					else {
						fs.writeFile(file, data, function(err) {
							if(err) {
								console.log("There was an error writing the exported bookmarks to a file.");
								console.log(err);
								dialog.showErrorBox("File Write Error", "There waas an error writing the exported bookmarks to a file. Error: "+err);
							}
							else {
								bookmarksWindow.send('successully-exported-bookmarks');
							}
						});
					}
				});
			}
		});
	});

	// Large Characters Window
	lgChars = new BrowserWindow({
		width: 500,
		height: 500,
		show: false,
		resizable: false,
		parent: mainWindow,
		title: 'Syng | View Large Characters'
	});

	lgChars.loadURL('file://'+__dirname+'/../views/lgChar.html');

	ipc.on('show-large-characters', function(event, args) {
		lgChars.send('load-new-characters', args);

		if(!lgChars.isVisible()) {
			lgChars.show();
		}
	});

	lgChars.on('close', function(event) {
		if(mainWindow != null) {
			lgChars.hide();
			event.preventDefault();
			event.returnValue = false;
		}
	});

	lgChars.on('closed', function(event) {
		lgChars = null;
	});

	// Flashcards Window
	flashcardsWindow = new BrowserWindow({
		width: 600,
		height: 400,
		show: false,
		parent: bookmarksWindow,
		title: 'Syng | Flashcards'
	});

	flashcardsWindow.loadURL('file://'+__dirname+"/../views/flashcards.html");

	flashcardsWindow.on('close', function(event) {
		if(mainWindow != null) {
			flashcardsWindow.hide();
			event.preventDefault();
			event.returnValue = false;
		}
	});

	flashcardsWindow.on('closed', function(event) {
		flashcardsWindow = null;
	});

	ipc.on('generate-flashcards', function(event, args) {
		if(!flashcardsWindow.isVisible()) {
			flashcardsWindow.show();
		}

		flashcardsWindow.send('generate-new-set');
	});

	// Testing Window
	testWindow = new BrowserWindow({
		width: 520,
		height: 700,
		show: false,
		parent: bookmarksWindow,
		title: 'Syng | Test Progress'
	});

	testWindow.on('close', function(event, args) {
		if(mainWindow != null) {
			testWindow.hide();
			event.preventDefault();
			event.returnValue = false;
		}
	});

	testWindow.on('closed', function(event) {
		testWindow = null;
	});

	// Open Testing Window and Generate a New Test
	// Generate New Test Based on Bookmarks
	ipc.on('test-bookmarks', function(event, args) {
		// Load the correct version of the testing "game"
		testWindow.loadURL('file://'+__dirname+"/../views/test-bookmarks.html");

		// Show the window if it isn't already visible
		if(!testWindow.isVisible()) {
			testWindow.show();
		}
	});

	// Generate New Test Based on Random Words From Dictionary
	ipc.on('test-dictionary', function(event, args) {
		// Load the correct version of the testing "game"
		testWindow.loadURL('file://'+__dirname+"/../views/test-random.html");

		// Show the test window if it isn't already visible
		if(!testWindow.isVisible()) {
			testWindow.show();
		}
	});

	// Close the window as requested by the page
	ipc.on('close-test-window', function(event, args) {
		testWindow.hide();
	});

	// Make the window large enough on Windows computers
	var pinyinConvertWindowHeight = 420;
	if(process.platform == "win32") {
		pinyinConvertWindowHeight = 450;
	}

	// Hanle the Pinyin Convsersion Window
	pinyinConvertWindow = new BrowserWindow({
		width: 950,
		height: pinyinConvertWindowHeight,
		show: false,
		title: 'Syng | Convert Pinyin'
	});

	pinyinConvertWindow.loadURL('file://'+__dirname+"/../views/pinyinConvert.html");

	pinyinConvertWindow.on('close', function(event, args) {
		if(mainWindow != null) {
			pinyinConvertWindow.hide();
			event.preventDefault();
			event.returnValue = false;
		}
	});

	pinyinConvertWindow.on('closed', function(event) {
		pinyinConvertWindow = null;
	});

	ipc.on('open-pinyin-convert-window', function(event, args) {
		if(!(pinyinConvertWindow.isVisible())) {
			pinyinConvertWindow.show();
		}
	});

	// Make the window large enough on windows machines
	var characterConvertWindowHeight = 420;
	if(process.platform == "win32") {
		characterConvertWindowHeight = 450;
	}

	// Hanlde Character Converter Window
	characterConvertWindow = new BrowserWindow({
		width: 950,
		height: characterConvertWindowHeight,
		show: false,
		title: 'Syng | Convert Characters'
	});

	characterConvertWindow.loadURL('file://'+__dirname+"/../views/characterConvert.html");

	characterConvertWindow.on('close', function(event, args) {
		if(mainWindow != null) {
			characterConvertWindow.hide();
			event.preventDefault();
			event.returnValue = false;
		}
	});

	characterConvertWindow.on('closed', function(event) {
		characterConvertWindow = null;
	});

	ipc.on('open-character-convert-window', function(event, args) {
		if(!(characterConvertWindow.isVisible())) {
			characterConvertWindow.show();
		}
	});
});
