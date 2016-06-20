var Api = require('./Api')
var async = require('async')

class List {
  constructor(opts, config, logger) {
    this.opts = opts
    this.logger = logger
    this.api = new Api(config)
  }
  run(cb) {
    this.api.getDumps((err, dumps) => {
      if(err) cb(err)
      dumps.map((dump) => {
        this.logger.info(`- Dump ID: [ ${dump.dumpId} ]
Sequence: [ ${dump.sequence} ]
Account ID: [ ${dump.accountId} ]
Number of Files: [ ${dump.numFiles} ]
Finished: [ ${dump.finished} ]
Expires At: [ ${dump.expires} ]
Created At: [ ${dump.createdAt} ]`)
      })
    }, cb)
  }
}
module.exports = List
