const express = require('express');
const router = express.Router();

const Perk = require('../../models/Perk');
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
    const perks = await Perk.find(filter).sort({ lpCost: 1 }).lean();
    res.json(perks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '특전 로드 실패' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const perk = await new Perk(withOwner(userId, req.body)).save();
    res.json({ message: '특전이 추가되었습니다.', perk });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '특전 저장 실패' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const updated = await Perk.findOneAndUpdate(ownedFilter(userId, { _id: req.params.id }), withOwner(userId, req.body), { new: true });
    if (!updated) return res.status(404).json({ error: '특전을 찾을 수 없습니다.' });
    res.json({ message: '특전이 수정되었습니다.', perk: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '특전 수정 실패' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const filter = scope(req, res, { _id: req.params.id });
    if (!filter) return;
    const deleted = await Perk.findOneAndDelete(filter);
    if (!deleted) return res.status(404).json({ error: '특전을 찾을 수 없습니다.' });
    res.json({ message: '특전이 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '특전 삭제 실패' });
  }
});

module.exports = router;
