const assert = require('assert')

const GetApi = require('../src/GetApi')
const logger = require('./fixtures/mockLogger')

describe('GetApi', () => {
  describe('run', () => {
    it('should get successfully', (done) => {
      const expected = {success: true}
      const get = new GetApi({}, {}, logger)
      get.api.makeRequest = (method, path, params, cb) => cb(null, expected)

      get.run((err, response) => {
        assert.ifError(err)
        assert.deepEqual(response, expected)
        done()
      })
    })

    it('should propagate errors', (done) => {
      const expected = {success: false}
      const get = new GetApi({}, {}, logger)
      get.api.makeRequest = (method, path, params, cb) => cb(expected, null)

      get.run((err) => {
        assert.deepEqual(err, expected)
        done()
      })
    })
  })
})
