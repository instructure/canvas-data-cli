var Api = require('./Api')
var async = require('async')

class List {
  constructor(opts, config, logger) {
    this.opts = opts
    this.logger = logger
    this.api = new Api(config)
    if (opts.json == null) {
      opts.json = false
    }
    this.jsonOut = opts.json
  }
  run(cb) {
    this.api.getDumps((err, dumps) => {
      if (err) return cb(err)
      let shouldShowCompletedMesssage = true
      if (!this.jsonOut) {
        dumps.map((dump) => {
          this.logger.info(`- Dump ID: [ ${dump.dumpId} ]
Sequence: [ ${dump.sequence} ]
Account ID: [ ${dump.accountId} ]
Number of Files: [ ${dump.numFiles} ]
Finished: [ ${dump.finished} ]
Expires At: [ ${dump.expires} ]
Created At: [ ${dump.createdAt} ]`)
        })
      } else {
        this.logger.info(JSON.stringify(dumps))
        shouldShowCompletedMesssage = false
      }
      cb(null, shouldShowCompletedMesssage)
    })
  }
}
module.exports = List
