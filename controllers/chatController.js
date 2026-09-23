const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Message = require('../models/messageModel');
const User = require('../models/userModel');
const { Op } = require('sequelize');
const pkg = require("agora-token");
const { RtcTokenBuilder, RtcRole } = pkg;

// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads/chat');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage }).single('file');

exports.uploadFile = (req, res) => {
  upload(req, res, function (err) {
    if (err) {
      console.error('File upload error:', err);
      return res.status(500).json({ message: 'File upload failed', error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Return the URL to access the file
    const fileUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/uploads/chat/${req.file.filename}`;
    res.status(200).json({ url: fileUrl });
  });
};

exports.getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Fetch all messages for this user (which forms the chat room)
    const messages = await Message.findAll({
      where: { userId },
      order: [['id', 'ASC']]
    });

    res.status(200).json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Failed to fetch messages', error: String(error), stack: error.stack });
  }
};

exports.getActiveChats = async (req, res) => {
  try {
    // For admin sidebar: get distinct users who have sent or received messages
    const usersWithMessages = await Message.findAll({
      attributes: ['userId'],
      group: ['userId'],
    });
    
    const userIds = usersWithMessages.map(m => m.userId);

    const activeUsers = await User.findAll({
      where: {
        id: {
          [Op.in]: userIds
        }
      },
      attributes: ['id', 'fullName', 'email']
    });

    // Fetch last message and unread count for each user
    const usersWithLastMsg = await Promise.all(activeUsers.map(async (user) => {
      const lastMsg = await Message.findOne({
        where: { userId: user.id },
        order: [['created_at', 'DESC']]
      });

      const unreadCount = await Message.count({
        where: {
          userId: user.id,
          senderType: 'user',
          isRead: false
        }
      });

      return {
        ...user.toJSON(),
        unreadCount,
        lastMessage: lastMsg ? {
          content: lastMsg.content,
          type: lastMsg.type,
          createdAt: lastMsg.created_at
        } : null
      };
    }));

    // Sort users by last message time
    usersWithLastMsg.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt) : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt) : 0;
      return timeB - timeA;
    });

    res.status(200).json({ users: usersWithLastMsg });
  } catch (error) {
    console.error('Error fetching active chats:', error);
    res.status(500).json({ message: 'Failed to fetch active chats', error: error.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    await message.destroy();
    res.status(200).json({ message: 'Message deleted', messageId: Number(messageId) });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ message: 'Failed to delete message', error: error.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.params;
    const count = await Message.count({
      where: {
        userId,
        senderType: 'admin',
        isRead: false
      }
    });
    res.status(200).json({ unreadCount: count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Failed to fetch unread count', error: error.message });
  }
};

exports.generateAgoraToken = async (req, res) => {
  try {
    const { channelName, uid } = req.query;
    if (!channelName) {
      return res.status(400).json({ message: "Channel name is required" });
    }

    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      return res.status(500).json({ message: "Agora credentials are not configured on the server" });
    }

    const numericUid = uid ? Number(uid) : 0;
    const role = RtcRole.PUBLISHER;
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      numericUid,
      role,
      privilegeExpiredTs,
      privilegeExpiredTs
    );

    res.status(200).json({
      status: "success",
      data: {
        token,
        appId
      }
    });
  } catch (err) {
    console.error("Agora Token Generation Error:", err);
    res.status(500).json({ message: "Failed to generate calling token" });
  }
};

