const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  lp: { type: Number, default: 0 }, 

  credits: { type: Number, default: 0 }, // 크레딧(로드맵 5번)

  // ★ 누적 전적(유저 기준)
  statistics: {
    totalGames: { type: Number, default: 0 },
    totalKills: { type: Number, default: 0 },
    totalWins: { type: Number, default: 0 }
  },
  
  // ★ 관리자 여부 추가 (기본값은 false)
  isAdmin: { type: Boolean, default: false },
  badges: [{
    name: String,
    unlockedAt: { type: Date, default: Date.now }
  }],
  perks: [{ type: String }], // 구매/해금한 특전 코드 목록
  
  personalHistory: [{
    charId: String,       
    name: String,         
    image: String,        
    totalKills: { type: Number, default: 0 }, 
    totalWins: { type: Number, default: 0 },  
    gamesPlayed: { type: Number, default: 0 } 
  }],

  createdAt: { type: Date, default: Date.now }
});

// ★ [수정됨] 비밀번호 암호화 미들웨어 (에러 원인 제거)
// async 함수에서는 'next'를 쓰지 않고 그냥 종료하면 됩니다.
UserSchema.pre('save', async function() {
  // 1. 비밀번호가 변경되지 않았다면 그냥 리턴 (next() 호출 안 함)
  if (!this.isModified('password')) return;

  try {
    // 2. 암호화 진행
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    // 에러 발생 시 Mongoose가 알아서 처리하도록 던짐
    throw error;
  }
});

// 비밀번호 검증 메서드
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
