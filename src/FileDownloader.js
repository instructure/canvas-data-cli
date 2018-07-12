var fs = require('fs')
var request = require('request')
var pump = require('pump')
var Re = require('re')

class FileDownloader {
  constructor(logger, reOpts) {
    this.logger = logger
    this.reOpts = reOpts || {
      retries: 5,
      strategy: {
        "type": Re.STRATEGIES.EXPONENTIAL,
        "initial": 100,
        "base": 2
      }
    }
    this.re = new Re(this.reOpts)
  }
  downloadToFile(downloadLink, artifact, dest, cb) {
    this.re.try((retryCount, done) => {
      this.logger.debug(`downloading ${downloadLink.filename} for artifact ${artifact.tableName}, attempt ${retryCount + 1}`)
      var r = request({method: 'GET', url: downloadLink.url})
      var badStatusCode = false
      r.on('response', (resp) => {
        if (resp.statusCode !== 200) {
          this.logger.debug(`got non 200 status code (actual ${resp.statusCode}) from ${downloadLink.url}`)
          badStatusCode = true
        }
      })
      pump(r, fs.createWriteStream(dest), (err) => {
        if (err || badStatusCode) {
          this.logger.debug(`failed attempt ${retryCount + 1} for ${downloadLink.filename}, err: ${err || badStatusCode}`)
          return done(new Error("Failed Attempt."), retryCount)
        }
        this.logger.debug(`finished downlading ${downloadLink.filename} for artifact ${artifact.tableName}`)
        done(null, retryCount)
      })
    }, (err, retryCount) => {
      cb(err ? new Error(`max number of retries reached for ${downloadLink.filename}, aborting`) : null)
    })
  }

}
module.exports = FileDownloader
