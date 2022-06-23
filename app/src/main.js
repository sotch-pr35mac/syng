// eslint-disable-next-line no-unused-vars
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { getAppMenu } = require(path.join(process.cwd(), 'app/src/menu.js'));

const DEBUG_MODE = process.argv.includes('--debug');
const OPEN_DEV_TOOLS = DEBUG_MODE;
const createWindow = (path, properties, cb) => {
	const win = new BrowserWindow(properties);
	win.loadFile(path).then(cb);
	if (OPEN_DEV_TOOLS)
		win.webContents.openDevTools();
	return win;
};
const getPreferencePath = () => DEBUG_MODE ? path.join(process.cwd(), 'app/src/resources/debug_config.json') : path.join(app.getPath('userData'), 'config.json');
const preferences = fs.existsSync(getPreferencePath()) ? require(getPreferencePath()) : require('./resources/defaults.json');
const appMenu = getAppMenu(app, process.platform);

// Keep a global reference to the main app window
let appWindow;
let characterWindow;

function hideAllWindows() {
	// Hide all windows
	characterWindow.hide();
	appWindow.hide();
}

function createMainView() {
	// Create the browser window.
	appWindow = createWindow('app/src/index.html', {
		width: 1110,
		height: 655,
		show: true, 
		title: 'Syng',
		scrollBounce: true,
		titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
		trafficLightPosition: {
			x: 19,
			y: 25
		},
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			additionalArguments: [`--configPath=${getPreferencePath()}`]
		},
		transparent: process.platform === 'darwin' && preferences.transparency.value, 
		vibrancy: process.platform === 'darwin' && preferences.transparency.value ? 'appearance-based' : undefined

	});

	// Register event listeners for main window
	appWindow.on('enter-full-screen', () => {
		appWindow.webContents.send('enter-full-screen', true);
	});
	appWindow.on('leave-full-screen', () => {
		appWindow.webContents.send('leave-full-screen', true);
	});
	appWindow.on('close', e => {
		if (process.platform === 'darwin') {
			e.preventDefault();
			hideAllWindows();
		}
	});

	// Create character window
	characterWindow = createWindow('app/src/characters.html', {
		width: 886,
		height: 497,
		show: false,
		title: 'Syng | Characters',
		scrollBounce: true,
		titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
		trafficLightPosition: {
			x: 19,
			y: 25
		},
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false
		}
	});

	// Register event listeners for character window
	characterWindow.on('close', e => {
		e.preventDefault();
		characterWindow.hide();
	});
	ipcMain.on('show-character-window', (e, word) => {
		characterWindow.webContents.send('display-characters', word);
		characterWindow.show();
	});
}

// Allow renderer process reuse
// to load native node modules
app.allowRendererProcessReuse = false;

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => createMainView()).catch(console.trace);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd+Q
	if(process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	// On macOS it is common to re-create a window in the app when the 
	// dock icon is clicked and there are no other windows open
	if(BrowserWindow.getAllWindows().length === 0) {
		createMainView();
	} else {
		appWindow.show();
	}
});

// Quit on macOS when the user requests to quit
app.on('before-quit', e => {
	if (process.platform === 'darwin') {
		e.preventDefault();
		app.exit();
	}
});

// Set the application menu
if(appMenu.length) {
	const menu = Menu.buildFromTemplate(appMenu);
	Menu.setApplicationMenu(menu);
}
