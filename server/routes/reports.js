const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Post = require('../models/Post');
const Report = require('../models/Report');
const { verifyAdmin } = require('../middleware/authMiddleware');
const { createNotification } = require('../utils/notifications');

const REASON_LABELS = {
  spam: '스팸',
  abuse: '욕설/비방',
  spoiler: '스포일러',
  offtopic: '주제 이탈',
  other: '기타',
};

const STATUS_LABELS = {
  open: '접수',
  reviewing: '검토 중',
  resolved: '처리 완료',
  dismissed: '기각',
};

function normalizeId(value) {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value?._id) return normalizeId(value._id);
  if (value?.id) return normalizeId(value.id);
  if (value?.$oid) return String(value.$oid);
  if (typeof value?.toString === 'function') return value.toString();
  return '';
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function displayName(user) {
  return String(user?.nickname || user?.username || '익명').trim() || '익명';
}

function userSummary(user) {
  if (!user || typeof user !== 'object') return null;
  return {
    _id: normalizeId(user),
    username: user.username || '',
    nickname: user.nickname || '',
  };
}

function normalizeReason(value) {
  const reason = cleanText(value, 40);
  return Object.prototype.hasOwnProperty.call(REASON_LABELS, reason) ? reason : 'other';
}

function normalizeStatus(value) {
  const status = cleanText(value, 40);
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, status) ? status : '';
}

function buildTargetUrl(postId) {
  return `/board/${normalizeId(postId)}`;
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function serializeReport(report) {
  const snapshot = report?.targetSnapshot || {};
  const post = report?.postId && typeof report.postId === 'object' ? report.postId : null;
  return {
    _id: normalizeId(report),
    reporter: userSummary(report?.reporterId),
    reporterName: displayName(report?.reporterId),
    targetType: report?.targetType || 'post',
    postId: normalizeId(report?.postId),
    commentId: normalizeId(report?.commentId),
    reason: report?.reason || 'other',
    reasonLabel: REASON_LABELS[report?.reason] || REASON_LABELS.other,
    detail: report?.detail || '',
    status: report?.status || 'open',
    statusLabel: STATUS_LABELS[report?.status] || STATUS_LABELS.open,
    adminNote: report?.adminNote || '',
    handledBy: userSummary(report?.handledBy),
    handledByName: report?.handledBy ? displayName(report.handledBy) : '',
    handledAt: report?.handledAt || null,
    target: {
      title: snapshot.title || post?.title || '',
      excerpt: snapshot.excerpt || '',
      authorName: snapshot.authorName || '',
      authorId: normalizeId(snapshot.authorId),
      url: snapshot.url || buildTargetUrl(report?.postId),
      postExists: Boolean(post),
    },
    createdAt: report?.createdAt || null,
    updatedAt: report?.updatedAt || null,
  };
}

async function findPostWithComment(postId) {
  return Post.findById(postId)
    .populate('authorId', 'username nickname')
    .populate('comments.authorId', 'username nickname');
}

router.post('/', async (req, res) => {
  try {
    const targetType = cleanText(req.body?.targetType, 20);
    if (!['post', 'comment'].includes(targetType)) {
      return res.status(400).json({ error: '신고 대상이 올바르지 않습니다.' });
    }

    const postId = cleanText(req.body?.postId, 80);
    const commentId = targetType === 'comment' ? cleanText(req.body?.commentId, 80) : '';
    const reason = normalizeReason(req.body?.reason);
    const detail = cleanText(req.body?.detail, 1000);
    if (!isValidObjectId(postId) || (targetType === 'comment' && !isValidObjectId(commentId))) {
      return res.status(400).json({ error: '신고 대상 ID가 올바르지 않습니다.' });
    }

    const post = await findPostWithComment(postId);
    if (!post) return res.status(404).json({ error: '신고할 게시글을 찾을 수 없습니다.' });

    let excerpt = post.content || '';
    let author = post.authorId;
    let finalCommentId = null;

    if (targetType === 'comment') {
      const comment = post.comments.id(commentId);
      if (!comment) return res.status(404).json({ error: '신고할 댓글을 찾을 수 없습니다.' });
      excerpt = comment.content || '';
      author = comment.authorId;
      finalCommentId = comment._id;
    }

    const openDuplicate = await Report.findOne({
      reporterId: req.user.id,
      targetType,
      postId: post._id,
      commentId: finalCommentId,
      status: { $in: ['open', 'reviewing'] },
    }).lean();
    if (openDuplicate) {
      return res.status(409).json({ error: '이미 접수된 신고가 있습니다.' });
    }

    const report = await Report.create({
      reporterId: req.user.id,
      targetType,
      postId: post._id,
      commentId: finalCommentId,
      reason,
      detail,
      targetSnapshot: {
        title: post.title || '',
        excerpt: cleanText(excerpt, 260),
        authorId: normalizeId(author) || null,
        authorName: displayName(author),
        url: buildTargetUrl(post._id),
      },
    });

    res.json({ message: '신고를 접수했습니다.', report: serializeReport(report.toObject()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '신고 접수에 실패했습니다.' });
  }
});

router.get('/', verifyAdmin, async (req, res) => {
  try {
    const status = normalizeStatus(req.query?.status);
    const filter = status ? { status } : {};
    const reports = await Report.find(filter)
      .populate('reporterId', 'username nickname')
      .populate('handledBy', 'username nickname')
      .populate('postId', 'title createdAt')
      .sort({ status: 1, createdAt: -1 })
      .limit(120)
      .lean();

    res.json({
      reports: reports.map(serializeReport),
      summary: {
        open: await Report.countDocuments({ status: 'open' }),
        reviewing: await Report.countDocuments({ status: 'reviewing' }),
        resolved: await Report.countDocuments({ status: 'resolved' }),
        dismissed: await Report.countDocuments({ status: 'dismissed' }),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '신고 목록을 불러오지 못했습니다.' });
  }
});

router.patch('/:id', verifyAdmin, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: '신고 ID가 올바르지 않습니다.' });
    const status = normalizeStatus(req.body?.status);
    if (!status) return res.status(400).json({ error: '처리 상태가 올바르지 않습니다.' });

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: '신고를 찾을 수 없습니다.' });

    report.status = status;
    report.adminNote = cleanText(req.body?.adminNote, 1000);
    report.handledBy = req.user.id;
    report.handledAt = ['resolved', 'dismissed'].includes(status) ? new Date() : null;
    await report.save();

    await createNotification({
      userId: report.reporterId,
      actorId: req.user.id,
      type: 'report_status',
      title: '신고 처리 상태 변경',
      message: `신고 상태가 ${STATUS_LABELS[status] || status} 상태로 변경되었습니다.`,
      link: buildTargetUrl(report.postId),
      meta: { reportId: normalizeId(report), status },
    });

    const populated = await Report.findById(report._id)
      .populate('reporterId', 'username nickname')
      .populate('handledBy', 'username nickname')
      .populate('postId', 'title createdAt')
      .lean();

    res.json({ message: '신고 상태를 저장했습니다.', report: serializeReport(populated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '신고 상태 저장에 실패했습니다.' });
  }
});

module.exports = router;
