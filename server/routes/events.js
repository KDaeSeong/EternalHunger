const express = require('express');
const router = express.Router();
const GameEvent = require('../models/GameEvent');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

function normalizeTimeOfDay(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'day' || v === 'night' || v === 'both') return v;
  if (v === 'any' || v === 'all' || v === 'default') return 'both';
  return 'both';
}

function normalizeStringList(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((v) => String(v || '').trim())
    .filter(Boolean);
}

function normalizeObject(raw) {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function inferEventType(doc) {
  const type = String(doc?.type || '').trim();
  if (type) return type;
  return Number(doc?.victimCount || 0) > 0 ? 'death' : 'normal';
}

function buildEventDoc(raw = {}, extra = {}) {
  const title = String(raw?.title || '').trim();
  const text = String(raw?.text || '').trim();
  const killers = normalizeStringList(raw?.killers);
  const victims = normalizeStringList(raw?.victims);
  const benefits = normalizeStringList(raw?.benefits);
  const survivorCount = Number(raw?.survivorCount ?? (killers.length > 0 ? killers.length : (text.includes('{2}') ? 2 : 1)));
  const victimCount = Number(raw?.victimCount ?? victims.length);
  const timeOfDay = normalizeTimeOfDay(raw?.timeOfDay ?? raw?.time);
  const enabled = raw?.enabled !== false;
  const conditions = normalizeObject(raw?.conditions);

  const setDoc = {
    ...extra,
    title,
    text,
    type: inferEventType({ ...raw, victimCount }),
    enabled,
    killers,
    victims,
    benefits,
    survivorCount: Number.isFinite(survivorCount) && survivorCount > 0 ? survivorCount : 1,
    victimCount: Number.isFinite(victimCount) && victimCount >= 0 ? victimCount : 0,
    timeOfDay,
    conditions,
  };

  if (raw?.mapId) setDoc.mapId = String(raw.mapId);
  if (raw?.zoneId) setDoc.zoneId = String(raw.zoneId);
  if (raw?.image) setDoc.image = String(raw.image);
  if (raw?.sortOrder !== undefined) {
    const n = Number(raw.sortOrder);
    if (Number.isFinite(n)) setDoc.sortOrder = n;
  }

  return setDoc;
}

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const q = { userId };

    if (req.query.enabled === 'true') q.enabled = true;
    if (req.query.enabled === 'false') q.enabled = false;

    const timeOfDay = normalizeTimeOfDay(req.query.timeOfDay);
    if (req.query.timeOfDay && timeOfDay !== 'both') q.timeOfDay = timeOfDay;

    if (req.query.mapId) q.mapId = String(req.query.mapId);
    if (req.query.zoneId) q.zoneId = String(req.query.zoneId);

    const sMin = req.query.survivorMin != null ? Number(req.query.survivorMin) : null;
    const sMax = req.query.survivorMax != null ? Number(req.query.survivorMax) : null;
    const vMin = req.query.victimMin != null ? Number(req.query.victimMin) : null;
    const vMax = req.query.victimMax != null ? Number(req.query.victimMax) : null;

    if (sMin != null || sMax != null) {
      q.survivorCount = {};
      if (sMin != null && !Number.isNaN(sMin)) q.survivorCount.$gte = sMin;
      if (sMax != null && !Number.isNaN(sMax)) q.survivorCount.$lte = sMax;
    }
    if (vMin != null || vMax != null) {
      q.victimCount = {};
      if (vMin != null && !Number.isNaN(vMin)) q.victimCount.$gte = vMin;
      if (vMax != null && !Number.isNaN(vMax)) q.victimCount.$lte = vMax;
    }

    const events = await GameEvent.find(q).sort({ sortOrder: 1, createdAt: 1 });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '로드 실패' });
  }
});

router.post('/add', async (req, res) => {
  try {
    const userId = req.user.id;
    const data = req.body;
    const baseCount = await GameEvent.countDocuments({ userId });

    if (Array.isArray(data)) {
      const docs = data.map((e, idx) => buildEventDoc(e, { userId, sortOrder: baseCount + idx }));
      if (docs.length > 0) await GameEvent.insertMany(docs);
      return res.json({ message: '이벤트가 저장되었습니다.' });
    }

    const doc = await new GameEvent(buildEventDoc(data, { userId, sortOrder: baseCount })).save();
    res.json({ message: '이벤트가 저장되었습니다.', event: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '저장 실패' });
  }
});

router.put('/reorder', async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body;
    const orderedIds = Array.isArray(body)
      ? body.map((e) => String(e?._id || e?.id || '')).filter(Boolean)
      : Array.isArray(body?.orderedIds)
        ? body.orderedIds.map((id) => String(id || '')).filter(Boolean)
        : [];

    if (orderedIds.length === 0) {
      return res.status(400).json({ error: 'orderedIds가 비었습니다.' });
    }

    await Promise.all(orderedIds.map((id, idx) => (
      GameEvent.updateOne({ _id: id, userId }, { $set: { sortOrder: idx } })
    )));

    res.json({ message: '순서가 변경되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '정렬 저장 실패' });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const setDoc = buildEventDoc(req.body || {});
    const unsetDoc = {};
    if (!req.body?.mapId) unsetDoc.mapId = 1;
    if (!req.body?.zoneId) unsetDoc.zoneId = 1;
    if (!req.body?.image) unsetDoc.image = 1;

    const updated = await GameEvent.findOneAndUpdate(
      { _id: req.params.id, userId },
      Object.keys(unsetDoc).length ? { $set: setDoc, $unset: unsetDoc } : { $set: setDoc },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: '이벤트가 없거나 권한이 없습니다.' });
    res.json({ message: '성공적으로 수정되었습니다!', event: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '수정 중 서버 오류가 발생했습니다.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await GameEvent.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: '삭제 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '삭제 실패' });
  }
});

module.exports = router;
