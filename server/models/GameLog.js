const mongoose = require('mongoose');

const GameLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  title: String,
  playedAt: { type: Date, default: Date.now },
  winnerName: String,
  winnerTeamId: String,
  winnerTeamName: String,
  matchMode: String,
  teamSize: Number,
  participants: [{
    charId: String,
    name: String,
    killCount: Number,
    assistCount: Number,
    isWinner: Boolean,
    alive: Boolean,
    teamId: String,
    teamName: String,
    rosterIds: [String],
    rosterNames: [String],
  }],
  fullLog: [String],
  runEvents: [mongoose.Schema.Types.Mixed],
  summary: {
    participantCount: Number,
    teamCount: Number,
    aliveCount: Number,
    totalKills: Number,
    totalAssists: Number,
    totalDeaths: Number,
    logCount: Number,
    runEventCount: Number,
    droneCalls: Number,
    kioskGains: Number,
    craftCount: Number,
    totalRevives: Number,
    totalFlees: Number,
    legendCount: Number,
    transCount: Number,
    firstLegendText: String,
    firstTransText: String,
    actionLine: String,
    chaseLine: String,
    topBlocked: String,
    topDeferred: String,
    topObjectiveMoves: String,
  },
});

GameLogSchema.index({ userId: 1, playedAt: -1 });

module.exports = mongoose.model('GameLog', GameLogSchema);
