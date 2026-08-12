const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const serverless = require('serverless-http');
const app = require('../../src/app');

exports.handler = serverless(app);