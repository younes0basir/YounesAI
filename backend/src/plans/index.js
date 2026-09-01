const config = require('./config');
const usageService = require('../services/usageService');

module.exports = {
  ...config,
  ...usageService,
};
