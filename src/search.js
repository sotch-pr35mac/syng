/*
*	@File				:: search.js
*	@Author 			:: Preston Stosur-Bassett [preston@stosur.info](http://stosur.info)
*	@Description	:: This file handles getting the search query from the user, displaying the loading dialog, and formatting and displaying search results.
*	@Created			:: Jan 27, 2016
*/

var cedict = require("../src/engine.js");
var franc = require("franc");
var _ = require("underscore");

function display(search_results, expanded_content) {
	$("#search-results").html(search_results);
	$("#expanded-dict-content").html(expanded_content);
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
		var charDisplay = "<h4 onclick='switchWord("+idString+")'><strong>"+simplified+"</strong> ("+traditional+")</h4>"
		var pinyinDisplay = "<p>"+pinyin+"</p>";
		var defDisplay = "<p>"+defToDisplay+"</p>";
		var listing = "<li class='list-group-item'><div class='media-body'>"+charDisplay+pinyinDisplay+defDisplay+"</div></li>";
		return listing;
	}

	// Generate Expanded Search Result Content HTML
	function genContent(simplified, traditional, pinyin, definitions, toneMarks, id) {
		// Handle definitions content
		var definitionsHtml = "<h3><strong>Definition:</strong></h3><ol>";
		for(var i = 0; i < definitions.length; i++) {
			definitionsHtml += "<li>"+definitions[i]+"</li>";
		}
		definitionsHtml += "</ol>";

		// Handle pinyin content
		var pinyinHtml = "<h3><strong>Pinyin:</strong></h3>"+pinyin;

		// Handle character display
		var characters = "";

		// Handle color-coded Characters
		if(simplified.length == traditional.length && traditional.length == toneMarks.length) {
			characters += "<h1>";
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

		var expandedContent = "<div style='display: none;' id='"+id+"'>"+characters+pinyinHtml+definitionsHtml+"</div>";
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

$(document).ready(function() {
	initializeSearch();

	// Enter key performs search
	$("#default-search").keyup(function(event) {
		if(event.keyCode == 13) {
			$("#default-search-btn").click()
		}
	});
});
