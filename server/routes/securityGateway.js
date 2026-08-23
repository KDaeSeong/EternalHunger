const express = require('express');
const GameLog = require('../models/GameLog');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

function text(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function nonNegativeInt(value, max = 999) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(max, Math.floor(number));
}

function sanitizeParticipants(value, winnerId) {
  return (Array.isArray(value) ? value : []).slice(0, 64).map((row) => {
    const charId = text(row?.charId || row?._id || row?.id, 80);
    return {
      charId,
      name: text(row?.name, 80) || 'Unknown',
      killCount: nonNegativeInt(row?.killCount),
      assistCount: nonNegativeInt(row?.assistCount),
      isWinner: charId === String(winnerId || ''),
      alive: row?.alive !== false,
      teamId: text(row?.teamId || row?.matchTeamId, 80),
      teamName: text(row?.teamName || row?.matchTeamName, 100),
      rosterIds: (Array.isArray(row?.rosterIds) ? row.rosterIds : []).slice(0, 16).map((id) => text(id, 80)).filter(Boolean),
      rosterNames: (Array.isArray(row?.rosterNames) ? row.rosterNames : []).slice(0, 16).map((name) => text(name, 80)).filter(Boolean),
    };
  });
}

function unverifiedResponse(logDoc, idempotent = false) {
  return {
    message: idempotent ? '이미 저장된 경기 기록입니다.' : '미검증 경기 기록을 저장했습니다.',
    gameLogId: logDoc._id,
    idempotent,
    trustedOutcome: false,
    rewardStatus: 'unverified',
    lpEarnedApplied: 0,
    creditsEarnedApplied: 0,
  };
}

router.post('/credits/earn', verifyToken, (req, res) => {
  res.status(410).json({
    error: '클라이언트 직접 크레딧 적립은 폐쇄되었습니다.',
    code: 'CLIENT_REWARD_DISABLED',
  });
});

router.post('/user/update-stats', verifyToken, (req, res) => {
  res.status(410).json({
    error: '클라이언트 직접 전적·보상 반영은 폐쇄되었습니다.',
    code: 'CLIENT_STATS_DISABLED',
  });
});

router.post('/game/end', verifyToken, async (req, res) => {
  const clientRunId = text(req.body?.clientRunId, 160);
  if (!/^[a-zA-Z0-9:._-]{16,160}$/.test(clientRunId)) {
    return res.status(400).json({ error: '유효한 clientRunId가 필요합니다.', code: 'RUN_ID_REQUIRED' });
  }

  try {
    const existing = await GameLog.findOne({ userId: req.user.id, clientRunId });
    if (existing) return res.json(unverifiedResponse(existing, true));

    const winnerId = text(req.body?.winnerId, 80);
    const participants = sanitizeParticipants(req.body?.participants, winnerId);
    const winner = participants.find((row) => row.charId === winnerId) || participants.find((row) => row.isWinner);
    const now = new Date();
    const logDoc = await GameLog.create({
      userId: req.user.id,
      clientRunId,
      title: `연습 경기 ${now.toISOString().slice(0, 19).replace('T', ' ')}`,
      winnerName: winner?.name || 'Unknown',
      winnerTeamId: text(req.body?.winnerTeamId, 80),
      winnerTeamName: winner?.teamName || '',
      matchMode: text(req.body?.matchMode, 40),
      teamSize: nonNegativeInt(req.body?.teamSize, 64),
      participants,
      fullLog: (Array.isArray(req.body?.fullLogs) ? req.body.fullLogs : []).slice(-400).map((line) => text(line, 500)),
      runEvents: (Array.isArray(req.body?.runEvents) ? req.body.runEvents : []).slice(-800),
      trustedOutcome: false,
      rewardStatus: 'unverified',
    });
    return res.status(201).json(unverifiedResponse(logDoc));
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await GameLog.findOne({ userId: req.user.id, clientRunId });
      if (existing) return res.json(unverifiedResponse(existing, true));
    }
    console.error('secure game end failed:', error);
    return res.status(500).json({ error: '경기 기록 저장에 실패했습니다.' });
  }
});

module.exports = router;
