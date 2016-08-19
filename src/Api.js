var apiAuth = require('./apiAuth')
var url = require('url')
var path = require('path')
var request = require('request')
var _ = require
const GET = 'GET'
class ApiError extends Error {
  constructor(msg, errorCode, resp) {
    super(msg)
    this.errorCode = errorCode
    this.resp = resp
  }
}

class Api {
  constructor(config) {
    this.apiUrl = config.apiUrl
    this.apiKey = config.key
    this.apiSecret = config.secret
    if(config.httpsProxy) {
      if(config.proxyUsername) {
        this.proxyUrl = `https://${config.proxyUsername}:${config.proxyPassword}@${config.httpsProxy}`
      }else {
        this.proxyUrl = `https://${config.httpsProxy}`
      }
    }
  }
  buildUrl(route, query) {
    var urlInfo = url.parse(this.apiUrl)
    urlInfo.pathname = path.posix.join(urlInfo.pathname, route)
    urlInfo.query = query
    return url.format(urlInfo)
  }
  makeRequest(method, route, query, cb) {
    if (typeof query === 'function') {
      cb = query
      query = null
    }
    var reqOpts = {
      method: method,
      url: this.buildUrl(route, query),
      json: true
    }
    if(this.proxyUrl) {
      reqOpts.proxy = this.proxyUrl
    }
    request(apiAuth.signRequest(this.apiKey, this.apiSecret, reqOpts), (err, resp, body) => {
      if (err) return cb
      if (resp.statusCode !== 200) {
        var message = body
        if (typeof body === 'object') {
          message = JSON.stringify(body, 0, 2)
        }
        return cb(new ApiError(`invalid status code, got ${resp.statusCode}: ${message}`, resp.statusCode, body))
      }
      cb(null, body)
    })
  }
  getDumps(params, cb) {
    if (typeof params === 'function') {
      cb = params
      params = {}
    }
    this.makeRequest(GET, 'account/self/dump', params, cb)
  }
  getLatestFiles(cb) {
    this.makeRequest(GET, 'account/self/file/latest', cb)
  }
  getFilesForDump(dumpId, cb) {
    this.makeRequest(GET, `account/self/file/byDump/${dumpId}`, cb)
  }
  getSync(cb) {
    this.makeRequest(GET, `account/self/file/sync`, cb)
  }
  getFilesForTable(tableName, params, cb) {
    if (typeof params === 'function') {
      cb = params
      params = {}
    }
    this.makeRequest(GET, `account/self/file/byTable/${tableName}`, params, cb)
  }
  getSchemas(cb) {
    this.makeRequest(GET, `schema`, cb)
  }
  getLastestSchema(cb) {
    this.makeRequest(GET, 'schema/latest', cb)
  }
  getSchemaVersion(version, cb) {
    this.makeRequest(GET, `schema/${version}`, cb)
  }
}

module.exports = Api
