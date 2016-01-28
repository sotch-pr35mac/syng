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

var Word = db.collection('words');

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

	// Default search is simplified unless input string is traditional
	// TODO: Change the query format to work with mongoDb
	var query = {
		where: {simplified: simplified}
	};
	if(traditional === str) {
		query.where = {traditional: traditional};
	}

	Word.findAll(query).exec(function(err, words) {
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

	// TODO: Change query format to work with mongoDb
	var query = {
		where: {pronunciation: str}
	};

	Word.findAll(query).exec(function(words) {
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
	});
}

// TODO: Finish this function
module.exports.searchByEnglish = function(str, cb) {

}
