// server/models/ErMeta.js
// Eternal Return Open API에서 가져온 실험체/스킬/특성 등 보조 메타 캐시.

const mongoose = require('mongoose');

const ErMetaSchema = new mongoose.Schema({
  namespace: { type: String, required: true, index: true },
  code: { type: String, required: true },
  name: { type: String, default: '' },
  localizedName: { type: String, default: '' },
  type: { type: String, default: '' },
  weaponTypes: { type: [String], default: [] },
  tags: { type: [String], default: [] },
  source: { type: String, default: 'er' },
  metaType: { type: String, default: '' },
  raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  importedAt: { type: Date, default: Date.now },
});

ErMetaSchema.index({ namespace: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('ErMeta', ErMetaSchema);
