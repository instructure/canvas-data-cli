var path = require('path')
var fs = require('fs')
var Api = require('./Api')
var StateStore = require('./StateStore')
var async = require('async')
var rimraf = require('rimraf')
var mkdirp = require('mkdirp')
var request = require('request')
var _ = require('lodash')
const DEFAULT_LIMIT = 50
const CONCURRENCY_LIMIT = 5
class Sync {
  constructor(opts, config, logger) {
    this.opts = opts
    this.logger = logger
    this.stateStore = new StateStore(config)
    this.api = new Api(config)
    this.saveLocation = path.resolve(process.cwd(), config.saveLocation)
  }
  run(cb) {
    this.stateStore.load((err, state) => {
      if (err) return cb(err)
      state = state || {}
      var lastSequence = state.sequence || 0
      this.logger.info(`starting from sequence ${lastSequence}`)
      this.getLatestDumps(lastSequence, (err, dumps) => {
        if (err) return cb(err)
        if (!dumps.length) {
          this.logger.info('no new dumps to process')
          return cb()
        }
        this.logger.info(`will process ${dumps.length} dumps`)
        dumps = dumps.map((dump, index) => {
          return {dump, index}
        })
        dumps[0].latestDump = true
        var newestSequence = dumps[0].dump.sequence
        async.reduce(dumps, {partialTables: {}, groups: {}, artifactCount: 0}, this.processDump.bind(this), (err, results) => {
          if (err) return cb(err)
          var toDownload = _.values(results.groups)
          this.logger.info(`downloading ${results.artifactCount} artifacts`)
          async.eachLimit(toDownload, CONCURRENCY_LIMIT, this.downloadArtifactGroup.bind(this), (err) => {
            if (err) return cb(err)
            state.sequence = newestSequence
            this.logger.info(`finished, saving out state, newest sequence: ${newestSequence}`)
            this.stateStore.save(state, cb)
          })
        })
      })
    })
  }
  processDump(collector, dumpInfo, cb) {
    this.api.getFilesForDump(dumpInfo.dump.dumpId, (err, dumpFiles) => {
      if (err) return cb(err)
      for (var tableName in dumpFiles.artifactsByTable) {
        var artifact = dumpFiles.artifactsByTable[tableName]
        var artifactInfo = {sequence: dumpInfo.dump.sequence, tableName, artifact}
        var willDownload = false
        if (dumpInfo.latestDump) {
          this.logger.debug(`will download artifact ${tableName} from dump ${artifactInfo.sequence} as latestDump`)
          willDownload = true
        } else if (artifact.partial && collector.partialTables[tableName] !== 'foundFull') {
          this.logger.debug(`will download artifact ${tableName} from dump ${artifactInfo.sequence} as partial`)
          willDownload = true
          collector.partialTables[tableName] = 'partial'
        } else if (collector.partialTables[tableName] === 'partial' && artifact.partial === false) {
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

          this.logger.debug(`downlading ${downloadLink.filename} for artifact ${artifact.tableName} from dump ${artifact.sequence}`)

          var r = request({method: 'GET', url: downloadLink.url})
          var fileName = path.join(this.saveLocation, artifact.tableName, `${artifact.sequence}_${downloadLink.filename}`)
          var newFile = fs.createWriteStream(fileName)

          r.on('error', cb)
          newFile.on('error', cb)
          r.on('end', () => {
            this.logger.debug(`finished downlading ${downloadLink.filename} for artifact ${artifact.tableName} from dump ${artifact.sequence}`)
            cb()
          })
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
      collector.push(...dumps)
      if (dumps.length < DEFAULT_LIMIT) return cb(null, collector)
      var newestSeq = dumps[0].sequence
      this.getLatestDumps(newSequence, collector, cb)
    })
  }
}
module.exports = Sync
