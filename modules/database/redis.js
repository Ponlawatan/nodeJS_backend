const { createClient } = require('redis');
const chalk = require('chalk');
require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });
const { REDISDATABASEURI } = process.env;


const redis = createClient({ url: REDISDATABASEURI });

module.exports = redis;

