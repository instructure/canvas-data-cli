#!/bin/sh

docker build -t canvas-data-cli:ci .
docker run --rm canvas-data-cli:ci
