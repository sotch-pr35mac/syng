const remote = require('electron').remote;
const ipc = require('electron').ipcRenderer;
const Menu = remote.Menu;
const MenuItem = remote.MenuItem;

window.addEventListener('contextmenu', function (e) {
  e.preventDefault();
  menu.popup(remote.getCurrentWindow());
}, false);

var template = [
  {
	 label: 'File',
	 submenu: [
		{
		  label: 'About',
		  //accelerator: 'CmdOrCtrl+B',
		  role: 'about',
        click: function() {
           ipc.send("open-about-window", "test");
         }
		},
	 ]
  },
  {
	 label: 'Help',
	 role: 'help',
	 submenu: [
		{
		  label: 'Report Bug',
		  //accelerator: 'CmdOrCtrl+R',
		  click: function() { require('electron').shell.openExternal('https://github.com/sotch-pr35mac/syng/issues') }
		},
	 ]
  },
];

if (process.platform == 'darwin') {
  var name = require('electron').remote.app.getName();
  template.unshift({
	 label: name,
	 submenu: [
		{
		  label: 'About ' + name,
		  role: 'about'
		},
		{
		  type: 'separator'
		},
		{
		  label: 'Services',
		  role: 'services',
		  submenu: []
		},
		{
		  type: 'separator'
		},
		{
		  label: 'Hide ' + name,
		  accelerator: 'Command+H',
		  role: 'hide'
		},
		{
		  label: 'Hide Others',
		  accelerator: 'Command+Alt+H',
		  role: 'hideothers'
		},
		{
		  label: 'Show All',
		  role: 'unhide'
		},
		{
		  type: 'separator'
		},
		{
		  label: 'Quit',
		  accelerator: 'Command+Q',
		  click: function() { app.quit(); }
		},
	 ]
  });
  // Window menu.
  template[3].submenu.push(
	 {
		type: 'separator'
	 },
	 {
		label: 'Bring All to Front',
		role: 'front'
	 }
  );
}

var menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
