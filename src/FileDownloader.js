var fs = require('fs')
var request = require('request')
var pump = require('pump')
var Re = require('re')
const reOpts = {
  retries: 5,
  strategy: {
    "type": Re.STRATEGIES.EXPONENTIAL,
    "initial": 100,
    "base": 2
  }
}
var re = new Re(reOpts)

class FileDownloader {
  constructor(logger) {
    this.logger = logger
  }
  downloadToFile(downloadLink, artifact, dest, cb) {
    re.try((retryCount, done) => {
      this.logger.debug(`downloading ${downloadLink.filename} for artifact ${artifact.tableName} from dump ${artifact.sequence}, attempt ${retryCount + 1}`)
      var r = request({method: 'GET', url: downloadLink.url})
      var badStatusCode = false
      r.on('response', (resp) => {
        if (resp.statusCode !== 200) {
          this.logger.debug(`got non 200 status code (actual ${resp.statusCode}) from ${downloadLink.url}`)
          badStatusCode = true
        }
      })
      r.pipe(fs.createWriteStream(dest))
      r.on('end', () => {
        if(badStatusCode) {
          this.logger.debug(`failed attempt ${retryCount + 1} for ${downloadLink.filename}, err: ${badStatusCode}`)
          return done(new Error("Failed Attempt."), retryCount)
        }
        this.logger.debug(`finished downlading ${downloadLink.filename} for artifact ${artifact.tableName} from dump ${artifact.sequence}`)
        done(null, retryCount)
      })
    }, (err, retryCount) => {
      cb(err ? new Error(`max number of retries reached for ${downloadLink.filename}, aborting`) : null)
    })
  }

}
module.exports = FileDownloader
