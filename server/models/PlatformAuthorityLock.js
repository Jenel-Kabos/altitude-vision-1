const mongoose = require('mongoose');

// Singleton Mongo sentinel used only to serialize mutations that may reduce
// platform-administrator viability. It carries no authorization data.
const schema = new mongoose.Schema({
  _id: { type: String, default: 'platform-authority' },
  revision: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('PlatformAuthorityLock', schema);
