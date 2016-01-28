Starting from version 0.3.0 safejs implements all functions of [Async](https://github.com/caolan/async) and can transparently replace it. For asyncjs functions library adds its error trap capabilities and also contain some optimizations and speed improovements as well as some new functions. We plan to be less conservative for all necessary changes and welcome any contributions.

Initially modules was designed to provide set of handy function to deal with thrown errors, callbacks and
nodejs alike error passing (first function argument).

The goal is to make code more stable, readable and avoid some routine calls. Idea is inspired in [Step](https://github.com/creationix/step) library which catches thrown errors and convert them into callback function calls. 

[Async](https://github.com/caolan/async) library which appears more handy missing this. With safe library it is easy to plug-in this when required.

Function are kind of chainable, so instead of `safe.trap(safe.sure(function () {} ))`
it is possible to use `safe.trap_sure(function() {})`

[![Build Status](https://travis-ci.org/sergeyksv/safejs.png?branch=master)](https://travis-ci.org/sergeyksv/safejs)

*Note: In all samples below async keyword can be replaced to safe*

### Plain poor code:
	async.series([
		function (callback) {
			// .. do something that can throw error
			// BAD: some dirty code can throw exception here
			// which breaks nodejs server
			async.forEach(array, function (e, callback2) {
				some.getSome(e.id, function (err, some) {
					// BAD: err is not checked 
					// .. process some
					// BAD: boring code
					callback2();
				})
			},callback)
		}]

### Plain good code:
	async.series([
		function (callback) {
			try {
				// .. do something that can throw error
				// .. note ANY CODE CAN DO in some conditions
				async.forEach(array, function (e, callback2) {
					some.getSome(e.id, function (err, some) {
						try {
							if (err) return callback2(err);
							// .. process some
							callback2();
						} catch (err) {
							callback2(err);
						}
					})
				},callback)
			} catch (err) {
				callback(err);
			}
		}]

###  Safe enhanced good code:
	async.series([
		safe.trap(function (callback) {
			async.forEach(array, function (e, callback2) {
				some.getSome(e.id, safe.trap_sure_results(callback2, function (some) {
					// .. process some
				});
			},callback)
		}

We also found that in some simple cases safe functions allows to write
code that does things similar to async.series or async.waterfall in bit 
more efficient way (at least as we think). It became possible
because JavaScript closures are in effect and you not need to think how
to pass variables from one function to another. In theory async.waterfall should
help for such case but it has two caveats. First is when one of funtions
that you used change number of paramaters returned thru callback. Code became
broken and error is hard to find. Second one is that if result of one step
is required later then next step you have to pass it thru intermidiate
steps which makes waterfall behavior fall down to async.series. Check 
this on examples

#### Classic async.series
		var users, user, clients;
		async.series([
			function (callback) {
				mongo.collection("users",function (err,val) {
					if (err) return callback(err);
					users = val;
					callback();
				}
			},
			function (callback) {
				users.findOne({login:"john"},fuction (err, val) {
					if (err) return callback(err);
					session.user = user;
					callback();
				}
			},
			function (callback) {
				mongo.collection("clients",function (err,val) {
					if (err) return callback(err);
					clients = val;
				})
			},
			function (callback) {
				clients.insert({uid:user.id, date: new Date()},callback)
			}
		], function (err) {
			if (err) callback(new Error("Log-in or password is incorrect")
				else callback();
		}))
		
#### Classic async.waterfall
		async.waterfall([
			function (callback) {
				mongo.collection("users",callback)
			},
			function (users,callback) {
				users.findOne({login:"john"},callback)
			},
			function (user,callback) {
				mongo.collection("clients",function (err, clients) {
					if (err) return callback(err);
					callback(null,user,clients)
				}
			}
			function (user,clients,callback) {
                                sesson.user = user;
				clients.insert({uid:user.id, date: new Date()},callback)
			}
		], function (err) {
			if (err) callback(new Error("Log-in or password is incorrect")
				else callback();
		}))		

#### Safe enhanced
		safe.run(function(callback) {
			mongo.collection("users",safe.sure(callback, function (users) {
				users.findOne({login:"john"},safe.sure(callback, fuction (user) {
					session.user = user;
					mongo.collection("clients",safe.sure(callback, function (clients) {
						clients.insert({uid:user.id, date: new Date()},callback)
					}))
				}))
			}))
		}, function (err) {
			if (err) callback(new Error("Log-in or password is incorrect")
				else callback();
		}))


### API

#### result
Transform synchronious function call result to callback

_callback is optional, when omited (function get one parameter) it assumes
callback as last parameter of wrapped function_

@param {Function} callback or wrapped function

@param {Function} fn wrapped function


#### sure
Strip (hide) first parameter from wrapped function and ensure that
controll is passed to it when no error happpens. I.e. it does do
routine error check `if (err) return callback(err)`

If passed non function it just returned thru callback

_callback is optional, when omited (function get one parameter) it assumes
callback as last parameter of wrapped function_

@param {Function} callback or wrapped function

@param {Function} wrapped function or value

#### trap
Wrap function call into try catch, pass thrown error to callback

_callback is optional, when omited (function get one parameter) it assumes
callback as last parameter of wrapped function_

@param {Function} callback or wrapped function

@param {Function} fn wrapped function

#### run
Run function with provided callback. Just help to have better readability.
Usefull when you need to handle local callback results, even if there are
errors. 

@param {Function} wrapped function

@param {Function} callback

#### yield
Yields execution of function giving chance to other stuff run

@param {Function} callback

#### noop
Empty function, does nothing. Sometime useful.

#### back
Run provided callback in next tick of event loop. This is what for
process.nextTick was usually used. However for very strange reason
starting from node v10 it fails when called recursively. 

To be honest its failry stupid because now process.nextTick became
useless because will it work or not depends on callee. It was honest
just to say to stop use process.nextTick, there is no any purpose for
it any longer. Function safe.run will use process.nextTick or its new successor
setImmediate in newer versions of node.

Anyway process.nextTick usually was used to break recursion or to maintain async
behavior when function return something right away without calling
trully async function (IO mostly). It was required to write something
like:

	if (cached)
		return process.nextTick(function () {callback(null,cached})
with back:

	if (cached)
		return safe.back(callback,null,cached) 

@param {Function} callback

@param argument1

@param argumentN

#### spread
Wraps function with several parameters into function that accept array of paramters. Useful to process async.series or async.parallel result calls.

@param {Function} - normal function 

Normal async code:

	], function (err, res) {
		if (err) return callback(err)
		var me = res[0];
		var users = res[1];

Using safe:

	],safe.sure_spread(callback, function (me, users) {

#### async
Complimentary helper function to "async" libray similar to async.apply. The difference is that it bind function call to some specific object context.

@param {Object} - context object

@param {String} - function name

@param ... - function arguments

Normal async code:

	async.series([
		function (cb) {
			users.findOne({gender:"male"},cb)
		}

Using safe:
		
	async.series([
		safe.async(users,"findOne",{gender:"male"})

#### wrap
Similar to _trap_ but has reverse order of parameters. Both paramters are required. Callback will be appended to wrapped function as last parameter. Useful to simulate try catch behavior for functions that didn't receive callback but still need error handling

@param {Function} fn wrapped function

@param {Function} callback or wrapped function

#### pseudo chains

sure_result, sure_spread

trap_sure, trap_sure_result - __deprecated__ Since version 0.1.x all functions catch thrown exceprtions

## MIT License

Copyright (c) [PushOk Software](http://www.pushok.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
