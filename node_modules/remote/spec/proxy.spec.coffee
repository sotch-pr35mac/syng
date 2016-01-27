Remote = require '../libs/remote.coffee'
GLOBAL.verbose = true

describe 'Remote proxy server', ->
	remote = new Remote(file: 'example/remote.json')
	it 'should exist', ->
		expect(remote).toBeDefined()

	it 'should have a proxy server', ->
		expect(remote.proxy).toBeDefined()

	it 'should read a json mapping', ->
		mappingTarget = remote.proxy.findMapping("/api/users/1/remove")
		expect(mappingTarget).toEqual({"result": "ok"})

	it 'should read a path mapping', ->
		mappingTarget = remote.proxy.findMapping("/img/nodejs.png")
		expect(mappingTarget).toEqual("example/")

		mappingResult = remote.proxy.readStringMapping(mappingTarget, "/img/nodejs.png")
		expect(mappingResult).toBeDefined()

	it 'should read a path mapping, discarding query string', ->
		mappingTarget = remote.proxy.findMapping("/img/nodejs.png?v=10")
		expect(mappingTarget).toEqual("example/")

		mappingResult = remote.proxy.readStringMapping(mappingTarget, "/img/nodejs.png?v=10")
		expect(mappingResult).toBeDefined()

	it 'should read a binary file mapping', ->
	it 'should read a utf-8 file mapping', ->
	it 'should read a path mapping', ->