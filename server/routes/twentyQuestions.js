const express = require('express');
const router = express.Router();

const TwentyQuestionsRoom = require('../models/TwentyQuestionsRoom');
require('../models/User');
const { verifyToken } = require('../middleware/authMiddleware');
const { getOptionalUserId } = require('../utils/requestScope');
const { createNotification } = require('../utils/notifications');

const CATEGORY_LABELS = {
  free: '자유',
  game: '게임',
  character: '캐릭터',
  item: '아이템',
  country: '나라',
  place: '지명',
  person: '인물',
  food: '음식',
  organism: '생물',
  comic: '만화',
  movie: '영화',
  drama: '드라마',
  program: '프로그램',
};

const ROOM_CATEGORIES = TwentyQuestionsRoom.ROOM_CATEGORIES || Object.keys(CATEGORY_LABELS);

const RESPONSE_LABELS = {
  pending: '대기',
  yes: '예',
  no: '아니오',
  maybe: '애매함',
};

function normalizeId(value) {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value?.toHexString === 'function') return value.toHexString();
  if (value?._id && value._id !== value) return normalizeId(value._id);
  if (value?.id && value.id !== value) return normalizeId(value.id);
  if (typeof value?.toString === 'function') return value.toString();
  return '';
}

function normalizeText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeAnswer(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function compactUser(user) {
  if (!user || typeof user !== 'object') return null;
  return {
    _id: normalizeId(user),
    username: user.username || '',
    nickname: user.nickname || '',
  };
}

function displayName(user) {
  return String(user?.nickname || user?.username || '익명').trim() || '익명';
}

function isHost(room, userId) {
  return Boolean(userId && normalizeId(room?.hostId) === String(userId));
}

function canRevealAnswer(room, userId) {
  return isHost(room, userId) || room?.status === 'solved' || room?.status === 'closed';
}

function serializeQuestion(question) {
  return {
    _id: normalizeId(question),
    asker: compactUser(question.askerId),
    askerName: displayName(question.askerId),
    text: question.text || '',
    response: question.response || 'pending',
    responseLabel: RESPONSE_LABELS[question.response] || RESPONSE_LABELS.pending,
    answeredAt: question.answeredAt || null,
    createdAt: question.createdAt || null,
    updatedAt: question.updatedAt || null,
  };
}

function serializeGuess(guess) {
  return {
    _id: normalizeId(guess),
    guesser: compactUser(guess.guesserId),
    guesserName: displayName(guess.guesserId),
    text: guess.text || '',
    correct: Boolean(guess.correct),
    createdAt: guess.createdAt || null,
  };
}

function serializeRoomSummary(room) {
  const questions = Array.isArray(room?.questions) ? room.questions : [];
  const guesses = Array.isArray(room?.guesses) ? room.guesses : [];
  return {
    _id: normalizeId(room),
    title: room?.title || '',
    category: room?.category || 'free',
    categoryLabel: CATEGORY_LABELS[room?.category] || CATEGORY_LABELS.free,
    hint: room?.hint || '',
    status: room?.status || 'active',
    maxQuestions: Number(room?.maxQuestions || 20),
    questionCount: questions.length,
    pendingCount: questions.filter((q) => q?.response === 'pending').length,
    guessCount: guesses.length,
    host: compactUser(room?.hostId),
    hostName: displayName(room?.hostId),
    solvedBy: compactUser(room?.solvedBy),
    solvedByName: room?.solvedBy ? displayName(room.solvedBy) : '',
    solvedAt: room?.solvedAt || null,
    createdAt: room?.createdAt || null,
    updatedAt: room?.updatedAt || null,
  };
}

function serializeRoomDetail(room, userId) {
  const summary = serializeRoomSummary(room);
  const revealAnswer = canRevealAnswer(room, userId);
  return {
    ...summary,
    isHost: isHost(room, userId),
    answer: revealAnswer ? room?.answer || '' : '',
    answerRevealed: revealAnswer,
    questions: (Array.isArray(room?.questions) ? room.questions : []).map(serializeQuestion),
    guesses: (Array.isArray(room?.guesses) ? room.guesses : []).map(serializeGuess),
  };
}

function serializeCreatedRoomFallback(room, userId) {
  const plain = typeof room?.toObject === 'function' ? room.toObject() : (room || {});
  const revealAnswer = canRevealAnswer(plain, userId);
  return {
    _id: normalizeId(plain),
    title: plain.title || '',
    category: plain.category || 'free',
    categoryLabel: CATEGORY_LABELS[plain.category] || CATEGORY_LABELS.free,
    hint: plain.hint || '',
    status: plain.status || 'active',
    maxQuestions: Number(plain.maxQuestions || 20),
    questionCount: Array.isArray(plain.questions) ? plain.questions.length : 0,
    pendingCount: Array.isArray(plain.questions) ? plain.questions.filter((q) => q?.response === 'pending').length : 0,
    guessCount: Array.isArray(plain.guesses) ? plain.guesses.length : 0,
    host: compactUser(plain.hostId),
    hostName: displayName(plain.hostId),
    solvedBy: compactUser(plain.solvedBy),
    solvedByName: plain.solvedBy ? displayName(plain.solvedBy) : '',
    solvedAt: plain.solvedAt || null,
    createdAt: plain.createdAt || null,
    updatedAt: plain.updatedAt || null,
    isHost: isHost(plain, userId),
    answer: revealAnswer ? plain.answer || '' : '',
    answerRevealed: revealAnswer,
    questions: [],
    guesses: [],
  };
}

async function findRoomWithUsers(id) {
  return TwentyQuestionsRoom.findById(id)
    .populate('hostId', 'username nickname')
    .populate('solvedBy', 'username nickname')
    .populate('questions.askerId', 'username nickname')
    .populate('guesses.guesserId', 'username nickname')
    .lean();
}

router.get('/', async (req, res) => {
  try {
    const status = normalizeText(req.query?.status, 20);
    const category = normalizeText(req.query?.category, 20);
    const filter = {};
    if (['active', 'solved', 'closed'].includes(status)) filter.status = status;
    if (ROOM_CATEGORIES.includes(category)) filter.category = category;

    const rooms = await TwentyQuestionsRoom.find(filter)
      .populate('hostId', 'username nickname')
      .populate('solvedBy', 'username nickname')
      .sort({ status: 1, updatedAt: -1 })
      .limit(80)
      .lean();

    res.json({ rooms: rooms.map(serializeRoomSummary) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '스무고개 방 목록을 불러오지 못했습니다.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = getOptionalUserId(req);
    const room = await findRoomWithUsers(req.params.id);
    if (!room) return res.status(404).json({ error: '스무고개 방을 찾을 수 없습니다.' });
    res.json({ room: serializeRoomDetail(room, userId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '스무고개 방을 불러오지 못했습니다.' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const title = normalizeText(req.body?.title, 80);
    const answer = normalizeText(req.body?.answer, 120);
    const hint = normalizeText(req.body?.hint, 180);
    const rawCategory = normalizeText(req.body?.category, 20);
    const category = ROOM_CATEGORIES.includes(rawCategory) ? rawCategory : 'free';

    if (!title || !answer) {
      return res.status(400).json({ error: '방 제목과 정답을 입력해주세요.' });
    }

    const room = await TwentyQuestionsRoom.create({
      hostId: req.user.id,
      title,
      answer,
      hint,
      category,
      maxQuestions: 20,
    });

    let responseRoom = room;
    try {
      const populated = await findRoomWithUsers(room._id);
      if (populated) responseRoom = populated;
    } catch (populateErr) {
      console.error('twenty questions create populate failed:', populateErr);
    }

    let payloadRoom;
    try {
      payloadRoom = serializeRoomDetail(responseRoom, req.user.id);
    } catch (serializeErr) {
      console.error('twenty questions create serialize failed:', serializeErr);
      payloadRoom = serializeCreatedRoomFallback(room, req.user.id);
    }

    res.json({ message: '스무고개 방을 만들었습니다.', room: payloadRoom });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '스무고개 방 생성에 실패했습니다.' });
  }
});

router.post('/:id/questions', verifyToken, async (req, res) => {
  try {
    const text = normalizeText(req.body?.text, 220);
    if (!text) return res.status(400).json({ error: '질문을 입력해주세요.' });

    const room = await TwentyQuestionsRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: '스무고개 방을 찾을 수 없습니다.' });
    if (room.status !== 'active') return res.status(400).json({ error: '진행 중인 방에만 질문할 수 있습니다.' });
    if ((room.questions || []).length >= Number(room.maxQuestions || 20)) {
      return res.status(400).json({ error: '질문 20개를 모두 사용했습니다.' });
    }

    room.questions.push({ askerId: req.user.id, text });
    await room.save();

    await createNotification({
      userId: room.hostId,
      actorId: req.user.id,
      type: 'twenty_question',
      title: '새 스무고개 질문',
      message: `"${room.title || '스무고개'}" 방에 새 질문이 등록되었습니다.`,
      link: `/twenty-questions/${room._id}`,
      meta: { roomId: normalizeId(room), questionCount: room.questions.length },
    });

    const populated = await findRoomWithUsers(room._id);
    res.json({ message: '질문을 등록했습니다.', room: serializeRoomDetail(populated, req.user.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '질문 등록에 실패했습니다.' });
  }
});

router.post('/:id/questions/:questionId/answer', verifyToken, async (req, res) => {
  try {
    const response = normalizeText(req.body?.response, 20);
    if (!['yes', 'no', 'maybe'].includes(response)) {
      return res.status(400).json({ error: '답변은 예, 아니오, 애매함 중 하나여야 합니다.' });
    }

    const room = await TwentyQuestionsRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: '스무고개 방을 찾을 수 없습니다.' });
    if (!isHost(room, req.user.id)) return res.status(403).json({ error: '방장만 질문에 답변할 수 있습니다.' });
    if (room.status !== 'active') return res.status(400).json({ error: '진행 중인 방만 답변할 수 있습니다.' });

    const question = room.questions.id(req.params.questionId);
    if (!question) return res.status(404).json({ error: '질문을 찾을 수 없습니다.' });

    question.response = response;
    question.answeredAt = new Date();
    await room.save();

    await createNotification({
      userId: question.askerId,
      actorId: req.user.id,
      type: 'twenty_answer',
      title: '스무고개 질문 답변',
      message: `"${room.title || '스무고개'}" 방의 질문에 답변이 달렸습니다.`,
      link: `/twenty-questions/${room._id}`,
      meta: { roomId: normalizeId(room), questionId: normalizeId(question), response },
    });

    const populated = await findRoomWithUsers(room._id);
    res.json({ message: '답변을 저장했습니다.', room: serializeRoomDetail(populated, req.user.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '답변 저장에 실패했습니다.' });
  }
});

router.post('/:id/guesses', verifyToken, async (req, res) => {
  try {
    const text = normalizeText(req.body?.text, 120);
    if (!text) return res.status(400).json({ error: '정답 도전을 입력해주세요.' });

    const room = await TwentyQuestionsRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: '스무고개 방을 찾을 수 없습니다.' });
    if (room.status !== 'active') return res.status(400).json({ error: '진행 중인 방에서만 정답을 맞힐 수 있습니다.' });

    const correct = normalizeAnswer(text) === normalizeAnswer(room.answer);
    room.guesses.push({ guesserId: req.user.id, text, correct });
    if (correct) {
      room.status = 'solved';
      room.solvedBy = req.user.id;
      room.solvedAt = new Date();
    }
    await room.save();

    if (correct) {
      await createNotification({
        userId: room.hostId,
        actorId: req.user.id,
        type: 'twenty_solved',
        title: '스무고개 정답',
        message: `"${room.title || '스무고개'}" 방의 정답을 맞힌 참가자가 있습니다.`,
        link: `/twenty-questions/${room._id}`,
        meta: { roomId: normalizeId(room), guessCount: room.guesses.length },
      });
    }

    const populated = await findRoomWithUsers(room._id);
    res.json({
      message: correct ? '정답입니다. 방이 종료되었습니다.' : '오답입니다.',
      correct,
      room: serializeRoomDetail(populated, req.user.id),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '정답 도전에 실패했습니다.' });
  }
});

router.post('/:id/close', verifyToken, async (req, res) => {
  try {
    const room = await TwentyQuestionsRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: '스무고개 방을 찾을 수 없습니다.' });
    if (!isHost(room, req.user.id)) return res.status(403).json({ error: '방장만 방을 종료할 수 있습니다.' });
    if (room.status !== 'active') return res.status(400).json({ error: '이미 종료된 방입니다.' });

    room.status = 'closed';
    await room.save();

    const populated = await findRoomWithUsers(room._id);
    res.json({ message: '방을 종료했습니다.', room: serializeRoomDetail(populated, req.user.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '방 종료에 실패했습니다.' });
  }
});

module.exports = router;
