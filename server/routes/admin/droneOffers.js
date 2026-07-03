const express = require('express');
const router = express.Router();

const DroneOffer = require('../../models/DroneOffer');
const { requireUserId, ownedFilter, withOwner } = require('../../utils/requestScope');

function scope(req, res, extra = {}) {
  const userId = requireUserId(req, res);
  if (!userId) return null;
  return ownedFilter(userId, extra);
}

router.get('/', async (req, res) => {
  try {
    const filter = scope(req, res);
    if (!filter) return;
    const offers = await DroneOffer.find(filter).populate('itemId', 'name tier rarity').lean();
    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '드론 판매 목록 로드 실패' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const offer = await new DroneOffer(withOwner(userId, req.body)).save();
    res.json({ message: '드론 판매가 추가되었습니다.', offer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '저장 실패' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const updated = await DroneOffer.findOneAndUpdate(ownedFilter(userId, { _id: req.params.id }), withOwner(userId, req.body), { new: true });
    if (!updated) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    res.json({ message: '수정 완료', offer: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '수정 실패' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const filter = scope(req, res, { _id: req.params.id });
    if (!filter) return;
    const deleted = await DroneOffer.findOneAndDelete(filter);
    if (!deleted) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    res.json({ message: '삭제 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '삭제 실패' });
  }
});

module.exports = router;
