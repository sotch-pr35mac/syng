## Remote

**Remote** is a simple CLI tool that enables you to work in local files while consuming an API from a remote server. An easy reverse proxy in Node, if you will.

If you'd like, it can also start a simple local server for your files.

Simply specify

- the address of your local files server, or where I should start one
- the address of your remote API
- the address of where to start a reverse proxy
- a directory, if you want me to start a local server
- some regex rules that define which files to serve locally, which to fetch from the remote host
- optionally, you can map requests to specific files with the mappings option

It aims to solve the dreaded **cross domain request** problem, so you can freely *ajax* like you have a local server-side.

### Install

	npm install -g remote

### Quickstart

After installing, create a `remote.json` configuration file (check the example folder) and simply call `remote`.

### Usage - command line

  remote [options]

		Options:

			-h, --help                output usage information
			-V, --version             output the version number
			-d, --directory [path]    Path to a local folder. If defined, will serve files at server address. [undefined]
			-r, --remote [host:port]  Address of the remote API [localhost:80]
			-p, --proxy [host:port]   Address of the reverse proxy server [localhost:9001]
			-s, --server [host:port]  Address of the static file server [localhost:9000]
			-m, --mapping             Whether to use the mapping rules [false]
			-f, --file [remote.json]  Specific configuration file [remote.json]

### Usage - configuration file (remote.json)

See the example configuration file at the example folder.

Read on for the possible options for your `remote.json` file.

### Bounces

This is the simplest `remote.json`, with some bounce rules defined:

	{
		"directory" : "./src/",
		"remote" : {"host": "remote-api-host.com", "port": 80},
		"bounces" : [
		    "public/.*",
		    "assets/.*"
		]
	}

In this case, any call to `localhost:3000/public/(...)` or `localhost:3000/assets/(...)`  will be *bounced* to your local files under `./src/`.
Other URL's will be forwarded to `remote-api-host.com`

### Headers

You may wish to send along some headers with your request. For example:

    {
			"directory" : "./src/",
			"remote" : {"host": "remote-api-host.com", "port": 80},
			"headers": {
					"Host": "remote-api-host.com",
					"X-Secret-Header" : "awesome"
				},
			"bounces" : [
					"public/.*",
					"assets/.*"
				]
    }

These will be added to every request made by `remote`.

### Mappings

A mapping is like a bounce rule, only more specific. You define what you want served given a request URL. For example:

    {
		"directory" : "./src/",
		"remote" : {"host": "remote-api-host.com", "port": 80},
		"headers": {
				"Host": "remote-api-host.com",
				"X-Secret-Header" : "awesome"
		},
		"bounces" : [
		    "public/.*",
		    "assets/.*"
		],
        "mapping": true,
        "mappings": {
            ".*/api/users/1/remove": {"result": "ok"},
            ".*/api/users/.*":"./test/mocks/users-mock.json",
            ".*/files/.*":"./test/files/",
            ".*/public/js/awesome.js":"./src/special/path/awesome-2.js"
        }
    }


As you can see, mappings can be:

- A JSON object.
- A path to any file.
- A path to any directory (Remote will locate the requested file in the directory).

When any of these URL's are requested, remote will serve the given resource.

**Note that mappings take precedence over bounce rules!**

You can disable all mappings setting `mapping` to **false**.

### Bounce to remote

If you like to keep things complicated, you may use the `bounceToRemote: true` option in your configuration file.
This will invert the `bounces` rules, so they will actually bounce to the remote API. All other requests will be forwarded to the local server.

### Other notes

Command line options take precedence over `remote.json` options.
Also, any command line option may be specified in the json configuration file.
Have fun!

-----------------

#### Note for Mac OS X users (or: *what to do when I get EMFILE errors*)

OS X has a arbitrarily low limit for the amount of files that a process can open of 256.
Use the `ulimit` command to check your current limit.
For sites with large amounts of files, or in any situation when encountering **EMFILE** errors, simply issue:

    ulimit -n 2048

Or any such large value, before turning on remote.

-----------------

### Changelog:
v 0.2.6:

- Ignores query string on mapping.
- Starting unit tests with jasmine-node.

v 0.2.5:

- Serves images correctly. Really, this time.
- Accepts mapping with 'http://' to change to arbitrary host.

v 0.2.4:

- Serves images correctly (utf8 issue fix, thanks Augusto).

v 0.2.3:

- Accepts directory for mappings.

v 0.2.1:

- File update and options scope fix.
- Mappings should work now when applied in a file.

v 0.2.0:

- **Breaking changes** in API. Old remote.json files wont work.
- Better options syntax
- Bring you own local server. Now you can use remote as a reverse proxy, only.
- Many fixes.

v 0.1.0:

- Major rewrite. Nothing of note before this ;)
- Using nodejitsu's http-proxy
- Add the capability to map arbitrary url to arbitrary files or JSON
- Add the capability to add request headers