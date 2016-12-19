const assert = require('assert')
const fs = require('fs')
const path = require('path')
const os = require('os')
const rimraf = require('rimraf')

const Grab = require('../src/Grab')
const logger = require('./fixtures/mockLogger')

function getFilesMock(dumpId, cb) {
  cb(null, {
    sequence: 2,
    artifactsByTable: {
      table1: {
        files: [
          {filename: 'table1-0.gz', url:'http://myapi.com/dl/table1-0.gz'},
          {filename: 'table1-1.gz', url:'http://myapi.com/dl/table1-1.gz'}
        ]
      },
      table2: {
        files: [
          {filename: 'table2-0.gz', url:'http://myapi.com/dl/table2-0.gz'}
        ]
      }
    }
  })
}

describe('Grab', () => {
  describe('run', () => {
    it('should be able to download a dump to given folder', (done) => {
      const tmpDir = path.join(os.tmpdir(), 'grab_test')
      const grab = new Grab({dump: 'abcd'}, {saveLocation: 'http://myApi', saveLocation: tmpDir}, logger)
      grab.api.getFilesForDump = getFilesMock
      // just collect the files we were called with, make sure it looks sane instead of validating from FS
      const gotFiles = []
      grab.fileDownloader.downloadToFile = function(fileInfo, artifactInfo, dest, cb) {
        gotFiles.push(dest.replace(tmpDir, ''))
        cb()
      }
      const expected = ['/abcd/2-table1-0.gz', '/abcd/2-table1-1.gz', '/abcd/2-table2-0.gz']
      // make sure folder is there though
      grab.run((err) => {
        assert.ifError(err)
        assert.deepEqual(gotFiles, expected)
        fs.access(tmpDir, fs.F_OK, (err) => {
          assert.ifError(err)
          rimraf(tmpDir, done)
        })
      })
    })
  })
})
