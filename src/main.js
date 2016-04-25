'use strict';

const electron = require('electron');
const ipc = require('electron').ipcMain;
const app = electron.app; //Module to control application life.
const BrowserWindow = electron.BrowserWindow; //Module to create native browser window.
const dialog = require('electron').dialog;
var fs =  require('fs');
var path = require('path');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;
var aboutWindow = null;
var splashWindow = null;
var bookmarksWindow = null;
var flashcardsWindow = null;
var testWindow = null;
var lgChars = null;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicity with CMD + Q
	if(process.platform != "darwin") {
		app.quit();
	}
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 950,
		height: 420,
		show: false
	});

	// and load the index.html of the app.
	mainWindow.loadURL('file://'+ __dirname + '/../views/index.html');

	// Emitted when the window is closed.
	mainWindow.on('closed', function() {
		// Derefernce the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null;
		aboutWindow.close();
		bookmarksWindow.close();
		lgChars.close();
		flashcardsWindow.close();
		testWindow.close();
	});

	// About Dialog Window
	aboutWindow = new BrowserWindow({
		width: 500,
		height: 500,
		show: false,
		resizable: false
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
		show: false
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
		dialog.showOpenDialog({ title: "Import Bookmarks", properties: ['openFile'], filters: [{name: 'JSON', extensions: ['json']}]}, function(file) {
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
		dialog.showSaveDialog({ title: 'Export Bookmarks', filters: [ {name: 'JSON', extensions: ['json']}] }, function(file) {
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
		resizable: false
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
		show: false
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
		width: 950,
		height: 420,
		show: false
	});

	testWindow.loadURL('file://'+__dirname+"/../views/test.html");

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

	ipc.on('generate-test', function(event, args) {
		if(!testWindow.isVisible()) {
			testWindow.show();
		}

		testWindow.send('generate-new-test');
	});
});
