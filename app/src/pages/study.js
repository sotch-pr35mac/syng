/*
*	@File				:: study.js
*	@Author			::	Preston Stosur-Bassett [preston@stosur.info](http://stosur.info)
*	@Description	::	This file handles the logic for the study selection page (the buttons that let you select what kind of study session you want)
*	@Created			:: April 12, 2016
*/

var ipc = require('electron').ipcRenderer; // For communication with the Main Process

function initializeStudyElements() {
	// OnClick Listeners
	$("#generateFlashcardsButton").click(function() {
		ipc.send("generate-flashcards");
		ipc.send("close-study-window");
	});

	$("#generateTestButton").click(function() {
		ipc.send("generate-test");
		ipc.send("close-study-window");
	});
}

$(document).ready(function() {
	initializeStudyElements();
});
