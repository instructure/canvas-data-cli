const assert = require('assert')
const path = require('path')
const os = require('os')
const fs = require('fs')

const proxyquire = require('proxyquire')
const logger = require('./fixtures/mockLogger')

const toMock = [
  'Sync', 'ConfigTask', 'Unpack', 'Fetch', 'Grab', 'List'
]
const mocks = toMock.reduce((all, next) => {
  function MockClass() {
    this.didRun = false
    all.instances[next.toLowerCase()] =  this
  }
  MockClass.prototype.run = function(cb) {
    this.didRun = true
    cb()
  }
  MockClass.validate = function() {}
  all[`./${next}`] = MockClass
  return all
}, {instances: {}})
mocks.logger = logger

const cli = proxyquire('../src/cli', mocks)

describe('cli', () => {
  const configFileName = path.join(os.tmpDir(), 'canDataCliConfig.js')
  before((done) => {
    fs.writeFile(configFileName, '{}', done)
  })
  after((done) => {
    fs.unlink(configFileName, done)
  })
  describe('parseArgs', () => {
    it('should expose the cli obj and parse args', () => {
      const args = cli.cli.parse('sampleConfig')
      assert.equal(args._[0], 'sampleConfig')
    })
  })
  describe('run', () => {
    it('should require config properly', () => {
      const argv = {
        _: ['sync'],
        level: 'info',
        config: configFileName
      }
      cli.run(argv)
      assert(mocks.instances.sync.didRun)
    })
  })
})
