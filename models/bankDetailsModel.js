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
      allowNull: true,
      field: "user_id",
      references: {
        model: 'users',
        key: 'id'
      }
    },
    accountHolderName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "account_holder_name",
    },
    bankAccount: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "account_number",
    },
    ifsc: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "ifsc_code",
    },
    bankName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "bank_name",
    },
    branch: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "branch",
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "city",
    },
    payoutPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "payout_phone",
    },
    status: {
      type: DataTypes.ENUM("pending", "verified", "failed"),
      defaultValue: "pending",
      field: "bank_status",
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
    nameMatchScore: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: "name_match_score",
    },
    ifscDetails: {
      type: DataTypes.JSON,
      allowNull: true,
      field: "ifsc_details",
    },
    verifiedAt: {
      type: DataTypes.DATE,
      field: "verified_at",
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
