require('mocha-sinon')

const os = require('os')
const path = require('path')
const crypto = require('crypto')
const fs = require('fs')

const assert = require('chai').assert
const rimraf = require('rimraf')
const logger = require('./fixtures/mockLogger')
const mockApi = require('./fixtures/mockApiObjects')
const async = require('async')
const mkdirp = require('mkdirp')


const Sync = require('../src/Sync')
function buildTestSync() {
  const tmpDir = path.join(os.tmpdir(), crypto.randomBytes(12).toString('hex'))
  const config = {
    tmpDir: tmpDir,
    saveLocation: path.join(tmpDir, 'dataFiles'),
    unpackLocation: path.join(tmpDir, 'unpackedFiles'),
    apiUrl: 'https://mockApi/api',
    key: 'fakeKey',
    secret: 'fakeSecret'
  }
  var sync = new Sync({}, config, logger)
  sync.testConfig = config
  return {sync: sync}
}

function cleanupSync(sync, cb) {
  rimraf(sync.testConfig.tmpDir, cb)
}

function touchFile(filename, cb) {
  if (typeof filename === 'object') {
    filename = filename.savedTo
  }
  mkdirp(path.dirname(filename), (err) => {
    if (err) return cb(err)
    fs.open(filename, 'w', (err, fd) => {
      if (err) return cb(err)
      fs.close(fd, cb)
    })
  })
}
function fileExists(filename, cb) {
  if (typeof filename === 'object') {
    filename = filename.savedTo
  }
  fs.stat(filename, (err, fileStat) => {
    if (err && err.code !== 'ENOENT') return cb(err)
    if (err && err.code === 'ENOENT') return cb(null, false)
    cb(null, true)
  })
}

describe('SyncTest', function() {
  describe('dirHandling', () => {
    var {sync} = buildTestSync()
    after((done) => cleanupSync(sync, done))
    it('should build dirs properly', () => {
      assert.include(sync.buildDir({table: 'foobar'}), '/foobar', 'properly joins from a file object to get a directory')
      assert.include(sync.buildRealPath({table: 'foobar', filename: 'foobar-1234'}), '/foobar/foobar-1234', 'properly joins from a file object to get a full path')
      assert.notEqual(sync.buildRealPath({table: 'foobar', filename: 'foobar-1234'}), '/foobar/foobar-1234', 'properly joins from a file object to get a full path')
    })
  })
  describe('fileExists', () => {
    var {sync} = buildTestSync()
    after((done) => cleanupSync(sync, done))
    it('should return true when a file does exist', (done) => {
      var file = path.join(sync.saveLocation, 'shouldExist')
      touchFile(file, (err) => {
        assert.ifError(err)
        sync.fileExists(file, (err, exists) => {
          assert.ifError(err)
          assert(exists)
          done()
        })
      })
    })
    it('should return false when a file does not exist', (done) => {
      sync.fileExists(path.join(sync.saveLocation, 'fakeFile'), (err, exists) => {
        assert.ifError(err)
        assert(!exists)
        done()
      })
    })
  })
  describe('downloadSchema', () => {
    var {sync} = buildTestSync()
    after((done) => cleanupSync(sync, done))
    it('should ensure the save location exists', function(done) {
      var schemaStub = this.sinon.stub(sync.api, 'getSchemaVersion')
      schemaStub.onFirstCall().callsArgWith(1, null, {schemaVersion: '1.0.0'})
      fs.stat(sync.saveLocation, (err) => {
        assert.equal(err.code, 'ENOENT')
        sync.downloadSchema('1.0.0', (err) => {
          assert.ifError(err)
          fs.stat(path.join(sync.saveLocation, 'schema.json'), (err, schema) => {
            assert.ifError(err)
            assert(schema.isFile())
            done()
          })
        })
      })
    })
  })
  describe('processFile', () => {
    var {sync} = buildTestSync()
    after((done) => cleanupSync(sync, done))
    it('does not download the file if it exists', function(done) {
      var existsStub = this.sinon.stub(sync, 'fileExists')
      existsStub.onFirstCall().callsArgWith(1, null, true)
      var downloadSpy = this.sinon.spy(sync, 'downloadFile')
      sync.processFile({filename: 'existsFile.gz', table: 'exists'}, (err, res) => {
        assert.ifError(err)
        assert(!res.didDownload)
        assert(res.filename, 'existsFile.gz')
        assert(res.table, 'exists')
        assert(res.savedTo, path.join(sync.saveLocation, 'exists', 'existsFile.gz'))
        assert(!downloadSpy.called)
        done()
      })
    })
    it('does call to download if the file does not exist', function(done) {
      var existsStub = this.sinon.stub(sync, 'fileExists')
      existsStub.onFirstCall().callsArgWith(1, null, false)
      var downloadStub = this.sinon.stub(sync, 'downloadFile')
      downloadStub.onFirstCall().callsArgWith(1, null, {didDownload: true})

      sync.processFile({filename: 'notExistsFile.gz', table: 'notExists'}, (err, res) => {
        assert.ifError(err)
        assert(res.didDownload)
        assert(downloadStub.called)
        done()
      })
    })
    it('handles if fileExists throws some other error', function(done) {
      var existsStub = this.sinon.stub(sync, 'fileExists')
      existsStub.onFirstCall().callsArgWith(1, new Error('unexpected'), false)

      sync.processFile({filename: 'notExistsFile.gz', table: 'notExists'}, (err, res) => {
        assert(err)
        assert.instanceOf(err, Error)
        done()
      })
    })
  })
  describe('downloadFile', () => {
    var {sync} = buildTestSync()
    after((done) => cleanupSync(sync, done))
    it('creates the enclosing folder if it does not exist', function(done) {
      var fileObj = {filename: 'foobar.gz', table: 'bubbles'}
      var downloaderStub = this.sinon.stub(sync.fileDownloader, 'downloadToFile', (fileInfo, info, dest, cb) => fs.open(dest, 'w', cb))
      fs.stat(sync.buildDir(fileObj), (err) => {
        assert.equal(err.code, 'ENOENT')
        sync.downloadFile(fileObj, (err, res) => {
          assert.ifError(err)
          assert(res.didDownload)
          assert.equal(res.table, fileObj.table)
          assert.equal(res.filename, fileObj.filename)
          assert.include(res.savedTo, fileObj.filename)
          fs.stat(res.savedTo, (err, fileStat) => {
            assert.ifError(err)
            assert(fileStat.isFile())
            fs.stat(sync.buildTempPath(fileObj), (err) => {
              assert.equal(err.code, 'ENOENT', 'does not leave a straggling temporary file')
              done()
            })
          })
        })
      })
    })

    it('does not return an error if the download fails', function(done) {
      var fileObj = {filename: 'error.gz', table: 'error'}
      var downloaderStub = this.sinon.stub(sync.fileDownloader, 'downloadToFile')
      downloaderStub.onFirstCall().callsArgWith(3, new Error('unexpected'))
      sync.downloadFile(fileObj, (err, res) => {
        assert.ifError(err)
        assert.instanceOf(res.error, Error)
        fs.stat(sync.buildRealPath(fileObj), (err) => {
          assert.equal(err.code, 'ENOENT', 'does not leave a real file which would break future syncs')
          done()
        })
      })
    })
  })
  describe('cleanupFiles', () => {
    var {sync} = buildTestSync()
    after((done) => cleanupSync(sync, done))
    function attachSavedTo(obj) {
      obj.savedTo = sync.buildRealPath(obj)
      return obj
    }
    it('should not delete files that are part of the downloaded set', (done) => {
      var validFiles = [
        {table: 'foo', filename: '1.gz',},
        {table: 'foo', filename: '2.gz'},
        {table: 'bar', filename: '1.gz'},
        {table: 'with_', filename: 'hello'},
      ].map(attachSavedTo)
      var toDelete = [
        {table: 'deleteMe', filename: 'asdfasdfsad.gz'},
        {table: '_reallyDeleteMe', filename: 'boop.gz'},
        {table: 'silylongnamehopefullythisshouldworkprettymucheverywherebutifnotwewillatleasthaveatestforit', filename: 'file.gz'}
      ].map(attachSavedTo)
      var toCreate = validFiles.slice(0)
      toCreate.push(...toDelete)
      var schemaPath = path.join(sync.saveLocation, 'schema.json')
      toCreate.push(schemaPath)
      async.map(toCreate, touchFile, (err) => {
        assert.ifError(err)
        sync.cleanupFiles(validFiles, (err) => {
          assert.ifError(err)
          // add this back on for the utility function to check for existence
          validFiles.push(schemaPath)
          async.map(validFiles, fileExists, (err, res) => {
            assert.ifError(err)
            assert.equal(res.length, 5)
            for (var r of res) {
              assert(r)
            }
            async.map(toDelete, fileExists, (err, res) => {
              assert.ifError(err)
              assert.equal(res.length, 3)
              for (var r of res) {
                assert(!r)
              }
              done()
            })
          })
        })
      })
    })
  })
})
