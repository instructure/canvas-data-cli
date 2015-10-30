# Canvas Data CLI
A small CLI tool for syncing data from the Canvas Data API.

NOTE: this is currently in beta, please report any bugs or issues you find!

## Installing
### Prerequisites
This tool should work on Linux, OSX, and Windows. The tool uses node.js runtime, which you will need to install before being able to use it.
1. Install Node.js - Any version newer than 0.12.0 should work, best bet is to follow the instructions [here](https://nodejs.org/en/download/package-manager/)
### Install via npm
`npm install -g canvas-data-cli`
### Install from github
`git clone https://github.com/instructure/canvas-data-cli.git && cd canvas-data-cli && npm install -g .`
### Configuring
The Canvas Data CLI requires a configuration file with a fields set. Canvas Data CLI uses a small javascript file as configuration file.
To generate a stub of this configuration run `canvasDataCli sampleConfig` which will print out the sample configuration. Safe this to a file, like `config.js`.

Edit the file to point to where you want to save the files as well as the file used to track the state of which data exports you have already downloaded. By default the sample config file
tries to pull your API key and secret from environment variables, `CD_API_KEY` and `CD_API_SECRET`, which is more secure, however, you can also hard code the credentials in the config file.

## Usage
### Syncing
`canvasDataCli sync -c path/to/config.js` will start the sync process. On the first sync, it will look through all the data exports and download only the latest version of any tables that are not
marked as `partial` and will download any files from older exports to complete a partial table.

On subsequent executions, it will check for newest data exports after the last recorded export, delete any old tables if the table is NOT a `partial` table and will append new files for partial tables.

Currently, for plus and pro customers, Canvas Data is updated daily, so running this in a daily cron job should keep your files up to date.

