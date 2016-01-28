/*!
 * safejs
 * https://github.com/sergeyksv/safejs
 *
 * Copyright 2012-2016 PushOk Software
 * Licensed under MIT
 */

/*global define, Image, self*/

!(function () {
	"use strict";

	var UNDEFINED = 'undefined',
		OBJECT = 'object',
		FUNCTION = 'function',
		undefined,
		safe = {},
		root = typeof self === OBJECT && self.self === self && self || typeof global === OBJECT && global.global === global && global || this,
		_Array = Array,
		_Object = Object,
		_previous = root ? root.safe : undefined,
		_toString = _Object.prototype.toString,
		_hop = function (obj, key) {
			return _Object.prototype.hasOwnProperty.call(obj, key);
		},
		_typedErrors = [
			"Array or Object are required",
			"Array is required",
			"Exactly two arguments are required",
			"Function is required"
		],
		_options = {
			_debugger: false
		};

	safe.noConflict = function () {
		root.safe = _previous;
		return this;
	};

	/* +++++++++++++++++++++++++ private functions +++++++++++++++++++++++++ */
	var _isFunction = function (fn) {
		return typeof fn === FUNCTION || _toString.call(fn) === '[object Function]';
	};

	var _isUndefined = function (val) {
		return typeof val === UNDEFINED;
	};

	var _isObject = function (obj) {
		if (obj === null)
			return false;

		var type = typeof obj;
		return type === OBJECT || type === FUNCTION;
	};

	var _isArray = _Array.isArray || function (arr) {
		return _toString.call(arr) === '[object Array]';
	};

	var _parseInt = function (num) {
		return +num;
	};

	var _arEach = /*_Array.prototype.forEach ? _Function.prototype.call.bind(_Array.prototype.forEach) :*/ function (arr, iterator) {
		for (var i = 0; i < arr.length; i++) {
			if (iterator(arr[i], i) === false) {
				break;
			}
		}
	};

	var _armap = function (arr, fn) {
		var res = _Array(arr.length),
			next = _iterator(arr),
			key;

		if (_isFunction(fn)) {
			while ((key = next()) !== null) {
				res[key] = fn(arr[key], key, arr);
			}
		} else {
			while ((key = next()) !== null) {
				res[key] = arr[key] ? arr[key][fn] : undefined;
			}
		}

		return res;
	};

	var _size = (function () {
		if (_Object.keys) {
			return function (obj) {
				return _isArray(obj) ? obj.length : _Object.keys(obj).length;
			};
		}

		return function (obj) {
			if (_isArray(obj))
				return obj.length;

			var j = 0;
			for (var i in obj) {
				if (_hop(obj, i)) {
					++j;
				}
			}
			return j;
		};
	})();

	var _keys = _Object.keys || function (obj) {
		if (typeof obj !== OBJECT && (typeof obj !== FUNCTION || obj === null)) {
			throw new TypeError('Object.keys called on non-object');
		}

		var len = _size(obj),
			arr = _Array(len),
			i = 0;

		if (_isArray(obj)) {
			for (; i < len; i++) {
				arr[i] = i;
			}
		} else {
			for (var j in obj) {
				if (_hop(obj, j)) {
					arr[i++] = j;
				}
			}
		}

		return arr;
	};

	var _iterator = function (obj) {
		var i = -1,
			keys,
			l;

		if (_isArray(obj)) {
			l = obj.length;
			return function () {
				++i;
				return i < l ? i : null;
			};
		} else {
			keys = _keys(obj);
			l = keys.length;
			return function () {
				++i;
				return i < l ? keys[i] : null;
			};
		}
	};

	var _fnApply = function (fn, self, args) {
		switch (args ? args.length : 0) {
			case 0: return fn.call(self);
			case 1: return fn.call(self, args[0]);
			case 2: return fn.call(self, args[0], args[1]);
			case 3: return fn.call(self, args[0], args[1], args[2]);
			default: return fn.apply(self, args);
		}
	};

	var _wrapArgs = function (fn) {
		var rest = fn.length > 1;

		return function () {
			var i = 0,
				len = rest ? arguments.length === 0 ? 0 : arguments.length - 1 : arguments.length,
				args = _Array(len);

			for (; i < len; i++) {
				args[i] = arguments[i];
			}

			if (rest) {
				return fn.call(this, args, arguments[len]);
			}

			return fn.call(this, args);
		};
	};

	var _wrapArgsSure = function (callback, fn) {
		return function (err) {
			if (arguments.length === 0)
				return fn.call(this);

			if (err) {
				return callback.apply(this, arguments);
			}

			var i = 1,
				len = arguments.length,
				args = _Array(len - 1);

			for (; i < len; i++) {
				args[i - 1] = arguments[i];
			}

			return fn.call(this, args);
		};
	};

	var _later;

	if (typeof setImmediate === UNDEFINED) {
		if (typeof process === UNDEFINED) {
			if (typeof Promise === FUNCTION) { // new browsers polyfill
				_later = (function (Promise) {
					var counter = 0,
						promise = Promise.resolve();

					return function (callback) {
						if (++counter === 10) {
							promise = Promise.resolve(); // clear promise stack
							counter = 0;
						}

						promise.then(function () {
							callback();
						});
					};
				})(Promise);
			} else if (typeof Image === FUNCTION) { // old browsers polyfill
				_later = (function (Image) {
					return function (callback) {
						var img = new Image;
						img.onerror = function () {
							callback();
						};
						img.src = 'data:image/png,0';
					};
				})(Image);
			} else
				_later = function (callback) {
					setTimeout(callback, 0);
				};
		} else {
			_later = process.nextTick;
		}
	} else {
		_later = function (callback) {
			setImmediate(callback);
		};
	}

	var _back = function (fn) {
		var self = this,
			args = arguments;

		_later(function () {
			switch (args.length - 1) {
				case 0: return fn.call(self);
				case 1: return fn.call(self, args[1]);
				case 2: return fn.call(self, args[1], args[2]);
				case 3: return fn.call(self, args[1], args[2], args[3]);
				default: return fn.apply(self, _argToArr.apply(1, args));
			}
		});
	};

	var _noop = function () {};

	var _throwError = function (text, callback) {
		var err = _typedErrors.indexOf(text) !== -1 ? new TypeError(text) : new Error(text);
		if (!_isFunction(callback))
			throw err;

		callback(err);
	};

	var _argToArr = function () {
		var len = arguments.length,
			rest = _parseInt(this);

		if (rest !== rest) // check for NaN
			_throwError('Pass arguments to "safe.args" only through ".apply" method!');

		if (len === 0 || rest > len)
			return [];

		var args = _Array(len - rest),
			i = rest;

		for (; i < len; i++) {
			args[i - rest] = i < 0 ? null : arguments[i];
		}

		return args;
	};

	var _doPsevdoAsync = function (fn) {
		return function (cb) {
			cb(null, fn());
		};
	};

	var _constant = function () {
		var args = _argToArr.apply(-1, arguments);
		args[0] = null;

		return function (callback) {
			return _fnApply(callback, this, args);
		};
	};

	var _once = function (callback) {
		callback = callback || null;

		return _wrapArgs(function (args) {
			if (callback === null)
				return;

			_fnApply(callback, this, args);
			callback = null;
		});
	};

	var _only_once = function (callback) {
		return _wrapArgs(function (args) {
			if (callback === null)
				_throwError("Callback was already called.");

			_fnApply(callback, this, args);
			callback = null;
		});
	};

	var _catcher = function (fn, self, args, callback) {
		try {
			return _fnApply(fn, self, args);
		} catch (err) {
			if (_options._debugger)
				_options._debugger(err, _argToArr.apply(0, arguments));

			callback(err);
		}
	};

	var _runCatcher = function (fn, callback) {
		try {
			return fn(callback);
		} catch (err) {
			if (_options._debugger)
				_options._debugger(err, _argToArr.apply(0, arguments));

			callback(err);
		}
	};

	var _ensureAsync = function (fn) {
		return _wrapArgs(function (args, callback) {
			var	sync = true;

			args.push(function () {
				var args2 = arguments,
					self = this;

				if (sync)
					_later(function () {
						_fnApply(callback, self, args2);
					});
				else
					_fnApply(callback, self, args2);
			});

			var r = _fnApply(fn, this, args);
			sync = false;
			return r;
		});
	};

	var _isPromise = function (p) {
		return p && _isFunction(p.then);
	};

	var _run = function (fn, callback) {
		callback = _only_once(callback);

		var res = _runCatcher(fn, callback);

		if (_isPromise(res)) {
			res.then(function (result) {
				callback(null, result);
			}, function (error) {
				callback(error);
			});
		}
	};

	var _asyncify = function (func) {
		return _wrapArgs(function (args, callback) {
			var	self = this;

			_run(function (cb) {
				var res = _fnApply(func, self, args);
				return _isPromise(res) ? res : cb(null, res);
			}, callback);
		});
	};

	var _result = function (callback, fn) {
		if (!_isFunction(fn) || !_isFunction(callback))
			return _throwError(_typedErrors[2]);

		return _wrapArgs(function (args) {
			var err, result = _catcher(fn, this, args, function (er) {
				err = er;
			});

			if (err)
				callback(err);
			else if (!_isUndefined(result))
				_back(callback, null, result);
			else
				_back(callback, null);
		});
	};

	var _sure_result = function (callback, fn) {
		if (!_isFunction(fn) || !_isFunction(callback))
			return _throwError(_typedErrors[2]);

		return _wrapArgsSure(callback, function (args) {
			var err, result = _catcher(fn, this, args, function (er) {
				err = er;
			});

			if (err)
				callback(err);
			else if (!_isUndefined(result))
				_back(callback, null, result);
			else
				_back(callback, null);
		});
	};

	var _sure = function (callback, fn) {
		if (_isUndefined(fn) || !_isFunction(callback))
			return _throwError(_typedErrors[2]);

		return _wrapArgsSure(callback, function (args) {
			if (!_isFunction(fn))
				return _back(callback, null, fn);

			_catcher(fn, this, args, callback);
		});
	};

	var _trap = function (callback, fn) {
		if (_isUndefined(callback))
			return _throwError(_typedErrors[2]);

		return _wrapArgs(function (args) {
			if (_isUndefined(fn)) {
				fn = callback;
				callback = args[args.length - 1];
			}

			_catcher(fn, this, args, callback);
		});
	};

	var _wrap = function (fn, callback) {
		if (_isUndefined(callback))
			return _throwError(_typedErrors[2]);

		return _wrapArgs(function (args) {
			args.push(callback);
			_catcher(fn, this, args, callback);
		});
	};

	var _sure_spread = function (callback, fn) {
		if (_isUndefined(fn) || !_isFunction(callback))
			return _throwError(_typedErrors[2]);

		return _wrapArgsSure(callback, function (args) {
			_catcher(fn, this, args[0], callback);
		});
	};

	var _spread = function (fn) {
		return function (arr) {
			_fnApply(fn, this, arr);
		};
	};

	var _inherits = (function () {
		function noop() {}

		function ecma3(ctor, superCtor) {
			noop.prototype = superCtor.prototype;
			ctor.prototype = new noop;
			ctor.prototype.constructor = superCtor;
			noop.prototype = null;
		}

		function ecma5(ctor, superCtor) {
			ctor.prototype = _Object.create(superCtor.prototype, {
				constructor: {
					value: ctor,
					enumerable: false
				}
			});
		}

		return _Object.create ? ecma5 : ecma3;
	})();

	var _async = function (self, fn) {
		var args = _argToArr.apply(2, arguments);

		return function (callback) {
			args.push(callback);
			_catcher(self[fn], self, args, callback);
		};
	};

	var _controlFlow = function (flow, arr, callback) {
		callback = _once(callback);

		var results = _isArray(arr) ? _Array(arr.length) : {};

		flow(arr, function (item, key, cb) {
			_run(function (cb) {
				return item(cb);
			}, function (err) {
				if (!err) {
					if (arguments.length === 0) {
						results[key] = null;
					} else {
						results[key] = arguments.length > 2 ? _argToArr.apply(1, arguments) : arguments[1]; // behavior is compatible with async
					}
				}

				cb(err);
			});
		}, function (err) {
			if (err)
				callback(err);
			else
				callback(null, results);
		});
	};

	var _executeSeries = function (chain, callback) {
		if (!_isObject(chain)) {
			return _throwError(_typedErrors[0], callback);
		}

		callback = _once(callback);

		var next = _iterator(chain),
			key;

		(function iterator(err) {
			if (err)
				return callback(err);

			if ((key = next()) === null)
				return callback.apply(this, arguments);

			var args = _argToArr.apply(1, arguments);

			_run(function (cb) {
				args.push(cb);
				return _fnApply(chain[key], this, args);
			}, iterator);
		})();
	};

	var _reduce = function (arr, memo, fn, callback, direction) {
		callback = _once(callback);

		var next = _iterator(arr),
			len = arr.length,
			key;

		(function iterator(err, memo) {
			if (err)
				return callback(err);

			if ((key = next()) === null)
				return callback(null, memo);

			_run(function (cb) {
				return fn(memo, direction ? arr[key] : arr[len - 1 - key], cb);
			}, iterator);
		})(null, memo);
	};

	var _eachLimit = function (limit) {
		limit = _parseInt(limit) || Infinity;

		return function (obj, fn, callback) {
			callback = _once(callback);

			var running = 0,
				done = false,
				next = _iterator(obj),
				err = false,
				key,
				flen = fn.length;

			(function iterator() {
				if (done && running <= 0)
					return callback(null);

				while (running < limit && !err) {
					key = next();

					if (key === null) {
						done = true;
						if (running <= 0) {
							callback(null);
						}
						return;
					}

					++running;
					_run(function (cb) {
						if (flen === 2)
							return fn(obj[key], cb);

						return fn(obj[key], key, cb);
					}, function (_err) {
						--running;

						if (_err) {
							err = true;
							callback(_err);
						} else {
							iterator();
						}
					});
				}
			})();
		};
	};

	var _eachSeries = _eachLimit(1);
	var _eachUnlim = _eachLimit(Infinity);

	var _asyncEach = function (flow, arr, fn, callback) {
		callback = _once(callback);

		flow(arr, function (item, key, cb) {
			_run(function (cb) {
				return fn(item, cb);
			}, cb);
		}, function (err) {
			callback(err || null);
		});
	};

	var _map = function (flow, obj, fn, callback) {
		callback = _once(callback);

		var result = _isArray(obj) ? _Array(obj.length) : [],
			idx = -1;

		flow(obj, function (item, key, cb) {
			var i = ++idx;

			_run(function (cb) {
				return fn(item, cb);
			}, function (err, res) {
				result[i] = res;
				cb(err);
			});
		}, function (err) {
			if (err)
				callback(err);
			else
				callback(null, result);
		});
	};

	var _sortBy = function (flow, arr, fn, callback) {
		callback = _once(callback);

		var result = _Array(arr.length);

		flow(arr, function (item, key, cb) {
			_run(function (cb) {
				return fn(item, cb);
			}, function (err, res) {
				result[key] = {
					e: item,
					i: res
				};
				cb(err);
			});
		}, function (err) {
			if (err)
				callback(err);
			else
				callback(null, _armap(result.sort(function (a, b) {
					return a.i - b.i;
				}), "e"));
		});
	};

	var _concat = function (flow, arr, fn, callback) {
		callback = _once(callback);

		var result = _Array(arr.length);

		flow(arr, function (item, key, cb) {
			_run(function (cb) {
				return fn(item, cb);
			}, function (err, res) {
				result[key] = res;
				cb(err);
			});
		}, function (err) {
			if (err) {
				callback(err);
			} else {
				var res = [];

				_arEach(result, function (r) {
					res = res.concat(r);
				});

				callback(null, res);
			}
		});
	};

	var _times = function (flow, times, fn, callback) {
		times = _parseInt(times);

		var arr = _Array(times),
			i = 0;

		for (; i < times; i++) {
			arr[i] = i;
		}

		_map(flow, arr, fn, callback);
	};

	var _filter = function (flow, trust, arr, fn, callback) {
		callback = _once(callback);

		var result = [];

		flow(arr, function (item, key, cb) {
			_run(function (cb) {
				return fn(item, cb);
			}, function (err, is) {
				if ((trust && is) || !(trust || is)) {
					result.push({
						e: item,
						i: key
					});
				}
				cb(err);
			});
		}, function (err) {
			if (err) {
				callback(err);
			} else {
				callback(null, _armap(result.sort(function (a, b) {
					return a.i - b.i;
				}), "e"));
			}
		});
	};

	var _detect = function (flow, arr, fn, callback) {
		callback = _once(callback);

		var result;

		flow(arr, function (item, cb) {
			_run(function (cb) {
				return fn(item, cb);
			}, function (is) {
				if (is)
					result = item;

				cb(result || null);
			});
		}, function () {
			callback(result);
		});
	};

	var _test = function (flow, trust, arr, fn, callback) {
		callback = _once(callback);

		var result = trust;

		flow(arr, function (item, cb) {
			_run(function (cb) {
				return fn(item, cb);
			}, function (is) {
				if (trust) {
					if (!is)
						result = false;

					cb(!is);
				} else {
					if (is)
						result = true;

					cb(result);
				}
			});
		}, function () {
			callback(result);
		});
	};

	var _auto = function (obj, limit, callback) {
		var results = {},
			stop,
			starter = {},
			running = 0,
			unresolve = null,
			tasks = _keys(obj),
			qnt = tasks.length;

		if (_isFunction(limit)) {
			callback = limit;
			limit = Infinity;
		} else {
			limit = _parseInt(limit) || Infinity;
		}

		// check dependencies
		_arEach(tasks, function (key) {
			var target = obj[key];

			if (_isArray(target)) {
				var i = 0,
					deps,
					len = target.length - 1;

				for (; i < len; i++) {
					deps = obj[target[i]];

					if (!deps) {
						unresolve = "Has inexistant dependency";
						return false;
					} else if ((deps == key) || (_isArray(deps) && deps.indexOf(key) !== -1)) {
						unresolve = 'Has nonexistent dependency in ' + deps.join(', ');
						return false;
					}
				}
			}
		});

		if (unresolve) {
			return _throwError(unresolve, callback);
		}

		callback = _once(callback);

		(function iterator() {
			_arEach(tasks, function (k) {
				if (stop || running >= limit)
					return false;

				if (starter[k])
					return;

				var task, target = obj[k];

				if (_isArray(target)) {
					var i = 0,
						fin = target.length - 1;

					for (; i < fin; i++) {
						if (!_hop(results, target[i]))
							return;
					}

					task = target[fin];
				} else
					task = target;

				starter[k] = true;
				++running;

				_run(function (cb) {
					return task(cb, results);
				}, function (err) {
					--qnt;
					--running;

					if (stop)
						return;

					stop = (err || qnt === 0);

					if (err)
						return callback(err, results);

					if (arguments.length > 1)
						results[k] = arguments.length > 2 ? _argToArr.apply(1, arguments) : arguments[1]; // behavior is compatible with async
					else
						results[k] = null;

					if (stop)
						return callback(err, results);

					iterator();
				});
			});
		})();
	};

	var _swhile = function (test, fn, dir, before, callback) {
		callback = _once(callback);

		function iterator() {
			_run(fn, _sure(callback, tester));
		}

		function tester(result) {
			_run(test, _sure(callback, function (res) {
				if (res == dir) {
					callback(null, result);
				} else
					iterator();
			}));
		}

		if (before) {
			tester();
		} else {
			iterator();
		}
	};

	var _forever = function (fn, callback) {
		callback = _only_once(callback);
		fn = _ensureAsync(fn);

		(function iterator() {
			fn(safe.sure(callback, iterator));
		})();
	};

	var _apply = function (fn) {
		var args = _argToArr.apply(1, arguments),
			self = this;

		return _wrapArgs(function (args2) {
			args = args.concat(args2);
			_fnApply(fn, self, args);
		});
	};

	var _applyEach = function (flow) {
		return function (fns) {
			var args = _argToArr.apply(1, arguments),
				self = this;

			var task = _wrapArgs(function (args2, callback) {
				flow(fns, function (fn, cb) {
					return _fnApply(fn, self, args2.concat(cb));
				}, callback);
			});

			if (args.length === 0) {
				return task;
			} else {
				return _fnApply(task, self, args);
			}
		};
	};

	var _memoize = function (fn, hasher) {
		var memo = {};
		var queues = {};
		hasher = hasher || function (v) {
			return v;
		};

		var memoized = _wrapArgs(function (args, callback) {
			var key = _fnApply(hasher, null, args);
			if (_hop(memo, key)) {
				_later(function () {
					_fnApply(callback, null, memo[key]);
				});
			} else if (_hop(queues, key)) {
				queues[key].push(callback);
			} else {
				queues[key] = [callback];
				_fnApply(fn, null, args.concat(_wrapArgs(function (args) {
					memo[key] = args;
					var q = queues[key];
					delete queues[key];
					_arEach(q, function (item) {
						_fnApply(item, null, args);
					});
				})));
			}
		});

		memoized.memo = memo;
		memoized.unmemoized = fn;
		return memoized;
	};

	var _unmemoize = function (fn) {
		return _wrapArgs(function (args) {
			return _fnApply(fn.unmemoized || fn, null, args);
		});
	};

	var _retry = function (obj, fn, callback) {
		if (arguments.length < 1 || arguments.length > 3) {
			return _throwError('Invalid arguments - must be either (task), (task, callback), (times, task) or (times, task, callback)');
		}

		var error,
			times,
			interval = 0;

		if (_isFunction(obj)) {
			callback = fn;
			fn = obj;
			times = 5;
		} else if (_isObject(obj)) {
			times = _parseInt(obj.times) || 5;
			interval = _parseInt(obj.interval) || 0;
		} else {
			times = _parseInt(times) || 5;
		}

		function task(wcb, data) {
			var cbi = (function () {
				if (interval > 0)
					return function (cb) {
						setTimeout(function () {
							cb();
						}, interval);
					};

				return function (cb) {
					cb();
				};
			})();

			_eachSeries(_Array(times), function (item, key, cb) {
				_run(function (cb) {
					return fn(cb, data);
				}, function (err, res) {
					error = err || null;
					data = {err: error, result: res};

					if (err && key < times - 1) {
						cbi(cb);
					} else {
						cb(!err);
					}
				});
			}, function () {
				(wcb || callback || _noop)(error, data);
			});
		}

		return callback ? task() : task;
	};

	var _transform = function (arr, memo, iterator, callback) {
		if (arguments.length === 3) {
			callback = iterator;
			iterator = memo;
			memo = _isArray(arr) ? [] : {};
		}

		_eachUnlim(arr, function(v, k, cb) {
			iterator(memo, v, k, cb);
		}, function(err) {
			callback(err, memo);
		});
	};

	var _queue = function (worker, concurrency) {
		var self = this;

		if (_Object.defineProperties) {
			_Object.defineProperties(self, {
				'__worker': {
					enumerable: false,
					configurable: false,
					writable: false,
					value: worker
				},
				'__workers': {
					enumerable: false,
					configurable: false,
					writable: true,
					value: 0
				},
				'__workersList': {
					enumerable: false,
					configurable: false,
					writable: true,
					value: []
				},
				'tasks': {
					enumerable: false,
					configurable: false,
					writable: true,
					value: []
				}
			});
		} else {
			self.__worker = worker;
			self.__workers = 0;
			self.__workersList = [];
			self.tasks = [];
		}

		if (concurrency == null) {
			concurrency = 1;
		} else if (concurrency === 0) {
			return _throwError('Concurrency must not be zero');
		} else {
			self.concurrency = _parseInt(concurrency);
		}

		self.started = false;
		self.paused = false;
	};

	_queue.prototype.saturated = _noop;
	_queue.prototype.empty = _noop;
	_queue.prototype.drain = _noop;

	_queue.prototype.kill = function () {
		this.drain = _noop;
		this.tasks = [];
	};

	_queue.prototype.length = function () {
		return this.tasks.length;
	};

	_queue.prototype.running = function () {
		return this.__workers;
	};

	_queue.prototype.idle = function () {
		return this.tasks.length + this.__workers === 0;
	};

	_queue.prototype.pause = function () {
		this.paused = true;
	};

	_queue.prototype.resume = function () {
		var self = this;
		if (self.paused === false)
			return;

		self.paused = false;

		var w = 0,
			next = _iterator(self.tasks);

		for (; w < self.concurrency && next() !== null; w++) {
			self.__execute();
		}
	};

	_queue.prototype.workersList =  function () {
		return this.__workersList;
	};

	_queue.prototype.__insert = function (data, pos, callback) {
		if (callback != null && typeof callback !== FUNCTION) {
			return _throwError(_typedErrors[3]);
		}

		var self = this;

		self.started = true;

		if (!_isArray(data))
			data = [data];

		if (data.length === 0)
			return self.drain();

		var arlen = data.length,
			tlen = self.tasks.length,
			i = 0,
			arr = _armap(data, function (task, k) {
				return {
					data: task,
					priority: pos,
					callback: _only_once(_isFunction(callback) ? callback : _noop)
				};
			});

		if (tlen) {
			if (self instanceof _priorQ) {
				var firstidx = tlen ? self.tasks[0].priority : 0,
					lastidx = tlen ? self.tasks[tlen - 1].priority : 0;

				if (pos > firstidx)
					self.tasks = arr.concat(self.tasks);
				else
					self.tasks = self.tasks.concat(arr);

				if (firstidx >= pos && pos < lastidx) {
					self.tasks.sort(function (b, a) { // reverse sort
						return a.priority - b.priority;
					});
				}
			} else {
				if (pos)
					self.tasks = arr.concat(self.tasks);
				else
					self.tasks = self.tasks.concat(arr);
			}
		} else
			self.tasks = arr;

		for (; i < arlen && !self.paused; i++) {
			self.__execute();
		}
	};

	var _priorQ = function (worker, concurrency) {
		_queue.call(this, worker, concurrency);
	};

	var _seriesQ = function (worker, concurrency) {
		_queue.call(this, worker, concurrency);
	};

	var _cargoQ = function (worker, payload) {
		_queue.call(this, worker, 1);
		this.payload = payload;
	};

	_inherits(_priorQ, _queue);
	_inherits(_seriesQ, _queue);
	_inherits(_cargoQ, _queue);

	_priorQ.prototype.push = function (data, prior, callback) {
		this.__insert(data, prior, callback);
	};

	_seriesQ.prototype.push = _cargoQ.prototype.push = function (data, callback) {
		this.__insert(data, false, callback);
	};

	_seriesQ.prototype.unshift = function (data, callback) {
		this.__insert(data, true, callback);
	};

	_seriesQ.prototype.__execute = _priorQ.prototype.__execute = function () {
		var self = this;

		if (!self.paused && self.__workers < self.concurrency && self.tasks.length !== 0) {
			var task = self.tasks.shift();
			self.__workersList.push(task);

			if (self.tasks.length === 0)
				self.empty();

			++self.__workers;

			if (self.__workers === self.concurrency)
				self.saturated();

			var cb = _only_once(function () {
				--self.__workers;

				_arEach(self.__workersList, function (worker, index) {
					if (worker === task) {
						self.__workersList.splice(index, 1);
						return false;
					}
				});

				_fnApply(task.callback, task, arguments);

				if (self.tasks.length + self.__workers === 0)
					self.drain();

				self.__execute();
			});

			_run(function (cb) {
				return self.__worker.call(task, task.data, cb);
			}, cb);
		}
	};

	_cargoQ.prototype.__execute = function () {
		var self = this;

		if (!self.paused && self.__workers < self.concurrency && self.tasks.length !== 0) {
			var tasks = self.tasks.splice(0, self.payload);

			if (self.tasks.length === 0)
				self.empty();

			var data = _armap(tasks, "data");

			++self.__workers;

			if (self.__workers === self.concurrency)
				self.saturated();

			var cb = _only_once(function () {
				--self.__workers;

				var args = arguments;

				_arEach(tasks, function (task) {
					_arEach(self.__workersList, function (worker, index) {
						if (worker === task) {
							self.__workersList.splice(index, 1);
							return false;
						}
					});

					_fnApply(task.callback, task, args);
				});

				if (self.tasks.length + self.__workers === 0)
					self.drain();

				self.__execute();
			});

			_run(function (cb) {
				return self.__worker.call(null, data, cb);
			}, cb);
		}
	};

	/* ++++++++++++++++++++++++++ public methods +++++++++++++++++++++++++++ */
	safe.noop = _noop;
	safe.yield = _later;
	safe.back = safe.setImmediate = safe.nextTick = _back; // compatible with async
	safe.apply = _apply;
	safe.async = _async;
	safe.inherits = _inherits;
	safe.args = _argToArr;
	safe.ensureAsync = _ensureAsync;

	safe.setDebugger = function (fn) {
		_options._debugger = _isFunction(fn) ? fn : false;
	};

	safe.constant = _constant;

	safe.result = function (callback, fn) {
		return _result(callback, fn);
	};

	safe.sure_result = safe.trap_sure_result = function (callback, fn) {
		return _sure_result(callback, fn);
	};

	safe.sure = safe.trap_sure = function (callback, fn) {
		return _sure(callback, fn);
	};

	safe.trap = function (callback, fn) {
		return _trap(callback, fn);
	};

	safe.wrap = function (fn, callback) {
		return _wrap(fn, callback);
	};

	safe.run = function (fn, callback) {
		_run(fn, callback);
	};

	safe.sure_spread = function (callback, fn) {
		return _sure_spread(callback, fn);
	};

	safe.spread = function (fn) {
		return _spread(fn);
	};

	safe.each = safe.forEach = function (arr, fn, callback) {
		if (!_isArray(arr)) {
			return _throwError(_typedErrors[1], callback);
		}

		_asyncEach(_eachUnlim, arr, fn, callback);
	};

	safe.eachLimit = safe.forEachLimit = function (arr, limit, fn, callback) {
		if (!_isArray(arr)) {
			return _throwError(_typedErrors[1], callback);
		}

		_asyncEach(_eachLimit(limit), arr, fn, callback);
	};

	safe.eachSeries = safe.forEachSeries = function (arr, fn, callback) {
		if (!_isArray(arr)) {
			return _throwError(_typedErrors[1], callback);
		}

		_asyncEach(_eachSeries, arr, fn, callback);
	};

	safe.forEachOf = safe.eachOf = function (obj, fn, callback) {
		if (!_isObject(obj, callback)) {
			return _throwError(_typedErrors[0], callback);
		}

		_eachUnlim(obj, fn, callback);
	};

	safe.forEachOfLimit = safe.eachOfLimit = function (obj, limit, fn, callback) {
		if (!_isObject(obj)) {
			return _throwError(_typedErrors[0], callback);
		}

		_eachLimit(limit)(obj, fn, callback);
	};

	safe.forEachOfSeries = safe.eachOfSeries =  function (obj, fn, callback) {
		if (!_isObject(obj)) {
			return _throwError(_typedErrors[0], callback);
		}

		_eachSeries(obj, fn, callback);
	};

	safe.map = function (obj, fn, callback) {
		if (!_isObject(obj)) {
			return _throwError(_typedErrors[0], callback);
		}

		_map(_eachUnlim, obj, fn, callback);
	};

	safe.mapLimit = function (obj, limit, fn, callback) {
		if (!_isObject(obj)) {
			return _throwError(_typedErrors[0], callback);
		}

		_map(_eachLimit(limit), obj, fn, callback);
	};

	safe.mapSeries = function (obj, fn, callback) {
		if (!_isObject(obj)) {
			return _throwError(_typedErrors[0], callback);
		}

		_map(_eachSeries, obj, fn, callback);
	};

	safe.concat = function (arr, fn, callback) {
		if (!_isArray(arr)) {
			return _throwError(_typedErrors[1], callback);
		}

		_concat(_eachUnlim, arr, fn, callback);
	};

	safe.concatLimit = function (arr, limit, fn, callback) {
		if (!_isArray(arr)) {
			return _throwError(_typedErrors[1], callback);
		}

		_concat(_eachLimit(limit), arr, fn, callback);
	};

	safe.concatSeries = function (arr, fn, callback) {
		if (!_isArray(arr)) {
			return _throwError(_typedErrors[1], callback);
		}

		_concat(_eachSeries, arr, fn, callback);
	};

	safe.sortBy = function (arr, fn, callback) {
		if (!_isArray(arr)) {
			return _throwError(_typedErrors[1], callback);
		}

		_sortBy(_eachUnlim, arr, fn, callback);
	};

	safe.filter = safe.select = function (arr, fn, callback) {
		if (!_isArray(arr)) {
			return _throwError(_typedErrors[1], callback);
		}

		_filter(_eachUnlim, 1, arr, fn, callback);
	};

	safe.filterLimit = safe.selectLimit = function (arr, limit, fn, callback) {
		if (!_isArray(arr)) {
			return _throwError(_typedErrors[1], callback);
		}

		_filter(_eachLimit(limit), 1, arr, fn, callback);
	};

	safe.filterSeries = safe.selectSeries = function (arr, fn, callback) {
		if (!_isArray(arr)) {
			return _throwError(_typedErrors[1], callback);
		}

		_filter(_eachSeries, 1, arr, fn, callback);
	};

	safe.reject = function (arr, fn, callback) {
		if (!_isArray(arr)) {
			return _throwError(_typedErrors[1], callback);
		}

		_filter(_eachUnlim, 0, arr, fn, callback);
	};

	safe.rejectLimit = function (arr, limit, fn, callback) {
		if (!_isArray(arr)) {
			return _throwError(_typedErrors[1], callback);
		}

		_filter(_eachLimit(limit), 0, arr, fn, callback);
	};

	safe.rejectSeries = function (arr, fn, callback) {
		if (!_isArray(arr)) {
			return _throwError(_typedErrors[1], callback);
		}

		_filter(_eachSeries, 0, arr, fn, callback);
	};

	safe.waterfall = function (obj, callback) {
		_executeSeries(obj, callback);
	};

	safe.series = function (obj, callback) {
		_controlFlow(_eachSeries, obj, callback);
	};

	safe.parallel = function (obj, callback) {
		_controlFlow(_eachUnlim, obj, callback);
	};

	safe.parallelLimit = function (obj, limit, callback) {
		_controlFlow(_eachLimit(limit), obj, callback);
	};

	safe.auto = _auto;

	safe.whilst = function (test, fn, callback) {
		_swhile(_doPsevdoAsync(test), fn, false, true, callback);
	};

	safe.doWhilst = function (fn, test, callback) {
		_swhile(_doPsevdoAsync(test), fn, false, false, callback);
	};

	safe.during = function (test, fn, callback) {
		_swhile(test, fn, false, true, callback);
	};

	safe.doDuring = function (fn, test, callback) {
		_swhile(test, fn, false, false, callback);
	};

	safe.until = function (test, fn, callback) {
		_swhile(_doPsevdoAsync(test), fn, true, true, callback);
	};

	safe.doUntil = function (fn, test, callback) {
		_swhile(_doPsevdoAsync(test), fn, true, false, callback);
	};

	safe.forever = function (fn, callback) {
		_forever(fn, callback);
	};

	safe.reduce = safe.inject = safe.foldl = function (arr, memo, fn, callback) {
		if (!_isArray(arr)) {
			return _throwError(_typedErrors[1], callback);
		}

		_reduce(arr, memo, fn, callback, 1);
	};

	safe.reduceRight = safe.foldr = function (arr, memo, fn, callback) {
		if (!_isArray(arr)) {
			return _throwError(_typedErrors[1], callback);
		}

		_reduce(arr, memo, fn, callback, 0);
	};

	safe.queue = function (worker, threads) {
		return new _seriesQ(worker, threads);
	};

	safe.priorityQueue = function (worker, threads) {
		return new _priorQ(worker, threads);
	};

	safe.cargo = function (worker, payload) {
		return new _cargoQ(worker, payload);
	};

	safe.retry = function (times, fn, callback) {
		return _retry(times, fn, callback);
	};

	safe.times = function (times, fn, callback) {
		_times(_eachLimit(times), times, fn, callback);
	};

	safe.timesLimit = function (times, limit, fn, callback) {
		_times(_eachLimit(limit), times, fn, callback);
	};

	safe.timesSeries = function (times, fn, callback) {
		_times(_eachSeries, times, fn, callback);
	};

	safe.detect = function (arr, fn, callback) {
		_detect(_eachUnlim, arr, fn, callback);
	};

	safe.detectLimit = function (arr, limit, fn, callback) {
		_detect(_eachLimit(limit), arr, fn, callback);
	};

	safe.detectSeries = function (arr, fn, callback) {
		_detect(_eachSeries, arr, fn, callback);
	};

	safe.some = safe.any = function (arr, fn, callback) {
		_test(_eachUnlim, false, arr, fn, callback);
	};

	safe.someLimit = safe.anyLimit = function (arr, limit, fn, callback) {
		_test(_eachLimit(limit), false, arr, fn, callback);
	};

	safe.someSeries = safe.anySeries = function (arr, fn, callback) {
		_test(_eachSeries, false, arr, fn, callback);
	};

	safe.every = safe.all = function (arr, fn, callback) {
		_test(_eachUnlim, true, arr, fn, callback);
	};

	safe.everyLimit = safe.allLimit = function (arr, limit, fn, callback) {
		_test(_eachLimit(limit), true, arr, fn, callback);
	};

	safe.everySeries = safe.allSeries = function (arr, fn, callback) {
		_test(_eachSeries, true, arr, fn, callback);
	};

	safe.applyEach = _applyEach(_eachUnlim);
	safe.applyEachSeries = _applyEach(_eachSeries);

	safe.wrapSync = safe.asyncify = _asyncify;

	safe.memoize = _memoize;
	safe.unmemoize = _unmemoize;

	safe.transform = _transform;

	if (typeof module === OBJECT && typeof module.exports === OBJECT) {
		// commonjs module
		module.exports = safe;
	} else if (typeof define === FUNCTION && define.amd) {
		// AMD module
		define([], function () {
			return safe;
		});
	} else {
		// finally old school
		root.safe = safe;
	}
})();
