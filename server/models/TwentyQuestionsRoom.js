const mongoose = require('mongoose');

const QUESTION_RESPONSES = ['pending', 'yes', 'no', 'maybe'];
const ROOM_STATUSES = ['active', 'solved', 'closed'];
const ROOM_CATEGORIES = [
  'free',
  'game',
  'character',
  'item',
  'country',
  'place',
  'person',
  'food',
  'organism',
  'comic',
  'movie',
  'drama',
  'program',
];

const TwentyQuestionsQuestionSchema = new mongoose.Schema({
  askerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 220 },
  response: { type: String, enum: QUESTION_RESPONSES, default: 'pending' },
  answeredAt: { type: Date, default: null },
}, { timestamps: true });

const TwentyQuestionsGuessSchema = new mongoose.Schema({
  guesserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 120 },
  correct: { type: Boolean, default: false },
}, { timestamps: true });

const TwentyQuestionsHintMessageSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 240 },
}, { timestamps: true });

const TwentyQuestionsRoomSchema = new mongoose.Schema({
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 80 },
  category: {
    type: String,
    enum: ROOM_CATEGORIES,
    default: 'free',
    index: true,
  },
  answer: { type: String, required: true, trim: true, maxlength: 120 },
  hint: { type: String, default: '', trim: true, maxlength: 180 },
  status: { type: String, enum: ROOM_STATUSES, default: 'active', index: true },
  maxQuestions: { type: Number, default: 20, min: 1, max: 20 },
  solvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  solvedAt: { type: Date, default: null },
  questions: [TwentyQuestionsQuestionSchema],
  guesses: [TwentyQuestionsGuessSchema],
  hintMessages: [TwentyQuestionsHintMessageSchema],
}, { timestamps: true });

TwentyQuestionsRoomSchema.index({ status: 1, updatedAt: -1 });
TwentyQuestionsRoomSchema.index({ category: 1, updatedAt: -1 });

const TwentyQuestionsRoom = mongoose.model('TwentyQuestionsRoom', TwentyQuestionsRoomSchema);

TwentyQuestionsRoom.ROOM_CATEGORIES = ROOM_CATEGORIES;

module.exports = TwentyQuestionsRoom;
