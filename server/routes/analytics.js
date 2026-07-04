const express = require('express');
const mongoose = require('mongoose');

const Character = require('../models/Characters');
const GameLog = require('../models/GameLog');
const TeamRecord = require('../models/TeamRecord');

const router = express.Router();

function getUserIdOrRespond(req, res) {
  const raw = req.user?.id ?? req.user?._id ?? req.user?.userId;
  const text = raw != null ? String(raw) : '';
  if (!text || !mongoose.Types.ObjectId.isValid(text)) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return null;
  }
  return new mongoose.Types.ObjectId(text);
}

function toNonNegativeInt(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function round(value, digits = 1) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  const scale = 10 ** digits;
  return Math.round(n * scale) / scale;
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function sampleLevel(gamesPlayed) {
  const games = toNonNegativeInt(gamesPlayed);
  if (games >= 10) return 'reliable';
  if (games >= 3) return 'signal';
  if (games > 0) return 'thin';
  return 'none';
}

function sampleLabel(level) {
  if (level === 'reliable') return '안정 표본';
  if (level === 'signal') return '관찰 표본';
  if (level === 'thin') return '표본 부족';
  return '기록 없음';
}

function rate(part, whole) {
  const denom = Number(whole || 0);
  if (!Number.isFinite(denom) || denom <= 0) return 0;
  return Number(part || 0) / denom;
}

function characterScore(row) {
  const records = row?.records || {};
  const gamesPlayed = toNonNegativeInt(records.gamesPlayed);
  const totalWins = toNonNegativeInt(records.totalWins);
  const totalKills = toNonNegativeInt(records.totalKills);
  const totalAssists = toNonNegativeInt(records.totalAssists);
  const deathCount = toNonNegativeInt(records.deathCount);
  const winRate = rate(totalWins, gamesPlayed);
  const killRate = rate(totalKills, gamesPlayed);
  const assistRate = rate(totalAssists, gamesPlayed);
  const survivalRate = gamesPlayed > 0 ? Math.max(0, rate(gamesPlayed - deathCount, gamesPlayed)) : 0;
  const score = round((winRate * 62) + (survivalRate * 18) + (killRate * 7) + (assistRate * 3), 1);
  const level = sampleLevel(gamesPlayed);

  return {
    id: String(row?._id || ''),
    name: safeText(row?.name, '이름 없음'),
    previewImage: row?.previewImage || '',
    weaponType: safeText(row?.weaponType, '무기 미설정'),
    erRole: safeText(row?.erRole, '역할 미설정'),
    erTrait: safeText(row?.erTrait, '특성 미설정'),
    tacticalSkill: safeText(row?.tacticalSkill, '전술 없음'),
    gamesPlayed,
    totalWins,
    totalKills,
    totalAssists,
    deathCount,
    winRate: round(winRate, 4),
    killRate: round(killRate, 2),
    assistRate: round(assistRate, 2),
    survivalRate: round(survivalRate, 4),
    score,
    sampleLevel: level,
    sampleLabel: sampleLabel(level),
  };
}

function teamScore(row) {
  const gamesPlayed = toNonNegativeInt(row?.gamesPlayed);
  const totalWins = toNonNegativeInt(row?.totalWins);
  const totalKills = toNonNegativeInt(row?.totalKills);
  const totalAssists = toNonNegativeInt(row?.totalAssists);
  const deathCount = toNonNegativeInt(row?.deathCount);
  const winRate = rate(totalWins, gamesPlayed);
  const killRate = rate(totalKills, gamesPlayed);
  const assistRate = rate(totalAssists, gamesPlayed);
  const survivalRate = gamesPlayed > 0 ? Math.max(0, rate(gamesPlayed - deathCount, gamesPlayed)) : 0;
  const score = round((winRate * 66) + (survivalRate * 14) + (killRate * 6) + (assistRate * 3), 1);
  const level = sampleLevel(gamesPlayed);
  const rosterNames = Array.isArray(row?.rosterNames) ? row.rosterNames.map((name) => safeText(name)).filter(Boolean) : [];

  return {
    id: String(row?._id || ''),
    teamKey: row?.teamKey || '',
    teamName: safeText(row?.teamName || rosterNames.join(' / '), '이름 없는 팀'),
    rosterNames,
    gamesPlayed,
    totalWins,
    totalKills,
    totalAssists,
    deathCount,
    winRate: round(winRate, 4),
    killRate: round(killRate, 2),
    assistRate: round(assistRate, 2),
    survivalRate: round(survivalRate, 4),
    score,
    sampleLevel: level,
    sampleLabel: sampleLabel(level),
    lastMatchAt: row?.lastMatchAt || null,
  };
}

function makeGroupBucket(label) {
  return {
    label: safeText(label, '미분류'),
    gamesPlayed: 0,
    totalWins: 0,
    totalKills: 0,
    totalAssists: 0,
    deathCount: 0,
    members: 0,
  };
}

function addToGroup(map, label, row) {
  const key = safeText(label, '미분류');
  const bucket = map.get(key) || makeGroupBucket(key);
  bucket.gamesPlayed += toNonNegativeInt(row.gamesPlayed);
  bucket.totalWins += toNonNegativeInt(row.totalWins);
  bucket.totalKills += toNonNegativeInt(row.totalKills);
  bucket.totalAssists += toNonNegativeInt(row.totalAssists);
  bucket.deathCount += toNonNegativeInt(row.deathCount);
  bucket.members += 1;
  map.set(key, bucket);
}

function finalizeGroups(map) {
  return [...map.values()].map((row) => {
    const winRate = rate(row.totalWins, row.gamesPlayed);
    const killRate = rate(row.totalKills, row.gamesPlayed);
    const assistRate = rate(row.totalAssists, row.gamesPlayed);
    const survivalRate = row.gamesPlayed > 0 ? Math.max(0, rate(row.gamesPlayed - row.deathCount, row.gamesPlayed)) : 0;
    const score = round((winRate * 62) + (survivalRate * 18) + (killRate * 7) + (assistRate * 3), 1);
    const level = sampleLevel(row.gamesPlayed);
    return {
      ...row,
      winRate: round(winRate, 4),
      killRate: round(killRate, 2),
      assistRate: round(assistRate, 2),
      survivalRate: round(survivalRate, 4),
      score,
      sampleLevel: level,
      sampleLabel: sampleLabel(level),
    };
  }).sort((a, b) => (
    b.score - a.score ||
    b.gamesPlayed - a.gamesPlayed ||
    String(a.label).localeCompare(String(b.label), 'ko')
  ));
}

function parseWeightedLine(line, acc) {
  String(line || '').split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const match = part.match(/^(.*)x(\d+)$/);
      const label = safeText(match ? match[1] : part, '');
      if (!label) return;
      const count = match ? toNonNegativeInt(match[2]) : 1;
      acc[label] = (acc[label] || 0) + Math.max(1, count);
    });
}

function topWeighted(acc, limit = 8) {
  return Object.entries(acc || {})
    .map(([label, count]) => ({ label, count: toNonNegativeInt(count) }))
    .filter((row) => row.label && row.count > 0)
    .sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label), 'ko'))
    .slice(0, limit);
}

function summarizeRuns(rows) {
  const blockedAcc = {};
  const deferredAcc = {};
  const objectiveAcc = {};
  const totals = rows.reduce((acc, row) => {
    const summary = row?.summary || {};
    parseWeightedLine(summary.topBlocked, blockedAcc);
    parseWeightedLine(summary.topDeferred, deferredAcc);
    parseWeightedLine(summary.topObjectiveMoves, objectiveAcc);
    return {
      gamesAnalyzed: acc.gamesAnalyzed + 1,
      participantCount: acc.participantCount + toNonNegativeInt(summary.participantCount),
      totalKills: acc.totalKills + toNonNegativeInt(summary.totalKills),
      totalAssists: acc.totalAssists + toNonNegativeInt(summary.totalAssists),
      totalDeaths: acc.totalDeaths + toNonNegativeInt(summary.totalDeaths),
      totalRevives: acc.totalRevives + toNonNegativeInt(summary.totalRevives),
      totalFlees: acc.totalFlees + toNonNegativeInt(summary.totalFlees),
      craftCount: acc.craftCount + toNonNegativeInt(summary.craftCount),
      droneCalls: acc.droneCalls + toNonNegativeInt(summary.droneCalls),
      kioskGains: acc.kioskGains + toNonNegativeInt(summary.kioskGains),
      legendCount: acc.legendCount + toNonNegativeInt(summary.legendCount),
      transCount: acc.transCount + toNonNegativeInt(summary.transCount),
      runEventCount: acc.runEventCount + toNonNegativeInt(summary.runEventCount),
    };
  }, {
    gamesAnalyzed: 0,
    participantCount: 0,
    totalKills: 0,
    totalAssists: 0,
    totalDeaths: 0,
    totalRevives: 0,
    totalFlees: 0,
    craftCount: 0,
    droneCalls: 0,
    kioskGains: 0,
    legendCount: 0,
    transCount: 0,
    runEventCount: 0,
  });

  return {
    totals: {
      ...totals,
      avgKills: round(rate(totals.totalKills, totals.gamesAnalyzed), 1),
      avgRevives: round(rate(totals.totalRevives, totals.gamesAnalyzed), 1),
      avgCrafts: round(rate(totals.craftCount, totals.gamesAnalyzed), 1),
      avgRunEvents: round(rate(totals.runEventCount, totals.gamesAnalyzed), 1),
      transPerGame: round(rate(totals.transCount, totals.gamesAnalyzed), 1),
      legendPerGame: round(rate(totals.legendCount, totals.gamesAnalyzed), 1),
    },
    bottlenecks: topWeighted(blockedAcc),
    deferred: topWeighted(deferredAcc),
    objectives: topWeighted(objectiveAcc),
  };
}

function compareWithAverage(row, averageScore) {
  const delta = round(Number(row?.score || 0) - Number(averageScore || 0), 1);
  let status = 'normal';
  if (row?.sampleLevel === 'none') status = 'empty';
  else if (row?.sampleLevel === 'thin') status = 'thin';
  else if (delta >= 15) status = 'strong';
  else if (delta <= -15) status = 'weak';
  return { ...row, scoreDelta: delta, status };
}

function buildRecommendations({ characters, teams, runSummary }) {
  const recommendations = [];
  const reliableCharacters = characters.filter((row) => row.sampleLevel !== 'none' && row.sampleLevel !== 'thin');
  const reliableTeams = teams.filter((row) => row.sampleLevel !== 'none' && row.sampleLevel !== 'thin');
  const strongest = reliableCharacters[0];
  const weakest = [...reliableCharacters].sort((a, b) => a.score - b.score)[0];
  const strongTeam = reliableTeams[0];
  const topBottleneck = runSummary.bottlenecks[0];

  if (!characters.some((row) => row.gamesPlayed > 0)) {
    recommendations.push({
      tone: 'info',
      title: '캐릭터 표본이 필요합니다',
      body: '시뮬레이션을 몇 판 더 완료하면 강세/약세 신호가 더 선명해집니다.',
    });
  }
  if (strongest && strongest.status === 'strong') {
    recommendations.push({
      tone: 'danger',
      title: `${strongest.name} 강세 신호`,
      body: `평균보다 지표가 ${strongest.scoreDelta} 높습니다. 승률과 킬/게임을 같이 확인해 주세요.`,
    });
  }
  if (weakest && weakest.status === 'weak') {
    recommendations.push({
      tone: 'warning',
      title: `${weakest.name} 약세 신호`,
      body: `평균보다 지표가 ${Math.abs(weakest.scoreDelta)} 낮습니다. 파밍 실패나 교전 생존률 문제를 우선 확인할 만합니다.`,
    });
  }
  if (strongTeam && strongTeam.status === 'strong') {
    recommendations.push({
      tone: 'danger',
      title: `${strongTeam.teamName} 팀 조합 주의`,
      body: `팀 지표가 평균보다 ${strongTeam.scoreDelta} 높습니다. 특정 조합 고착 여부를 확인해 주세요.`,
    });
  }
  if (topBottleneck) {
    recommendations.push({
      tone: 'info',
      title: `가장 잦은 병목: ${topBottleneck.label}`,
      body: `${topBottleneck.count}회 감지됐습니다. 우선순위 로직을 손볼 때 먼저 볼 만한 항목입니다.`,
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      tone: 'success',
      title: '큰 편차가 아직 보이지 않습니다',
      body: '현재 기록 기준으로는 즉시 손볼 만한 과도한 신호가 없습니다.',
    });
  }
  return recommendations.slice(0, 5);
}

router.get('/balance', async (req, res) => {
  try {
    const userId = getUserIdOrRespond(req, res);
    if (!userId) return;

    const limit = Math.min(200, Math.max(20, toNonNegativeInt(req.query?.limit) || 100));
    const [charactersRaw, teamsRaw, runsRaw] = await Promise.all([
      Character.find({ userId }, 'name previewImage weaponType erRole erTrait tacticalSkill records').lean(),
      TeamRecord.find({ userId }).sort({ totalWins: -1, gamesPlayed: -1, totalKills: -1, updatedAt: -1 }).lean(),
      GameLog.find({ userId })
        .select('playedAt winnerName winnerTeamName matchMode teamSize participants summary')
        .sort({ playedAt: -1, _id: -1 })
        .limit(limit)
        .lean(),
    ]);

    const weaponGroups = new Map();
    const roleGroups = new Map();
    const traitGroups = new Map();
    const tacticalGroups = new Map();
    const charactersBase = charactersRaw.map((row) => {
      const mapped = characterScore(row);
      addToGroup(weaponGroups, mapped.weaponType, mapped);
      addToGroup(roleGroups, mapped.erRole, mapped);
      addToGroup(traitGroups, mapped.erTrait, mapped);
      addToGroup(tacticalGroups, mapped.tacticalSkill, mapped);
      return mapped;
    });
    const playedCharacters = charactersBase.filter((row) => row.gamesPlayed > 0);
    const averageCharacterScore = playedCharacters.length
      ? round(playedCharacters.reduce((sum, row) => sum + row.score, 0) / playedCharacters.length, 1)
      : 0;
    const characters = charactersBase
      .map((row) => compareWithAverage(row, averageCharacterScore))
      .sort((a, b) => (
        b.score - a.score ||
        b.gamesPlayed - a.gamesPlayed ||
        String(a.name).localeCompare(String(b.name), 'ko')
      ));

    const teamsBase = teamsRaw.map(teamScore);
    const playedTeams = teamsBase.filter((row) => row.gamesPlayed > 0);
    const averageTeamScore = playedTeams.length
      ? round(playedTeams.reduce((sum, row) => sum + row.score, 0) / playedTeams.length, 1)
      : 0;
    const teams = teamsBase
      .map((row) => compareWithAverage(row, averageTeamScore))
      .sort((a, b) => (
        b.score - a.score ||
        b.gamesPlayed - a.gamesPlayed ||
        String(a.teamName).localeCompare(String(b.teamName), 'ko')
      ));
    const runSummary = summarizeRuns(runsRaw);

    res.json({
      generatedAt: new Date().toISOString(),
      counts: {
        characters: charactersRaw.length,
        playedCharacters: playedCharacters.length,
        teams: teamsRaw.length,
        playedTeams: playedTeams.length,
        runs: runsRaw.length,
      },
      characters: {
        averageScore: averageCharacterScore,
        strongest: characters.filter((row) => row.gamesPlayed > 0).slice(0, 8),
        weakest: [...characters]
          .filter((row) => row.gamesPlayed > 0)
          .sort((a, b) => a.score - b.score || b.gamesPlayed - a.gamesPlayed)
          .slice(0, 8),
        groups: {
          weapons: finalizeGroups(weaponGroups),
          roles: finalizeGroups(roleGroups),
          traits: finalizeGroups(traitGroups),
          tacticalSkills: finalizeGroups(tacticalGroups),
        },
      },
      teams: {
        averageScore: averageTeamScore,
        strongest: teams.filter((row) => row.gamesPlayed > 0).slice(0, 8),
        weakest: [...teams]
          .filter((row) => row.gamesPlayed > 0)
          .sort((a, b) => a.score - b.score || b.gamesPlayed - a.gamesPlayed)
          .slice(0, 8),
      },
      runs: runSummary,
      recommendations: buildRecommendations({ characters, teams, runSummary }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '밸런스 분석 로드 실패' });
  }
});

module.exports = router;
