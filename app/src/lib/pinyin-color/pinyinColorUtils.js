var fs = window.require('fs');
var path = window.require('path');
var electron = window.require('electron');
var app = electron.remote.app;
var FILE = path.join(path.join(app.getPath('appData'), 'Syng'), 'db/syng/colors.json');
var DEFAULT_COLORS = {
	0: '#000000',
	1: '#0000FF',
	2: '#FFA500',
	3: '#FF0000',
	4: '#008000'
};

function loadData() {
	// Load in the data from the file here
	fs.readFile(FILE, 'utf8', function(err, data) {
		var colors = DEFAULT_COLORS;
		if(err) {
			// There was an error loading the file data.
			console.error('There was an error while attempting to load pinyin color data. Falling back to defaults.');
		} else {
			colors = JSON.parse(data);
		}
		
		localStorage.setItem('pinyin-colors', JSON.stringify(colors));
	});
}

function writeData(colorObject, cb) {
	var colorData = JSON.stringify(colorObject);

	fs.writeFile(FILE, colorData, function(err) {
		if(err) {
			console.error('There was an error while attempting to create the pinyin color data file.');
		}

		cb();
	});
}

module.exports = {
	initializeColorData() {
		fs.exists(FILE, function(exists) {
			if(exists) {
				// The file exists, just load in the data here
				loadData();
			} else {
				// The file doesn't exist, create it, then load it in.
				writeData(DEFAULT_COLORS, function() {
					loadData();
				});
			}
		});
	},
	writeColorData(colorObject) {
		localStorage.setItem('pinyin-colors', JSON.stringify(colorObject)); 
		writeData(colorObject, function() {});
	},
	getColors() {
		return JSON.parse(localStorage.getItem('pinyin-colors'));
	},
	resetDefaults() {
		localStorage.setItem('pinyin-colors', JSON.stringify(DEFAULT_COLORS));
		writeData(DEFAULT_COLORS, function() {});
	}
};
