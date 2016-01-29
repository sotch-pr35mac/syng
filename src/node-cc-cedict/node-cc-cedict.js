var _ = require("underscore");
var path = require("path");
var Engine = require("tingodb")(); // Mongo-Style Database
var cnchars = require('cn-chars'); // Convert between tradtitional and simplified
var pinyin = require('prettify-pinyin'); // Prettify the pinyin default (letter + numbers) in CC-CEDICT

var db = new Engine.Db("./src/node-cc-cedict/db/cc-cedict-tingodb", {});

var cedict = db.collection('words');

cedict.count(function(err, count) {
	if(err || count == undefined || count == null) {
		console.log("There was an error while getting the count of the database.");
		console.log(err);
		// TODO: Report the error to the user.
	}
	if(count == 0) {
		$.getJSON("../src/node-cc-cedict/db/cc-cedict.json", function(data) {
			console.log(data);
			cedict.insert(data, {w:1}, function(err, result) {
				if(err || result == undefined || result == null) {
					console.log("There was an error while updating the database with the dictionary.");
					console.log(err);
					// TODO: Report the error to the user.
				}
			});
		});
	}
});

module.exports.searchByChinese = function(str, cb) {
	var simplified = str.slice().split("");
	var traditional = str.slice().split('');

	for(var i = 0; i < str.length; i++) {
		simplified[i] = cnchars.toSimplifiedChar(str[i]);
		traditional[i] = cnchars.toTraditionalChar(str[i]);
	}

	simplified = simplified.join('');
	traditional = traditional.join('');

	// The default search is simplified unless input string is traditional
	// Consider using the $where query option to query the database
	var query = {};
	if(traditional === str) {
		query.traditional = traditional;
	}
	else {
		query.simplified = simplified;
	}

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
					definitions: word.definitions
				});
			});
			cb(results);
		}
	});
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

	// Consider using the $where query option when querying the database
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
