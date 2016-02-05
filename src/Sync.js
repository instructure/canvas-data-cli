var path = require('path')
var fs = require('fs')
var Api = require('./Api')
var StateStore = require('./StateStore')
var FileDownloader = require('./FileDownloader')
var async = require('async')
var rimraf = require('rimraf')
var mkdirp = require('mkdirp')
var _ = require('lodash')
const DEFAULT_LIMIT = 50
const CONCURRENCY_LIMIT = 5
class Sync {
  constructor(opts, config, logger) {
    this.opts = opts
    this.logger = logger
    this.stateStore = new StateStore(config)
    this.api = new Api(config)
    this.fileDownloader = new FileDownloader(logger)
    this.saveLocation = path.resolve(process.cwd(), config.saveLocation)
  }
  getNewCollector() {
    return {partialTables: {}, groups: {}, artifactCount: 0}
  }
  run(cb) {
    this.stateStore.load((err, state) => {
      if (err) return cb(err)
      state = state || {}
      var lastSequence = state.sequence || 0
      this.logger.info(`starting from sequence ${lastSequence}`)
      this.getToDownload(lastSequence, (err, {toDownload, artifactCount, schemaVersion, newestSequence}) => {
        if (err) return cb(err)
        if (toDownload.length === 0) {
          this.logger.info('no new dumps to process')
          return cb()
        }
        this.logger.info(`downloading ${artifactCount} artifacts`)
        async.eachLimit(toDownload, CONCURRENCY_LIMIT, this.downloadArtifactGroup.bind(this), (err) => {
          if (err) return cb(err)
          state.sequence = newestSequence
          this.downloadSchema(schemaVersion, (err) => {
            if (err) return cb(err)
            this.logger.info(`finished, saving out state, newest sequence: ${newestSequence}`)
            this.stateStore.save(state, cb)
          })
        })
      })
    })
  }
  getToDownload(lastSequence, cb) {
    this.getLatestDumps(lastSequence, (err, dumps) => {
      if (err) return cb(err)
      if (dumps.length === 0) return cb()
      this.logger.info(`will process ${dumps.length} dumps`)
      dumps = dumps.map((dump, index) => {
        return {dump, index}
      })
      dumps[0].latestDump = true
      var latestDump = dumps[0].dump
      var newestSequence = dumps[0].dump.sequence
      async.reduce(dumps, this.getNewCollector(), this.processDump.bind(this), (err, results) => {
        if (err) return cb(err)
        var toDownload = _.values(results.groups)
        cb(null, {toDownload, newestSequence, artifactCount: results.artifactCount, schemaVersion: latestDump.schemaVersion})
      })
    })
  }
  downloadSchema(schemaVersion, cb) {
    this.api.getSchemaVersion(schemaVersion, (err, schema) => {
      if (err) return cb(err)
      fs.writeFile(path.join(this.saveLocation, 'schema.json'), JSON.stringify(schema, 0, 2), cb)
    })
  }
  processDump(collector, dumpInfo, cb) {
    this.api.getFilesForDump(dumpInfo.dump.dumpId, (err, dumpFiles) => {
      if (err) return cb(err)

      for (var tableName in dumpFiles.artifactsByTable) {
        const artifact = dumpFiles.artifactsByTable[tableName]
        const artifactInfo = {sequence: dumpInfo.dump.sequence, tableName, artifact}
        let willDownload = false

        if (dumpInfo.latestDump) {
          this.logger.debug(`will download artifact ${tableName} from dump ${artifactInfo.sequence} as latestDump`)
          willDownload = true
        } else if (artifact.partial && collector.partialTables[tableName] !== 'foundFull') {
          this.logger.debug(`will download artifact ${tableName} from dump ${artifactInfo.sequence} as partial`)
          willDownload = true
          collector.partialTables[tableName] = 'partial'
        } else if (collector.partialTables[tableName] === 'partial' &&
                   artifact.partial === false) {
          this.logger.debug(`will download artifact ${tableName} from dump ${artifactInfo.sequence} as first in partial`)
          willDownload = true
          collector.partialTables[tableName] = 'foundFull'
        }

        if (willDownload) {
          collector.artifactCount++
          collector.groups[tableName] = collector.groups[tableName] || []
          collector.groups[tableName].unshift(artifactInfo)
        }

      }

      cb(null, collector)
    })
  }
  downloadArtifactGroup(group, cb) {
    async.eachSeries(group, this.downloadArtifact.bind(this), cb)
  }
  downloadArtifact(artifact, cb) {
    this.removeOldArtifact(artifact, (err) => {
      if (err) return cb(err)
      mkdirp(path.join(this.saveLocation, artifact.tableName), (err) => {
        if (err) return cb(err)

        this.logger.info(`artifact ${artifact.tableName} from dump ${artifact.sequence} has ${artifact.artifact.files.length} to download`)
        async.eachLimit(artifact.artifact.files, CONCURRENCY_LIMIT, (downloadLink, cb) => {
          var fileName = path.join(this.saveLocation, artifact.tableName, `${artifact.sequence}_${downloadLink.filename}`)
          this.fileDownloader.downloadToFile(downloadLink, artifact, fileName, cb)
        }, (err) => {
          if (err) return cb(err)
          this.logger.info(`artifact ${artifact.tableName} from dump ${artifact.sequence} finished`)
          cb()
        })
      })
    })
  }
  removeOldArtifact(artifact, cb) {
    if (artifact.artifact.partial) return cb()
    this.logger.info(`artifact ${artifact.tableName} from dump ${artifact.sequence} replaces old files, will delete old files`)
    rimraf(path.join(this.saveLocation, artifact.tableName), cb)
  }
  getLatestDumps(lastSequence, collector, cb) {
    if (typeof collector === 'function') {
      cb = collector
      collector = []
    }
    this.api.getDumps({after: lastSequence, limit: DEFAULT_LIMIT}, (err, dumps) => {
      if (err) return cb(err)
      collector.unshift(...dumps)
      if (dumps.length < DEFAULT_LIMIT) return cb(null, collector)
      var newestSeq = dumps[0].sequence
      this.getLatestDumps(newestSeq, collector, cb)
    })
  }
}
module.exports = Sync
