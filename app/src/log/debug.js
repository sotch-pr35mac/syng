/*
* @Author: Preston Stosur-Bassett
* @Date: Nov 4, 2016
* @Description: debug.js is a debug logging platform for Syng Chinese to English Dictionary
* @File: debug.js
*/

// Set this variable to true to enable debug print statements
var debugOn = false;

module.exports = {
  // Log a message to the console
  writeLogMessage: function(message) {
    conosle.log("/* Syng: "+message+" */");
  },

  // Log a message to the console only if `debugOn` is set to true
  writeDebugMessage: function(message) {
    if(debugOn == true) {
      console.log("~~~ DEBUG ~~~");
      console.log(message);
    }
  },

  // Write out a messsage to the console
  // Take two arguments
  // `message` ==> The message to be logged to the console
  // `type` ==> the type of log to create, "debug" for writeDebugMessage and "log" for writeLogMessage
  writeOut: function(message, type) {
    if(type == "debug") {
      writeDebugMessage(message);
    }
    else if(type == "log") {
      writeLogMessage(message);
    }
    else {
      console.log("Unrecognized log type: "+type);
    }
  },

  // Write out a message to the console using the writeLogMessage method
  writeOut: function(message) {
    this.writeLogMessage(message);
  },

  // Write out a message to the console using the writeLogMessage method
  log: function(message) {
    this.writeLogMessage(message);
  },

  // Write out a message to the console using the writeDebugMessage method
  debug: function(message) {
    this.writeDebugMessage(message);
  },

  // Turn the `debugOn` variable to true so that debug statements write out
  setDebugTrue: function() {
    debugOn = true;
  },

  // Turn the `debugOn` variable to false so that debug statements do not write out
  setDebugFalse: function() {
    debugOn = false;
  },

  // Short hand name for setDebugTrue
  turnDebugOn: function() {
    this.setDebugTrue();
  },

  // Short hand name for setDebugFalse
  turnDebugOff: function() {
    this.setDebugFalse();
  },
};
