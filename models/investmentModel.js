const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Investment = sequelize.define(
  "Investment",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    projectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'projects',
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
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
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
    paybackProof: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "investments",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Investment;
