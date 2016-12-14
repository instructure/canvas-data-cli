FROM instructure/node:latest

USER root
RUN mkdir -p /usr/src/app/report && chown -R docker /usr/src/app
USER docker

ADD package.json package.json
RUN npm install . --ignore-scripts && rm package.json
ADD . /usr/src/app

CMD npm test
