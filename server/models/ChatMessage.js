// server/models/ChatMessage.js
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  attachments: [{
    filename: String,
    filepath: String,
    mimetype: String,
    size: Number,
  }],
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
