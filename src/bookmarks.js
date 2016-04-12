/*
*	@File				:: bookmarks.js
*	@Author			:: Preston Stosur-Basseett [preston@stosur.info](http://stosur.info)
*	@Description	:: This file handles all the logic for the bookmarks window
*	@Created			:: Mar 19, 2016
*/

var _ = require("underscore");
var path = require('path');
var tingo = require('tingodb')(); // Mongo-Style Database
var ipc = require('electron').ipcRenderer; // For communication with the Main Process.

ipc.on("refresh-page", function(event, args) {
	refreshPage();
});

function initializeBookmarks() {
	var db = new tingo.Db("./src/db/syng", {});
	var bookmarksDb = db.collection("bookmarks");

	var displayBookmarks = false;

	// Generate unique random ID's for the search result expanded content to be linked with the search results listing
	function generateUUID(){
	    var d = new Date().getTime();
	    if(window.performance && typeof window.performance.now === "function"){
	        d += performance.now(); //use high-precision timer if available
	    }
	    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
	        var r = (d + Math.random()*16)%16 | 0;
	        d = Math.floor(d/16);
	        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
	    });
	    return uuid;
	}

	function genBookListHtml(traditional, simplified, pinyin, english, id) {
		var defToDisplay = english.substring(0, 9);
		var idString = '"'+id+'"';
		var charDisplay = "<h4 onclick='switchWord("+idString+")'><strong>"+simplified+"</strong> ("+traditional+")</h4>";
		var pinyinDisplay = "<p>"+pinyin+"</p>";
		var defDisplay = "<p>"+defToDisplay+"</p>";
		var listing = "<li class='list-group-item'><div class='media-body'>"+charDisplay+pinyinDisplay+defDisplay+"</div></li>";
		return listing;
	}

	function genBookExpHtml(traditional, simplified, pinyin, english, toneMarks, id) {
		// Convert from string to array
		var definitions = english.split(',');
		var tones = toneMarks.split(',');

		//Handle definitions content
		var definitionsHtml = "<h3><strong>Definition:</strong></h3><ol>";
		for(var i = 0; i < definitions.length; i++) {
			definitionsHtml += "<li>"+definitions[i]+"</li>";
		}
		definitionsHtml += "</ol>";

		// Handle pinyin content
		var pinyinHtml = "<h3><strong>Pinyin:</strong></h3>"+pinyin;

		// Handle characters and color coding
		var characters = "";

		if(simplified.length == traditional.length && traditional.length == tones.length) {
			characters += "<h1>";
			var simpArr = simplified.split("");
			var tradArr = traditional.split("");
			var colorCodeArr = [];
			for(var i = 0; i < tones.length; i++) {
				var colorCode;
				if(tones[i] == "0") {
					colorCode = "black";
				}
				else if(tones[i] == "1") {
					colorCode = "blue";
				}
				else if(tones[i] == "2") {
					colorCode = "orange";
				}
				else if(tones[i] == "3") {
					colorCode = "red";
				}
				else if(tones[i] == "4") {
					colorCode = "green";
				}
				else {
					colorCode = "black";
				}

				characters += "<a style='color: "+colorCode+"'>"+simpArr[i]+"</a>";
				colorCodeArr.push(colorCode);
			}

			characters += " (";
			for(var i = 0; i < tradArr.length; i++) {
				characters += "<a style='color: "+colorCodeArr[i]+"'>"+tradArr[i]+"</a>";
			}

			characters += ")</h1>";
		}
		else {
			// Handle colorless characters
			characters = "<h1>"+simplified+" ("+traditional+")</h1>";
		}

		// Create the action buttons
		var simp = '"'+simplified+'"';
		var trad = '"'+traditional+'"';
		var pin = '"'+pinyin+'"';
		var def = '"'+definitions+'"';
		var tnm = '"'+toneMarks+'"';
		var actionsButton = "<div class='btn-group pull-right'><button onlick='removeFromBookmarks("+id+")' class='btn btn-default btn-large hint-bottom' data-hint='Remove from Bookmarks'><span class='icon icon-minus-circled'></span><button onclick='viewLargeChars("+simp+", "+trad+")' class='btn btn-default btn-large hint--left' data-hint='View Large Characters'><span class='icon icon-popup'></span></button></div>";

		var expandedContent = "div style='display: none;' id='"+id+"'>"+actionsButton+characters+pinyinHtml+definitionsHtml+"</div>";
		return expandedContent;
	}

	bookmarksDb.count(function(err, count) {
		if(err || count == undefined || count == null) {
			console.log("There was an error while getting the count of the database.");
			console.log(err);
			/*
			*	TODO: Report this error to the user.
			*/
		}
		else {
			if(count == 0) {
				displayBookmarks = false;
				$("#expanded-bookmark-content").html("<center><h4>No Bookmarks Saved Yet</h4><br><p>To add a bookmark, search for a word and click 'Save to Bookmarks'</p></center>");
			}
			else {
				displayBookmarks = true;
			}
		}
	});

	if(displayBookmarks == true) {
		bookmarksDb.find().toArray(function(err, bookmarks) {
			if(err || bookmarks == undefined || bookmarks == null) {
				console.log("There was an error getting all the saved bookmarks.");
				console.log(err);
				/*
				*	TODO: Report this error to the user.
				*/
			}
			else {
				// DEBUG
				console.log(bookmarks);

				// Handle displaying the bookmarks on the page here
				var listingHtml = "";
				var expandedHtml = "";

				_.each(bookmarks, function(bookmarkWord) {
					listingHtml += genBookListHtml(bookmarkWord.traditional, bookmarkWord.simplified, bookmarkWord.pronunciation, bookmarkWord.definitions, bookmarkWord.id);
					expandedHtml += genBookExpHtml(bookmarkWord.traditional, bookmarkWord.simplified, bookmarkWord.pronunciation, bookmarkWord.definitions, bookmarkWord.toneMarks, bookmarkWord.id);
				});

				$("#bookmarks-listing-container").html(listingHtml);
				$("#expanded-bookmark-content").html(expandedHtml);
			}
		});
	}
}

/*
*	TODO: Finish this function
*/
function switchWord(id) {

}

/*
*	TODO: Finish this function
*/
function removeFromBookmarks(id) {

}

/*
*	TODO: Finsih this function
*/
function viewLargeChars(simplified, traditional) {

}

function refreshPage() {
	location.reload();
}

$(document).ready(function() {
	initializeBookmarks();

	// Enter on search button handles filtering bookmarks
	$("#filter-bookmarks").keyup(function(event) {
		if(event.keyCode == 13) {
			// Handle filtering here
		}
	});
});
