'use strict';

var _Promise = require('babel-runtime/core-js/promise')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

exports['default'] = function () {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  var stdout = options.stdout && process.stdout ? process.stdout : [];
  var stderr = options.stderr && process.stderr ? process.stderr : [];

  return new _Promise(function (resolve, reject) {
    var error = null;
    //console.log("Calling spawn! " + JSON.stringify(options));
    var proc = _child_process2['default'].spawn(options.cmd, options.args, options.opts);

    proc.stdout.on('data', function (data) {
      if (_lodash2['default'].isArray(stdout)) {
        stdout.push(data.toString());
      } else {
        stdout.write(data.toString());
      }
    });

    proc.stderr.on('data', function (data) {
      if (_lodash2['default'].isArray(stderr)) {
        stderr.push(data.toString());
      } else {
        stderr.write(data.toString());
      }
    });

    proc.on('error', function (processError) {
      return error = error || processError;
    });

    proc.on('close', function (exitCode, signal) {
      var stdoutStr = _lodash2['default'].isArray(stdout) ? stdout.join('') : '';
      var stderrStr = _lodash2['default'].isArray(stderr) ? stderr.join('') : '';

      if (exitCode !== 0) {
        error = error || new Error("Process exited with code: " + exitCode);
        error.stdout = stdoutStr;
        error.stderr = stderrStr;
      }

      var results = {
        stderr: stderrStr, stdout: stdoutStr,
        code: exitCode
      };

      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};

module.exports = exports['default'];