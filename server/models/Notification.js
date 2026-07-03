const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'post_comment',
  'report_status',
  'twenty_question',
  'twenty_answer',
  'twenty_solved',
  'system',
];

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  type: { type: String, enum: NOTIFICATION_TYPES, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, default: '', trim: true, maxlength: 500 },
  link: { type: String, default: '', trim: true, maxlength: 300 },
  readAt: { type: Date, default: null, index: true },
  meta: { type: Object, default: {} },
}, { timestamps: true });

NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
