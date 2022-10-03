const { Sequelize } = require('sequelize');
const sequelize = require('./connection');

const Settings = sequelize.define('settings', {
  account_name: Sequelize.STRING,
  app_key: Sequelize.STRING,
  app_token: Sequelize.STRING,
  seller_id: Sequelize.STRING,
  access_token: Sequelize.STRING,
  shop: Sequelize.STRING,
  shopify_token: Sequelize.STRING,
})

module.exports = Settings
