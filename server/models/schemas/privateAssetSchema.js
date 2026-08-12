const mongoose = require('mongoose');

module.exports = new mongoose.Schema({
  assetClass: { type: String, enum: ['PRIVATE_DOCUMENT'], required: true, default: 'PRIVATE_DOCUMENT' },
  purpose: { type: String, enum: ['identity', 'lease', 'financial', 'conversation', 'maintenance', 'application', 'administrative'], required: true },
  provider: { type: String, enum: ['cloudinary'], required: true, default: 'cloudinary' },
  publicId: { type: String, required: true, select: false },
  resourceType: { type: String, enum: ['image', 'video', 'raw'], required: true, select: false },
  deliveryType: { type: String, enum: ['authenticated'], required: true, default: 'authenticated', select: false },
  version: { type: String, default: '', select: false },
  format: { type: String, default: '', select: false },
  mimeType: { type: String, default: 'application/octet-stream' },
  originalFilename: { type: String, default: '', maxlength: 255 },
  size: { type: Number, min: 0, default: 0 },
}, { _id: false });
