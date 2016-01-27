'use strict';

var _Promise = require('babel-runtime/core-js/promise')['default'];

var _Object$keys = require('babel-runtime/core-js/object/keys')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var promisify = function promisify(funcOrObject) {
  if (typeof funcOrObject === 'function') {
    return function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return new _Promise(function (resolve, reject) {
        args.push(function (err) {
          for (var _len2 = arguments.length, rest = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
            rest[_key2 - 1] = arguments[_key2];
          }

          if (err) {
            reject(err);
          } else {
            resolve(rest.length === 1 ? rest[0] : rest);
          }
        });

        funcOrObject.apply(this, args);
      });
    };
  }

  if (typeof funcOrObject === 'object') {
    return _lodash2['default'].reduce(_Object$keys(funcOrObject), function (acc, x) {
      acc[x] = promisify(funcOrObject[x]);
      return acc;
    }, {});
  }

  // Neither a func or an object, just return itself
  return funcOrObject;
};

exports['default'] = promisify;
module.exports = exports['default'];