.PHONY: compile publish installLocal test

# Compile the cli using babel
compile:
	npm install .
	./node_modules/.bin/babel src --out-dir lib/

# Publish compiled cli to npm (Can only be done by npm user addisonj)
publish: compile
	npm publish

# Globally install this version of the cli for testing purposes 
installLocal: compile
	npm install -g --progress=false .

# Run mocha tests with nyc coverage reporting
test:
	npm test
