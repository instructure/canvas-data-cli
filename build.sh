#!/bin/sh

set -e
mkdir -p report
chmod -R 777 report || true

docker build -t canvas-data-cli:ci .
docker run -v $(pwd)/report:/usr/src/app/report --rm canvas-data-cli:ci
