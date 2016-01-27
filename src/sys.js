var remote = require('remote');

$(document).ready(function() {
	$("#XOUT").click(function() {
		var sysWin = remote.getCurrentWindow();
		sysWin.close();
	});

	$("#WMIN").click(function() {
		var sysWin = remote.getCurrentWindow();
		sysWin.minimize();
	});
});
