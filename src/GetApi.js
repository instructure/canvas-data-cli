var Api = require('./Api')

class GetApi {
  constructor(opts, config, logger) {
    this.opts = opts
    this.logger = logger
    this.api = new Api(config)
  }
  run(cb) {
    this.api.makeRequest('GET', this.opts.route, (err, response) => {
      if (err) return cb(err)
      this.logger.info(JSON.stringify(response, null, 2))
      return cb(null, response)
    })
  }
}
module.exports = GetApi
