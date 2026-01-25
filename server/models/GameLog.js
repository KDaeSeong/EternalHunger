// server/models/GameLog.js
const mongoose = require('mongoose');

const GameLogSchema = new mongoose.Schema({
  title: String,       // 게임 제목 (예: 제 123회 아레나)
  playedAt: { type: Date, default: Date.now }, // 게임 날짜
  winnerName: String,  // 우승자 이름
  participants: [{     // 참가자 요약 정보
    charId: String,
    name: String,
    killCount: Number,
    isWinner: Boolean
  }],
  fullLog: [String]    // 전체 로그 내용 (텍스트 배열)
});

module.exports = mongoose.model('GameLog', GameLogSchema);