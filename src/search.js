/*
*	@File				:: search.js
*	@Author 			:: Preston Stosur-Bassett [preston@stosur.info](http://stosur.info)
*	@Description	:: This file handles getting the search query from the user, displaying the loading dialog, and formatting and displaying search results.
*	@Created			:: Jan 27, 2016
*/

var cedict = require("../src/engine.js");
var franc = require("franc");
var _ = require("underscore");

function unDisplay() {
	$("#search-results").closeModal();
	$("#results-container").html("");
	$("#loading-dialog").show();
}

function display(html) {
	$("#loading-dialog").hide();
	$("#results-container").html(html);

	// Bind the new buttons
	$("#close-search-results").click(function() {
		unDisplay();
	});
}

function displayNone() {
	var resultHtml = "<a href='#' ids='close-search-results' class='secondary-content modal-action modal-close' onclick='unDisplay()'><i class='material-icons'>close</i></a><br><center><h4>No Results to Display</h4></center>";
	display(resultHtml);
}

function displayResults(trans) {
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
	$("#search-button").click(function() {
		var text = $("#search-bar").val();
		var latinLang = $("#latin-language").html();
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

	$("#latin-language").click(function() {
		var en = "EN";
		var cn = "PY";
		var currentLang = $("#latin-language").html();

		if(currentLang == en) {
			$("#latin-language").html(cn);
		}
		else {
			$("#latin-language").html(en);
		}
	});

	$("#clear-search").click(function() {
		$("#search-bar").val("");
	});
}

$(document).ready(function() {
	initializeSearch();
});
