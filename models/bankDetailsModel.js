const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const BankDetails = sequelize.define(
  "BankDetails",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    accountHolderName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    bankAccount: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    ifsc: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    bankName: {
      type: DataTypes.STRING(255),
    },
    branch: {
      type: DataTypes.STRING(255),
    },
    city: {
      type: DataTypes.STRING(100),
    },
    payoutPhone: {
      type: DataTypes.STRING(20),
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: "PENDING",
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    referenceId: {
      type: DataTypes.STRING(100),
    }
  },
  {
    tableName: "bank_details",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = BankDetails;
