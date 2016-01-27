StaticServer = require('./static.coffee')
ProxyServer = require('./proxy.coffee')
Initializer = require('./init.coffee')
_u = require("underscore")
fs = require('fs')
GLOBAL.verbose = false

module.exports = (opts = {}) ->
	GLOBAL.verbose = opts.verbose or GLOBAL.verbose
	console.log 'Object Options', opts if GLOBAL.verbose

	@options = {}
	_u.defaults @options, opts, Initializer.defaults

	# If we are being started from command line
	if @options.cli
		cliOptions = Initializer.parseOptionsFromCLI()
		console.log 'CLI Options', cliOptions if GLOBAL.verbose

	# If the user has specified a file
	file = cliOptions?.file or @options?.file
	if file
		console.log("Using file:", file)
		fileOptions = Initializer.parseOptionsFromFile(file)
		console.log 'File Options', fileOptions if GLOBAL.verbose

	# Override any file options with command line options
	_u.extend(@options, fileOptions, cliOptions, opts)

	# Show the user the selected options
	console.log @options

	# Watch changes to configuration.
	if @options.file
		fs.watchFile @options.file, { persistent: true, interval: 1000 }, (curr, prev) =>
			unless curr.size is prev.size and curr.mtime.getTime() is prev.mtime.getTime()
				console.log "Configuration file changed - updating options."
				fileOptions = Initializer.parseOptionsFromFile(@options.file)
				@options = _u.extend(@options, fileOptions, cliOptions)
				console.log @options

	# Start the static server if a directory has been provided
	@static = new StaticServer(@options) if @options.directory
	console.log("Remote -- bouncing to server at", @options.server.host + ":" + @options.server.port) unless @options.directory

	# Start the reverse proxy
	@proxy = new ProxyServer(@options)

	this
