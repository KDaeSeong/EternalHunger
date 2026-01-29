// server/models/Post.js
const mongoose = require('mongoose');

/**
 * 🧾 게시판 글(로드맵 8번)
 */
const PostSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  content: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Post', PostSchema);
