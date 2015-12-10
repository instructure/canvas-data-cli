const MAX_ATTEMPTS = 5
var fs = require('fs')
var request = require('request')
var pump = require('pump')

// ghetto backoff solution
var backoff = [100, 200, 500, 1500, 3000]

class FileDownloader {
  constructor(logger) {
    this.logger = logger
  }
  downloadToFile(downloadLink, artifact, dest, cb) {
    this._downloadRetry(downloadLink, artifact, dest, 0, cb)
  }
  _downloadRetry(downloadLink, artifact, dest, attempt, cb) {
    if (attempt > MAX_ATTEMPTS) return cb(new Error(`max number of retries reached for ${fileUrl}, aborting`))
    this.logger.debug(`downlading ${downloadLink.filename} for artifact ${artifact.tableName} from dump ${artifact.sequence}, attempt ${attempt}`)
    pump(request({method: 'GET', url: downloadLink.url}), fs.createWriteStream(dest), (err) => {
      if (err) {
        this.logger.debug(`failed attempt ${attempt} for ${downloadLink.filename}, err: ${err}`)
        return setTimeout(() => this._downloadRetry(downloadLink, artifact, dest, attempt + 1, cb), backoff[attempt])
      }
      this.logger.debug(`finished downlading ${downloadLink.filename} for artifact ${artifact.tableName} from dump ${artifact.sequence}`)
      cb()
    })
  }

}
module.exports = FileDownloader
