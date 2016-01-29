// Uncomment the line below to load the sqlite version of the dictionary search engine
// var cedict = require("../src/node-cc-cedict/index.js");

// Comment out the line below to unload the mongodb version of the dictionary search engine
var cedict = require("../src/node-cc-cedict/node-cc-cedict.js");
var franc = require("franc");

function initializeSearch() {
	$("#search-button").click(function() {
		var text = $("#search-bar").val();
		var latinLang = $("#latin-language").html();
		var lang = franc(text, {'minLength': 1, 'whitelist': ['eng', 'cmn', 'und']});

		if(lang == 'cmn') {
			cedict.searchByChinese(text, function(results) {
				console.log(results);
			});
		}
		else if(lang == 'eng') {
			if(latinLang == "EN") {
				console.log("Search Language is English");
				/* cedict.searchByEnglish(text, function(results) {
					console.log(results);
				}); */
			}
			else if(latinLang == "PY") {
				cedict.searchByPinyin(text, function(results) {
					cosnole.log(results);
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
