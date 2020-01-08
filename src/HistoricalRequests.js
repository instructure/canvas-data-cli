var Api = require('./Api')
var lodash = require('lodash')

const customizer = (a, b) => {
  if (lodash.isArray(a)) {
    return a.concat(b);
  }
}

class HistoricalRequests {
  constructor(opts, config, logger) {
    this.opts = opts
    this.logger = logger
    this.api = new Api(config)
  }
  getRangeForFile(url) {
    // The URL format is:
    // https://<bucket>.s3.amazonaws.com/<timestamp>/requests_split_historical/<account>/requests/range/
    return url.split('/')[7]
  }
  run(cb) {
    this.api.getFilesForTable('requests', (err, response) => {
      if (err) return cb(err)
      //
      // Get all the not-partial files and figure out their range
      const results = lodash.merge({}, ...response.history
        .filter((dump) => !dump.partial)
        .map((dump) => {
          const maps = dump.files.map((file) => {
            return {
              dumpId: dump.dumpId,
              ranges: {
                [this.getRangeForFile(file.url)]: [file]
              }
            }
          })
          return lodash.merge({}, ...maps, customizer)
        }), customizer)
      this.logger.info(JSON.stringify(results, null, 2))
      cb(null, results)
    })
  }
}
module.exports = HistoricalRequests
