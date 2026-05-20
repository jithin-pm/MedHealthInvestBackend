const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const PanDetails = sequelize.define(
  "PanDetails",
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
    fullName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    panNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    dob: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: "VERIFIED",
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
    tableName: "pan_details",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = PanDetails;
