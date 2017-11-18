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
var mainWindow = null; 	// The main "search/dictionary" window.
var splashWindow = null; // The splash page to display while Syng is loading.
var lgChars = null; // The window for displaying large characters for better visibility.
var manageLists = null; // The window to manage vocabulary lists.

// Quit when all windows are closed.
app.on('window-all-closed', function() {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicity with CMD + Q
	if(process.platform != "darwin") {
		app.quit();
	} else {
		app.hide();
	}
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
	// Load the main window
	mainWindow = new BrowserWindow({
		width: 1110,
		height: 655,
		show: false,
		title: "Syng",
		'auto-hide-menu-bar': true
	});

	mainWindow.loadURL("file://"+__dirname+"/../views/index.html");

	// Emitted when the window is closed.
	mainWindow.on('closed', function() {
		// Derefernce the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null;
		if(lgChars != null) {
			lgChars.close();
		}
		if(manageLists != null) {
			manageLists.close();
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

	// Large Characters Window
	lgChars = new BrowserWindow({
		width: 886,
		height: 497,
		show: false,
		resizable: true,
		parent: mainWindow,
		title: 'Syng | View Large Characters',
		'auto-hide-menu-bar': true
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

	// Manage Vocab Lists Window
	manageLists = new BrowserWindow({
		width: 600,
		height: 500,
		parent: mainWindow,
		title: 'Syng | Manage Lists',
		'auto-hide-menu-bar': true,
		show: false
	});

	manageLists.loadURL('file://'+__dirname+'/../views/manageLists.html');

	ipc.on('show-manage-lists', function(event, args) {
		manageLists.send('open-lists', args);

		if(!manageLists.isVisible()) {
			manageLists.show();
		}
	});

	manageLists.on('close', function(event) {
		if(mainWindow != null) {
			manageLists.hide();
			event.preventDefault();
			event.returnValue = false;
		}
	});

	manageLists.on('closed', function(event) {
		manageLists = null;
	});

	ipc.on('send-database-update', function(event, args) {
		mainWindow.send('receive-database-update');
	});

	// Import / Export Bookmarks and WorldLists
	ipc.on('export-wordlist', function(event, args) {
		var pathName = "db/syng/" + args.list;
		fs.readFile(path.join(__dirname, pathName), "utf-8", function(err, data) {
			if(err) {
				console.log("There was an error reading the database file. File = " + pathName);
				console.log(err);
				dialog.showErrorBox("File Read Error", "There was an error reading the list's database file. Error = " + err);
			}
			else {
				dialog.showSaveDialog({ title: 'Export List', filters: [{ name: 'Syng List Data', extensions: ['sld'] }] }, function(file) {
					if(file == undefined || file == null) {
						console.log("There was an error with the chosen file.");
						console.log(file);
						dialog.showErrorBox("File Selection Error", "There was an error with the chosen file.");
					}
					else {
						file = file + '.sld';
						fs.writeFile(file, data, function(err) {
							if(err) {
								console.log("There was an error writing the exported list data to a file.");
								console.log(err);
								dialog.showErrorBox("File Write Error", "There was an error writing the exported list data to a file. Error: " + err);
							}
							else {
								mainWindow.send('successfully-exported-list');
							}
						});
					}
				});
			}
		});
	});

	ipc.on('import-wordlist', function(event, args) {
		var pathName = 'db/syng/' + args.list;

		dialog.showOpenDialog({ title: 'Import List', properties: ['openFile'], filters: [{ name: 'Syng List Data', extensions: ['sld', 'sdb'] }] }, function(file) {
			if(file == undefined || file == null) {
				console.log('There was an error opening the file.');
				console.log(file);
				dialog.showErrorBox('Open File Error', 'There was an error opening the file.');
			}
			else {
				fs.readFile(file[0], 'utf-8', function(err, data) {
					if(err) {
						console.log('There was an error reading in the file.');
						console.log(err);
						dialog.showErrorBox('File Read Error', 'There was an error reading the selected file. Error: ' + err);
					}
					else {
						fs.appendFile(path.join(__dirname, pathName), data, function(err) {
							if(err) {
								console.log('There was an error appending the database file.');
								console.log(err);
								dialog.showErrorBox('File Write Error', 'There was an error appending the database. Error = ' + err);
							}
							else {
								mainWindow.send('successfully-imported-list', args);
							}
						});
					}
				});
			}
		});
	});

	// Import and Export bookmarks
	ipc.on('start-bookmarks-import', function (event, args) {
		dialog.showOpenDialog({
			title: "Import Bookmarks",
			properties: ['openFile'],
			filters: [{
				name: 'Syng Dictionary Bookmarks Backup',
				extensions: ['sdb']
			}]
		}, function (file) {
			if (file == undefined || file == null) {
				console.log("There was an error opening the file.");
				console.log(file);
				dialog.showErrorBox("Open File Error", "There was an error opening the file.");
			} else {
				fs.readFile(file[0], 'utf-8', function (err, data) {
					if (err) {
						console.log("There was an error reading in the file.");
						console.log(err);
						dialog.showErrorBox("File Read Error", "There was an error reading the selected file. Error: " + err);
					} else {
						fs.appendFile(path.join(__dirname, "db/syng/bookmarks"), data, function (err) {
							if (err) {
								console.log("There was an error appending the database file.");
								console.log(err);
								dialog.showErrorBox("File Write Error", "There was an error appending the database. Error: " + err);
							} else {
								bookmarksWindow.send('successfully-imported-bookmarks');
							}
						});
					}
				});
			}
		});
	});

	ipc.on('bookmarks-export-data', function (event, args) {
		dialog.showSaveDialog({
			title: 'Export Bookmarks',
			filters: [{
				name: 'Syng Dictionary Bookmarks Backup',
				extensions: ['sdb']
			}]
		}, function (file) {
			if (file == undefined || file == null) {
				console.log("There was an error with the chosen file.");
				console.log(file);
				dialog.showErrorBox("File Selection Error", "There was an error with the chosen file.");
			} else {
				fs.readFile(path.join(__dirname, "db/syng/bookmarks"), "utf-8", function (err, data) {
					if (err) {
						console.log("There was an error reading the bookmarks file that syng is stored.");
						console.log(err);
						dialog.showErrorBox("File Read Error", "There was an error reading the bookmarks database file. Error: " + err);
					} else {
						fs.writeFile(file, data, function (err) {
							if (err) {
								console.log("There was an error writing the exported bookmarks to a file.");
								console.log(err);
								dialog.showErrorBox("File Write Error", "There waas an error writing the exported bookmarks to a file. Error: " + err);
							} else {
								bookmarksWindow.send('successully-exported-bookmarks');
							}
						});
					}
				});
			}
		});
	});
});
