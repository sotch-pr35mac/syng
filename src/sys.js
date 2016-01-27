const remote = require("electron").remote;
const BrowserWindow = remote.BrowserWindow;

function initializeSystemElements() {
	$("#XOUT").click(function() {
		var sysWin = BrowserWindow.getFocusedWindow();
		sysWin.close();
	});

	$("#WMIN").click(function() {
		var sysWin = BrowserWindow.getFocusedWindow();
		sysWin.minimize();
		alert("this also runs");
	});

	$("#WMAX").click(function() {
		var sysWin = BrowserWindow.getFocusedWindow();
		sysWin.maximize();
	});
}

$(document).ready(function() {
	initializeSystemElements();
});
