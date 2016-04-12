
var fs = require('fs')
var sampleConfig = `
module.exports = {
  saveLocation: './dataFiles',
  unpackLocation: './unpackedFiles', // if not defined, defaults to 'unpackedFiles'
  apiUrl: 'https://api.inshosteddata.com/api',
  key: process.env.CD_API_KEY, // don't hardcode creds, keep them in environment variables ideally!
  secret: process.env.CD_API_SECRET
}
`
class ConfigTask {
  constructor(opts, config, logger) {
    this.logger = logger
  }
  run(cb) {
    this.logger.info(sampleConfig)
    this.logger.info('was written to config.js')
    fs.writeFile('config.js.sample', sampleConfig, cb)
  }
  static validate(config) {
    var fields = [
      'saveLocation',
      'apiUrl',
      'key',
      'secret'
    ]
    var missing = []
    for (var field of fields) {
      if (!config[field]) missing.push(field)
    }
    if (missing.length) return `missing ${missing.join(', ')} fields in config`
    return null
  }
}
module.exports = ConfigTask
