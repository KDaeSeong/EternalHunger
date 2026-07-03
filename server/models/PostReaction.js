const mongoose = require('mongoose');

const PostReactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
}, { timestamps: true });

PostReactionSchema.index({ userId: 1, postId: 1 }, { unique: true });
PostReactionSchema.index({ postId: 1, createdAt: -1 });

module.exports = mongoose.model('PostReaction', PostReactionSchema);
