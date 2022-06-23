const { shell } = require('electron');

const menu = {
	universal: () => {
		return [
			{ role: 'fileMenu' },
			{ role: 'editMenu' },
			{
				label: 'View',
				submenu: [
					{ role: 'togglefullscreen' }
				]
			},
			{ role: 'windowMenu' },
			{
				label: 'Help',
				submenu: [
					{
						label: 'Github',
						click: async () => {
							await shell.openExternal('https://github.com/sotch-pr35mac/syng');
						}
					},
					{ type: 'separator' },
					{
						label: 'License',
						click: async () => {
							await shell.openExternal('https://github.com/sotch-pr35mac/syng/blob/master/LICENSE.md');
						}
					},
					{
						label: 'CC-CEDICT License',
						click: async () => {
							await shell.openExternal('https://github.com/sotch-pr35mac/syng/blob/master/License-CC-CEDICT.md');
						}
					},
					{ type: 'separator' },
					{
						label: 'Report Bug',
						click: async () => {
							await shell.openExternal('https://github.com/sotch-pr35mac/syng/issues');
						}
					}
				]
			}
		];
	},
	windows: () => [],
	linux: () => [],
	mac: app => {
		return [
			{
				label: app.name,
				submenu: [
					{ role: 'about' },
					{ type: 'separator' },
					{ role: 'services' },
					{ type: 'separator' },
					{ role: 'hide' },
					{ role: 'hideOthers' },
					{ role: 'unhide' },
					{ type: 'separator' },
					{ role: 'quit' }
				]
			}
		];
	}
};
module.exports = {
	getAppMenu: (app, platform) => {
		switch (platform) {
		case 'darwin':
			return [...menu.mac(app), ...menu.universal()];
		case 'win32':
			return [...menu.windows(), ...menu.universal()];
		case 'linux':
			return [...menu.linux(), ...menu.universal()];
		default:
			return menu.universal();
		}
	}
};
