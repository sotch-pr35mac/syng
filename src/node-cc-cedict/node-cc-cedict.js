var _ = require("underscore");
var path = require("path");
var Engine = require("tingodb")(); // Mongo-Style Database
var cnchars = require('cn-chars'); // Convert between tradtitional and simplified
var pinyin = require('prettify-pinyin'); // Prettify the pinyin default (letter + numbers) in CC-CEDICT
var SimpleHashTable = require('simple-hashtable'); // Hash table to store values of chinese charactesr and their database id.

var db = new Engine.Db("./src/node-cc-cedict/db/cc-cedict-tingodb", {});
var cedict = db.collection('words');

var simpHashtable = new SimpleHashTable();
var tradHashtable = new SimpleHashTable();

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

if(tradHashtable.isEmpty()) {
	cedict.find().toArray(function(err, wordList) {
		if(err || wordList == undefined || wordList == null) {
			console.log("There was an error getting all the database entires.");
			console.log(err);
			// TODO: Report this issue to the user.
		}
		else {
			_.each(wordList, function(word) {
				tradHashtable.put(word.traditional, word.id);
			});
		}
	});
}
if(simpHashtable.isEmpty()) {
	cedict.find().toArray(function(err, wordList) {
		if(err || wordList == undefined || wordList == null) {
			console.log("There was an error getting all the database entires.");
			console.log(err);
			// TODO: Report this issue to the user.
		}
		else {
			_.each(wordList, function(word) {
				simpHashtable.put(word.simplified, word.id);
			});
		}
	});
}

module.exports.searchByChinese = function(str, cb) {
	function searchByTraditional(trad, callback) {
		var compounds = [];
		var infiniteCheck = 0;
		while(trad.length > 0 && infiniteCheck < 4000) {
			if(trad.length >= 4 && tradHashtable.containsKey(trad.substring(4))) {
				var compoundId = tradHashtable.get(trad.substring(4));
				compounds.push(compoundId);
				trad = trad.substring(4);
			}
			else if(trad.length >= 3 && tradHashtable.containsKey(trad.substring(3))) {
				var compoundId = tradHashtable.get(trad.substring(3));
				compounds.push(compoundId);
				trad = trad.substring(3);
			}
			else if(trad.length >= 2 && tradHashtable.containsKey(trad.substring(2))) {
				var compoundId = tradHashtable.get(trad.substring(2));
				compounds.push(compoundId);
				trad = trad.substring(2);
			}
			else if(trad.length >= 1 && tradHashtable.containsKey(trad.substring(1))) {
				var compoundId = tradHashtable.get(trad.substring(1));
				compounds.push(compoundId);
				trad = trad.substring(1);
			}
			else {
				//The character wasn't recognized at all
				console.log("The character wasn't recognized");
				console.log("Length: "+trad.length >= 1);
				console.log(tradHashtable.containsKey(trad.substring(1)));
			}

			infiniteCheck++;
		}

		callback(compounds);
	}

	function searchBySimplified(simp, callback) {
		var compounds = [];
		var infiniteCheck = 0;
		while(simp.length > 0 && infiniteCheck < 4000) {
			if(simp.length >= 4 && simpHashtable.containsKey(simp.substring(4))) {
				var compoundId = simpHashtable.get(simp.substring(4));
				compounds.push(compoundId);
				simp = simp.substring(4);
			}
			else if(simp.length >= 3 && simpHashtable.containsKey(simp.substring(3))) {
				var compoundId = simpHashtable.get(simp.substring(3));
				compounds.push(compoundId);
				simp = simp.substring(3);
			}
			else if(simp.length >= 2 && simpHashtable.containsKey(simp.substring(2))) {
				var compoundId = simpHashtable.get(simp.substring(2));
				compounds.push(compoundId);
				simp = simp.substring(2);
			}
			else if(simp.length >= 1 && simpHashtable.containsKey(simp.substring(1))) {
				var compoundId = simpHashtable.get(simp.substring(1));
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

		searchByTraditional(traditional, function(res) { console.log });
	}
	else {
		// Remove puncuation and whitespace
		simplified = simplified.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
		simplified = simplified.replace(" ", "");

		searchBySimplified(simplified, queryDatabase());
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
