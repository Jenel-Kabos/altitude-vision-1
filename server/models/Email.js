const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  emailType: {
    type: String,
    enum: ['Contact Général', 'Devis & Commercial', 'Support Technique', 'Administration', 'Marketing', 'Événementiel', 'Immobilier', 'Personnel', 'Autre'],
    default: 'Contact Général'
  },
  description: String,
  isActive: {
    type: Boolean,
    default: true
  },
  notifications: {
    quotes: { type: Boolean, default: false },
    contactMessages: { type: Boolean, default: false },
    systemAlerts: { type: Boolean, default: false },
    properties: { type: Boolean, default: false },
    events: { type: Boolean, default: false }
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // NOUVEAUX CHAMPS
  emailsSent: {
    type: Number,
    default: 0
  },
  lastEmailSent: Date,
  zohoAccountId: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Email', emailSchema);