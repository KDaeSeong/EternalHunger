// server/models/Post.js
const mongoose = require('mongoose');

const PostCommentSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  content: { type: String, required: true, trim: true, maxlength: 1200 },
}, { timestamps: true });

/**
 * 🧾 게시판 글(로드맵 8번)
 */
const PostSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  content: { type: String, required: true, trim: true, maxlength: 10000 },
  isNotice: { type: Boolean, default: false, index: true },
  noticePinnedAt: { type: Date, default: null },
  commentCount: { type: Number, default: 0, min: 0 },
  comments: [PostCommentSchema],
}, { timestamps: true });

PostSchema.index({ isNotice: -1, noticePinnedAt: -1, createdAt: -1 });

module.exports = mongoose.model('Post', PostSchema);
