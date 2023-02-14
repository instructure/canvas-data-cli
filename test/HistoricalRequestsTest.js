const assert = require('assert')

const HistoricalRequests = require('../src/HistoricalRequests')
const logger = require('./fixtures/mockLogger')

const assertHistoricalRequests = (input, expected, done) => {
  const hr = new HistoricalRequests({}, {}, logger)
  hr.api.getSync = (cb) => cb(null, input)

  hr.run((err, response) => {
    assert.ifError(err)
    assert.deepEqual(response, expected)
    done()
  })
}

describe('HistoricalRequests', () => {
  describe('run', () => {
    it('ignores daily dumps', (done) => {
      const input = {
        schemaVersion: 'test',
        files: [
          {
            url: 'https://s3.amazonaws.com/account/requests/b%3D1/0/part-1',
            filename: 'requests-1.gz',
            table: 'requests',
            partial: true
          }
        ]
      }
      const expected = {}

      assertHistoricalRequests(input, expected, done)
    })

    it('ignores other tables', (done) => {
      const input = {
        schemaVersion: 'test',
        files: [
          {
            url: 'https://s3.amazonaws.com/account/requests/b%3D1/0/part-1',
            filename: 'users-1.gz',
            table: 'users',
            partial: false
          }
        ]
      }
      const expected = {}

      assertHistoricalRequests(input, expected, done)
    })

    it('groups ranges', (done) => {
      const input = {
        schemaVersion: 'test',
        files: [
          {
            url: 'https://s3.amazonaws.com/account/requests/range-1/0/part-1',
            filename: 'requests-1.gz',
            table: 'requests',
            partial: false
          },
          {
            url: 'https://s3.amazonaws.com/account/requests/range-1/0/part-2',
            filename: 'requests-2.gz',
            table: 'requests',
            partial: false
          },
          {
            url: 'https://s3.amazonaws.com/account/requests/range-2/0/part-1',
            filename: 'requests-1.gz',
            table: 'requests',
            partial: false
          }
        ]
      }
      const expected = {
        'range-1': [
          {
            url: 'https://s3.amazonaws.com/account/requests/range-1/0/part-1',
            filename: 'requests-1.gz',
            table: 'requests',
            partial: false
          },
          {
            url: 'https://s3.amazonaws.com/account/requests/range-1/0/part-2',
            filename: 'requests-2.gz',
            table: 'requests',
            partial: false
          }
        ],
        'range-2': [
          {
            url: 'https://s3.amazonaws.com/account/requests/range-2/0/part-1',
            filename: 'requests-1.gz',
            table: 'requests',
            partial: false
          }
        ]
      }
      assertHistoricalRequests(input, expected, done)
    })

    it('should propagate errors', (done) => {
      const expected = {success: false}
      const hr = new HistoricalRequests({}, {}, logger)
      hr.api.getSync = (cb) => cb(expected, null)

      hr.run((err) => {
        assert.deepEqual(err, expected)
        done()
      })
    })
  })
})
