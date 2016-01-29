var _ = require("underscore");
var path = require("path");
var Engine = require("tingodb")(); // Mongo-Style Database
var cnchars = require('cn-chars'); // Convert between tradtitional and simplified
var pinyin = require('prettify-pinyin'); // Prettify the pinyin default (letter + numbers) in CC-CEDICT

var db = new Engine.Db("./db/cc-cedict-mongodb", {});

var cedict = db.collection('words');

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
	var query = {};
	if(traditional === str) {
		query.traditional = traditional;
	}
	else {
		query.simplified = simplified;
	}

	cedict.find(query, function(err, words) {
		var results = [];

		if(err || words == undefined || words == null) {
			console.log("There was an error when querying the database.");
			console.log(err);
			// TODO: Report this error to the user.
		}
		else {
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

	var query = {
		pronunciation: str
	};

	cedict.find(query, function(err, words) {
		var results = [];

		if(err || words == undefined || words == null) {
			console.log("There was an error while querying the database.");
			console.log(err);
			// TODO: Report this error to the user.
		}
		else {
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
