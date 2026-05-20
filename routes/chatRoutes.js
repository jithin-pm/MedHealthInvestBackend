const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Upload a file (image, video, document, audio)
router.post('/upload', chatController.uploadFile);

// Get chat history for a specific user
router.get('/messages/:userId', chatController.getMessages);

// Get a list of active chats for the admin dashboard
router.get('/active-chats', chatController.getActiveChats);

// Delete a message for everyone
router.delete('/messages/:messageId', chatController.deleteMessage);

// Get unread message count for a specific user
router.get('/unread-count/:userId', chatController.getUnreadCount);

module.exports = router;
