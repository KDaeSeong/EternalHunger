// server/models/Item.js
const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['무기', '방어구', '소모품', '기타'], default: '기타' },
  stats: {
    atk: { type: Number, default: 0 },
    def: { type: Number, default: 0 },
    hp: { type: Number, default: 0 }
  },
  description: String,
  image: String, // 아이템 이미지 URL 또는 Base64 데이터
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Item', ItemSchema);