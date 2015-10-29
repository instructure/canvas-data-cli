var fs = require('fs')
var path = require('path')
class StateStore {
  constructor(config) {
    this.stateFile = path.resolve(process.cwd(), config.stateFile)
  }
  load(cb) {
    fs.stat(this.stateFile, (err) => {
      if (err) return cb(null, {})
      fs.readFile(this.stateFile, (err, data) => {
        if (err) return cb(err)
        var jsonStr = data.toString("utf8")
        var state = null
        try {
          state = JSON.parse(jsonStr)
        } catch (e) {
          return cb(new Error('state file is invalid ' + e.message))
        }
        cb(null, state)
      })
    })
  }
  save(state, cb) {
    fs.writeFile(this.stateFile, JSON.stringify(state, 0, 2), cb)
  }
}
module.exports = StateStore
