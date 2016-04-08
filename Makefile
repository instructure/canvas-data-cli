compile:
	babel src --out-dir lib/
publish: compile
	npm publish
