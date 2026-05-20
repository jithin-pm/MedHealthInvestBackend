const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Enquiry = sequelize.define('Enquiry', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  fullname: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  countryCode: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  enquiryType: {
    type: DataTypes.ENUM('General', 'Exclusive'),
    allowNull: false,
    defaultValue: 'General'
  }
}, {
  timestamps: true
});

module.exports = Enquiry;
