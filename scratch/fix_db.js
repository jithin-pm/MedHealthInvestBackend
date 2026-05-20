const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
  }
);

async function checkAndFix() {
  try {
    await sequelize.authenticate();
    console.log("Connected to database.");

    // Check if column exists
    const [results] = await sequelize.query("SHOW COLUMNS FROM projects LIKE 'exclusiveUserId'");
    
    if (results.length === 0) {
      console.log("Column exclusiveUserId does not exist. Adding it...");
      await sequelize.query("ALTER TABLE projects ADD COLUMN exclusiveUserId INT NULL REFERENCES users(id)");
      console.log("Column added successfully.");
    } else {
      console.log("Column exclusiveUserId already exists.");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkAndFix();
