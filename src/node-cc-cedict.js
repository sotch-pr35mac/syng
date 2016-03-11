var _ = require("underscore");
var SqliteToMongo = require('sqlite-to-mongo');
var path = require('path');
var Engine = require('tingodb')();
var assert = require('assert');

//Try and Load the Mongo database using tingodb
var sqliteDbLocation = path.join(__dirname, './db/cc-cedict.sqlite');
var mongoDbLocation = path.join(__dirname, './db/cc-cedict-mongo');

var db = new Engine.Db(mongoDbLocation, {});

var importer = new SqliteToMongo(sqliteDbLocation, mongoDbLocation);

// Import SQLite database into a Mongo Collection
importer.importCollection('words', {
	tableName: 'Words',
	columns: {
		id: "id",
		traditional: 'traditional',
		simplified: 'simplified',
		pronunciation: 'pronunciation',
		definitions: 'definitions'
	}
});

var cedict = db.collection('Words');

// Convert between traditional and simplified
var cnchars = require('cn-chars');
// Prettify the PinYin default pinyin (letters + numbers) in CC-CEDICT
var pinyin = require('prettify-pinyin');

module.exports.searchByChinese = function(str, cb) {
	var simplified = str.slice().split('');
	var traditional = str.slice().split('');
	for(var i = 0; i < str.length; i++) {
		simplified[i] = cnchars.toSimplifiedChar(str[i]);
		traditional[i] = cnchars.toTraditionalChar(str[i]);
	}
	simplified = simplified.join('');
	traditional = traditional.join('');

	var query = {};

	// Default search is simplified unless input string is traditional
	if(traditional === str) {
		query.traditional = traditional;
	}
	else {
		query.simplified = simplified;
	}

	cedict.find(query, function(err, words) {
		var results = [];

		if(err || words == undefined || words == null) {
			console.log("There was an error when querying the cedict database.");
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
		}
		cb(results);
	});
}

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
			console.log("There was an error when querying the cedict database.");
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
		}
		cb(results);
	});
}

// TODO: Finish this function
module.exports.searchByEnglish = function(str, cb) {

}
