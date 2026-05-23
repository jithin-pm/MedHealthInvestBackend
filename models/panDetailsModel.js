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
      allowNull: true,
      field: "user_id",
      references: {
        model: 'users',
        key: 'id'
      }
    },
    fullName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "full_name",
    },
    panNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "pan_number",
    },
    dob: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "dob",
    },
    status: {
      type: DataTypes.ENUM("pending", "verified", "failed"),
      defaultValue: "pending",
      field: "pan_status",
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_verified",
    },
    referenceId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "reference_id",
    },
    verifiedAt: {
      type: DataTypes.DATE,
      field: "verified_at",
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
