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
    // https://<bucket>.s3.amazonaws.com/<account>/requests/<timerange>/0/part-<uuid>.???.txt.gz
    // it used (not sure when the change was made) to have a format of:
    // https://<bucket>.s3.amazonaws.com/<timestamp>/requests_split_historical/<account>/requests/range/
    return url.split('/')[5]
  }
  run(cb) {
    this.api.getSync((err, response) => {
      if (err) return cb(err)

      // Get all the not-partial files and figure out their range
      const files = response.files
        .filter((file) => file.table == 'requests')
        .filter((file) => !file.partial);
      const results = lodash.merge({}, ...files
        .map((file) => {
          return {
            [this.getRangeForFile(file.url)]: [file]
          }
        }), customizer)

      this.logger.info(JSON.stringify(results, null, 2))
      cb(null, results)
    })
  }
}
module.exports = HistoricalRequests
