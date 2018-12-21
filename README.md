# Canvas Data CLI
A small CLI tool for syncing data from the Canvas Data API.

NOTE: this is currently in beta, please report any bugs or issues you find!

## Installing
### Prerequisites
This tool should work on Linux, OSX, and Windows. The tool uses node.js runtime, which you will need to install before being able to use it.
1. Install Node.js - Any version newer than 6.0 should work, best bet is to follow the instructions [here](https://nodejs.org/en/download/package-manager/)
### Install via npm
`npm install -g canvas-data-cli`
### OR Install from github
`git clone https://github.com/instructure/canvas-data-cli.git && cd canvas-data-cli && make installLocal`
### Configuring
The Canvas Data CLI requires a configuration file with a fields set. Canvas Data CLI uses a small javascript file as configuration file.
To generate a stub of this configuration run `canvasDataCli sampleConfig` which will create a `config.js.sample` file. Rename this to a file, like `config.js`.

Edit the file to point to where you want to save the files as well as the file used to track the state of which data exports you have already downloaded. By default the sample config file
tries to pull your API key and secret from environment variables, `CD_API_KEY` and `CD_API_SECRET`, which is more secure, however, you can also hard code the credentials in the config file.

#### Configuring an HTTP Proxy

canvas-data-cli has support for HTTP Proxies, both with and without basic authentication. To do this there
are three extra options you can add to your config file. `httpsProxy`, `proxyUsername`, and `proxyPassword`.

| Config Option | Value                                                                                   |
|:--------------|:----------------------------------------------------------------------------------------|
| httpsProxy    | the `host:port` of the https proxy. Ideally it'd look like: `https_proxy_stuff.com:433` |
| proxyUsername | the basic auth username for the https proxy.                                            |
| proxyPassword | the basic auth password for the https proxy.                                            |

## Usage

### Syncing

If you want to simply download all the data from Canva Data, the `sync` command can be used to keep an up-to-date copy locally.

```Shell
canvasDataCli sync -c path/to/config.js
```

This will start the sync process. The sync process uses the `sync` api endpoint to get a list of all the files. If the file does

not exist, it will download it. Otherwise, it will skip the file. After downloading all files, it will delete any unexpected files

in the directory to remove old data.

On subsequent executions, it will only download the files it doesn't have.

This process is also resumeable, if for whatever reason you have issues, it should restart and download only the files

that previously failed. One of the ways to make this more safe is that it downloads the file to a temporary name and

renames it once the process is finished. This may leave around `gz.tmp` files, but they should get deleted automatically once

you have a successful run.

If you run this daily, you should keep all of your data from Canvas Data up to date.

### Fetch

Fetches most up to date data for a single table from the API. This ignores any previously downloaded files and will redownload all the files associated with that table.

```Shell
canvasDataCli fetch -c path/to/config.js -t user_dim
```

This will start the fetch process and download what is needed to get the most recent data for that table (in this case, the `user_dim`).

On subsequent executions, this will redownload all the data for that table, ignoring any previous days data.

### Unpack

*NOTE*: This only works after properly running a `sync` command

This command will unpack the gzipped files, concat any partitioned files, and add a header to the output file

```Shell
canvasDataCli unpack -c path/to/config.js -f user_dim,account_dim
```

This command will unpack the user_dim and account_dim tables to a directory. Currently, you explictly have to give the files you want to unpack
as this has the potential for creating very large files.


## Developing

Development should be done in Node v8 or greater to take advantage of new node.js and npm standards

Process:
1. Write some code
2. Write tests
3. Open a pull request

### Running tests

#### In Docker

If you use docker, you can run tests inside a docker container
```Shell
./build.sh
```

#### Native

```Shell
npm install .
npm test
```
