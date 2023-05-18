const { Sequelize } = require('sequelize');
var {dbSettings} = require('../shared/constants');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  dialect: dbSettings.dialect
});

module.exports = sequelize