const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const User = require("./userModel");

const Message = sequelize.define(
  "Message",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    senderType: {
      type: DataTypes.ENUM('user', 'admin'),
      allowNull: false,
    },
    receiverId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'),
      defaultValue: 'TEXT',
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // We group conversations by userId. If an admin is chatting, they chat WITH a user.
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users', // using table name
        key: 'id'
      }
    }
  },
  {
    tableName: "messages",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// Define Association
User.hasMany(Message, { foreignKey: 'userId', as: 'messages' });
Message.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = Message;
