const mongoose = require('mongoose');

const GameCatalogEntrySchema = new mongoose.Schema({
  slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80, unique: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  subtitle: { type: String, default: '', trim: true, maxlength: 80 },
  priority: { type: String, default: '후보', trim: true, maxlength: 80 },
  stage: { type: String, enum: ['planned', 'prototype', 'live', 'archived'], default: 'planned', index: true },
  stageLabel: { type: String, default: '이식 후보', trim: true, maxlength: 80 },
  adapter: { type: String, default: 'discussion', trim: true, maxlength: 80 },
  roomSystem: { type: String, enum: ['none', 'game-room', 'twenty-questions'], default: 'none' },
  resultMode: { type: String, default: 'manual', trim: true, maxlength: 80 },
  scope: { type: String, default: '', trim: true, maxlength: 240 },
  summary: { type: String, default: '', trim: true, maxlength: 600 },
  nextStep: { type: String, default: '', trim: true, maxlength: 600 },
  supportsRooms: { type: Boolean, default: false },
  supportsStateSync: { type: Boolean, default: false },
  supportsRecords: { type: Boolean, default: true },
  supportsSaves: { type: Boolean, default: true },
  visible: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 1000, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, {
  timestamps: true,
});

GameCatalogEntrySchema.index({ visible: 1, sortOrder: 1, updatedAt: -1 });

module.exports = mongoose.model('GameCatalogEntry', GameCatalogEntrySchema);
