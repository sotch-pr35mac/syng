(function() {
  var NSLog, util,
    __slice = [].slice;

  NSLog = require('../build/Release/nslog.node');

  util = require('util');

  module.exports = function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    return NSLog.log(util.format.apply(util, args));
  };

}).call(this);
