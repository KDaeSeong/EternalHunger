const mongoose = require('mongoose');

const PostBookmarkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
}, { timestamps: true });

PostBookmarkSchema.index({ userId: 1, postId: 1 }, { unique: true });
PostBookmarkSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('PostBookmark', PostBookmarkSchema);
