program = require("commander")
fs = require('fs')
_u = require("underscore")
path = require('path')

class Initializer
  constructor: ->

  # Default configuration options
  @defaults:
    remote:
      host: '127.0.0.1'
      port: 80
    proxy:
      host: 'localhost'
      port: 9001
    server:
      host: 'localhost'
      port: 9000
    directory: undefined
    bounceToRemote: false
    file: './remote.json'
    mapping: false

  # Overrides argument options with CLI options
  @parseOptionsFromCLI: ->
    hostAndPortFromAddress = (address = ':') ->
      if address.split(':')[0] is '' then return undefined else host: address.split(':')[0], port: parseInt(address.split(':')[1], 10)

    # Commander options
    program.version("0.2.6")
      .option("-d, --directory [path]", "Path to a local folder. If defined, will serve files at server address. [undefined]")
      .option("-r, --remote [host:port]", "Address of the remote API [localhost:80]", hostAndPortFromAddress)
      .option("-p, --proxy [host:port]", "Address of the reverse proxy server [localhost:9001]", hostAndPortFromAddress)
      .option("-s, --server [host:port]", "Address of the static file server [localhost:9000]", hostAndPortFromAddress)
      .option("-m, --mapping", "Whether to use the mapping rules")
      .option("-f, --file [remote.json]", "Specific configuration file [remote.json]")
      .parse process.argv

    return Initializer.normalize(_u.pick(program,['remote', 'proxy', 'server', 'directory', 'mapping', 'file']))

  # Read options from filePath and overrides argument options with them
  @parseOptionsFromFile: (filePath) =>
    # Resolve relative path
    filePath = path.resolve(process.cwd(), filePath)
    try
      fileConfig = JSON.parse(fs.readFileSync(filePath))
      return Initializer.normalize(fileConfig)
    catch e
      console.error "No configuration file found!", e
      return {}

  @normalize: (options) ->
    # Resolve relative path
    options.directory = path.resolve(process.cwd(), options.directory) if options.directory
    # Remove keys with undefined properties
    _u(options).chain().keys().each((k) -> delete options[k] if options[k] is undefined)
    return options

module.exports = Initializer
