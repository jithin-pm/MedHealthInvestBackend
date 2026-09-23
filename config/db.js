const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: false, // Set to true to see SQL queries in console
    pool: {
      max: 10,
      min: 0,
      acquire: 60000, // 60 seconds acquire timeout
      idle: 10000,
    },
    dialectOptions: {
      connectTimeout: 60000, // 60 seconds connection timeout
    },
  }
);

sequelize
  .authenticate()
  .then(() => {
    console.log("MySQL Connected with Sequelize...");
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err.message || err);
  });

module.exports = sequelize;