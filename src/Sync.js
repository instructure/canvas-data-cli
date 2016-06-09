var path = require('path')
var fs = require('fs')
var Api = require('./Api')
var FileDownloader = require('./FileDownloader')
var async = require('async')
var mkdirp = require('mkdirp')
var glob = require('glob')
const DEFAULT_LIMIT = 50
const CONCURRENCY_LIMIT = 5
class Sync {
  constructor(opts, config, logger) {
    this.opts = opts
    this.logger = logger
    this.api = new Api(config)
    this.fileDownloader = new FileDownloader(logger)
    this.saveLocation = path.resolve(process.cwd(), config.saveLocation)
  }
  run(cb) {
    this.getSync((err, toSync) => {
      if (err) return cb(err)
      this.downloadSchema(toSync.schemaVersion, (err) => {
        if (err) return cb(err)
        async.mapLimit(toSync.files, CONCURRENCY_LIMIT, this.processFile.bind(this), (err, results) => {
          if (err) return cb(err)

          var splitResults = this.splitResults(results)
          this.logResults(splitResults)

          if (splitResults.erroredFiles.length) {
            this.logger.warn(`${errorFiles.length} files failed to download, please try running the sync again, if this error persists, open a ticket. No files will be cleaned up`)
            this.logger.warn(errorFiles)
            return cb(new Error('failed to download some files, try running sync again'))
          }

          this.cleanupFiles(results, (err) => {
            if (err) return cb(err)
            this.logger.info('finished cleanup, done!')
            cb()
          })
        })
      })
    })
  }
  splitResults(results) {
    var erroredFiles = results.filter((res) => res.error)
    var newDownloaded = results.filter((res) => res.didDownload).map((res) => res.filename)
    var cached = results.filter((res) => !res.error && !res.didDownload).map((res) => res.filename)
    return {erroredFiles, newDownloaded, cached, results}
  }
  logResults(splitResults) {
    if (splitResults.cached.length === splitResults.results.length) {
      this.logger.info('no new files were downloaded')
    } else {
      this.logger.info(`downloaded ${splitResults.newDownloaded.length} new files out of ${splitResults.results.length} total files`)
      this.logger.debug('new files downloaded', splitResults.newDownloaded)
      this.logger.debug('cached files', splitResults.cached)
    }
  }
  getSync(cb) {
    this.logger.info('fetching current list of files from API...')
    this.api.getSync((err, toSync) => {
      if (err && err.errorCode === 404) {
        this.logger.error('no files exist for account, cannot sync')
        err.silence = true
        return cb(err)
      }
      if (err) return cb(err)
      if (toSync.incomplete) this.logger.warn(`Could not retrieve a full list of files! Some incremental data will be missing!`)

      this.logger.info(`total number of files: ${toSync.files.length} files`)
      cb(null, toSync)
    })
  }
  downloadSchema(schemaVersion, cb) {
    mkdirp(this.saveLocation, (err) => {
      if (err) return cb(err)
      this.api.getSchemaVersion(schemaVersion, (err, schema) => {
        if (err) return cb(err)
        fs.writeFile(path.join(this.saveLocation, 'schema.json'), JSON.stringify(schema, 0, 2), cb)
      })
    })
  }
  buildDir(fileInfo) {
    return path.join(this.saveLocation, fileInfo.table)
  }
  buildTempPath(fileInfo) {
    return this.buildRealPath(fileInfo) + '.tmp'
  }
  buildRealPath(fileInfo) {
    return path.join(this.buildDir(fileInfo), fileInfo.filename)
  }
  processFile(fileInfo, cb) {
    var filename = this.buildRealPath(fileInfo)

    this.logger.info(`checking for existence of ${fileInfo.filename}`)
    this.fileExists(filename, (err, exists) => {
      if (err) return cb(err)
      if (!exists) return this.downloadFile(fileInfo, cb)
      this.logger.info(`already have ${fileInfo.filename}, no need to redownload`)
      return cb(null, {error: null, table: fileInfo.table, filename: fileInfo.filename, savedTo: filename, didDownload: false})
    })
  }
  fileExists(filename, cb) {
    fs.stat(filename, (err, stat) => {
      if (err && err.code !== 'ENOENT') return cb(err)
      if (err && err.code === 'ENOENT') return cb(null, false)
      cb(null, true)
    })
  }
  downloadFile(fileInfo, cb) {
    var filename = this.buildRealPath(fileInfo)
    var tmpFilename = this.buildTempPath(fileInfo)

    this.logger.info(`${filename} does not exist, downloading`)
    mkdirp(this.buildDir(fileInfo), (err) => {
      if (err) return cb(err)
      this.fileDownloader.downloadToFile(fileInfo, {tableName: fileInfo.table}, tmpFilename, (err) => {
        this.logger.info(`${filename} finished`)
        if (err) return cb(null, {error: err, table: fileInfo.table, filename: fileInfo.filename})
        this.logger.debug(`rename ${tmpFilename} to ${filename}`)
        fs.rename(tmpFilename, filename, (err) => {
          if (err) return cb(err)
          cb(null, {error: null, table: fileInfo.table, filename: fileInfo.filename, savedTo: filename, didDownload: true})
        })
      })
    })
  }
  cleanupFiles(downloadedFiles, cb) {
    var byFilename = {}
    for (var file of downloadedFiles) {
      byFilename[path.relative(this.saveLocation, file.savedTo)] = true
    }
    this.logger.info('searching for old files to remove')
    glob('**/*', {cwd: this.saveLocation, nodir: true}, (err, files) => {
      var toRemove = files.filter((f) => {
        return f !== 'schema.json' && !byFilename[f]
      })
      this.logger.debug('will remove files', toRemove)
      async.map(toRemove.map((name) => path.join(this.saveLocation, name)), fs.unlink, cb)
    })
  }
}
module.exports = Sync
