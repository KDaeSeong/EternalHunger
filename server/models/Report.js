const mongoose = require('mongoose');

const REPORT_REASONS = ['spam', 'abuse', 'spoiler', 'offtopic', 'other'];
const REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'];

const ReportSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetType: { type: String, enum: ['post', 'comment', 'user'], required: true, index: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null, index: true },
  commentId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  reason: { type: String, enum: REPORT_REASONS, default: 'other', index: true },
  detail: { type: String, default: '', trim: true, maxlength: 1000 },
  status: { type: String, enum: REPORT_STATUSES, default: 'open', index: true },
  adminNote: { type: String, default: '', trim: true, maxlength: 1000 },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  handledAt: { type: Date, default: null },
  targetSnapshot: {
    title: { type: String, default: '' },
    excerpt: { type: String, default: '' },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    authorName: { type: String, default: '' },
    url: { type: String, default: '' },
  },
}, { timestamps: true });

ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ reporterId: 1, targetType: 1, postId: 1, commentId: 1, status: 1 });
ReportSchema.index({ reporterId: 1, targetType: 1, targetUserId: 1, status: 1 });

module.exports = mongoose.model('Report', ReportSchema);
