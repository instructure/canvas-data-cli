const _ = require('lodash')
const SIXTY_DAYS = (1000 * 60 * 60 * 24 * 60)
var mockApiObjects = module.exports = {
  buildDump(opts) {
    return _.defaults(opts, {
      dumpId: '1234',
      sequence: 0,
      accountId: "customer_account_id",
      numFiles: 10,
      finished: true,
      expires: Date.now() - SIXTY_DAYS,
      updatedAt: "2015-10-24T00:00:00.000Z",
      createdAt: "2015-10-24T00:00:00.000Z",
      schemaVersion: "1.0.1"
    })
  },
  buildDumpFile(opts) {
    opts = opts || {}
    opts.tableOpts = opts.tableOpts || {}
    const tables = opts.tables || ['account_dim', 'course_dim', 'assignment_fact']
    const artifacts = tables.map((tableName) => mockApiObjects.buildDumpArtifact(opts.tableOpts[tableName] || {tableName}))
    return _.defaults(opts, {
      dumpId: '1234',
      sequence: 0,
      accountId: "customer_account_id",
      numFiles: 10,
      finished: true,
      expires: Date.now() - SIXTY_DAYS,
      updatedAt: "2015-10-24T00:00:00.000Z",
      createdAt: "2015-10-24T00:00:00.000Z",
      schemaVersion: "1.0.1",
      artifactsByTable: _.keyBy(artifacts, 'tableName')
    });

  },
  buildDumpArtifact(opts) {
    return _.defaults(opts, {
      tableName: 'account_dim',
      partial: false,
      files: [
        {url: 'http://url_to_download/file1.tar.gz', filename: 'file1.tar.gz'}
      ]
    })
  },
  buildDumpHistory(opts) {
    opts = opts || {}
    opts.entryOpts = opts.entryOpts || []
    var numEntries = opts.numEntries || 2
    var entries = _.fill(Array(numEntries), 0).map((v, index) => {
      var entryOpts = _.defaults(opts.entryOpts[index] || {}, {
        sequence: index,
        dumpId: '1234' + index
      })
      return mockApiObjects.buildDumpHistoryEntry(entryOpts)
    })
    return _.defaults(opts, {
      table: 'account_dim',
      history: entries
    })
  },
  buildDumpHistoryEntry(opts) {
    opts = opts || {}
    var numFiles = opts.numFiles || 2
    var files = _.fill(Array(numFiles), 0).map((v, index) => mockApiObjects.buildDumpHistoryFile({filename: `filename-${index}.tar.gz`}))
    return _.defaults(opts, {
      dumpId: '1234',
      sequence: 0,
      files: files,
      partial: false
    })
  },
  buildDumpHistoryFile(opts) {
    return _.defaults(opts, {
      url: 'http://myapi.com/table/filename-1.tar.gz', filename: 'filename-1.tar.gz'
    })
  }

}
