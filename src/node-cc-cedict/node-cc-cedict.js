var _ = require("underscore");
var path = require("path");
var Engine = require("tingodb")(); // Mongo-Style Database
var cnchars = require('cn-chars'); // Convert between tradtitional and simplified
var pinyin = require('prettify-pinyin'); // Prettify the pinyin default (letter + numbers) in CC-CEDICT
var SimpleHashTable = require('simple-hashtable'); // Hash table to store values of chinese charactesr and their database id.

var db = new Engine.Db("./src/node-cc-cedict/db/cc-cedict-tingodb", {});
var cedict = db.collection('words');

// var simpHashtable = new SimpleHashTable();
// var tradHashtable = new SimpleHashTable();

window.simpHashtable = new SimpleHashTable();
window.tradHashtable = new SimpleHashTable();

// Ensure that the database has been setup on this build
cedict.count(function(err, count) {
	if(err || count == undefined || count == null) {
		console.log("There was an error while getting the count of the database.");
		console.log(err);
		// TODO: Report the error to the user.
	}
	if(count == 0) {
		$("#search-results").openModal();
		$.getJSON("../src/node-cc-cedict/db/cc-cedict.json", function(data) {
			cedict.insert(data, {w:1}, function(err, result) {
				if(err || result == undefined || result == null) {
					console.log("There was an error while updating the database with the dictionary.");
					console.log(err);
					// TODO: Report the error to the user.
				}
				else {
					/*_.each(result, function(item) {
						hashtable.put(item.simplified, item.id);
					});*/
					$("#search-results").closeModal();
				}
			});
		});
	}
});

if(tradHashtable.isEmpty() || simpHashtable.isEmpty()) {
	/*
	*	TODO： Make it so a loading dialog start here
	*/
	console.log("should load loading dialog here");
	$("#loading-dialog").show();

	function getDatabase() {
		cedict.find().toArray(function(err, wordList) {
			if(err || wordList == undefined || wordList == null) {
				console.log("There was an error getting all the database entires.");
				console.log(err);
				// TODO: Report this issue to the user.
			}
			else {
				//return wordList;

				var tradIsEmpty = tradHashtable.isEmpty();
				var simpIsEmpty = simpHashtable.isEmpty();

				for(var i = 0; i < wordList.length; i++) {
					if(tradIsEmpty == true) {
						// tradHashtable.put(wordList[i].traditional, wordList[i].id);
						tradHashtable.put(wordList[i].traditional, wordList[i]);
					}
					if(simpIsEmpty == true) {
						// simpHashtable.put(wordList[i].simplified, wordList[i].id);
						simpHashtable.put(wordList[i].simplified, wordList[i]);
					}
				}

				/*
				* TODO: Close the loading dialog here
				*/
				console.log("should close loading dialog now");
				$("#loading-dialog").hide();
			}
		});
	}

	getDatabase();

	/*var wordList = getDatabase();

	var tradIsEmpty = tradHashtable.isEmpty();
	var simpIsEmpty = simpHashtable.isEmpty();

	for(var i = 0; i < wordList.length; i++) {
		if(tradIsEmpty == true) {
			tradHashtable.put(wordList[i].traditional, wordList[i].id);
		}
		if(simpIsEmpty == true) {
			simpHashtable.put(wordList[i].simplified, wordList[i].id);
		}
	}*/
}

// A little after adding the values
//console.log(tradHashtable.keys());

module.exports.searchByChinese = function(str, cb) {
	function searchByTraditional(trad, callback) {
		console.log("started search");
		var compounds = [];
		var infiniteCheck = 0;
		while(trad.length > 0 && infiniteCheck < 4000) {
			console.log("while is running");
			if(trad.length >= 4 && tradHashtable.containsKey(trad.substring(0, 4))) {
				var compoundId = tradHashtable.get(trad.substring(0, 4));
				compounds.push(compoundId);
				trad = trad.substring(4);
			}
			else if(trad.length >= 3 && tradHashtable.containsKey(trad.substring(0, 3))) {
				var compoundId = tradHashtable.get(trad.substring(0, 3));
				compounds.push(compoundId);
				trad = trad.substring(3);
			}
			else if(trad.length >= 2 && tradHashtable.containsKey(trad.substring(0, 2))) {
				var compoundId = tradHashtable.get(trad.substring(0, 2));
				compounds.push(compoundId);
				trad = trad.substring(2);
			}
			else if(trad.length >= 1 && tradHashtable.containsKey(trad.substring(0, 1))) {
				var compoundId = tradHashtable.get(trad.substring(0, 1));
				compounds.push(compoundId);
				trad = trad.substring(1);
			}
			else {
				//The character wasn't recognized at all
				console.log("The character wasn't recognized");
				console.log("Length: "+trad.length >= 1);
				console.log(tradHashtable.containsKey(trad.substring(1)));
				console.log(trad.substring(0, 1));
			}

			infiniteCheck++;
		}
		console.log("finished search");
		callback(compounds);
	}

	function searchBySimplified(simp, callback) {
		var compounds = [];
		var infiniteCheck = 0;
		while(simp.length > 0 && infiniteCheck < 4000) {
			if(simp.length >= 4 && simpHashtable.containsKey(simp.substring(0, 4))) {
				var compoundId = simpHashtable.get(simp.substring(0, 4));
				compounds.push(compoundId);
				simp = simp.substring(4);
			}
			else if(simp.length >= 3 && simpHashtable.containsKey(simp.substring(0, 3))) {
				var compoundId = simpHashtable.get(simp.substring(0, 3));
				compounds.push(compoundId);
				simp = simp.substring(3);
			}
			else if(simp.length >= 2 && simpHashtable.containsKey(simp.substring(0, 2))) {
				var compoundId = simpHashtable.get(simp.substring(0, 2));
				compounds.push(compoundId);
				simp = simp.substring(2);
			}
			else if(simp.length >= 1 && simpHashtable.containsKey(simp.substring(0, 1))) {
				var compoundId = simpHashtable.get(simp.substring(0, 1));
				compounds.push(compoundId);
				simp = simp.substring(1);
			}
			else {
				// The character wasn't recognized
				console.log("The character wasn't recognized");
			}

			infiniteCheck++;
		}

		callback(compounds);
	}

	var queryDatabase = function(queryArray) {
		var query = {
			id: { $in: queryArray }
		};

		cedict.find(query).toArray(function(err, words) {
			if(err || words == undefined || words == null) {
				console.log("There was an error when querying the database.");
				console.log(err);
				// TODO: Report this error to the user.
				cb([]);
			}
			else {
				var results = [];
				_.each(words, function(word) {
					var pronunciation = word.pronunciation;
					var prettified = pinyin.prettify(pronunciation.slice(1, pronunciation.length - 1));
					results.push({
						traditional: word.traditional,
						simplified: word.simplified,
						pronunciation: prettified,
						definitions: word.definitions,
						id: word.id
					});
				});
				cb(results);
			}
		});
	}

	var simplified = str.slice().split("");
	var traditional = str.slice().split("");

	for(var i = 0; i < str.length; i++) {
		simplified[i] = cnchars.toSimplifiedChar(str[i]);
		traditional[i] = cnchars.toTraditionalChar(str[i]);
	}

	simplified = simplified.join('');
	traditional = traditional.join('');

	if(traditional === str) {
		// Remove punctuation and whitespaces
		traditional = traditional.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
		traditional = traditional.replace(" ", "");

		searchByTraditional(traditional, function(res) { cb(res); });
	}
	else {
		// Remove puncuation and whitespace
		simplified = simplified.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
		simplified = simplified.replace(" ", "");

		searchBySimplified(simplified, function(res) { cb(res); });
	}
};

module.exports.searchByPinyin = function(str, cb) {
	//Catches dead-tones or 5th tones
	var parts = str.split(" ");
	var newStr = [];
	_.each(parts, function(part) {
		var numeric = part.replace(/\D/g,'');

		if(numeric === "") {
			part += "5";
			newStr.push(part);
		}
		else {
			newStr.push(part);
		}
	});

	str = "[" + newStr.join(" ") + "]";

	// Consider using the $where query option
	var query = {
		pronunciation: str
	};

	cedict.find(query).toArray(function(err, words) {
		if(err || words == undefined || words == null) {
			console.log("There was an error while querying the database.");
			console.log(err);
			// TODO: Report error to the user.
			cb([]);
		}
		else {
			var results = [];
			_.each(words, function(word) {
				var pronunciation = word.pronunciation;
				var prettified = pinyin.prettify(pronunciation.slice(1, pronunciation.length - 1));
				results.push({
					traditional: word.traditional,
					simplified: word.simplified,
					pronunciation: prettified,
					definitions: word.definitions
				});
			});

			cb(results);
		}
	});
};


module.exports.searchByEnglish = function(str, cb) {}
