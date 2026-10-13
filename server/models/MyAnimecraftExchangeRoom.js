const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  createKey: { type: String, required: true, unique: true },
  inviteHash: { type: String, required: true, unique: true },
  memberUserIds: { type: [String], required: true, index: true },
  revision: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
  document: { type: mongoose.Schema.Types.Mixed, required: true },
}, { versionKey: false, minimize: false });
module.exports = mongoose.model('MyAnimecraftExchangeRoom', schema);
