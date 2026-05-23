const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fullName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    gender: {
      type: DataTypes.STRING(50),
    },
    mobileNumber: {
      type: DataTypes.STRING(20),
    },
    countryCode: {
      type: DataTypes.STRING(10),
    },
    role: {
      type: DataTypes.STRING(50),
      defaultValue: "user",
    },
    lastSeen: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    bankName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    accountNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    ifscCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    accountHolderName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isBankVerified: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },
    isPanVerified: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    }
  },
  {
    tableName: "users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = User;
