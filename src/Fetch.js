var Api = require('./Api')
var path = require('path')
var FileDownloader = require('./FileDownloader')
var async = require('async')
var fs = require('fs')
class Fetch {
  constructor(opts, config, logger) {
    this.opts = opts
    this.logger = logger
    this.api = new Api(config)
    this.table = opts.table
    this.saveLocation = path.resolve(process.cwd(), config.saveLocation)
    this.fileDownloader = new FileDownloader(logger)
  }
  run(cb) {
    if (!fs.existsSync(this.saveLocation)){
      fs.mkdirSync(this.saveLocation)
    }
    this.api.getFilesForTable(this.table, (err, files) => {
      if(err) {
        return cb(err)
      } else {
        async.forEach(files.history, (element, innerCb) => {
          this.fileDownloader.downloadToFile(element.files[0], {tableName: this.table,
            sequence: element.sequence}, path.join(this.saveLocation, `${String(element.sequence)}-${element.files[0].filename}`),
            innerCb)
        }, cb)
      }
    })
  }
}
module.exports = Fetch
