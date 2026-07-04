const express = require('express');
const mongoose = require('mongoose');

const Character = require('../models/Characters');
const GameLog = require('../models/GameLog');
const Post = require('../models/Post');
const TeamRecord = require('../models/TeamRecord');
const TwentyQuestionsRoom = require('../models/TwentyQuestionsRoom');
const User = require('../models/User');

const router = express.Router();

const SECTION_LABELS = {
  simulation: '시뮬레이션',
  records: '기록',
  community: '커뮤니티',
  twenty: '스무고개',
  economy: '성장',
};

function normalizeId(value) {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value?.toHexString === 'function') return value.toHexString();
  if (value?._id && value._id !== value) return normalizeId(value._id);
  if (value?.id && value.id !== value) return normalizeId(value.id);
  if (value?.$oid) return String(value.$oid);
  if (typeof value?.toString === 'function') return value.toString();
  return '';
}

function toNonNegativeInt(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function getUserIdOrRespond(req, res) {
  const raw = req.user?.id ?? req.user?._id ?? req.user?.userId;
  const text = normalizeId(raw);
  if (!text || !mongoose.Types.ObjectId.isValid(text)) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return null;
  }
  return new mongoose.Types.ObjectId(text);
}

function compactUser(user) {
  const stats = user?.statistics || {};
  return {
    _id: normalizeId(user),
    username: user?.username || '',
    nickname: user?.nickname || '',
    lp: toNonNegativeInt(user?.lp),
    credits: toNonNegativeInt(user?.credits),
    badges: Array.isArray(user?.badges) ? user.badges.map((badge) => ({
      name: badge?.name || '',
      unlockedAt: badge?.unlockedAt || null,
    })).filter((badge) => badge.name) : [],
    statistics: {
      totalGames: toNonNegativeInt(stats.totalGames),
      totalWins: toNonNegativeInt(stats.totalWins),
      totalKills: toNonNegativeInt(stats.totalKills),
    },
  };
}

function buildAchievement({ id, section, title, description, value, target, points, href }) {
  const current = toNonNegativeInt(value);
  const goal = Math.max(1, toNonNegativeInt(target));
  const progress = Math.min(1, current / goal);
  const completed = current >= goal;
  return {
    id,
    section,
    sectionLabel: SECTION_LABELS[section] || section,
    title,
    description,
    value: current,
    target: goal,
    progress,
    completed,
    points: toNonNegativeInt(points),
    href: href || '',
  };
}

function summarizeSections(achievements) {
  const bySection = new Map();
  for (const achievement of achievements) {
    const key = achievement.section || 'etc';
    const current = bySection.get(key) || {
      section: key,
      label: achievement.sectionLabel || key,
      completedCount: 0,
      totalCount: 0,
      score: 0,
      maxScore: 0,
    };
    current.totalCount += 1;
    current.maxScore += achievement.points;
    if (achievement.completed) {
      current.completedCount += 1;
      current.score += achievement.points;
    }
    bySection.set(key, current);
  }
  return Array.from(bySection.values());
}

router.get('/', async (req, res) => {
  try {
    const userId = getUserIdOrRespond(req, res);
    if (!userId) return;

    const [
      user,
      characterCount,
      teamRecords,
      runCount,
      postCount,
      commentAgg,
      hostedRoomCount,
      solvedRoomCount,
    ] = await Promise.all([
      User.findById(userId).select('username nickname lp credits badges statistics').lean(),
      Character.countDocuments({ userId }),
      TeamRecord.find({ userId }).select('gamesPlayed totalWins totalKills totalAssists deathCount').lean(),
      GameLog.countDocuments({ userId }),
      Post.countDocuments({ authorId: userId }),
      Post.aggregate([
        { $unwind: '$comments' },
        { $match: { 'comments.authorId': userId } },
        { $count: 'count' },
      ]),
      TwentyQuestionsRoom.countDocuments({ hostId: userId }),
      TwentyQuestionsRoom.countDocuments({ solvedBy: userId }),
    ]);

    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const stats = user.statistics || {};
    const teamTotals = teamRecords.reduce((acc, row) => ({
      gamesPlayed: acc.gamesPlayed + toNonNegativeInt(row.gamesPlayed),
      totalWins: acc.totalWins + toNonNegativeInt(row.totalWins),
      totalKills: acc.totalKills + toNonNegativeInt(row.totalKills),
      totalAssists: acc.totalAssists + toNonNegativeInt(row.totalAssists),
      deathCount: acc.deathCount + toNonNegativeInt(row.deathCount),
    }), { gamesPlayed: 0, totalWins: 0, totalKills: 0, totalAssists: 0, deathCount: 0 });

    const totals = {
      totalGames: toNonNegativeInt(stats.totalGames),
      totalWins: toNonNegativeInt(stats.totalWins),
      totalKills: toNonNegativeInt(stats.totalKills),
      lp: toNonNegativeInt(user.lp),
      credits: toNonNegativeInt(user.credits),
      badges: Array.isArray(user.badges) ? user.badges.length : 0,
      characters: toNonNegativeInt(characterCount),
      teams: teamRecords.length,
      teamWins: teamTotals.totalWins,
      runs: toNonNegativeInt(runCount),
      posts: toNonNegativeInt(postCount),
      comments: toNonNegativeInt(commentAgg?.[0]?.count),
      hostedRooms: toNonNegativeInt(hostedRoomCount),
      solvedRooms: toNonNegativeInt(solvedRoomCount),
    };

    const achievements = [
      buildAchievement({
        id: 'first_sim',
        section: 'simulation',
        title: '첫 경기',
        description: '시뮬레이션을 1회 완료합니다.',
        value: totals.totalGames,
        target: 1,
        points: 10,
        href: '/simulation',
      }),
      buildAchievement({
        id: 'ten_games',
        section: 'simulation',
        title: '적응 완료',
        description: '시뮬레이션 누적 10전을 달성합니다.',
        value: totals.totalGames,
        target: 10,
        points: 30,
        href: '/records',
      }),
      buildAchievement({
        id: 'first_win',
        section: 'simulation',
        title: '첫 승리',
        description: '시뮬레이션에서 1승을 기록합니다.',
        value: totals.totalWins,
        target: 1,
        points: 20,
        href: '/records',
      }),
      buildAchievement({
        id: 'hunter',
        section: 'simulation',
        title: '킬 로그가 말해준다',
        description: '누적 10킬을 달성합니다.',
        value: totals.totalKills,
        target: 10,
        points: 25,
        href: '/records',
      }),
      buildAchievement({
        id: 'roster_builder',
        section: 'records',
        title: '로스터 빌더',
        description: '캐릭터 5명을 등록합니다.',
        value: totals.characters,
        target: 5,
        points: 20,
        href: '/characters',
      }),
      buildAchievement({
        id: 'team_archivist',
        section: 'records',
        title: '팀 기록 수집가',
        description: '팀 전적 3개를 기록합니다.',
        value: totals.teams,
        target: 3,
        points: 20,
        href: '/records',
      }),
      buildAchievement({
        id: 'replay_keeper',
        section: 'records',
        title: '리플레이 보관',
        description: '저장 경기 기록 5개를 남깁니다.',
        value: totals.runs,
        target: 5,
        points: 25,
        href: '/records',
      }),
      buildAchievement({
        id: 'poster',
        section: 'community',
        title: '첫 게시글',
        description: '게시판에 글을 1개 작성합니다.',
        value: totals.posts,
        target: 1,
        points: 10,
        href: '/board',
      }),
      buildAchievement({
        id: 'commentator',
        section: 'community',
        title: '토론 참여자',
        description: '댓글 5개를 작성합니다.',
        value: totals.comments,
        target: 5,
        points: 15,
        href: '/board',
      }),
      buildAchievement({
        id: 'twenty_host',
        section: 'twenty',
        title: '방장 데뷔',
        description: '스무고개 방을 1개 만듭니다.',
        value: totals.hostedRooms,
        target: 1,
        points: 10,
        href: '/twenty-questions?create=1',
      }),
      buildAchievement({
        id: 'twenty_solver',
        section: 'twenty',
        title: '정답 사냥꾼',
        description: '스무고개 정답을 1회 맞힙니다.',
        value: totals.solvedRooms,
        target: 1,
        points: 20,
        href: '/twenty-questions',
      }),
      buildAchievement({
        id: 'wallet',
        section: 'economy',
        title: '자금 확보',
        description: '크레딧 1,000을 보유합니다.',
        value: totals.credits,
        target: 1000,
        points: 20,
        href: '/perks',
      }),
      buildAchievement({
        id: 'lp_climber',
        section: 'economy',
        title: 'LP 상승세',
        description: 'LP 1,000을 달성합니다.',
        value: totals.lp,
        target: 1000,
        points: 25,
        href: '/leaderboard',
      }),
      buildAchievement({
        id: 'badge_collector',
        section: 'economy',
        title: '배지 수집가',
        description: '배지 3개를 획득합니다.',
        value: totals.badges,
        target: 3,
        points: 25,
        href: '/account',
      }),
    ];

    const completed = achievements.filter((row) => row.completed);
    const next = achievements
      .filter((row) => !row.completed)
      .sort((a, b) => (b.progress - a.progress) || (b.points - a.points) || a.title.localeCompare(b.title, 'ko'))
      .slice(0, 5);

    const score = completed.reduce((sum, row) => sum + row.points, 0);
    const maxScore = achievements.reduce((sum, row) => sum + row.points, 0);

    res.json({
      user: compactUser(user),
      season: {
        id: 'preseason',
        name: '프리시즌',
        title: '기반 시즌',
        summary: '누적 전적과 커뮤니티 활동을 기준으로 기본 업적을 계산합니다.',
        score,
        maxScore,
        completedCount: completed.length,
        totalCount: achievements.length,
      },
      totals,
      sections: summarizeSections(achievements),
      achievements,
      next,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '업적 정보를 불러오지 못했습니다.' });
  }
});

module.exports = router;
