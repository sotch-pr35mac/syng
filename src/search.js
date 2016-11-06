/*
*	@File				:: search.js
*	@Author 			:: Preston Stosur-Bassett [preston@stosur.info](http://stosur.info)
*	@Description	:: This file handles getting the search query from the user, displaying the loading dialog, and formatting and displaying search results.
*	@Created			:: Jan 27, 2016
*/

var path = require('path');
var cedict = require(path.join(__dirname, "../src/engine.js"));
var franc = require("franc");
var _ = require("underscore");
var tingo = require('tingodb')();
var ipc = require('electron').ipcRenderer; // For communication with the Main Process
const dialog = require('electron').remote.dialog;

var db = new tingo.Db(path.join(__dirname, "../src/db/syng"), {});
var bookmarksDb = db.collection('bookmarks');

function addToBookmarks(simplified, traditional, pinyin, definitions, toneMarks) {
	var dbObj = {
		traditional: traditional,
		simplified: simplified,
		pronunciation: pinyin,
		definitions: definitions,
		toneMarks: toneMarks
	};
	bookmarksDb.insert(dbObj, function(err, res) {
		if(err) {
			if(confirm("There was an error saving the word to your bookmarks. Would you like to report this error? Error = "+err)) {
				require('electron').shell.openExternal('https://github.com/sotch-pr35mac/syng/issues');
			}
		}
		else {
			alert("The word was successfully saved to your bookmarks!");
			ipc.send('refresh-bookmarks-window');
		}
	});
}

function viewLargeChars(simplified, traditional) {
	var lgObj = {
		traditional: traditional,
		simplified: simplified
	};

	ipc.send('show-large-characters', lgObj);
}

function display(search_results, expanded_content) {
	$("#search-results").html(search_results);
	$("#expanded-dict-content").html(expanded_content);
	initializeSectionHeaders();
}

function displayNone() {
	var resultHtml = "<center><h4>No Results to Display</h4></center>";
	display("", resultHtml);
}

function displayResults(trans) {
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

	// Generate Search Result Listing HTML
	function genListing(simplified, traditional, pinyin, definitions, id) {
		var defString = definitions.join(" ");
		var defToDisplay = defString.substring(0, 9);
		var idString = '"'+id+'"';
		var charDisplay = "<h4 onclick='switchWord("+idString+")'><strong>"+simplified+"</strong> ("+traditional+")</h4>";
		var pinyinDisplay = "<p>"+pinyin+"</p>";
		var defDisplay = "<p>"+defToDisplay+"</p>";
		var listing = "<li class='list-group-item'><div class='media-body'>"+charDisplay+pinyinDisplay+defDisplay+"</div></li>";
		return listing;
	}

	// Generate Characters Section Content
	function genCharCont(tradWord) {
		var wordList = [];
		for(var x = 0; x < tradWord.length; x++) {
			cedict.searchByChinese(tradWord[x], function(result) {
				wordList.push(result);
			});
		}

		var componentHtml = "<h3 class='section-header'><strong>Characters:</strong></h3><div class='section-content'><ol>";
		/*for(var x = 0; x < wordList.length; x++) {
			componentHtml += "<li><h4>"+wordList[x][0][0].simplified+" ("+wordList[x][0][0].traditional+") - "+wordList[x][0][0].pronunciation+"</h4><ul>";
			for(var y = 0; y < wordList[x][0][0].definitions.length; y++) {
				componentHtml += "<li>"+wordList[x][0][0].definitions[y]+"</li>";
			}
			componentHtml += "</ul>";
		}*/

		for(var x = 0; x < wordList.length; x++) {
			for(var y = 0; y < wordList[x].length; y++) {
				for(var n = 0; n < wordList[x][y].length; n++) {
					componentHtml += "<li><h4 class='sub-section-header'>"+wordList[x][y][n].simplified+" ("+wordList[x][y][n].traditional+") - "+wordList[x][y][n].pronunciation+"</h4><div class='sub-section-content'><ul>";
					for(var z = 0; z < wordList[x][y][n].definitions.length; z++) {
						componentHtml += "<li>"+wordList[x][y][n].definitions[z]+"</li>";
					}
					componentHtml += "</ul></div>";
				}
			}
		}

		componentHtml += "</ol></div>";

		return componentHtml;
	}

	// Generate Expanded Search Result Content HTML
	function genContent(simplified, traditional, pinyin, definitions, toneMarks, id) {
		// Handle definitions content
		var definitionsHtml = "<h3 class='section-header'><strong>Definition:</strong></h3><div class='section-content default'><ol>";
		for(var i = 0; i < definitions.length; i++) {
			definitionsHtml += "<li>"+definitions[i]+"</li>";
		}
		definitionsHtml += "</ol></div>";

		// Get character breakdown html
		var componentCharacterHtml = genCharCont(traditional);

		// Handle pinyin content
		var pinyinHtml = "<h3 style='margin-top: 0px; padding-left: 3px;'>"+pinyin+"</h3>";

		// Handle character display
		var characters = "";

		// Handle color-coded Characters
		if(simplified.length == traditional.length && traditional.length == toneMarks.length) {
			characters += "<h1 style='margin-bottom: 0;'>";
			var simpArr = simplified.split("");
			var tradArr = traditional.split("");
			var colorCodeArr = [];
			for(var i = 0; i < toneMarks.length; i++) {
				var colorCode;
				if(toneMarks[i] == "0") {
					colorCode = "black";
				}
				else if(toneMarks[i] == "1") {
					colorCode = "blue";
				}
				else if(toneMarks[i] == "2") {
					colorCode = "orange";
				}
				else if(toneMarks[i] == "3") {
					colorCode = "red";
				}
				else if(toneMarks[i] == "4") {
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
			// Handle colorless Characters
			characters = "<h1>"+simplified+" ("+traditional+")</h1>";
		}

		// Create the action buttons
		var simp = '"'+simplified+'"';
		var trad = '"'+traditional+'"';
		var pin = '"'+pinyin+'"';
		var def = '"'+definitions+'"';
		var tnm = '"'+toneMarks+'"';
		var actionsButton = "<div class='btn-group pull-right'><button onclick='addToBookmarks("+simp+", "+trad+", "+pin+", "+def+", "+tnm+")' class='btn btn-default btn-large hint--bottom' data-hint='Add to Bookmarks'><span class='icon icon-plus-circled'></span></button><button onclick='viewLargeChars("+simp+", "+trad+")' class='btn btn-default btn-large hint--left' data-hint='View Large Characters'><span class='icon icon-popup'></span></button></div>";

		var expandedContent = "<div style='display: none;' id='"+id+"'>"+actionsButton+characters+pinyinHtml+definitionsHtml+componentCharacterHtml+"</div>";
		return expandedContent;
	}

	var resultHtml = "";
	var expandedContent = "";
	_.each(trans, function(wordList) {
		_.each(wordList, function(word) {
			var id = generateUUID();
			resultHtml += genListing(word.simplified, word.traditional, word.pronunciation, word.definitions, id);
			expandedContent += genContent(word.simplified, word.traditional, word.pronunciation, word.definitions, word.toneMarks, id);
		});
	});

	display(resultHtml, expandedContent);
}

function initializeSearch() {
	$("#default-search-btn").click(function() {
		var text = $("#default-search").val();
		var latinLang = $("#language-selector").html();
		var lang = franc(text, {'minLength': 1, 'whitelist': ['eng', 'cmn', 'und']});

		if(lang == 'cmn') {
			cedict.searchByChinese(text, function(results) {
				console.log(results);
				if(results.length < 1) {
					displayNone();
				}
				else {
					displayResults(results);
				}
			});
		}
		else if(lang == 'eng') {
			if(latinLang == "EN") {
				console.log("Search Language is English");
				cedict.searchByEnglish(text, function(results) {
					displayResults(results);
				});
			}
			else if(latinLang == "PY") {
				cedict.searchByPinyin(text, function(results) {
					console.log(results);
					if(results.length < 1) {
						displayNone();
					}
					else {
						displayResults(results);
					}
				});
			}
			else {
				console.log("Unable to detect the search language. Try again using more characters/words.");
			}
		}
		else {
			console.log("Unable to detect the search language. Try using more characters/words.");
		}
	});

	$("#language-selector").click(function() {
		var en = "EN";
		var cn = "PY";
		var currentLang = $("#language-selector").html();

		if(currentLang == en) {
			$("#language-selector").html(cn);
		}
		else {
			$("#language-selector").html(en);
		}
	});

	/*$("#clear-search").click(function() {
		$("#search-bar").val("");
	});*/
}

function switchWord(id) {
	if(window.currentWord == undefined || window.currentWord == null) {
		window.currentWord = id;
		$("#"+id).show();
	}
	else {
		$("#"+window.currentWord).hide();
		window.currentWord = id;
		$("#"+id).show();
	}
	console.log(id);
}

function initializeSectionHeaders() {
	$(".window").find(".section-header").click(function() {
		// Expand or collapse this panel
		$(this).next().slideToggle('fast');

		// Hide the other panels
		// $(".section-content").not($(this).next()).slideUp("fast");
	});

	$(".window").find(".sub-section-header").click(function() {
		// Expand or collapse this panel
		$(this).next().slideToggle('fast');
	});
}

$(document).ready(function() {
	initializeSearch();

	// Enter key performs search
	$("#default-search").keyup(function(event) {
		if(event.keyCode == 13) {
			$("#default-search-btn").click()
		}
	});
});
