const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Notification = require('../models/Notification');
require('../models/User');

function normalizeId(value) {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value?._id) return normalizeId(value._id);
  if (value?.id) return normalizeId(value.id);
  if (value?.$oid) return String(value.$oid);
  if (typeof value?.toString === 'function') return value.toString();
  return '';
}

function displayName(user) {
  return String(user?.nickname || user?.username || '사용자').trim() || '사용자';
}

function userSummary(user) {
  if (!user || typeof user !== 'object') return null;
  return {
    _id: normalizeId(user),
    username: user.username || '',
    nickname: user.nickname || '',
  };
}

function serializeNotification(row) {
  return {
    _id: normalizeId(row),
    actor: userSummary(row?.actorId),
    actorName: row?.actorId ? displayName(row.actorId) : '',
    type: row?.type || 'system',
    title: row?.title || '',
    message: row?.message || '',
    link: row?.link || '',
    readAt: row?.readAt || null,
    unread: !row?.readAt,
    meta: row?.meta && typeof row.meta === 'object' ? row.meta : {},
    createdAt: row?.createdAt || null,
    updatedAt: row?.updatedAt || null,
  };
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 50)));
    const filter = { userId: req.user.id };
    if (String(req.query?.unread || '') === '1') filter.readAt = null;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter)
        .populate('actorId', 'username nickname')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId: req.user.id, readAt: null }),
    ]);

    res.json({
      notifications: notifications.map(serializeNotification),
      unreadCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '알림 목록을 불러오지 못했습니다.' });
  }
});

router.patch('/read-all', async (req, res) => {
  try {
    const now = new Date();
    await Notification.updateMany(
      { userId: req.user.id, readAt: null },
      { $set: { readAt: now } }
    );
    res.json({ message: '모든 알림을 읽음 처리했습니다.', readAt: now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '알림 읽음 처리에 실패했습니다.' });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: '알림 ID가 올바르지 않습니다.' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { readAt: new Date() } },
      { new: true }
    ).populate('actorId', 'username nickname').lean();

    if (!notification) return res.status(404).json({ error: '알림을 찾을 수 없습니다.' });
    res.json({ message: '알림을 읽음 처리했습니다.', notification: serializeNotification(notification) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '알림 읽음 처리에 실패했습니다.' });
  }
});

module.exports = router;
