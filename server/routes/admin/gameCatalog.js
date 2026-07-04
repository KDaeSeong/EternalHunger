const express = require('express');
const mongoose = require('mongoose');

const GameCatalogEntry = require('../../models/GameCatalogEntry');

const router = express.Router();

const VALID_STAGES = new Set(['planned', 'prototype', 'live', 'archived']);
const VALID_ROOM_SYSTEMS = new Set(['none', 'game-room', 'twenty-questions']);

function cleanText(value, fallback = '', maxLength = 240) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return (text || fallback).slice(0, maxLength);
}

function normalizeKey(value, fallback = '') {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return fallback;
}

function toFiniteNumber(value, fallback = 1000) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStage(value) {
  const stage = String(value || '').trim();
  return VALID_STAGES.has(stage) ? stage : 'planned';
}

function normalizeRoomSystem(value) {
  const roomSystem = String(value || '').trim();
  return VALID_ROOM_SYSTEMS.has(roomSystem) ? roomSystem : 'none';
}

function userObjectId(req) {
  const raw = String(req.user?.id || req.user?._id || '');
  return mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(raw) : null;
}

function buildPatch(body = {}) {
  const roomSystem = normalizeRoomSystem(body.roomSystem);
  const supportsRooms = toBoolean(body.supportsRooms, roomSystem !== 'none');
  return {
    slug: normalizeKey(body.slug),
    title: cleanText(body.title, '', 120),
    subtitle: cleanText(body.subtitle, '', 80),
    priority: cleanText(body.priority, '후보', 80),
    stage: normalizeStage(body.stage),
    stageLabel: cleanText(body.stageLabel, '이식 후보', 80),
    adapter: cleanText(body.adapter, 'discussion', 80),
    roomSystem,
    resultMode: cleanText(body.resultMode, 'manual', 80),
    scope: cleanText(body.scope, '', 240),
    summary: cleanText(body.summary, '', 600),
    nextStep: cleanText(body.nextStep, '', 600),
    supportsRooms,
    supportsStateSync: toBoolean(body.supportsStateSync),
    supportsRecords: toBoolean(body.supportsRecords, true),
    supportsSaves: toBoolean(body.supportsSaves, true),
    visible: toBoolean(body.visible, true),
    sortOrder: toFiniteNumber(body.sortOrder, 1000),
  };
}

function mapEntry(row) {
  return {
    id: String(row?._id || ''),
    slug: row?.slug || '',
    title: row?.title || '',
    subtitle: row?.subtitle || '',
    priority: row?.priority || '',
    stage: row?.stage || 'planned',
    stageLabel: row?.stageLabel || '',
    adapter: row?.adapter || '',
    roomSystem: row?.roomSystem || 'none',
    resultMode: row?.resultMode || '',
    scope: row?.scope || '',
    summary: row?.summary || '',
    nextStep: row?.nextStep || '',
    supportsRooms: Boolean(row?.supportsRooms),
    supportsStateSync: Boolean(row?.supportsStateSync),
    supportsRecords: Boolean(row?.supportsRecords),
    supportsSaves: Boolean(row?.supportsSaves),
    visible: row?.visible !== false,
    sortOrder: Number(row?.sortOrder || 0),
    createdAt: row?.createdAt || null,
    updatedAt: row?.updatedAt || null,
  };
}

router.get('/catalog', async (req, res) => {
  try {
    const rows = await GameCatalogEntry.find({})
      .sort({ sortOrder: 1, updatedAt: -1 })
      .lean();
    res.json({ entries: rows.map(mapEntry) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게임 후보 목록을 불러오지 못했습니다.' });
  }
});

router.post('/catalog', async (req, res) => {
  try {
    const patch = buildPatch(req.body);
    if (!patch.slug) return res.status(400).json({ error: '게임 키를 입력해주세요.' });
    if (!patch.title) return res.status(400).json({ error: '게임 이름을 입력해주세요.' });

    const userId = userObjectId(req);
    const row = await GameCatalogEntry.findOneAndUpdate(
      { slug: patch.slug },
      {
        $set: { ...patch, updatedBy: userId },
        $setOnInsert: { createdBy: userId },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean();

    res.json({ message: '게임 후보를 저장했습니다.', entry: mapEntry(row) });
  } catch (err) {
    console.error(err);
    if (err?.code === 11000) return res.status(409).json({ error: '이미 사용 중인 게임 키입니다.' });
    res.status(500).json({ error: '게임 후보 저장에 실패했습니다.' });
  }
});

router.delete('/catalog/:id', async (req, res) => {
  try {
    const id = String(req.params?.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '게임 후보 ID가 올바르지 않습니다.' });
    }
    const result = await GameCatalogEntry.deleteOne({ _id: id });
    if (!result.deletedCount) return res.status(404).json({ error: '게임 후보를 찾을 수 없습니다.' });
    res.json({ message: '게임 후보를 삭제했습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게임 후보 삭제에 실패했습니다.' });
  }
});

module.exports = router;
