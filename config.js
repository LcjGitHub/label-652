const path = require('path');
const config = require('./config.json');

config.database = {
  path: path.join(__dirname, 'backend', 'products.db')
};

module.exports = config;
