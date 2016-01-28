var cedict = require("../src/node-cc-cedict/index.js");

function initializeSearch() {
	$("#chinese-to-english-search").click(function() {
		//Chinese to English Search
		var chineseText = $("#search-bar").val();

		alert("Click!");
		cedict.searchByChinese(chineseText, function(englishText) {
			alert(englishText);
		});
	});

	$("#english-to-chinese-search").click(function() {
		//English to Chinese Search
		var englishTest = $("#search-bar").val();

		alert("Clicked English to Chinese");
	});
}

$(document).ready(function() {
	initializeSearch();
});
