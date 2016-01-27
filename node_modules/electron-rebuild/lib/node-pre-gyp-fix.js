'use strict';

var _regeneratorRuntime = require('babel-runtime/regenerator')['default'];

var _getIterator = require('babel-runtime/core-js/get-iterator')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.preGypFixRun = preGypFixRun;

var _path2 = require('path');

var _path3 = _interopRequireDefault(_path2);

var _spawnJs = require('./spawn.js');

var _spawnJs2 = _interopRequireDefault(_spawnJs);

var _promisifyJs = require('./promisify.js');

var _promisifyJs2 = _interopRequireDefault(_promisifyJs);

var _mainJs = require('./main.js');

var glob = (0, _promisifyJs2['default'])(require('glob'));
var cp = (0, _promisifyJs2['default'])(require('ncp').ncp);

function preGypFixRun(cwd, shouldRun, electronPath) {
  var explicitNodeVersion = arguments.length <= 3 || arguments[3] === undefined ? null : arguments[3];

  var paths, electronModuleVersion, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, _path, newPath;

  return _regeneratorRuntime.async(function preGypFixRun$(context$1$0) {
    while (1) switch (context$1$0.prev = context$1$0.next) {
      case 0:
        if (shouldRun) {
          context$1$0.next = 2;
          break;
        }

        return context$1$0.abrupt('return');

      case 2:
        context$1$0.next = 4;
        return _regeneratorRuntime.awrap(glob(_path3['default'].join(cwd, '**', 'electron-v*')));

      case 4:
        paths = context$1$0.sent;
        context$1$0.t0 = explicitNodeVersion;

        if (context$1$0.t0) {
          context$1$0.next = 10;
          break;
        }

        context$1$0.next = 9;
        return _regeneratorRuntime.awrap((0, _mainJs.getElectronModuleVersion)(electronPath));

      case 9:
        context$1$0.t0 = context$1$0.sent;

      case 10:
        electronModuleVersion = context$1$0.t0;
        _iteratorNormalCompletion = true;
        _didIteratorError = false;
        _iteratorError = undefined;
        context$1$0.prev = 14;
        _iterator = _getIterator(paths);

      case 16:
        if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
          context$1$0.next = 25;
          break;
        }

        _path = _step.value;
        newPath = _path.replace(/electron-v[^-]+/, 'node-v' + electronModuleVersion);
        context$1$0.next = 21;
        return _regeneratorRuntime.awrap(cp(_path, newPath));

      case 21:
        console.log('node-pre-gyp fixer:', _path, 'copied to', newPath);

      case 22:
        _iteratorNormalCompletion = true;
        context$1$0.next = 16;
        break;

      case 25:
        context$1$0.next = 31;
        break;

      case 27:
        context$1$0.prev = 27;
        context$1$0.t1 = context$1$0['catch'](14);
        _didIteratorError = true;
        _iteratorError = context$1$0.t1;

      case 31:
        context$1$0.prev = 31;
        context$1$0.prev = 32;

        if (!_iteratorNormalCompletion && _iterator['return']) {
          _iterator['return']();
        }

      case 34:
        context$1$0.prev = 34;

        if (!_didIteratorError) {
          context$1$0.next = 37;
          break;
        }

        throw _iteratorError;

      case 37:
        return context$1$0.finish(34);

      case 38:
        return context$1$0.finish(31);

      case 39:
      case 'end':
        return context$1$0.stop();
    }
  }, null, this, [[14, 27, 31, 39], [32,, 34, 38]]);
}

// THE MIGHTY HACK GOES HERE!