FROM instructure/node:latest

ADD package.json package.json
RUN npm install . --ignore-scripts && rm package.json
ADD . /usr/src/app

CMD npm test
