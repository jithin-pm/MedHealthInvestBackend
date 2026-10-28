const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ActivityLog = sequelize.define(
  "ActivityLog",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "LOGIN",
    },
    ipAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    device: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    browser: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    os: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "SUCCESS",
    },
    loginTime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "activity_logs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = ActivityLog;
