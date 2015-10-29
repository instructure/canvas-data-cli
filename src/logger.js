
var levels = ['debug', 'info', 'warn', 'log', 'error']
class Logger {
  constructor(level) {
    this._level = level
  }
  setLevel(level) {
    this._level = level
  }
  levelIndex(level) {
    return levels.indexOf(level)
  }
  shouldLog(level) {
    return this.levelIndex(level) >= this.levelIndex(this._level)
  }
  logIt(level, ...args) {
    if (this.shouldLog(level)) {
      if (console[level]) {
        console[level](...args)
      } else {
        console.log(...args)
      }
    }
  }
}

function makeLogger(level) {
  return function(...args) {
    this.logIt(level, ...args)
  }
}
for (var level of levels) {
  Logger.prototype[level] = makeLogger(level)
}
Logger.prototype.levels = levels
module.exports = new Logger('info')
