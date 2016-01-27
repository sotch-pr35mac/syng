var cedict = require("../src/node-cc-cedict/index.js");

$(document).ready(function() {
	//Chinese to English Search
	$("#chinese-to-english-search").click(function() {
		var chineseText = $("#search-bar").val();

		cedict.searchByChinese(chineseText, function(englishText) {
			alert(englishText);
		});
	});
});
