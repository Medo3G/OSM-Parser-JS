const express = require('express');
const axios = require('axios');
const parser = require('./parser.js');

const app = express();

app.get('/', (req, res) => {
  if (req.query.left === undefined
    || req.query.right === undefined
    || req.query.top === undefined
    || req.query.bottom === undefined) {
    return res.status(400).json({ error: 'Missing query paramters' });
  }
  const baseURL = 'https://api.openstreetmap.org/';
  const {
    left, right, bottom, top,
  } = req.query;

  return axios.get(`${baseURL}/api/0.6/map?bbox=${left},${bottom},${right},${top}`, { responseType: 'text' })
    .then(response => (res.json(parser.parse(response.data))))
    .catch(err => (res.status(400).json({ error: err.response.data })));
});

app.listen(3000);
