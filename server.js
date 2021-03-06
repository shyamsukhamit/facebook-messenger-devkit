/* eslint-env node */
'use strict';

const EventEmitter = require('events');
const express = require('express');

const app = express();
app.set('port', process.env.PORT || 3000);

app.get('/', (req, res) => {
  res.send('this works as expected!');
})

app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === process.env.MESSENGER_VALIDATION_TOKEN) {
    log.info('[src/app] Validating webhook!');

    res.status(200).send(req.query['hub.challenge']);
  } else {
    log.info('[src/app] Error. Make sure the validation tokens match.');
    res.sendStatus(403);
  }
});

class SSE extends EventEmitter {}
const proxyEmitter = new SSE();
proxyEmitter.setMaxListeners(1);

app.post('/webhook', (req, res) => {
  const data = req.body;
  // Make sure this is a page subscription
  if (data.object === 'page') {
    proxyEmitter.emit('msg', data);

    // timeout here = 20sec
    res.sendStatus(200);
  }
});

// forward messages down to subscribed clients
app.get('/eventsource', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control':'no-cache',
    'Connection': 'keep-alive'
  });
  console.log('Client connected to eventsoruce');

  // workaround for Heroku: https://devcenter.heroku.com/articles/request-timeout
  setInterval(() => {
    res.write('ping \n\n');
  }, 1000);

  proxyEmitter.on('msg', data => {
    res.write(`event:msg\ndata: ${JSON.stringify(data)}\n\n`);
  });

  res.socket.on('close', () => {
    console.log('Client has left');
  });
});

app.all('/*', (req, res) => {
  res.json({
    status: 404,
    message: `No endpoint exists at ${req.originalUrl}`
  });
});

app.listen(process.env.PORT || 5000)
