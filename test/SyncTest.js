require('mocha-sinon')

const os = require('os')
const path = require('path')
const crypto = require('crypto')

const assert = require('chai').assert
const _ = require('lodash')
const rimraf = require('rimraf')
const logger = require('./fixtures/mockLogger')
const mockApi = require('./fixtures/mockApiObjects')

const Sync = require('../src/Sync')
function buildTestSync() {
  const tmpDir = path.join(os.tmpdir(), crypto.randomBytes(12).toString('hex'))
  const config = {
    tmpDir: tmpDir,
    saveLocation: path.join(tmpDir, 'dataFiles'),
    unpackLocation: path.join(tmpDir, 'unpackedFiles'),
    stateFile: path.join(tmpDir, '/state.json'),
    apiUrl: 'https://mockApi/api',
    key: 'fakeKey',
    secret: 'fakeSecret'
  }
  return {sync: new Sync({}, config, logger), config}
}

function cleanupSync(sync, config, cb) {
  rimraf(config.tmpDir, cb)
}

describe('SyncTest', function() {
  describe('getLatestDumps', () => {
    it('should work with API if no paging', function(done) {
      var {sync, config} = buildTestSync()
      var apiStub = this.sinon.stub(sync.api, 'getDumps', (opts, cb) => {
        cb(null, _.fill(Array(40), 0).map((k, i) => mockApi.buildDump({sequence: 40 - i})))
      })
      sync.getLatestDumps(0, (err, dumps) => {
        assert.ifError(err)
        assert.equal(dumps.length, 40)
        assert.equal(dumps[0].sequence, 40)
        assert.equal(dumps[39].sequence, 1)
        assert(apiStub.calledOnce)
        cleanupSync(sync, config, done)
      })
    })
    it('should work with paged responsed', function(done) {
      var {sync, config} = buildTestSync()
      var apiStub = this.sinon.stub(sync.api, 'getDumps')
      apiStub.onFirstCall().callsArgWith(1, null, _.fill(Array(60), 0).map((k, i) => mockApi.buildDump({sequence: 60 - i})))
      apiStub.onSecondCall().callsArgWith(1, null, _.fill(Array(40), 0).map((k, i) => mockApi.buildDump({sequence: 100 - i})))
      sync.getLatestDumps(0, (err, dumps) => {
        assert.ifError(err)
        assert.equal(dumps.length, 100)
        assert.equal(dumps[0].sequence, 100)
        assert.equal(dumps[99].sequence, 1)
        assert(apiStub.calledTwice)
        cleanupSync(sync, config, done)
      })
    })
    it('should pass errors back', function(done) {
      var {sync, config} = buildTestSync()
      var apiStub = this.sinon.stub(sync.api, 'getDumps')
      apiStub.onFirstCall().callsArgWith(1, new Error('something wrong'))
      sync.getLatestDumps(0, (err, dumps) => {
        assert.isNotNull(err)
        assert(err instanceof Error)
        cleanupSync(sync, config, done)
      })
    })
  })
  describe('processDump', () => {
    it('should mark to download an artifact if latest', function(done) {
      var {sync, config} = buildTestSync()
      var apiStub = this.sinon.stub(sync.api, 'getFilesForDump')
      const mockOpts = {
        tables: ['account_dim', 'requests'],
        tableOpts: {
          requests: {
            tableName: 'requests',
            partial: true
          }
        }
      }

      const mockDumpFile = mockApi.buildDumpFile(mockOpts)
      apiStub.onFirstCall().callsArgWith(1, null, mockDumpFile)
      sync.processDump(sync.getNewCollector(), {dump: mockDumpFile, latestDump: true}, (err, res) => {
        assert.ifError(err)
        assert.equal(res.groups.account_dim.length, 1)
        assert.equal(res.groups.requests.length, 1)
        cleanupSync(sync, config, done)
      })

    })
    it('should not download a full table if not latest', function(done) {
      var {sync, config} = buildTestSync()
      var apiStub = this.sinon.stub(sync.api, 'getFilesForDump')
      const mockOpts = {
        tables: ['account_dim', 'requests'],
        tableOpts: {
          requests: {
            tableName: 'requests',
            partial: true
          }
        }
      }

      const mockDumpFile = mockApi.buildDumpFile(mockOpts)
      apiStub.onFirstCall().callsArgWith(1, null, mockDumpFile)
      sync.processDump(sync.getNewCollector(), {dump: mockDumpFile, latestDump: false}, (err, res) => {
        assert.ifError(err)
        assert.isUndefined(res.groups.account_dim)
        assert.equal(res.groups.requests.length, 1)
        assert.equal(res.partialTables.requests, 'partial')
        cleanupSync(sync, config, done)
      })
    })
    it('should download a full dump if we previously have seen a partial', function(done) {
      var {sync, config} = buildTestSync()
      var apiStub = this.sinon.stub(sync.api, 'getFilesForDump')
      const mockOpts = {
        tables: ['account_dim', 'requests'],
        tableOpts: {
          requests: {
            tableName: 'requests',
            partial: false
          }
        }
      }

      const mockDumpFile = mockApi.buildDumpFile(mockOpts)
      apiStub.onFirstCall().callsArgWith(1, null, mockDumpFile)
      var coll = sync.getNewCollector()
      coll.partialTables.requests = 'partial'
      coll.groups.requests = []
      coll.groups.requests.push({artifact: mockApi.buildDumpArtifact({tableName: 'requests', partial: true})})
      sync.processDump(coll, {dump: mockDumpFile, latestDump: false}, (err, res) => {
        assert.ifError(err)
        assert.isUndefined(res.groups.account_dim)
        assert.equal(res.groups.requests.length, 2)
        assert.equal(res.partialTables.requests, 'foundFull')
        cleanupSync(sync, config, done)
      })
    })
    it('should not download a partial if we previously have seen a full dump', function(done) {
      var {sync, config} = buildTestSync()
      var apiStub = this.sinon.stub(sync.api, 'getFilesForDump')
      const mockOpts = {
        tables: ['account_dim', 'requests'],
        tableOpts: {
          requests: {
            tableName: 'requests',
            partial: true
          }
        }
      }

      const mockDumpFile = mockApi.buildDumpFile(mockOpts)
      apiStub.onFirstCall().callsArgWith(1, null, mockDumpFile)
      var coll = sync.getNewCollector()
      coll.partialTables.requests = 'foundFull'
      coll.groups.requests = []
      coll.groups.requests.push({artifact: mockApi.buildDumpArtifact({tableName: 'requests', partial: false})})
      sync.processDump(coll, {dump: mockDumpFile, latestDump: false}, (err, res) => {
        assert.ifError(err)
        assert.isUndefined(res.groups.account_dim)
        assert.equal(res.groups.requests.length, 1)
        assert.equal(res.partialTables.requests, 'foundFull')
        cleanupSync(sync, config, done)
      })
    })
    it('should not download a full if we previously have seen a full dump', function(done) {
      var {sync, config} = buildTestSync()
      var apiStub = this.sinon.stub(sync.api, 'getFilesForDump')
      const mockOpts = {
        tables: ['account_dim', 'requests'],
        tableOpts: {
          requests: {
            tableName: 'requests',
            partial: false
          }
        }
      }

      const mockDumpFile = mockApi.buildDumpFile(mockOpts)
      apiStub.onFirstCall().callsArgWith(1, null, mockDumpFile)
      var coll = sync.getNewCollector()
      coll.partialTables.requests = 'foundFull'
      coll.groups.requests = []
      coll.groups.requests.push({artifact: mockApi.buildDumpArtifact({tableName: 'requests', partial: false})})
      sync.processDump(coll, {dump: mockDumpFile, latestDump: false}, (err, res) => {
        assert.ifError(err)
        assert.isUndefined(res.groups.account_dim)
        assert.equal(res.groups.requests.length, 1)
        assert.equal(res.partialTables.requests, 'foundFull')
        cleanupSync(sync, config, done)
      })
    })
    it('should properly escape if an error', function(done) {
      var {sync, config} = buildTestSync()
      var apiStub = this.sinon.stub(sync.api, 'getFilesForDump')
      const mockDumpFile = mockApi.buildDumpFile()
      apiStub.onFirstCall().callsArgWith(1, new Error('something wrong'))
      var coll = sync.getNewCollector()
      sync.processDump(coll, {dump: mockDumpFile, lastestDump: false}, (err, res) => {
        assert.isNotNull(err)
        assert(err instanceof Error)
        cleanupSync(sync, config, done)
      })
    })

  })
})
