const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const SpecialInvestmentLedger = sequelize.define(
  "SpecialInvestmentLedger",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    specialInvestmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'special_investments',
        key: 'id'
      }
    },
    transactionType: {
      type: DataTypes.ENUM("INITIAL_INVESTMENT", "INTEREST_ACCRUED", "PAYOUT_MADE"),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    transactionDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "special_investment_ledgers",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = SpecialInvestmentLedger;
