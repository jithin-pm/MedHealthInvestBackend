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
      max: 5,         // Max 5 concurrent connections (prevents exhausting host limits)
      min: 2,         // Keep at least 2 persistent connections alive (avoids creating new connections on every request)
      acquire: 30000, // 30 seconds acquire timeout
      idle: 300000,   // 5 minutes (300,000 ms) idle timeout (prevents rapid connect/disconnect cycling)
      evict: 60000,   // Eviction check once every 60 seconds
    },
    dialectOptions: {
      connectTimeout: 60000,        // 60 seconds connection timeout
      enableKeepAlive: true,         // Keep TCP socket alive across AWS EC2 and remote database
      keepAliveInitialDelay: 10000, // Send keep-alive packet every 10 seconds
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
