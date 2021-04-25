const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const OPEN_DEV_TOOLS = true;
require('electron-reload')(__dirname, {
	electron: path.join(__dirname, '../node_modules', '.bin', 'electron'),
	awaitWriteFinish: true
});
const createWindow = (path, properties, cb) => {
	const win = new BrowserWindow(properties);
	win.loadFile(path).then(cb);
	if (OPEN_DEV_TOOLS)
		win.webContents.openDevTools();
	return win;
}

function createMainView() {
	// Create the browser window.
	const appWindow = createWindow('app/src/index.html', {
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
            		contextIsolation: false
		}

	});

	// Register event listeners
	appWindow.on('enter-full-screen', () => {
		appWindow.webContents.send('enter-full-screen', true);
	});
	appWindow.on('leave-full-screen', () => {
		appWindow.webContents.send('leave-full-screen', true);
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

app.on('active', () => {
	// On macOS it is common to re-create a window in the app when the 
	// dock icon is clicked and there are no other windows open
	if(BrowserWindow.getAllWindows().length === 0) {
		createMainView();
	}
});

// In this file you can include the rest of your app's specific main process 
// code. You can also put them in separate files and require them here
