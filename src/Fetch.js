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
    this.maxConnections = config.maxConnections || 200
  }
  getNewest(files) {
    let toDownload = []
    // We can get multiple entries in files.history for a single sequence / dumpId.
    // So group these entries up by sequence ID.
    let groups = _.groupBy(files.history, 'sequence')
    // Walk through the groups in the same sequence order as provided by the API
    let sequences = _.map(files.history, 'sequence')
    for (let sequence of sequences) {
      let group = groups[sequence]
      // If /any/ in the group is marked as partial, we'll consider that sequence
      // to be completely partial
      let partial = _.some(group, 'partial')
      let files = _.flatten(_.map(group, 'files')).map((file) => {
        file.sequence = sequence
        return file
      })

      toDownload.push(...files)

      if (!partial) {
        break
      }

    }
    return toDownload
  }
  run(cb) {
    let saveFolder = path.join(this.saveLocation, this.table)
    mkdirp(saveFolder, (err) => {
      this.api.getFilesForTable(this.table, (err, files) => {
        if (err) return cb(err)

        let toDownload = this.getNewest(files)
        this.logger.info(`Files (${toDownload.length})`, toDownload)
        
        async.mapLimit(toDownload, this.maxConnections, (file, innerCb) => {
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
