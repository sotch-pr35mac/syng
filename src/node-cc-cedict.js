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

var words = db.collection('words');

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
	var query = {
		where: {simplified: simplified}
	};
	if(traditional === str) {
		query.where = {traditional: traditional};
	}

	word.findAll(query).exec(function(err, searchResults) {
		console.log(searchResults);
	});
}
