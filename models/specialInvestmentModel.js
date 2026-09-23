const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const SpecialInvestment = sequelize.define(
  "SpecialInvestment",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    specialProjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'special_projects',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    amountInvested: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    remainingCapital: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    accumulatedInterest: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    paymentId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    orderId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("PENDING", "SUCCESS", "FAILED"),
      allowNull: false,
      defaultValue: "PENDING",
    },
    paybackStatus: {
      type: DataTypes.ENUM("PENDING", "PAID"),
      allowNull: false,
      defaultValue: "PENDING",
    },
  },
  {
    tableName: "special_investments",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = SpecialInvestment;
