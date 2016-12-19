const assert = require('assert')
const proxyquire = require('proxyquire')

let nextReqHandler = null
function buildMockResp(returnBody, statusCode, cb) {
  process.nextTick(() => {
    cb(null, {statusCode: statusCode}, returnBody)
  })
}
function mockRequest(opts, cb) {
  if (nextReqHandler) return nextReqHandler(opts, cb)
  return buildMockResp({mocked: true}, 200, cb)
}

const Api = proxyquire('../src/Api', {
  request: mockRequest,
  apiAuth: {
    signRequest(key, secret, opts) {
      opts.headers = opts.headers || {}
      opts.headers['Authorization'] = `${key}:${secret}`
      return opts
    }
  }
})

function buildTest(apiObj, endpoint, args, expectedMethod, expectedRoute, expectedParams, cb) {
  if (typeof expectedParams === 'function') {
    cb = expectedParams
    expectedParams = {}
  }
  function mockMakeRequest(method, route, maybeParams, cb) {
    if (typeof maybeParams === 'function') {
      cb = maybeParams
      maybeParams = {}
    }
    assert.equal(method, expectedMethod)
    assert.equal(route, expectedRoute)
    assert.deepEqual(maybeParams, expectedParams)
    cb(null, {mocked: true})
  }
  args.push(cb)
  apiObj.makeRequest = mockMakeRequest.bind(apiObj)
  apiObj[endpoint].apply(apiObj, args)
}

describe('ApiTest', () => {
  describe('buildProxyUrl', () => {
    it('should return null if not httpsProxy', () => {
      assert(Api.prototype.buildProxyUrl({httpsProxy: false}) == null)
    })
    it('should return simple url if a proxy', () => {
      assert.equal(Api.prototype.buildProxyUrl({httpsProxy: 'someplace.com'}), 'https://someplace.com')
    })
    it('should return with username and pass if defined', () => {
      const config = {httpsProxy: 'someplace.com', proxyUsername: 'bob', proxyPassword: 'pass'}
      assert.equal(Api.prototype.buildProxyUrl(config), 'https://bob:pass@someplace.com')
    })
  })
  describe('buildUrl', () => {
    it('should join the api url and query', () => {
      const api = new Api({apiUrl: 'http://myapi.com/api'})
      assert.equal(api.buildUrl('my/fancy/route', {foobar: true}), 'http://myapi.com/api/my/fancy/route?foobar=true')
    })
    it('should handle an extra slash', () => {
      const api = new Api({apiUrl: 'http://myapi.com/api/'})
      assert.equal(api.buildUrl('my/fancy/route', {foobar: true}), 'http://myapi.com/api/my/fancy/route?foobar=true')
    })
    it('should handle preceeding slash', () => {
      const api = new Api({apiUrl: 'http://myapi.com/api/'})
      assert.equal(api.buildUrl('/my/fancy/route', {foobar: true}), 'http://myapi.com/api/my/fancy/route?foobar=true')
    })
  })
  describe('makeRequest', () => {
    it('should return the body of a request with query', (done) => {
      const api = new Api({apiUrl: 'http://myapi.com/api', key: 'foo', secret: 'bar'})
      api.makeRequest('get', 'some/route', {foobar: true}, (err, body) => {
        assert.ifError(err)
        assert.deepEqual(body, {mocked: true})
        done()

      })
    })
    it('should return the body of a request without a query', (done) => {
      const api = new Api({apiUrl: 'http://myapi.com/api', key: 'foo', secret: 'bar'})
      api.makeRequest('get', 'some/route', (err, body) => {
        assert.ifError(err)
        assert.deepEqual(body, {mocked: true})
        done()

      })
    })
    it('should throw errors for non 200 status codes', (done) => {

      nextReqHandler = function(opts, cb) {
        cb(null, {statusCode: 500}, {error: true, message: 'you screwed it up'})
      }
      const api = new Api({apiUrl: 'http://myapi.com/api', key: 'foo', secret: 'bar'})
      api.makeRequest('get', 'some/route', (err, body) => {
        assert(err instanceof Error)
        done()
      })
    })
  })
  describe('getDumps', () => {
    it('should work without params to get index of dumps', (done) => {
      const api = new Api({apiUrl: 'http://myapi.com/api', key: 'foo', secret: 'bar'})
      buildTest(api, 'getDumps', [], 'GET', 'account/self/dump', done)
    })
    it('should work with params and still index of dumps', (done) => {
      const api = new Api({apiUrl: 'http://myapi.com/api', key: 'foo', secret: 'bar'})
      buildTest(api, 'getDumps', [{foobar: true}], 'GET', 'account/self/dump', {foobar: true}, done)
    })
  })
  describe('getLatestFiles', () => {
    it('should make get latest call', (done) => {
      const api = new Api({apiUrl: 'http://myapi.com/api', key: 'foo', secret: 'bar'})
      buildTest(api, 'getLatestFiles', [], 'GET', 'account/self/file/latest', done)
    })
  })
  describe('getFilesForDump', () => {
    it('make a call to get files for a given dump', (done) => {
      const api = new Api({apiUrl: 'http://myapi.com/api', key: 'foo', secret: 'bar'})
      buildTest(api, 'getFilesForDump', [1234], 'GET', 'account/self/file/byDump/1234', done)
    })
  })
  describe('getSync', () => {
    it('should make a sync call', (done) => {
      const api = new Api({apiUrl: 'http://myapi.com/api', key: 'foo', secret: 'bar'})
      buildTest(api, 'getSync', [], 'GET', 'account/self/file/sync', done)
    })
  })
  describe('getFilesForTable', () => {
    it('should work without params and get for a tablename', (done) => {
      const api = new Api({apiUrl: 'http://myapi.com/api', key: 'foo', secret: 'bar'})
      buildTest(api, 'getFilesForTable', ['someTable'], 'GET', 'account/self/file/byTable/someTable', done)
    })
    it('should work with params and get for a tablename', (done) => {
      const api = new Api({apiUrl: 'http://myapi.com/api', key: 'foo', secret: 'bar'})
      buildTest(
        api, 'getFilesForTable', ['someTable', {foobar: true}],
        'GET', 'account/self/file/byTable/someTable', {foobar: true}, done
      )
    })
  })
  describe('getSchemas', () => {
    it('should make a call for all schema', (done) => {
      const api = new Api({apiUrl: 'http://myapi.com/api', key: 'foo', secret: 'bar'})
      buildTest(api, 'getSchemas', [], 'GET', 'schema', done)
    })
  })
  describe('getLatestSchema', () => {
    it('get the latest schema call', (done) => {
      const api = new Api({apiUrl: 'http://myapi.com/api', key: 'foo', secret: 'bar'})
      buildTest(api, 'getLatestSchema', [], 'GET', 'schema/latest', done)
    })
    it('should also would for the type getLastestSchema', (done) => {
      const api = new Api({apiUrl: 'http://myapi.com/api', key: 'foo', secret: 'bar'})
      buildTest(api, 'getLastestSchema', [], 'GET', 'schema/latest', done)
    })
  })
  describe('getSchemaVersion', () => {
    it('should work without to get a specific schema version', (done) => {
      const api = new Api({apiUrl: 'http://myapi.com/api', key: 'foo', secret: 'bar'})
      buildTest(api, 'getSchemaVersion', ['v1.0.0'], 'GET', 'schema/v1.0.0', done)
    })
  })
})
