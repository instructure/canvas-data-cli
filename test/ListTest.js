const assert = require('assert')

const List = require('../src/List')
const logger = require('./fixtures/mockLogger')

function listMock(cb) {
  cb(null, [
    {dumpId: 'a', sequence: 1, accountId: 'fake', numFiles: 2, finished: true, expires: 'd', createdAt: 'd'},
    {dumpId: 'b', sequence: 1, accountId: 'fake', numFiles: 2, finished: true, expires: 'd', createdAt: 'd'},
    {dumpId: 'c', sequence: 1, accountId: 'fake', numFiles: 2, finished: true, expires: 'd', createdAt: 'd'},
    {dumpId: 'd', sequence: 1, accountId: 'fake', numFiles: 2, finished: true, expires: 'd', createdAt: 'd'}
  ])
}

describe('List', () => {
  describe('run', () => {
    it('should list dumps', (done) => {
      let callCount = 0
      logger.info = function() {
        callCount++
      }
      const list = new List({}, {}, logger)
      list.api.getDumps = listMock
      list.run((err) => {
        assert.equal(callCount, 4)
        done(err)
      })
    })
    it('should return an error if that fails', (done) => {
      const list = new List({}, {}, logger)
      list.api.getDumps = function(cb) {
        cb(new Error('bah'))
      }
      list.run((err) => {
        assert(err instanceof Error)
        done()
      })
    })
  })
})
