const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const SpecialPayout = sequelize.define(
  "SpecialPayout",
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
    capitalPaid: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    roiPaid: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    totalPaid: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    paybackProof: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("PENDING", "PAID"),
      allowNull: false,
      defaultValue: "PENDING",
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "special_payouts",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = SpecialPayout;
