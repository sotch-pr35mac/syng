_u = require("underscore")
fs = require('fs')
path = require('path')
httpProxy = require('http-proxy')

class ProxyServer
	constructor: (@options) ->
		@server = httpProxy.createServer( (req, res, proxy) =>
			# Test if this request fits a mapping
			mappingTarget = @findMapping(req.url)

			# Test what bounce rule this request fits first
			matchedBounce = @findBounce(req.url)

			# Bounce matching requests to this host:port
			bounceAddress = if @options.bounceToRemote then @options.remote else @options.server

			# All other requests
			defaultAddress = if @options.bounceToRemote then @options.server else @options.remote

			# Add user headers and overwrite any present headers, if necessary.
			req.headers[key] = value for key, value of @options.headers

			if mappingTarget
				@map(req, res, proxy, mappingTarget)
			else if matchedBounce
				@bounce(req, res, proxy, bounceAddress, matchedBounce)
			else
				@forward(req, res, proxy, defaultAddress)
		)
		@server.listen(@options.proxy.port, @options.proxy.host)
		console.log "Remote -- reverse proxy at", @options.proxy.host + ":" + @options.proxy.port

	map: (req, res, proxy, mappingTarget) =>
		if @isAddress mappingTarget
			cleanHost = mappingTarget.replace(/^http\:\/\/|^https\:\/\//g, '')
			console.log '\tto host\n\t' + cleanHost
			proxy.proxyRequest(req, res, { host: cleanHost, port: @options.remote.port })
		# If it's a string, treat as a path or file.
		else if _u.isString(mappingTarget)
			res.end(@readStringMapping(mappingTarget, req.url))
		# Otherwise, treat it as an object and return JSON.
		else
			res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
			res.end(JSON.stringify(mappingTarget))

	bounce: (req, res, proxy, address, matchedBounce) =>
		console.log 'Bouncing request: \n\t' + address.host + ':' + address.port + req.url + '\n\tMatched bounce rule: \n\t' + matchedBounce
		proxy.proxyRequest(req, res, { host: address.host, port: address.port })

	forward: (req, res, proxy, address) =>
		console.log 'Forwarding request: \n\t' + address.host + ':' + address.port + req.url
		proxy.proxyRequest(req, res, { host: address.host, port: address.port })

	# Utility function to read mapping, either directly as JSON or from a file
	readStringMapping: (mapping, url) =>
		console.log 'Request: \n\t' + url
		try
			pathMapping = path.resolve(process.cwd(), mapping)
			isDirectory = fs.statSync(pathMapping).isDirectory()
			fileName = path.basename(url).replace(/\?.*/, '')
			fileExtension = path.extname(fileName)
			encoding = @getEncoding(fileExtension)
			if isDirectory
				fullPath = path.resolve(pathMapping, fileName)
				console.log '\tmapped to file in directory\n\t' + fullPath, 'encoding',  encoding
				return fs.readFileSync(fullPath, encoding)
			else
				console.log '\tmapped to file\n\t' + pathMapping, 'encoding', encoding
				return fs.readFileSync(pathMapping, encoding)
		catch e
			console.error "Error reading mapping", mapping, e

	findMapping: (url) =>
		if @options.mapping is false
			return undefined

		for key, value of @options.mappings
			return value if (new RegExp(key).test(url))

		return undefined

	findBounce: (url) =>
		if @options.bounces is undefined or @options.bounces.length is 0
			return undefined

		for bounce in @options.bounces
			return bounce if (new RegExp(bounce).test(url))

		return undefined

	isAddress: (mappingTarget) -> /^http\:\/\/.*|^https\:\/\/.*/.test mappingTarget

	getEncoding: (extension) ->
		if extension in ['.gif', '.png', '.jpg', '.jpeg']
			return undefined
		else
			return 'utf-8'

module.exports = ProxyServer
