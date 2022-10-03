const { Sequelize } = require('sequelize');
const sequelize = require('./connection');

const ActivityLogs = sequelize.define('activity_logs', {
  created_at: Sequelize.STRING,
  action: Sequelize.STRING,
  request: Sequelize.STRING,
  response: Sequelize.STRING,
  type: Sequelize.STRING,
  shop: Sequelize.STRING
})

module.exports = ActivityLogs
