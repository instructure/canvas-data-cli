const os = require('os')
const fs = require('fs')
const path = require('path')
const gzip = require('zlib')
const {Transform} = require('stream')

const async = require('async')
const chai = require('chai')
const assert = chai.assert
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')

const logger = require('./fixtures/mockLogger')

const Unpack = require('../src/Unpack')

const tmpdir = path.join(os.tmpdir(), 'unpack')

function buildFile(prefix, rowCount, colCount, lastNewline) {
  const f = [...Array(rowCount).keys()].map((i) => {
    return [...Array(colCount).keys()].map((j) => prefix + i.toString() + j.toString()).join('\t')
  }).join('\n')
  if (lastNewline) return f + '\n'
  return f
}

function buildTable(colCount) {
  const cols = [...Array(colCount).keys()].map((i) => {
    const charCode = 65 + (i % 26)
    return {name: String.fromCharCode(charCode)}
  })
  return {columns: cols}
}

function getTableHeader(table) {
  return table.columns.map((e) => e.name).join('\t')
}

function buildFileName(num, max) {
  let numLen = max.toString().length
  let zeroes = [...Array(numLen).keys()].map(() => '0').join('')
  return (zeroes + num.toString()).slice(-numLen)
}
function buildTest(tmpDir, fileCount, rowsPerFile, colCount, lastNewline, cb) {
  if (typeof lastNewline === 'function') {
    cb = lastNewline
    lastNewline = true
  }
  const toCreate = [...Array(fileCount).keys()].map((el) => {
    return {i: el, n: path.join(tmpDir, `${buildFileName(el, fileCount)}.gz`)}
  })
  mkdirp(tmpDir, (err) => {
    if (err) return cb(err)
    async.map(toCreate, (fn, cb) => {
      const contents = buildFile(fn.i, rowsPerFile, colCount, lastNewline)
      gzip.gzip(contents, (err, res) => {
        if (err) return cb(err)
        fs.writeFile(fn.n, res, (err) => {
          if (err) return cb(err)
          cb(null, contents)
        })
      })
    }, (err, res) => {
      if (err) return cb(err)
      const table = buildTable(colCount)
      const withNewline = res.map((r) => {
        if (r.charAt(r.length - 1) !== '\n') return r + '\n'
        return r
      })
      const contents = getTableHeader(table) + '\n' + withNewline.join('')
      cb(null, {table, contents})
    })
  })
}

function assertStream(s, expected, cb) {
  let c = ''
  s.on('data', (n) => {
    c += n
    //console.log('hello', n.toString('utf8'))
  })
  s.on('end', () => {
    assert.equal(c, expected)
    cb()
  })
}

function testStream() {
  return new Transform({
    transform(chunk, enc, cb) {
      cb(null, chunk)
    }
  })
}

let toDelete = null
describe('Unpack', () => {
  afterEach((done) => {
    if (!toDelete) return done()
    rimraf(toDelete, done)
  })
  describe('loadSchema', () => {
    let unpack = new Unpack({}, {saveLocation: 'fake', unpackLocation: 'fake2'}, logger)
    it('should work to load a schema', (done) => {
      unpack.schemaLocation = path.join(__dirname, './fixtures/mockSchema.json')
      unpack.loadSchema((err, schema) => {
        assert.ifError(err)
        assert(schema.fakeSchema)
        done()
      })
    })
    it('should throw an error if no schema', (done) => {
      unpack.schemaLocation = path.join(__dirname, './fixtures/missing')
      unpack.loadSchema((err, schema) => {
        assert(err instanceof Error)
        done()
      })
    })
  })
  describe('addTitleAndUnzip', () => {
    const schema = {
      schema: {
        one: {
          tableName: 'one',
          columns: [
            {name: "id"},
            {name: "type"},
            {name: "name"}
          ]
        },
        two: {
          tableName: 'two',
          columns: [
            {name: "letter"},
            {name: "type"}
          ]
        },
        three: {
          tableName: 'three',
          columns: [
            {name: "sound"}
          ]
        }
      }
    }
    it('should exit early if nothing matches', (done) => {
      let unpack = new Unpack({filter: []}, {saveLocation: 'fake', unpackLocation: 'fake2'}, logger)
      unpack.addTitleAndUnzip(schema, 'fake', 'fake', (err, res) => {
        assert.ifError(err)
        assert(res == null)
        done()
      })
    })
    it('should write out files to where we expect', (done) => {
      const d = path.join(tmpdir, 'full')
      toDelete = d
      const mockDump = path.join(__dirname, './fixtures/mockDump')
      let unpack = new Unpack({filter: ['one', 'two']}, {saveLocation: mockDump, unpackLocation: d}, logger)
      mkdirp(d, (err) => {
        assert.ifError(err)
        unpack.addTitleAndUnzip(schema, mockDump, d, (err) => {
          assert.ifError(err)
          fs.readFile(path.join(d, 'one.txt'), 'utf8', (err, out) => {
            assert.ifError(err)
            assert.equal(out, 'id\ttype\tname\n1\tfoo\tbob\n2\tbar\tsteve\n')
            fs.readFile(path.join(d, 'two.txt'), 'utf8', (err, out) => {
              assert.ifError(err)
              assert.equal(out, 'letter\ttype\na\tcat\nb\tdog\n')
              fs.access(path.join(d, 'three.txt'), fs.F_OK, (err) => {
                assert(err instanceof Error)
                done()
              })
            })
          })
        })
      })
    })

  })
  describe('processTable', function() {
    this.timeout(4000)
    let unpack = new Unpack({}, {saveLocation: 'fake', unpackLocation: 'fake2'}, logger)
    it('should handle a single file', (done) => {
      const d = path.join(tmpdir, 'single')
      toDelete = d
      buildTest(d, 1, 3, 3, (err, test) => {
        if (err) return done(err)
        let output = testStream()
        assertStream(output, test.contents, done)
        unpack.processTable(test.table, d, output, (err) => {
          if (err) return done(err)
        })
      })
    })
    it('should handle multiple files', (done) => {
      const d = path.join(tmpdir, 'multiple')
      toDelete = d
      buildTest(d, 3, 3, 3, (err, test) => {
        if (err) return done(err)
        let output = testStream()
        assertStream(output, test.contents, done)
        unpack.processTable(test.table, d, output, (err) => {
          if (err) return done(err)
        })
      })
    })
    it('should handle large files', (done) => {
      const d = path.join(tmpdir, 'large')
      toDelete = d
      buildTest(d, 3, 30000, 3, (err, test) => {
        if (err) return done(err)
        let output = testStream()
        assertStream(output, test.contents, done)
        unpack.processTable(test.table, d, output, (err) => {
          if (err) return done(err)
        })
      })
    })
    it('should handle lots of files', (done) => {
      const d = path.join(tmpdir, 'many')
      toDelete = d
      buildTest(d, 100, 3, 3, (err, test) => {
        if (err) return done(err)
        let output = testStream()
        assertStream(output, test.contents, done)
        unpack.processTable(test.table, d, output, (err) => {
          if (err) return done(err)
        })
      })
    })
    it('should handle a wide file', (done) => {
      const d = path.join(tmpdir, 'wide')
      toDelete = d
      buildTest(d, 3, 30, 300, (err, test) => {
        if (err) return done(err)
        let output = testStream()
        assertStream(output, test.contents, done)
        unpack.processTable(test.table, d, output, (err) => {
          if (err) return done(err)
        })
      })
    })
    it('should handle if last line of file is not newline terminated', (done) => {
      const d = path.join(tmpdir, 'newline')
      toDelete = d
      buildTest(d, 10, 3, 3, false, (err, test) => {
        if (err) return done(err)
        let output = testStream()
        assertStream(output, test.contents, done)
        unpack.processTable(test.table, d, output, (err) => {
          if (err) return done(err)
        })
      })

    })
  })
  describe('run', () => {
    it('should ensure the unpack location is created', (done) => {
      const d = path.join(tmpdir, 'run')
      let unpack = new Unpack({}, {saveLocation: 'fake', unpackLocation: d}, logger)
      unpack.loadSchema = function(cb) { cb(null, {mocked: true}) }
      unpack.addTitleAndUnzip = function(s, sourceDir, outDir, cb) { cb() }
      unpack.run((err) => {
        assert.ifError(err)
        fs.access(d, fs.F_OK, (err) => {
          assert.ifError(err)
          done()
        })
      })
    })
  })
})
