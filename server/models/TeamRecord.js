const mongoose = require('mongoose');
const { Schema } = mongoose;

const TeamRecordSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  teamKey: { type: String, required: true },
  teamName: { type: String, default: '' },
  rosterIds: [{ type: String }],
  rosterNames: [{ type: String }],
  gamesPlayed: { type: Number, default: 0 },
  totalWins: { type: Number, default: 0 },
  totalKills: { type: Number, default: 0 },
  totalAssists: { type: Number, default: 0 },
  deathCount: { type: Number, default: 0 },
  lastMatchAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

TeamRecordSchema.index({ userId: 1, teamKey: 1 }, { unique: true });

module.exports = mongoose.model('TeamRecord', TeamRecordSchema);
