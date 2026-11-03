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
    retry: {
      match: [
        /read ECONNRESET/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /EPIPE/,
        /PROTOCOL_CONNECTION_LOST/,
        /Connection lost/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ],
      max: 3, // Automatically retry query up to 3 times with a fresh connection
      backoffBase: 1000,
      backoffExponent: 1.5,
    },
    pool: {
      max: 5,         // Max 5 concurrent connections
      min: 0,         // Do not hold idle connections open indefinitely against remote host firewalls
      acquire: 30000, // 30 seconds acquire timeout
      idle: 10000,    // Close idle connections cleanly after 10 seconds before remote drops them
      evict: 5000,    // Check and evict every 5 seconds
    },
    dialectOptions: {
      connectTimeout: 60000,        // 60 seconds connection timeout
      enableKeepAlive: true,        // Keep TCP socket alive across AWS EC2 and remote database
      keepAliveInitialDelay: 5000,  // Send keep-alive packet every 5 seconds
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
