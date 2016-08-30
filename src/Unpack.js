const zlib = require("zlib")
const fs = require("fs")
const path = require("path")
const stream = require("stream")
const mkdirp = require("mkdirp")
const Multistream = require("multistream")
const pump = require('pump')
const async = require('async')
const split = require('split')
const mapS = require('map-stream')

class Unpack {
  constructor(opts, config, logger) {
    this.logger = logger
    this.tableFilter = opts.filter
    this.sourceLocation = path.resolve(process.cwd(), config.saveLocation)
    this.outputLocation = path.resolve(process.cwd(), config.unpackLocation || './unpackedFiles')
    this.schemaLocation = path.join(this.sourceLocation, 'schema.json')
  }
  buildTitlesHeader(table) {
    return table.columns.map((c) => {
      return c.name
    }).join("\t") + '\n'
  }
  loadSchema(cb) {
    fs.stat(this.schemaLocation, (err, stat) => {
      if (err && !stat) {
        this.logger.error('could not find schema, have you downloaded files yet?')
        return cb(err)
      }
      const schema = require(this.schemaLocation)
      cb(null, schema)
    })
  }
  addTitleAndUnzip(schema, sourceDir, outputDir, cb) {
    const toUnpack = []
    for (let key in schema.schema) {
      let table = schema.schema[key]
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
      const inputDir = path.join(sourceDir, table.tableName)
      const outputTableName = path.join(outputDir, table.tableName + '.txt')
      const outputStream = fs.createWriteStream(outputTableName)
      this.logger.info(`outputting ${table.tableName} to ${outputTableName}`)
      this.processTable(table, inputDir, outputStream, (err) => {
        if (err) return cb(err)
        this.logger.info(`finished with ${table.tableName}`)
      })
    }, cb)
  }
  processTable(table, inputDir, outputStream, cb) {
    outputStream.write(this.buildTitlesHeader(table))
    fs.readdir(inputDir, (err, files) => {
      if (err) return cb(err)
      const streams = files.map((f) => {
        const gunzip = zlib.createUnzip()
        return fs.createReadStream(path.join(inputDir, f))
        .pipe(gunzip)
        .pipe(split())
        .pipe(mapS((item, cb) => {
          if (item.trim() === '') return cb()
          // add newlines for each row
          return cb(null, item + '\n')
        }))
      })
      const multi = new Multistream(streams)
      pump(multi, outputStream, cb)
    })
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
