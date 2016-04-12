compile:
	npm install .
	./node_modules/.bin/babel src --out-dir lib/
publish: compile
	npm publish
installLocal: compile
	npm install -g --progress=false .
