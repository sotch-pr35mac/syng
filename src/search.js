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
	/*
	*	TODO: Figure out loading dialog situation
	*/
	//$("#loading-dialog").hide();
	$("#search-results").html(search_results);
	$("#expanded-dict-content").html(expanded_content);
}

function displayNone() {
	var resultHtml = "<center><h4>No Results to Display</h4></center>";
	display("", resultHtml);
}

/*
*	TODO: Fix the display settings
*	DESC: Add some colors, fix formatting
*/
function displayResults(trans) {
	var resultHtml = "";
	var expandedHtml = "";
	var i = 0;
	_.each(trans, function(wordList) {
		resultHtml += "<a href='#single-word-expanded-"+i+"'><li class='single-word-listing list-group-item' data-translationID='"+i+"'><b>"+wordList[0].simplified+"</b> &nbsp; (<em>"+wordList[0].traditional+"</em>)</li></a><hr>";
		expandedHtml += "<div class='single-word-expanded' data-translationID='"+i+"' id='single-word-expanded-"+i+"'><h4><b>"+wordList[0].simplified+"</b> &nbsp; <em>("+wordList[0].traditional+")</em></h4><br>";
		_.each(wordList, function(word) {
			expandedHtml += "<b>Pinyin:</b><br><p>"+word.pronunciation+"</p>";
			expandedHtml += "<b>Definitions:</b><br><ol>";
			for(var v = 0; v < word.definitions.length; v++) {
				var definitionsListing = "<li>"+word.definitions[v]+"</li>";
				expandedHtml += definitionsListing;
			}
			expandedHtml += "<br>";
		});
		expandedHtml += "<hr></div>";
		i++;
	});

	display(resultHtml, expandedHtml);
}

function displayResultsOld(trans) {
	var resultHtml = "<ul class='collection'><li class='collection-item'><div>Search Results</div><a href='#' ids='close-search-results' class='secondary-content modal-action modal-close' onclick='unDisplay()'><i class='material-icons'>close</i></a></li>";
	_.each(trans, function(wordList) {
		_.each(wordList, function(word) {
			var itemListingSectionOne = "<li class='collection-item'><span class='title'>"+word.simplified+" ("+word.traditional+") </span><p>"+word.pronunciation+" <br>";
			var definitionsHtml = "<ol>";
			for(var i = 0; i < word.definitions.length; i++) {
				var definitionListing = "<li>"+word.definitions[i]+"</li>";
				definitionsHtml += definitionListing;
			}
			definitionsHtml += "</ol>";
			var itemListingSectionTwo = "<a href='#' class='secondary-content unsupported-feature'><i class='material-icons'>grade</i></a></li>";
			var itemListing = itemListingSectionOne+definitionsHtml+itemListingSectionTwo;
			resultHtml += itemListing;
		});
	});
	resultHtml += "</ul>";

	display(resultHtml);
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

$(document).ready(function() {
	initializeSearch();
});
