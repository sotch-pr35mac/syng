/*
*	@File				:: flashcard.js
*	@Author			:: Preston Stosur-Bassett [preston@stosur.info](http://stosur.info)
*	@Description	::	This file handles all the logic for generating and displaying flashcards
*	@Created			:: April 13, 2016
*/

var ipc = require('electron').ipcRenderer; // For communication with the Main Process
var tingo = require("tingodb")(); // Mongo-style database
var path = require('path');
var dialog = require('electron').remote.dialog;

var cardSet = new Array();
var iterator = 0;

ipc.on('generate-new-set', function(event, args) {
	initializeCards();
});

function displayCard(traditional, simplified, pinyin, definitions) {
	var charactersDisplay = simplified+" ("+traditional+")";
	var definitionsDisplay = "<ol>";
	definitions = definitions.split(",");
	for(var i = 0; i < definitions.length; i++) {
		definitionsDisplay += "<li>"+definitions[i]+"</li>";
	}
	definitionsDisplay += "</ol>";

	$("#character-card").html(charactersDisplay);
	$("#pinyin-card").html(pinyin);
	$("#definitions-card").html(definitionsDisplay);
}

function initializeCards() {
	var db = new tingo.Db(path.join(__dirname, "../src/db/syng"), {});
   var bookmarksDb = db.collection("bookmarks");

	bookmarksDb.find().toArray(function(err, bookmarksArr) {
		if(err || bookmarksArr == undefined || bookmarksArr == null) {
			console.log("There was an error retreiving the bookmarks");
			console.log(err);
			dialog.showErrorBox("Error Getting Bookmarks", err);
		}
		else {
			if(bookmarksArr.length == 0) {
				// alert("There are no saved searches in your bookmarks to create flashcards.");
			}
			else {
				cardSet = bookmarksArr;
				iterator = 0;

				displayCard(cardSet[0].traditional, cardSet[0].simplified, cardSet[0].pronunciation, cardSet[0].definitions);
			}
		}
	});
}

function initializeButtons() {
	$("#flip-card-btn").click(function() {
		$("#character-card").toggle();
		$("#pinyin-card").toggle();
		$("#definitions-card").toggle();
	});

	$("#next-btn").click(function() {
		$("#pinyin-card").hide();
		$("#definitions-card").hide();
		$("#character-card").show();

		if(!(iterator+1 > cardSet.length - 1))  {
			iterator = iterator + 1;
			displayCard(cardSet[iterator].traditional, cardSet[iterator].simplified, cardSet[iterator].pronunciation, cardSet[iterator].definitions);
		}
	});

	$("#back-btn").click(function() {
		$("#pinyin-card").hide();
		$("#definitions-card").hide();
		$("#character-card").show();

		if(!(iterator - 1 < 0)) {
			iterator = iterator - 1;
			displayCard(cardSet[iterator].traditional, cardSet[iterator].simplified, cardSet[iterator].pronunciation, cardSet[iterator].definitions);
		}
	});
}

$(document).ready(function() {
	initializeCards();
	initializeButtons();
});
