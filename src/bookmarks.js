/*
*	@File				:: bookmarks.js
*	@Author			:: Preston Stosur-Basseett [preston@stosur.info](http://stosur.info)
*	@Description	:: This file handles all the logic for the bookmarks window
*	@Created			:: Mar 19, 2016
*/

function initializeBookmarks() {
	var _ = require("underscore");
	var path = require('path');
	var tingo = require('tingo')(); // Mongo-Style Database

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

	/*
	*	TODO: Write this function
	*/
	function genBookListkHtml(traditional, simplified, pinyin, english, id) {

	}

	/*
	*	TODO: Write this function
	*/
	function genBookExpHtml(traditional, simplified, pinyin, english, toneMarks, id) {

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
				// Handle displaying the bookmarks on the page here
				var listingHtml = "";
				var expandedHtml = "";

				_.each(bookmarks, function(bookmarkWord) {
					var wid = generateUUID();
					listingHtml += genBookListHtml(bookmarkWord.traditional, bookmarkWord.simplified, bookmarkWord.pronunciation, bookmarkWord.english, wid);
					expandedHtml += genBookExpHtml(bookmarkWord.traditional, bookmarkWord.simplified, bookmarkWord.pronunciation, bookmarkWord.english, bookmarkWord.toneMarks, wid);
				});

				$("#bookmarks-listing-container").html(listingHtml);
				$("#expanded-bookmark-content").html(expandedHtml);
			}
		});
	}
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
