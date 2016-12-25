/*
* @File         :: characterConvert.js
* @Author       :: Preston Stosur-Bassett http://stosur.info
* @Created      :: April 25, 2016
* @Description  :: This file handles the conversion between simplified and traditional characters
*/

var cnchars = require('cn-chars'); // Convert between tradtitional and simplified

$(document).ready(function() {
  // Handle Conversion from Traditional to Simpliified
  $("#t2s").click(function() {
    var input = $("#input-chars").val();

  	var text = input.slice().split("");

  	for(var i = 0; i < input.length; i++) {
      if(text[i] == "學") {
        text[i] = "学";
      }
      else {
        text[i] = cnchars.toSimplifiedChar(text[i]);
      }
  	}

  	text = text.join('');

    $("#res-chars").val(text);
  });

  // Handle Conversion from Simplified to Traditional
  $("#s2t").click(function() {
    var input = $("#input-chars").val();

  	var text = input.slice().split("");

  	for(var i = 0; i < input.length; i++) {
  		if(text[i] == "学") {
  			text[i] = "學";
  		}
  		else {
        text[i] = cnchars.toTraditionalChar(text[i]);
  		}
  	}

  	text = text.join('');

    $("#res-chars").val(text);
  })
});
