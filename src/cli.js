var path = require('path')
var fs = require('fs')
var yargs = require('yargs')
var logger = require('./logger')
var Sync = require('./Sync')
var Config = require('./ConfigTask')
var Unpack = require('./Unpack')
var Fetch = require('./Fetch')
var Grab = require('./Grab')
var List = require('./List')
var GetApi = require('./GetApi')
var HistoricalRequests = require('./HistoricalRequests')

var cli = yargs
  .usage('canvasDataCli <command>')
  .demand(1, 'must provide a valid command')
  .option('level', {
    alias: 'l',
    default: 'info',
    describe: `logging level to use, valid levels are ${logger.levels.join(', ')}`,
    type: 'string'
  })
  .command('sync', 'download the latest files from the API', (yargs) => {
    yargs.option('config', {
      alias: 'c',
      demand: true,
      describe: 'the configuration file to use',
      type: 'string'
    })
    .help('help')
  })
  .command('sampleConfig', 'write a sample config file to config.js.sample')
  .command('unpack', 'decompress and merge files into a single file', (yargs) => {
    yargs.option('config', {
      alias: 'c',
      demand: true,
      describe: 'the configuration file to use',
      type: 'string'
    })
    .option('filter', {
      alias: 'f',
      describe: 'list of tables to unpack, ex: -f user_dim account_dim',
      demand: true,
      array: true,
      type: 'string'
    })
    .help('help')
  })
  .command('fetch', 'fetch a single table', (yargs) => {
    yargs.options('config', {
      alias: 'c',
      demand: true,
      describe: 'the configuration file to use',
      type: 'string'
    })
    .option('table', {
      alias: 't',
      describe: 'the table to fetch',
      demand: true,
      type: 'string'
    })
  })
  .command('grab', 'grab one specific dump', (yargs) => {
    yargs.options('config', {
      alias: 'c',
      demand: true,
      describe: 'the configuration file to use',
      type: 'string'
    })
    .option('dump', {
      alias: 'd',
      describe: 'the dump to fetch',
      demand: true,
      type: 'string'
    })
  })
  .command('list', 'list all dumps', (yargs) => {
    yargs.options('config', {
      alias: 'c',
      demand: true,
      describe: 'the configuration file to use.',
      type: 'string'
    }).option('json', {
      alias: 'j',
      describe: 'output in json format',
      demand: false,
      type: 'boolean'
    })
  })
  .command('api', 'submit API GET request', (yargs) => {
    yargs.options('config', {
      alias: 'c',
      demand: true,
      describe: 'the configuration file to use.',
      type: 'string'
    }).option('route', {
      alias: 'r',
      describe: 'route to request',
      demand: true,
      type: 'string'
    }).option('params', {
      alias: 'p',
      desscribe: 'params in JSON form',
      demand: false,
      type: 'string'
    })
  })
  .command('historical-requests', 'show historical requests by date ranges', (yargs) => {
    yargs.options('config', {
      alias: 'c',
      demand: true,
      describe: 'the configuration file to use.',
      type: 'string'
    })
  })
  .help('help')
  .alias('v', 'version')
  .version(() => require('../package').version)
  .describe('v', 'show version information')

var runnerMap = {
  sync: {requireConfig: true, class: Sync},
  sampleConfig: {class: Config},
  unpack: {requireConfig: true, class: Unpack},
  fetch: {requireConfig: true, class: Fetch},
  grab: {requireConfig: true, class: Grab},
  list: {requireConfig: true, class: List},
  api: {requireConfig: true, class: GetApi},
  'historical-requests': {requireConfig: true, class: HistoricalRequests}
}
module.exports = {
  cli: cli,
  run(argv) {
    var command = argv._[0]
    var runner = runnerMap[command]
    var logLevel = argv.l || argv.level
    if (logLevel) {
      logger.setLevel(logLevel)
    }
    if (!runner) {
      logger.error('invalid command')
      cli.showHelp()
      process.exit(1)
    }
    var RunnerClass = runner.class
    var config = {}
    if (runner.requireConfig) {
      var configFile = argv.config
      var configPath = path.resolve(process.cwd(), configFile)
      try {
        fs.statSync(configPath)
      } catch (e) {
        logger.error(`config file at ${configPath} does not exist`)
        process.exit(1)
      }

      config = require(configPath)
      var isInvalidConfig = Config.validate(config)
      if (isInvalidConfig) {
        logger.error(`config at ${configPath} is invalid`)
        logger.error(isInvalidConfig)
        process.exit(1)
      }
    }

    var runner = new RunnerClass(argv, config, logger)
    runner.run((err, showComplete = true) => {
      if (err) {
        logger.error('an error occured')
        logger.error(err)
        if (err.stack && !err.silence) logger.error(err.stack)
        process.exit(1)
      }
      if (showComplete) {
        logger.info(`${command} command completed successfully`)
      }
    })
  }
}
