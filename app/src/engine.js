/*
*	@File				:: engine.js
* 	@Description	:: This file converts the CC-CEDICT JSON file to a Hashmap and searches it based on Chinese, Pinyin, or English input.
*	@Author 			:: Preston Stosur-Bassett [preston@stosur.info](http://stosur.info)
* 	@Based On		:: node-cc-cedict by [John Heroy](http://johnheroy.com/)
*	@Created			:: Jan 28, 2016
*/

var _ = require("underscore");
var path = require("path");
var Engine = require("tingodb")(); // Mongo-Style Database
var cnchars = require('chinese-conv'); // Convert between tradtitional and simplified
var Hashmap = require('hashmap'); // Hashmap to store values of chinese characters and their "word object"
var ipc = require('electron').ipcRenderer; // For communication with the Main Process to close the splash page when loading is complete

// Create global Hashmaps that are going to serve as the lookup method for search
// Using the Hashmaps over just a database query will dramatically incrase the speed
window.simpHashmap = new Hashmap();	// Global Hashmap containing all simplified characters as key and their "word object" as the value
window.tradHashmap = new Hashmap();	// Global Hashmap containing all traditional characters as key and their "word object" as the value
window.pinyinHashmap = new Hashmap();	// Global Hashmap containing all pinyin that could be input as key, and their "word object" as the value
window.englishHashmap = new Hashmap(); // Global Hashmap containing all the english definitions that oculd be input as key, and their "word object" as the value

var tradIsEmpty = tradHashmap.size == 0 ? true : false;
var simpIsEmpty = simpHashmap.size == 0 ? true : false;
var pinyinIsEmpty = pinyinHashmap.size == 0 ? true : false;
var englishIsEmpty = englishHashmap.size == 0 ? true : false;

if(tradIsEmpty || simpIsEmpty || pinyinIsEmpty || englishIsEmpty) {
	console.log("Reading from file....");
	$.getJSON(path.join(__dirname, "../src/db/cc-cedict.json"), function(wordList) {
		console.log("Loading...");

		for(var i = 0; i < wordList.length - 1; i++) {
			var word = {
				traditional: wordList[i].t,
				simplified: wordList[i].s,
				pronunciation: wordList[i].p,
				toneMarks: wordList[i].u,
				definitions: wordList[i].d
			};

			// Add the word to the Simplified Hashmap, if the character already exists in the Hashmap as a key, add the second definition to the same key
			if (simpHashmap.has(word.simplified) == false) {
				var addWord = [];
				addWord.push(word);
				simpHashmap.set(word.simplified, addWord);
			} else {
				var addWord = simpHashmap.get(word.simplified);
				addWord.push(word);
				simpHashmap.set(word.simplified, addWord);
			}

			// Add the word to the Traditional Hashmap, if the character already exists in the Hashmap as a key, add the second definition to the same key
			if(tradHashmap.has(word.traditional) == false) {
				var addWord = [];
				addWord.push(word);
				tradHashmap.set(word.traditional, addWord);
			} else {
				var addWord = tradHashmap.get(word.traditional);
				addWord.push(word);
				tradHashmap.set(word.traditional, addWord);
			}

			// Add the word to the Pinyin Hashmap, if the character already exists in the Hashmap as a key, add the second definition to the same key
			if(pinyinHashmap.has(wordList[i].v) == false) {
				var addWord = [];
				addWord.push(word);
				pinyinHashmap.set(wordList[i].v, addWord);
			} else {
				var addWord = pinyinHashmap.get(wordList[i].v);
				addWord.push(word);
				pinyinHashmap.set(wordList[i].v, addWord);
			}

			// Add the word with tones to the pinyin hashmap, if the character already exists in the hashmap as a key, add the second definition to the same key
			if (pinyinHashmap.has(wordList[i].w) == false) {
				var addWord = [];
				addWord.push(word);
				pinyinHashmap.set(wordList[i].w, addWord);
			} else {
				var addWord = pinyinHashmap.get(wordList[i].w);
				addWord.push(word);
				pinyinHashmap.set(wordList[i].w, addWord);
			}

			// Cycle through each definition of a character and add it to the Hashmap
			for (var t = 0; t < wordList[i].x.length; t++) {
				var searchableTerm = wordList[i].x[t];
				// Add the word to the Hashmap, if the definition already exists in the Hashmap as a key, add the second "word object" to the same key
				if (englishHashmap.has(searchableTerm) == false) {
					var addWord = [];
					addWord.push(word);
					englishHashmap.set(searchableTerm, addWord);
				} else {
					var addWord = englishHashmap.get(searchableTerm);
					addWord.push(word);
					englishHashmap.set(searchableTerm, addWord);
				}
			}
		}

		console.log("Finished Loading!");

		// Close the splash page so that the user can now search
		ipc.send('finished-loading-dictinoary');
	});
}

// Search using Chinese Characters (both simplified and traditional)
module.exports.searchByChinese = function(str, cb) {
	function searchByTraditional(trad, callback) {
		var compounds = [];	// Put all the compound words into this array so they can be searched as compound words
		var infiniteCheck = 0;	// Max the search out at 4000 loops, so that in case none of the characters in the input are found we don't run into an infinite loop
		while(trad.length > 0 && infiniteCheck < 8000) {
			// Check for 4, 3, and 2 character compound words
			if(trad.length >= 4 && tradHashmap.has(trad.substring(0, 4))) {
				var compoundWord = tradHashmap.get(trad.substring(0, 4));
				compounds.push(compoundWord);
				trad = trad.substring(4);
			}
			else if(trad.length >= 3 && tradHashmap.has(trad.substring(0, 3))) {
				var compoundWord = tradHashmap.get(trad.substring(0, 3));
				compounds.push(compoundWord);
				trad = trad.substring(3);
			}
			else if(trad.length >= 2 && tradHashmap.has(trad.substring(0, 2))) {
				var compoundWord = tradHashmap.get(trad.substring(0, 2));
				compounds.push(compoundWord);
				trad = trad.substring(2);
			}
			else if(trad.length >= 1 && tradHashmap.has(trad.substring(0, 1))) {
				var compoundWord = tradHashmap.get(trad.substring(0, 1));
				compounds.push(compoundWord);
				trad = trad.substring(1);
			}
			else {
				// The character wasn't recognized at all
				console.log("The character wasn't recognized. Skipping...");
				console.log(trad.substring(0, 1));
        trad = trad.substring(1);
			}

			infiniteCheck++;
		}
		callback(compounds);
	}

	function searchBySimplified(simp, callback) {
		var compounds = [];	// Put all the compound words into this array so they can be searched as compound words
		var infiniteCheck = 0;	// Max the search out at 4000 loops, so that in case none of the characters in the input are found we don't run into an infinite loop
		while(simp.length > 0 && infiniteCheck < 8000) {
			// Check for 4, 3, and 2 character compound words
			if(simp.length >= 4 && simpHashmap.has(simp.substring(0, 4))) {
				var compoundWord = simpHashmap.get(simp.substring(0, 4));
				compounds.push(compoundWord);
				simp = simp.substring(4);
			}
			else if(simp.length >= 3 && simpHashmap.has(simp.substring(0, 3))) {
				var compoundWord = simpHashmap.get(simp.substring(0, 3));
				compounds.push(compoundWord);
				simp = simp.substring(3);
			}
			else if(simp.length >= 2 && simpHashmap.has(simp.substring(0, 2))) {
				var compoundWord = simpHashmap.get(simp.substring(0, 2));
				compounds.push(compoundWord);
				simp = simp.substring(2);
			}
			else if(simp.length >= 1 && simpHashmap.has(simp.substring(0, 1))) {
				var compoundWord = simpHashmap.get(simp.substring(0, 1));
				compounds.push(compoundWord);
				simp = simp.substring(1);
			}
			else {
				// The character wasn't recognized
				console.log("The character wasn't recognized. Skipping...");
				console.log(simp.substring(0, 1));
        simp = simp.substring(1);
			}

			infiniteCheck++;
		}

		callback(compounds);
	}

	// Remove whitespace from front and end of string, remove newline breaks in string
	str = str.trim();

	// Convert characters to Simplified and Traditional in-case of input that contains both Traditional and Simplified
	var simplified = str.slice().split("");
	var traditional = str.slice().split("");

	for(var i = 0; i < str.length; i++) {
		simplified[i] = cnchars.sify(simplified[i]);
		traditional[i] = cnchars.tify(traditional[i]);
	}

	simplified = simplified.join('');
	traditional = traditional.join('');

	// Search the traditional Hashmap if the input was explicitly in tradtitional, otherwise search simplified
	if(traditional === str) {
		searchByTraditional(traditional, function(res) { cb(res); });
	}
	else {
		searchBySimplified(simplified, function(res) { cb(res); });
	}
};

// Search by pinyin
/*
*	TODO: Make pinyin searchable WITH tone numbers
*		DESC: The input 'ni2hao3' and 'nihao' should both return results containing the character 你好
*/
module.exports.searchByPinyin = function(str, cb) {
	// Remove whitespace from front and end of string, remove newline breaks in string
	str = str.trim();

	// Make the string searchable by making it lower case to match with what is in the hashmap
	str = str.toLowerCase();

	// Convert querty to space separated array
	str = str.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
	str = str.replace(/[\$\uFFE5\^\+=`~<>{}\[\]|\u3000-\u303F!-#%-\x2A,-/:;\x3F@\x5B-\x5D_\x7B}\u00A1\u00A7\u00AB\u00B6\u00B7\u00BB\u00BF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u0AF0\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E3B\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]+/g, "");
	pinyin = str.split(" ");

	var results = []; // Put the search results into this array
	var i = 0; // An interator for the pinyin array
	var infiniteCheck = 0; // Max the search out at 4000 loops, so that in case none of the characters in the input are found we don't run into an infinite loop
	while(i < pinyin.length && infiniteCheck < 4000) {
		if(pinyinHashmap.has(pinyin[i])) {
			results.push(pinyinHashmap.get(pinyin[i]));
		}
		else {
			console.log("Error: Could not find "+pinyin[i]+" in the database.");
		}

		infiniteCheck++;
		i++;
	}

	cb(results);
};

// Search using English
module.exports.searchByEnglish = function(str, cb) {
	// Remove whitespace from front and end of string, remove newline breaks in string
	str = str.trim();

	// Remove regex
	str = str.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
	str = str.replace(/[\$\uFFE5\^\+=`~<>{}\[\]|\u3000-\u303F!-#%-\x2A,-/:;\x3F@\x5B-\x5D_\x7B}\u00A1\u00A7\u00AB\u00B6\u00B7\u00BB\u00BF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u0AF0\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E3B\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]+/g, "");
	str = str.toLowerCase();

	var searchResults = []; // Put the search results into this array
	var searchableTerms = str.split(" "); // An array of the terms to search for
	var infiniteCheck = 0; // Max the search out at 4000 loops, so that in case none of the characters in the input are found we don't run into an infinite loop
	console.log(searchableTerms);
	while(searchableTerms.length > 0 && infiniteCheck < 4000)  {
		// Check for 4, 3, and 2 word phrases or definitions
		if(searchableTerms.length >= 4 && englishHashmap.has(searchableTerms[0]+"%20"+searchableTerms[1]+"%20"+searchableTerms[2]+"%20"+searchableTerms[3])) {
			var compoundWord = englishHashmap.get(searchableTerms[0]+"%20"+searchableTerms[1]+"%20"+searchableTerms[2]+"%20"+searchableTerms[3]);
			searchResults.push(compoundWord);
			searchableTerms.splice(0, 4);
		}
		else if(searchableTerms.length >= 3 && englishHashmap.has(searchableTerms[0]+"%20"+searchableTerms[1]+"%20"+searchableTerms[2])) {
			var compoundWord = englishHashmap.get(searchableTerms[0]+"%20"+searchableTerms[1]+"%20"+searchableTerms[2]);
			searchResults.push(compoundWord);
			searchableTerms.splice(0, 3);
		}
		else if(searchableTerms.length >= 2 && englishHashmap.has(searchableTerms[0]+"%20"+searchableTerms[1])) {
			var compoundWord = englishHashmap.get(searchableTerms[0]+"%20"+searchableTerms[1]);
			searchResults.push(compoundWord);
			searchableTerms.splice(0, 2);
		}
		else if(searchableTerms.length >= 1 && englishHashmap.has(searchableTerms[0])) {
			var compoundWord = englishHashmap.get(searchableTerms[0]);
			searchResults.push(compoundWord);
			searchableTerms.splice(0, 1);
		}
		else {
			// The word or phrase was not found in the english Hashmap
			console.log("The word or phrase was not found.");
			console.log(searchableTerms[0]);
			searchableTerms.splice(0, 1);
		}

		infiniteCheck++;
	}

	cb(searchResults);
};
