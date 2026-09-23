const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const SpecialProject = sequelize.define(
  "SpecialProject",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    projectName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    projectCategory: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    targetAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    collectedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    minInvestmentAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 1000.00,
    },
    roi: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    paymentProof: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("ACTIVE", "ONGOING", "COMPLETED", "EXPIRED"),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
    activeDeadline: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ongoingStartDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completionDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    assignedUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
  },
  {
    tableName: "special_projects",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = SpecialProject;
