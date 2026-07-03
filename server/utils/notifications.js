const Notification = require('../models/Notification');
require('../models/User');

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

async function createNotification(input = {}) {
  const userId = normalizeId(input.userId);
  const actorId = normalizeId(input.actorId);
  if (!userId) return null;
  if (actorId && actorId === userId) return null;

  try {
    return await Notification.create({
      userId,
      actorId: actorId || null,
      type: cleanText(input.type, 40) || 'system',
      title: cleanText(input.title, 120),
      message: cleanText(input.message, 500),
      link: cleanText(input.link, 300),
      meta: input.meta && typeof input.meta === 'object' ? input.meta : {},
    });
  } catch (err) {
    console.error('notification create failed:', err?.message || err);
    return null;
  }
}

module.exports = {
  createNotification,
  normalizeNotificationId: normalizeId,
};
