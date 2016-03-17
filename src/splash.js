$(document).ready(function() {
	var messages = [
							"Rasterbating gigapixels...",
							"Contacting Starfleet...",
							"Pay no attention to Ceaser. Ceaser has no idea what's really going on.",
							"Don't think about elephants.",
							"Please wait while we test your patience.",
							"Are we there yet...?",
							"Contemplating life...",
							"Working...",
							"Determining length for offline cable...",
							"Reading sectors from file...",
							"Erasing ~/ ...",
							"Trying commong passwords...",
							"Covering up security breach...",
							"Don't panic.",
							"Obfuscating error messages...",
							"Dividing by zero...",
							"Recalculating gravitational constant...",
							"Archeiving internet to ~/Downloads ...",
							"brb",
							"Determining size of CC-CEDICT file ... It's Over 9000!",
							"Mining for bitcoin...",
							"Solving for x...",
							"Saving checkpoint...",
							"Insert quarter.",
							"Taking too long? Go get coffee or make a sandwich.",
							"Insufficient disk space. Reformatting...",
							"Please keep waiting.",
							"Scanning personal files...",
							"Untie-ing dyslexics...",
							"Batteries not included.",
							"Level up!",
							"Unjamming RAM",
							"Softening hard disk...",
							"Notifying relevant government authorities...",
							"Have a good day.",
							"Uploading photos...",
							"Preparing DOS run-time environment",
							"Bitmapping..."
						];

	setInterval(function() {
		var randomInt = Math.floor(Math.random() * messages.length - 1);
		$("#loading-messages").html(messages[randomInt]);
	}, 3000);
});
