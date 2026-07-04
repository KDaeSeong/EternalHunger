const mongoose = require('mongoose');

const GameRoomPlayerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['host', 'player'], default: 'player' },
  status: { type: String, enum: ['joined', 'left', 'ready'], default: 'joined' },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date, default: null },
}, {
  _id: false,
});

const GameRoomSchema = new mongoose.Schema({
  gameSlug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  mode: { type: String, default: '', trim: true, maxlength: 80 },
  status: { type: String, enum: ['open', 'playing', 'finished', 'closed'], default: 'open', index: true },
  visibility: { type: String, enum: ['public', 'private'], default: 'public', index: true },
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  maxPlayers: { type: Number, default: 4, min: 1, max: 64 },
  players: { type: [GameRoomPlayerSchema], default: [] },
  summary: { type: mongoose.Schema.Types.Mixed, default: {} },
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  state: { type: mongoose.Schema.Types.Mixed, default: {} },
  stateBytes: { type: Number, default: 0 },
  revision: { type: Number, default: 0 },
  result: { type: mongoose.Schema.Types.Mixed, default: {} },
  recordedAt: { type: Date, default: null, index: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  recordCount: { type: Number, default: 0 },
  startedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  lastActivityAt: { type: Date, default: Date.now, index: true },
}, {
  timestamps: true,
});

GameRoomSchema.index({ gameSlug: 1, status: 1, lastActivityAt: -1 });
GameRoomSchema.index({ visibility: 1, status: 1, lastActivityAt: -1 });
GameRoomSchema.index({ hostId: 1, updatedAt: -1 });
GameRoomSchema.index({ 'players.userId': 1, updatedAt: -1 });
GameRoomSchema.index({ gameSlug: 1, recordedAt: -1 });

module.exports = mongoose.model('GameRoom', GameRoomSchema);
