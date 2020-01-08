const assert = require('assert')

const HistoricalRequests = require('../src/HistoricalRequests')
const logger = require('./fixtures/mockLogger')

const assertHistoricalRequests = (input, expected, done) => {
  const hr = new HistoricalRequests({}, {}, logger)
  hr.api.getFilesForTable = (table, cb) => cb(null, input)

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
        table: 'requests',
        history: [
          {
            dumpId: 'one',
            partial: true,
            files: [
              {
                url: 'https://s3.amazonaws.com/timestamp/dw_split/account/requests/b%3D1/part-1',
                filename: 'requests-1.gz'
              }
            ],
            sequence: 1
          }
        ]
      }
      const expected = {}

      assertHistoricalRequests(input, expected, done)
    })

    it('groups across dump entries', (done) => {
      const input = {
        table: 'requests',
        history: [
          {
            dumpId: 'one',
            partial: false,
            files: [
              {
                url: 'https://s3.amazonaws.com/timestamp/requests_split_historical/account/requests/range-1/0/part-1',
                filename: 'requests-1.gz'
              }
            ],
            sequence: 1
          },
          {
            dumpId: 'one',
            partial: false,
            files: [
              {
                url: 'https://s3.amazonaws.com/timestamp/requests_split_historical/account/requests/range-1/0/part-2',
                filename: 'requests-2.gz'
              }
            ],
            sequence: 1
          }
        ]
      }
      const expected = {
        dumpId: 'one',
        ranges: {
          'range-1': [
            {
              url: 'https://s3.amazonaws.com/timestamp/requests_split_historical/account/requests/range-1/0/part-1',
              filename: 'requests-1.gz'
            },
            {
              url: 'https://s3.amazonaws.com/timestamp/requests_split_historical/account/requests/range-1/0/part-2',
              filename: 'requests-2.gz'
            }
          ]
        }
      }
      assertHistoricalRequests(input, expected, done)
    })

    it('groups multiple ranges', (done) => {
      const input = {
        table: 'requests',
        history: [
          {
            dumpId: 'one',
            partial: false,
            files: [
              {
                url: 'https://s3.amazonaws.com/timestamp/requests_split_historical/account/requests/range-1/0/part-1',
                filename: 'requests-1.gz'
              },
              {
                url: 'https://s3.amazonaws.com/timestamp/requests_split_historical/account/requests/range-1/0/part-2',
                filename: 'requests-2.gz'
              }
            ],
            sequence: 1
          },
          {
            dumpId: 'one',
            partial: false,
            files: [
              {
                url: 'https://s3.amazonaws.com/timestamp/requests_split_historical/account/requests/range-2/0/part-1',
                filename: 'requests-1.gz'
              }
            ],
            sequence: 1
          }
        ]
      }
      const expected = {
        dumpId: 'one',
        ranges: {
          'range-1': [
            {
              url: 'https://s3.amazonaws.com/timestamp/requests_split_historical/account/requests/range-1/0/part-1',
              filename: 'requests-1.gz'
            },
            {
              url: 'https://s3.amazonaws.com/timestamp/requests_split_historical/account/requests/range-1/0/part-2',
              filename: 'requests-2.gz'
            }
          ],
          'range-2': [
            {
              url: 'https://s3.amazonaws.com/timestamp/requests_split_historical/account/requests/range-2/0/part-1',
              filename: 'requests-1.gz'
            }
          ]
        }
      }
      assertHistoricalRequests(input, expected, done)
    })

    it('should propagate errors', (done) => {
      const expected = {success: false}
      const hr = new HistoricalRequests({}, {}, logger)
      hr.api.getFilesForTable = (table, cb) => cb(expected, null)

      hr.run((err) => {
        assert.deepEqual(err, expected)
        done()
      })
    })
  })
})
