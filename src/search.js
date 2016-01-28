var cedict = require("../src/node-cc-cedict/index.js");

function initializeSearch() {
	$("#chinese-to-english-search").click(function() {
		//Chinese to English Search
		var chineseText = $("#search-bar").val();

		alert(chineseText);

		cedict.searchByChinese(chineseText, function(englishText) {
			alert(englishText);
		});
	});
}

$(document).ready(function() {
	initializeSearch();
});
