// server/routes/posts.js
// 게시판(로드맵 8번)
// - 조회(GET)은 공개
// - 작성/수정/삭제는 로그인 필요

const express = require('express');
const router = express.Router();

const Post = require('../models/Post');
const { verifyToken } = require('../middleware/authMiddleware');

// =========================
// ✅ 목록 조회 (공개)
// GET /api/posts
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find({}).sort({ createdAt: -1 }).lean();
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게시글 로드 실패' });
  }
});

// =========================
// ✅ 단건 조회 (공개)
// GET /api/posts/:id
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).lean();
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게시글 조회 실패' });
  }
});

// =========================
// ✅ 작성 (로그인 필요)
// POST /api/posts
router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
    }

    const post = await Post.create({
      authorId: req.user.id,
      title: String(title).trim(),
      content: String(content).trim(),
    });

    res.json({ message: '작성 완료', post });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게시글 작성 실패' });
  }
});

// =========================
// ✅ 수정 (로그인 + 작성자만)
// PUT /api/posts/:id
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { title, content } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

    if (String(post.authorId) !== String(req.user.id)) {
      return res.status(403).json({ error: '작성자만 수정할 수 있습니다.' });
    }

    if (typeof title === 'string') post.title = title.trim();
    if (typeof content === 'string') post.content = content.trim();
    await post.save();

    res.json({ message: '수정 완료', post });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게시글 수정 실패' });
  }
});

// =========================
// ✅ 삭제 (로그인 + 작성자만)
// DELETE /api/posts/:id
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

    if (String(post.authorId) !== String(req.user.id)) {
      return res.status(403).json({ error: '작성자만 삭제할 수 있습니다.' });
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: '삭제 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게시글 삭제 실패' });
  }
});

module.exports = router;
