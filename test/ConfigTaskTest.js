const assert = require('assert')
const fs = require('fs')

const ConfigTask = require('../src/ConfigTask')
const logger = require('./fixtures/mockLogger')

describe('ConfigTask', () => {
  describe('validate', () => {
    it('should return nothing if we got all the required fields', () => {
      const out = ConfigTask.validate({saveLocation: '/tmp', apiUrl: 'http://api.com', key: 'bob', secret: 'secret'})
      assert(out == null)
    })
    it('return a string of failed fields', () => {
      const out = ConfigTask.validate({saveLocation: '/tmp', apiUrl: 'http://api.com'})
      assert.equal(out, 'missing key, secret fields in config')
    })
  })
  describe('constructor', () => {
    it('should not blow up', () => {
      new ConfigTask({}, {}, logger)
    })
  })
  describe('run', () => {
    it('should write a sample file to current dir', (done) => {
      new ConfigTask({}, {}, logger).run((err) => {
        assert.ifError(err)
        fs.access('./config.js.sample', fs.F_OK, (err) => {
          assert.ifError(err)
          fs.unlink('./config.js.sample', done)
        })
      })
    })
  })
})
