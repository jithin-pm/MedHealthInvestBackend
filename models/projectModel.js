const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Project = sequelize.define(
  "Project",
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
    projectType: {
      type: DataTypes.ENUM("Standard", "Exclusive"),
      allowNull: false,
      defaultValue: "Standard",
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
    duration: {
      type: DataTypes.INTEGER, // in months
      allowNull: false,
    },
    projectImages: {
      type: DataTypes.TEXT, // Storing as JSON string
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
    exclusiveUserId: {
      type: DataTypes.INTEGER,
      field: 'exclusiveUserId',
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
  },
  {
    tableName: "projects",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Project;
