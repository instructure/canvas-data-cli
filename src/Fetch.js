var Api = require('./Api')
var path = require('path')
var FileDownloader = require('./FileDownloader')
var async = require('async')
var fs = require('fs')
var _ = require('lodash')
var mkdirp = require('mkdirp')
class Fetch {
  constructor(opts, config, logger) {
    this.opts = opts
    this.logger = logger
    this.api = new Api(config)
    this.table = opts.table
    this.saveLocation = path.resolve(process.cwd(), config.saveLocation)
    this.fileDownloader = new FileDownloader(logger)
  }
  getNewest(files) {
    let toDownload = []
    for (let element of files.history) {
      let seq = element.sequence
      let files = element.files.map((file) => {
        file.sequence = seq
        return file
      })

      if (!element.partial) {
        toDownload.push(...files)
        break
      }
      toDownload.push(...files)
    }
    return toDownload
  }
  run(cb) {
    let saveFolder = path.join(this.saveLocation, this.table)
    mkdirp(saveFolder, (err) => {
      this.api.getFilesForTable(this.table, (err, files) => {
        if (err) return cb(err)

        let toDownload = this.getNewest(files)

        async.map(toDownload, (file, innerCb) => {
          this.fileDownloader.downloadToFile(
            file,
            {tableName: this.table, sequence: file.sequence},
            path.join(saveFolder, `${file.sequence.toString()}-${file.filename}`),
            innerCb
          )
        }, cb)
      })
    })
  }
}
module.exports = Fetch
