// server/routes/game.js
const express = require('express');
const router = express.Router();

const GameLog = require('../models/GameLog');
const Character = require('../models/Characters');

/**
 * ✅ 게임 종료 기록 저장
 * POST /api/game/end
 * body: { winnerId, killCounts, fullLogs, participants }
 */
router.post('/end', async (req, res) => {
  try {
    const { winnerId, killCounts, fullLogs, participants } = req.body || {};
    if (!winnerId) return res.status(400).json({ error: "winnerId가 필요합니다." });

    const winner = await Character.findOne({ _id: winnerId, userId: req.user.id });
    if (!winner) return res.status(404).json({ error: "우승 캐릭터를 찾을 수 없습니다." });

    const count = await GameLog.countDocuments();
    const title = `제 ${count + 1}회 아레나`;

    const safeParticipants = Array.isArray(participants) ? participants : [];
    const summary = safeParticipants.map(p => {
      const id = String(p._id || p.charId || p.id || "");
      const k = killCounts && id ? (killCounts[id] || 0) : 0;
      return {
        charId: id,
        name: p.name || "Unknown",
        killCount: Number(k || 0),
        isWinner: id === String(winnerId)
      };
    });

    const logDoc = await new GameLog({
      title,
      winnerName: winner.name,
      participants: summary,
      fullLog: Array.isArray(fullLogs) ? fullLogs.map(String) : []
    }).save();

    // ✅ 캐릭터 누적 기록 반영 (내 계정 캐릭터에만)
    // - participants는 프론트가 보내는 객체라서 userId 검증을 위해 DB에서 조회 후 업데이트합니다.
    const participantIds = summary.map(s => s.charId).filter(Boolean);

    const chars = await Character.find({ _id: { $in: participantIds }, userId: req.user.id }, '_id name');
    const existingIds = new Set(chars.map(c => String(c._id)));

    // 개별 업데이트
    const ops = summary
      .filter(s => existingIds.has(String(s.charId)))
      .map(s => ({
        updateOne: {
          filter: { _id: s.charId, userId: req.user.id },
          update: {
            $inc: {
              'records.gamesPlayed': 1,
              'records.totalKills': Number(s.killCount || 0),
              'records.totalWins': s.isWinner ? 1 : 0
            }
          }
        }
      }));

    if (ops.length > 0) await Character.bulkWrite(ops);

    res.json({ message: "게임 로그 저장 완료", gameLogId: logDoc._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "게임 로그 저장 실패" });
  }
});

module.exports = router;
