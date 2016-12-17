const assert = require('assert')
const os = require('os')
const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const proxyquire = require('proxyquire')

const Re = require('re')

let nextReqHandler = null
const defaultFile = path.join(__dirname, 'fixtures', 'mockDump', 'one', 'file.gz')
function buildMockResp(readStream, statusCode) {
  process.nextTick(() => {
    readStream.emit('response', {statusCode})
  })
  return readStream
}
function mockRequest(opts) {
  if (nextReqHandler) return nextReqHandler(opts)
  return buildMockResp(fs.createReadStream(defaultFile), 200)
}

const logger = require('./fixtures/mockLogger')
const FileDownloader = proxyquire('../src/FileDownloader', {request: mockRequest})

function fileExists(path, cb) {
  fs.stat(path, (err, stats) => {
    if (err && err.code === 'ENOENT') return cb(null, false)
    if (err) return cb(err)
    if (stats && stats.size === 0) return cb(null, false)
    cb(null, true)
  })
}


describe('FileDownloader', () => {
  const baseDir = path.join(os.tmpdir(), 'fileDownloadTest')
  before((done) => {
    mkdirp(baseDir, done)
  })
  after((done) => {
    rimraf(baseDir, done)
  })
  describe('downloadToFile', () => {
    const fd = new FileDownloader(logger, {
      retries: 3,
      strategy: {
        "type": Re.STRATEGIES.CONSTANT,
        "initial": 20
      }
    })
    const dlLink = {
      filename: 'mock',
      url: 'mock'
    }
    const artifact = {tableName: 'fake'}
    it('should work to download a file', (done) => {
      const dest = path.join(baseDir, 'success')
      fd.downloadToFile(dlLink, artifact, dest, (err) => {
        assert.ifError(err)
        fileExists(dest, (err, exists) => {
          assert.ifError(err)
          assert(exists)
          done()
        })
      })
    })
    it('should retry on a failure and work', (done) => {
      const dest = path.join(baseDir, 'one_fail')
      let handlerCalled = false
      nextReqHandler = function(opts) {
        handlerCalled = true
        nextReqHandler = function() {
          return buildMockResp(fs.createReadStream(defaultFile), 200)
        }
        return buildMockResp(fs.createReadStream(defaultFile), 404)
      }
      fd.downloadToFile(dlLink, artifact, dest, (err) => {
        assert(handlerCalled)
        assert.ifError(err)
        fileExists(dest, (err, exists) => {
          assert.ifError(err)
          assert(exists)
          done()
        })
      })
    })
    it('should error out after a few retries', (done) => {
      nextReqHandler = function(opts) {
        return buildMockResp(fs.createReadStream(defaultFile), 404)
      }
      const dest = path.join(baseDir, 'fail')
      fd.downloadToFile(dlLink, artifact, dest, (err) => {
        assert(err instanceof Error)
        done()
      })
    })
  })
})
