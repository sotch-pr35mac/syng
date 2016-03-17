'use strict';

const electron = require('electron');
const ipc = require('electron').ipcMain;
const app = electron.app; //Module to control application life.
const BrowserWindow = electron.BrowserWindow; //Module to create native browser window.

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;
var aboutWindow = null;
var splashWindow = null;

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
		width: 1200,
		height: 500,
		show: false
	});

	// and load the index.html of the app.
	mainWindow.loadURL('file://'+ __dirname + '/../views/index.html');
	mainWindow.openDevTools();

	// Emitted when the window is closed.
	mainWindow.on('closed', function() {
		// Derefernce the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null;
		aboutWindow.close();
	});

	// About Dialog Window
	var aboutWindow = new BrowserWindow({
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

	var splashWindow = new BrowserWindow({
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
});
