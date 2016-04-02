/*
*	@File				::	lgChar.js
*	@Author			:: Preston Stosur-Bassett [preston@stosur.info](http://stosur.info)
*	@Description	:: This file handles the page actions for the 'View Large Characters Window'
*	@Created			:: April 2, 2016
*/

var ipc = require('electron').ipcRenderer; // For communication with the Main Process

ipc.on('load-new-characters', function(event, args) {
	var simplified = args.simplified;
	var traditional = args.traditional;

	$("#simplified-container").html(simplified);
	$("#traditional-container").html(traditional);
});

$(document).ready(function() {
	$("#simplified-tab").click(function() {
		$("#traditional-pane").hide();
		$("#traditional-tab").removeClass("active");
		$("#simplified-tab").addClass("active");
		$("#simplified-pane").show();
	});

	$("#traditional-tab").click(function() {
		$("#simplified-tab").removeClass("active");
		$("#traditional-tab").addClass("active");
		$("#simplified-pane").hide();
		$("#traditional-pane").show();
	});
});
