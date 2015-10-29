var crypto = require('crypto')
var url = require('url')
var HMAC_ALG = 'sha256'
var apiAuth = {
  buildMessage: function(secret, timestamp, reqOpts) {
    var urlInfo = url.parse(reqOpts.path, true)
    var sortedParams = Object.keys(urlInfo.query).sort(function(a, b) {
      return a.localeCompare(b)
    })
    var sortedParts = []
    for (var i = 0; i < sortedParams.length; i++) {
      var paramName = sortedParams[i]
      sortedParts.push(paramName + '=' + urlInfo.query[paramName])
    }
    var parts = [
      reqOpts.method.toUpperCase(),
      reqOpts.host || '',
      reqOpts.contentType || '',
      reqOpts.contentMD5 || '',
      urlInfo.pathname,
      sortedParts.join('&') || '',
      timestamp,
      secret
    ]
    return parts.join('\n')
  },
  buildHmacSig: function(secret, timestamp, reqOpts) {
    var message = apiAuth.buildMessage(secret, timestamp, reqOpts)
    var hmac = crypto.createHmac(HMAC_ALG, new Buffer(secret))
    hmac.update(message)
    return hmac.digest('base64')
  },
  signRequest: function(key, secret, requestOpts, opts) {
    opts = opts || {}
    var urlInfo = url.parse(requestOpts.url)
    requestOpts.headers = requestOpts.headers || {}
    var dateVal = requestOpts.headers.Date || opts.date || new Date().toUTCString()
    // ensure the date header exists
    requestOpts.headers.Date = dateVal
    var reqOpts = {
      method: requestOpts.method || 'GET',
      path: urlInfo.path,
      host: opts.host || urlInfo.host,
      contentType: apiAuth.determineContentType(requestOpts, opts),
      contentMD5: opts.contentMD5 || (requestOpts.headers && requestOpts.headers['Content-MD5'] ? requestOpts.headers['Content-MD5'] : null),
    }
    var signature = apiAuth.buildHmacSig(secret, dateVal, reqOpts)
    requestOpts.headers.Authorization = 'HMACAuth ' + key + ':' + signature
    return requestOpts
  },
  determineContentType: function(requestOpts, opts) {
    if (opts && opts.contentType) return opts.contentType
    if (requestOpts.form) return 'application/x-www-form-urlencoded'
    if (requestOpts.formData) return 'multipart/form-data'
    if (requestOpts.json && requestOpts.body) return 'application/json'
    if (requestOpts.json && typeof requestOpts.json === 'object') return 'application/json'
    if (requestOpts.body && typeof requestOpts.body === 'string') return 'text/plain'
    if (requestOpts.body && Buffer.isBuffer(requestOpts.body)) return 'application/octet-stream'
    return null
  }
}

module.exports = apiAuth
