const express = require('express');
const router = express.Router();

const Post = require('../models/Post');
const User = require('../models/User');
const { verifyToken } = require('../middleware/authMiddleware');
const { createNotification } = require('../utils/notifications');

const POST_LIST_LIMIT = 100;
const POST_PREVIEW_LENGTH = 160;
const POST_CATEGORIES = Post.POST_CATEGORIES || ['free', 'guide', 'feedback', 'bug', 'simulation', 'game'];
const CATEGORY_LABELS = {
  free: '자유',
  guide: '공략',
  feedback: '피드백',
  bug: '버그',
  simulation: '시뮬레이션',
  game: '게임',
};

function normalizeId(value) {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value?.toHexString === 'function') return value.toHexString();
  if (value?._id && value._id !== value) return normalizeId(value._id);
  if (value?.id && value.id !== value) return normalizeId(value.id);
  if (value?.$oid) return String(value.$oid);
  if (typeof value?.toString === 'function') return value.toString();
  return '';
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeCategory(value) {
  const category = cleanText(value, 40);
  return POST_CATEGORIES.includes(category) ? category : 'free';
}

function normalizeCategoryFilter(value) {
  const category = cleanText(value, 40);
  return POST_CATEGORIES.includes(category) ? category : '';
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function userSummary(user) {
  if (!user || typeof user !== 'object') return null;
  return {
    _id: normalizeId(user),
    username: user.username || '',
    nickname: user.nickname || '',
  };
}

function displayName(user) {
  return String(user?.nickname || user?.username || '익명').trim() || '익명';
}

async function requireAdminUser(req, res) {
  const user = await User.findById(req.user.id).select('isAdmin').lean();
  if (!user?.isAdmin) {
    res.status(403).json({ error: '관리자만 사용할 수 있습니다.' });
    return null;
  }
  return user;
}

function serializeComment(comment) {
  return {
    _id: normalizeId(comment),
    authorId: userSummary(comment?.authorId),
    authorName: displayName(comment?.authorId),
    content: comment?.content || '',
    createdAt: comment?.createdAt || null,
    updatedAt: comment?.updatedAt || null,
  };
}

function serializePostDetail(post) {
  const comments = Array.isArray(post?.comments) ? post.comments : [];
  return {
    _id: normalizeId(post),
    authorId: userSummary(post?.authorId),
    authorName: displayName(post?.authorId),
    category: normalizeCategory(post?.category),
    categoryLabel: CATEGORY_LABELS[normalizeCategory(post?.category)] || CATEGORY_LABELS.free,
    title: post?.title || '',
    content: post?.content || '',
    contentPreview: cleanText(post?.content, POST_PREVIEW_LENGTH),
    isNotice: Boolean(post?.isNotice),
    noticePinnedAt: post?.noticePinnedAt || null,
    commentCount: Number(post?.commentCount ?? comments.length ?? 0),
    comments: comments.map(serializeComment),
    createdAt: post?.createdAt || null,
    updatedAt: post?.updatedAt || null,
  };
}

function serializePostSummary(post, author) {
  return {
    _id: normalizeId(post),
    authorId: userSummary(author || post?.authorId),
    authorName: displayName(author || post?.authorId),
    category: normalizeCategory(post?.category),
    categoryLabel: CATEGORY_LABELS[normalizeCategory(post?.category)] || CATEGORY_LABELS.free,
    title: post?.title || '',
    contentPreview: post?.contentPreview || '',
    isNotice: Boolean(post?.isNotice),
    noticePinnedAt: post?.noticePinnedAt || null,
    commentCount: Number(post?.commentCount || 0),
    createdAt: post?.createdAt || null,
    updatedAt: post?.updatedAt || null,
  };
}

async function findPostWithUsers(id) {
  return Post.findById(id)
    .populate('authorId', 'username nickname')
    .populate('comments.authorId', 'username nickname')
    .lean();
}

async function getAuthorMap(authorIds) {
  const ids = [...new Set(authorIds.map(normalizeId).filter(Boolean))];
  if (!ids.length) return new Map();
  const users = await User.find({ _id: { $in: ids } })
    .select('username nickname')
    .lean();
  return new Map(users.map((user) => [normalizeId(user), user]));
}

router.get('/', async (req, res) => {
  try {
    const q = cleanText(req.query?.q, 80);
    const category = normalizeCategoryFilter(req.query?.category);
    const match = {};
    if (category) match.category = category;
    if (q) {
      const pattern = new RegExp(escapeRegExp(q), 'i');
      const matchingAuthors = await User.find({
        $or: [
          { username: pattern },
          { nickname: pattern },
        ],
      }).select('_id').lean();
      match.$or = [
        { title: pattern },
        { content: pattern },
        ...(matchingAuthors.length ? [{ authorId: { $in: matchingAuthors.map((user) => user._id) } }] : []),
      ];
    }

    const posts = await Post.aggregate([
      ...(Object.keys(match).length ? [{ $match: match }] : []),
      { $sort: { isNotice: -1, noticePinnedAt: -1, createdAt: -1 } },
      { $limit: POST_LIST_LIMIT },
      {
        $project: {
          authorId: 1,
          category: 1,
          title: 1,
          isNotice: 1,
          noticePinnedAt: 1,
          createdAt: 1,
          updatedAt: 1,
          contentPreview: { $substrCP: [{ $ifNull: ['$content', ''] }, 0, POST_PREVIEW_LENGTH] },
          commentCount: {
            $ifNull: ['$commentCount', { $size: { $ifNull: ['$comments', []] } }],
          },
        },
      },
    ]);
    const authors = await getAuthorMap(posts.map((post) => post.authorId));
    res.json({
      posts: posts.map((post) => serializePostSummary(post, authors.get(normalizeId(post.authorId)))),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게시글 목록을 불러오지 못했습니다.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const post = await findPostWithUsers(req.params.id);
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    res.json({ post: serializePostDetail(post) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게시글을 불러오지 못했습니다.' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const title = cleanText(req.body?.title, 120);
    const content = cleanText(req.body?.content, 10000);
    const category = normalizeCategory(req.body?.category);
    if (!title || !content) {
      return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
    }

    const post = await Post.create({
      authorId: req.user.id,
      category,
      title,
      content,
      commentCount: 0,
      comments: [],
    });

    const populated = await findPostWithUsers(post._id);
    res.json({ message: '게시글을 작성했습니다.', post: serializePostDetail(populated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게시글 작성에 실패했습니다.' });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

    if (String(post.authorId) !== String(req.user.id)) {
      return res.status(403).json({ error: '작성자만 수정할 수 있습니다.' });
    }

    if (typeof req.body?.category === 'string') post.category = normalizeCategory(req.body.category);
    if (typeof req.body?.title === 'string') post.title = cleanText(req.body.title, 120);
    if (typeof req.body?.content === 'string') post.content = cleanText(req.body.content, 10000);
    if (!post.title || !post.content) {
      return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
    }
    await post.save();

    const populated = await findPostWithUsers(post._id);
    res.json({ message: '게시글을 수정했습니다.', post: serializePostDetail(populated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게시글 수정에 실패했습니다.' });
  }
});

router.post('/:id/comments', verifyToken, async (req, res) => {
  try {
    const content = cleanText(req.body?.content, 1200);
    if (!content) return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

    post.comments.push({ authorId: req.user.id, content });
    post.commentCount = post.comments.length;
    await post.save();

    await createNotification({
      userId: post.authorId,
      actorId: req.user.id,
      type: 'post_comment',
      title: '새 댓글',
      message: `"${post.title || '게시글'}"에 댓글이 달렸습니다.`,
      link: `/board/${post._id}`,
      meta: { postId: normalizeId(post), commentCount: post.commentCount },
    });

    const populated = await findPostWithUsers(post._id);
    res.json({ message: '댓글을 작성했습니다.', post: serializePostDetail(populated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '댓글 작성에 실패했습니다.' });
  }
});

router.post('/:id/notice', verifyToken, async (req, res) => {
  try {
    const admin = await requireAdminUser(req, res);
    if (!admin) return;

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

    const nextPinned = req.body?.isNotice !== undefined ? Boolean(req.body.isNotice) : !post.isNotice;
    post.isNotice = nextPinned;
    post.noticePinnedAt = nextPinned ? new Date() : null;
    await post.save();

    const populated = await findPostWithUsers(post._id);
    res.json({
      message: nextPinned ? '공지로 고정했습니다.' : '공지 고정을 해제했습니다.',
      post: serializePostDetail(populated),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '공지 상태 변경에 실패했습니다.' });
  }
});

router.delete('/:id/comments/:commentId', verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });

    const isPostAuthor = String(post.authorId) === String(req.user.id);
    const isCommentAuthor = String(comment.authorId) === String(req.user.id);
    if (!isPostAuthor && !isCommentAuthor) {
      return res.status(403).json({ error: '댓글 작성자 또는 게시글 작성자만 삭제할 수 있습니다.' });
    }

    post.comments.pull({ _id: req.params.commentId });
    post.commentCount = post.comments.length;
    await post.save();

    const populated = await findPostWithUsers(post._id);
    res.json({ message: '댓글을 삭제했습니다.', post: serializePostDetail(populated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '댓글 삭제에 실패했습니다.' });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

    if (String(post.authorId) !== String(req.user.id)) {
      return res.status(403).json({ error: '작성자만 삭제할 수 있습니다.' });
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: '게시글을 삭제했습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게시글 삭제에 실패했습니다.' });
  }
});

module.exports = router;
