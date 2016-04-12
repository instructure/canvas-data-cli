require('mocha-sinon')

const os = require('os')
const path = require('path')
const crypto = require('crypto')

const chai = require('chai')
chai.use(require('chai-fs'))
const assert = chai.assert

const _ = require('lodash')
const rimraf = require('rimraf')
const touch = require('touch')
const logger = require('./fixtures/mockLogger')
const mockApi = require('./fixtures/mockApiObjects')

const Fetch = require('../src/Fetch')
function buildTestFetch(tableName) {
  const tmpDir = path.join(os.tmpdir(), crypto.randomBytes(12).toString('hex'))
  const config = {
    tmpDir: tmpDir,
    saveLocation: path.join(tmpDir, 'dataFiles'),
    unpackLocation: path.join(tmpDir, 'unpackedFiles'),
    apiUrl: 'https://mockApi/api',
    key: 'fakeKey',
    secret: 'fakeSecret'
  }
  return {fetch: new Fetch({table: tableName || 'account_dim'}, config, logger), config}
}

function cleanupFetch(sync, config, cb) {
  rimraf(config.tmpDir, cb)
}

describe('FetchTest', function() {
  describe('getNewest', () => {
    it('should return only the most recent dump if non partial table', () => {
      var {fetch, config} = buildTestFetch('user_dim')
      var ret = fetch.getNewest({
        table: 'user_dim',
        history: [
          {
            dumpId: '1234',
            sequence: 3,
            partial: false,
            files: [
              {url: 'http://url_to_download/file1.tar.gz', filename: 'file1.tar.gz'},
              {url: 'http://url_to_download/file2.tar.gz', filename: 'file2.tar.gz'}
            ]
          },
          {
            dumpId: '1234',
            sequence: 2,
            partial: true,
            files: [
              {url: 'http://url_to_download/file1.tar.gz', filename: 'file1.tar.gz'},
              {url: 'http://url_to_download/file2.tar.gz', filename: 'file2.tar.gz'}
            ]
          }
        ]
      })
      assert.equal(ret.length, 2)
      assert.equal(ret[0].sequence, 3)
      assert.equal(ret[0].filename, 'file1.tar.gz')
      assert.equal(ret[1].sequence, 3)
      assert.equal(ret[1].filename, 'file2.tar.gz')
    })
    it('should return multiple dumps for partial tables', () => {
      var {fetch, config} = buildTestFetch('user_dim')
      var ret = fetch.getNewest({
        table: 'user_dim',
        history: [
          {
            dumpId: '1234',
            sequence: 3,
            partial: true,
            files: [
              {url: 'http://url_to_download/file1.tar.gz', filename: 'file1.tar.gz'},
              {url: 'http://url_to_download/file2.tar.gz', filename: 'file2.tar.gz'}
            ]
          },
          {
            dumpId: '1232',
            sequence: 2,
            partial: false,
            files: [
              {url: 'http://url_to_download/file1.tar.gz', filename: 'filef0.tar.gz'},
              {url: 'http://url_to_download/file2.tar.gz', filename: 'filef1.tar.gz'}
            ]
          },
          {
            dumpId: '1231',
            sequence: 1,
            partial: true,
            files: [
              {url: 'http://url_to_download/file1.tar.gz', filename: 'file1.tar.gz'},
              {url: 'http://url_to_download/file2.tar.gz', filename: 'file2.tar.gz'}
            ]
          }
        ]
      })
      assert.equal(ret.length, 4)
      assert.equal(ret[0].sequence, 3)
      assert.equal(ret[0].filename, 'file1.tar.gz')
      assert.equal(ret[1].sequence, 3)
      assert.equal(ret[1].filename, 'file2.tar.gz')
      assert.equal(ret[2].sequence, 2)
      assert.equal(ret[2].filename, 'filef0.tar.gz')
      assert.equal(ret[3].sequence, 2)
      assert.equal(ret[3].filename, 'filef1.tar.gz')
    })
  })
  describe('run', () => {
    it('it should write files for a non partial table', function(done) {
      const tableName = 'user_dim'
      var {fetch, config} = buildTestFetch(tableName)
      var apiStub = this.sinon.stub(fetch.api, 'getFilesForTable', (opts, cb) => {
        cb(null, mockApi.buildDumpHistory({table: tableName}))
      })
      var downloadStub = this.sinon.stub(fetch.fileDownloader, 'downloadToFile', (filename, opts, savePath, cb) => {
        touch(savePath, cb)
      })
      fetch.run((err, res) => {
        assert.ifError(err)
        assert.equal(res.length, 2)
        assert(downloadStub.callCount, 2)
        assert.isFile(path.join(config.saveLocation, tableName, '0-filename-1.tar.gz'))
        cleanupFetch(fetch, config, done)
      })
    })
    it('it should write files for a partial table', function(done) {
      const tableName = 'partial_dim'
      var {fetch, config} = buildTestFetch(tableName)
      var apiStub = this.sinon.stub(fetch.api, 'getFilesForTable', (opts, cb) => {
        var entryOpts = [
          {sequence: 3, partial: true},
          {sequence: 2, partial: false},
          {sequence: 1, partial: true}
        ]
        cb(null, mockApi.buildDumpHistory({table: tableName, numEntries: 3, entryOpts}))
      })
      var downloadStub = this.sinon.stub(fetch.fileDownloader, 'downloadToFile', (filename, opts, savePath, cb) => {
        touch(savePath, cb)
      })
      fetch.run((err, res) => {
        assert.ifError(err)
        assert.equal(res.length, 4)
        assert(downloadStub.callCount, 4)
        assert.isFile(path.join(config.saveLocation, tableName, '3-filename-1.tar.gz'))
        assert.isFile(path.join(config.saveLocation, tableName, '2-filename-1.tar.gz'))
        assert.notPathExists(path.join(config.saveLocation, tableName, '1-filename-1.tar.gz'))
        cleanupFetch(fetch, config, done)
      })
    })
  })
})
