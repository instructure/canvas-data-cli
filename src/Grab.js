var Api = require('./Api')
var path = require('path')
var FileDownloader = require('./FileDownloader')
var async = require('async')
var fs = require('fs')
var _ = require('lodash')
var mkdirp = require('mkdirp')

class Grab {
  constructor(opts, config, logger) {
    this.opts = opts
    this.logger = logger
    this.api = new Api(config)
    this.dump = opts.dump
    this.saveLocation = path.resolve(process.cwd(), config.saveLocation)
    this.fileDownloader = new FileDownloader(logger)
    this.maxConnections = config.maxConnections || 200
  }
  formatResult(files) {
    let finalResult = []
    Object.keys(files.artifactsByTable).forEach((currentValue) => {
      const artifact = files.artifactsByTable[currentValue]
      artifact.files.forEach((currentFile) => {
        finalResult.push({
          tableName: currentValue,
          sequence: files.sequence,
          filename: currentFile.filename,
          url: currentFile.url
        })
      })
    })
    return finalResult
  }
  run(cb) {
    const saveFolder = path.join(this.saveLocation, this.dump)
    mkdirp(saveFolder, (err) => {
      if (err) return cb(err)
      this.api.getFilesForDump(this.dump, (err, files) => {
        if(err) return cb(err)

        const formattedTables = this.formatResult(files)

        async.mapLimit(formattedTables, this.maxConnections, (file, innerCb) => {
          this.fileDownloader.downloadToFile(
            file,
            {tableName: file.tableName, sequence: file.sequence},
            path.join(saveFolder, `${file.sequence.toString()}-${file.filename}`),
            innerCb
          )
        }, cb)
      })
    })
  }
}
module.exports = Grab
