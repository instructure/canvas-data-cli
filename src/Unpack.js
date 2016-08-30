var zlib = require("zlib")
var fs = require("fs")
var path = require("path")
var stream = require("stream")
var mkdirp = require("mkdirp")
var ss = require("stream-stream")
var pump = require('pump')
var async = require('async')

class Unpack {
  constructor(opts, config, logger) {
    this.logger = logger
    this.tableFilter = opts.filter
    this.sourceLocation = path.resolve(process.cwd(), config.saveLocation)
    this.outputLocation = path.resolve(process.cwd(), config.unpackLocation || './unpackedFiles')
    this.schemaLocation = path.join(this.sourceLocation, 'schema.json')
  }
  buildTitlesStream(table) {
    var titles = table.columns.map((c) => {
      return c.name
    }).join("\t")
    var s = new stream.Readable()
    s.push(titles)
    s.push(null)
    return s
  }
  loadSchema(cb) {
    fs.stat(this.schemaLocation, (err, stat) => {
      if (err && !stat) {
        this.logger.error('could not find schema, have you downloaded files yet?')
        return cb(err)
      }
      var schema = require(this.schemaLocation)
      cb(null, schema)
    })
  }
  addTitleAndUnzip(schema, sourceDir, outputDir, cb) {
    var toUnpack = []
    for (var key in schema.schema) {
      var table = schema.schema[key]
      if (this.tableFilter.indexOf(table.tableName) >= 0 ) {
        toUnpack.push(table)
      }
    }
    this.logger.debug(`will unpack ${toUnpack.map((p) => p.tableName).join(',')}`)
    if (toUnpack.length === 0) {
      this.logger.warn('no files matched filter, nothing will be unpacked')
      return cb()
    }
    async.each(toUnpack, (table, cb) => {
      var inputDir = path.join(sourceDir, table.tableName)
      var outputTableName = path.join(outputDir, table.tableName + '.txt')
      var outputStream = fs.createWriteStream(outputTableName)
      this.logger.info(`outputting ${table.tableName} to ${outputTableName}`)
      this.processTable(table, inputDir, outputStream, (err) => {
        if (err) return cb(err)
        this.logger.info(`finished with ${table.tableName}`)
      })
    }, cb)
  }
  processTable(table, inputDir, outputStream, cb) {
    var ssStream = new ss()
    ssStream.write(this.buildTitlesStream(table))
    fs.readdir(inputDir, (err, files) => {
      if (err) return cb(err)
      files.forEach((f) => {
        var gunzip = zlib.createUnzip()
        ssStream.write(fs.createReadStream(path.join(inputDir, f)).pipe(gunzip))
      })
    })
    pump(ssStream, outputStream, cb)
  }
  run(cb) {
    this.loadSchema((err, schema) => {
      if (err) return cb(err)
      mkdirp(this.outputLocation, (err) => {
        if (err) return cb(err)
        this.addTitleAndUnzip(schema, this.sourceLocation, this.outputLocation, cb)
      })
    })
  }
}
module.exports = Unpack
