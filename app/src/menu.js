const remote = require('electron').remote;
var ipc = require('electron').ipcRenderer;
const Menu = remote.Menu;
const MenuItem = remote.MenuItem;

// Add insert function into Array prototype
Array.prototype.insert = function (index, item) {
	this.splice(index, 0, item);
};

window.addEventListener('contextmenu', function (e) {
  e.preventDefault();
  menu.popup(remote.getCurrentWindow());
}, false);

var template = [
	{
		label: 'Edit',
  	submenu: [
  		{
  			label: "Undo",
  			accelerator: "CmdOrCtrl+Z",
  			selector: "undo:"
  		},
  		{
  			label: "Redo",
  			accelerator: "Shift+CmdOrCtrl+Z",
  			selector: "redo:"
  		},
  		{
  			type: "separator"
  		},
  		{
  			label: "Cut",
  			accelerator: "CmdOrCtrl+X",
  			selector: "cut:"
  		},
  		{
  			label: "Copy",
  			accelerator: "CmdOrCtrl+C",
  			selector: "copy:"
  		},
  		{
  			label: "Paste",
  			accelerator: "CmdOrCtrl+V",
  			selector: "paste:"
  		},
  		{
  			label: "Select All",
  			accelerator: "CmdOrCtrl+A",
  			selector: "selectAll:"
  		},
			{
				type: "separator"
			},
			{
				label: "Switch Input",
				accelerator: "CmdOrCtrl+D",
				click: function() {
					ipc.send("switch-input");
				}
			}
  	]
	},
  {
	 label: 'Help',
	 submenu: [
     {
       label: 'View Changelog',
       click: function() {
         require('electron').shell.openExternal('https://github.com/sotch-pr35mac/syng/blob/master/CHANGELOG.md');
       }
     },
     {
       type: 'separator'
     },
		{
		  label: 'Report Bug',
		  //accelerator: 'CmdOrCtrl+R',
		  click: function() { require('electron').shell.openExternal('https://github.com/sotch-pr35mac/syng/issues') }
		},
      {
         type: 'separator'
      },
      {
         label: 'View Syng License',
         click: function() { require('electron').shell.openExternal('https://github.com/sotch-pr35mac/syng/blob/master/LICENSE.md') }
      },
      {
         label: 'View CC-CEDICT License',
         click: function() { require('electron').shell.openExternal('https://github.com/sotch-pr35mac/syng/blob/master/License-CC-CEDICT.md') }
      },
      {
         label: 'View Node-CC-CEDICT License',
         click: function() { require('electron').shell.openExternal('https://github.com/sotch-pr35mac/syng/blob/master/License-Node-CC-CEDICT.md') }
      }
	 ]
  }
];

if (process.platform == 'darwin') {
  var name = require('electron').remote.app.getName();

  template.unshift({
	 label: name,
	 submenu: [
		{
		  label: 'Hide ' + name,
		  accelerator: 'Command+H',
		  role: 'hide',
      click: function() { app.hide(); }
		},
		{
		  label: 'Hide Others',
		  accelerator: 'Command+Alt+H',
		  role: 'hideothers'
		},
		{
		  label: 'Show',
		  role: 'unhide',
      accelerator: 'Command+S',
      click: function() { app.show(); }
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
