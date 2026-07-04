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

function mapCharacterRecord(row) {
  const records = row?.records || {};
  const gamesPlayed = toNonNegativeInt(records.gamesPlayed);
  const totalWins = toNonNegativeInt(records.totalWins);
  const totalKills = toNonNegativeInt(records.totalKills);
  const totalAssists = toNonNegativeInt(records.totalAssists);
  const deathCount = toNonNegativeInt(records.deathCount);
  return {
    id: String(row?._id || ''),
    name: row?.name || '이름 없음',
    previewImage: row?.previewImage || '',
    weaponType: row?.weaponType || '',
    gamesPlayed,
    totalWins,
    totalKills,
    totalAssists,
    deathCount,
    winRate: gamesPlayed > 0 ? totalWins / gamesPlayed : 0,
    kda: Math.round(((totalKills + totalAssists) / Math.max(1, deathCount)) * 100) / 100,
    createdAt: row?.createdAt || null,
  };
}

function mapTeamRecord(row) {
  const gamesPlayed = toNonNegativeInt(row?.gamesPlayed);
  const totalWins = toNonNegativeInt(row?.totalWins);
  const totalKills = toNonNegativeInt(row?.totalKills);
  const totalAssists = toNonNegativeInt(row?.totalAssists);
  const deathCount = toNonNegativeInt(row?.deathCount);
  return {
    id: String(row?._id || ''),
    teamKey: row?.teamKey || '',
    teamName: row?.teamName || '',
    rosterIds: Array.isArray(row?.rosterIds) ? row.rosterIds.map(String).filter(Boolean) : [],
    rosterNames: Array.isArray(row?.rosterNames) ? row.rosterNames.map(String).filter(Boolean) : [],
    gamesPlayed,
    totalWins,
    totalKills,
    totalAssists,
    deathCount,
    winRate: gamesPlayed > 0 ? totalWins / gamesPlayed : 0,
    kda: Math.round(((totalKills + totalAssists) / Math.max(1, deathCount)) * 100) / 100,
    lastMatchAt: row?.lastMatchAt || null,
    createdAt: row?.createdAt || null,
  };
}

function buildTotals(rows = []) {
  return rows.reduce((acc, row) => ({
    gamesPlayed: acc.gamesPlayed + toNonNegativeInt(row.gamesPlayed),
    totalWins: acc.totalWins + toNonNegativeInt(row.totalWins),
    totalKills: acc.totalKills + toNonNegativeInt(row.totalKills),
    totalAssists: acc.totalAssists + toNonNegativeInt(row.totalAssists),
    deathCount: acc.deathCount + toNonNegativeInt(row.deathCount),
  }), { gamesPlayed: 0, totalWins: 0, totalKills: 0, totalAssists: 0, deathCount: 0 });
}

function mapGameRun(row) {
  const summary = row?.summary || {};
  const participants = Array.isArray(row?.participants) ? row.participants : [];
  const sortedParticipants = [...participants].sort((a, b) => (
    Number(b?.killCount || 0) - Number(a?.killCount || 0) ||
    Number(b?.assistCount || 0) - Number(a?.assistCount || 0) ||
    String(a?.name || '').localeCompare(String(b?.name || ''), 'ko')
  ));
  const winnerTeamMembers = participants
    .filter((p) => p?.isWinner)
    .map((p) => p?.name)
    .filter(Boolean);
  return {
    id: String(row?._id || ''),
    title: row?.title || '',
    playedAt: row?.playedAt || null,
    winnerName: row?.winnerName || '',
    winnerTeamId: row?.winnerTeamId || '',
    winnerTeamName: row?.winnerTeamName || '',
    winnerTeamMembers,
    matchMode: row?.matchMode || '',
    teamSize: toNonNegativeInt(row?.teamSize),
    participantCount: toNonNegativeInt(summary.participantCount || participants.length),
    teamCount: toNonNegativeInt(summary.teamCount),
    aliveCount: toNonNegativeInt(summary.aliveCount),
    totalKills: toNonNegativeInt(summary.totalKills),
    totalAssists: toNonNegativeInt(summary.totalAssists),
    totalDeaths: toNonNegativeInt(summary.totalDeaths),
    logCount: toNonNegativeInt(summary.logCount || row?.fullLog?.length),
    runEventCount: toNonNegativeInt(summary.runEventCount),
    droneCalls: toNonNegativeInt(summary.droneCalls),
    kioskGains: toNonNegativeInt(summary.kioskGains),
    craftCount: toNonNegativeInt(summary.craftCount),
    totalRevives: toNonNegativeInt(summary.totalRevives),
    totalFlees: toNonNegativeInt(summary.totalFlees),
    legendCount: toNonNegativeInt(summary.legendCount),
    transCount: toNonNegativeInt(summary.transCount),
    firstLegendText: summary.firstLegendText || '',
    firstTransText: summary.firstTransText || '',
    actionLine: summary.actionLine || '',
    chaseLine: summary.chaseLine || '',
    topBlocked: summary.topBlocked || '',
    topDeferred: summary.topDeferred || '',
    topObjectiveMoves: summary.topObjectiveMoves || '',
    replayAvailable: Boolean(row?._id && (toNonNegativeInt(summary.runEventCount) > 0 || (Array.isArray(row?.fullLog) && row.fullLog.length > 0))),
    topParticipants: sortedParticipants.slice(0, 5).map((p) => ({
      id: String(p?.charId || ''),
      name: p?.name || '',
      kills: toNonNegativeInt(p?.killCount),
      assists: toNonNegativeInt(p?.assistCount),
      alive: p?.alive !== false,
      teamName: p?.teamName || '',
    })),
  };
}

function buildRunTotals(rows = []) {
  return rows.reduce((acc, row) => ({
    gamesPlayed: acc.gamesPlayed + 1,
    totalKills: acc.totalKills + toNonNegativeInt(row.totalKills),
    totalAssists: acc.totalAssists + toNonNegativeInt(row.totalAssists),
    totalDeaths: acc.totalDeaths + toNonNegativeInt(row.totalDeaths),
    totalRevives: acc.totalRevives + toNonNegativeInt(row.totalRevives),
    droneCalls: acc.droneCalls + toNonNegativeInt(row.droneCalls),
    kioskGains: acc.kioskGains + toNonNegativeInt(row.kioskGains),
    craftCount: acc.craftCount + toNonNegativeInt(row.craftCount),
  }), {
    gamesPlayed: 0,
    totalKills: 0,
    totalAssists: 0,
    totalDeaths: 0,
    totalRevives: 0,
    droneCalls: 0,
    kioskGains: 0,
    craftCount: 0,
  });
}

function phaseLabel(at) {
  if (!at || typeof at !== 'object') return '시간 미기록';
  const day = toNonNegativeInt(at.day);
  if (!day) return '시간 미기록';
  const phase = String(at.phase || '').toLowerCase().includes('night') ? '밤' : '낮';
  return `${day}일차 ${phase}`;
}

function eventSortKey(event, index = 0) {
  const at = event?.at && typeof event.at === 'object' ? event.at : {};
  const phase = String(at.phase || '').toLowerCase().includes('night') ? 1 : 0;
  return [
    toNonNegativeInt(at.day),
    phase,
    Number(at.sec || 0),
    index,
  ];
}

function compareEventTime(a, b) {
  const left = eventSortKey(a.event, a.index);
  const right = eventSortKey(b.event, b.index);
  for (let i = 0; i < left.length; i += 1) {
    const diff = Number(left[i] || 0) - Number(right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function makeParticipantNameMap(participants = []) {
  const map = new Map();
  for (const p of Array.isArray(participants) ? participants : []) {
    const name = String(p?.name || '').trim();
    if (!name) continue;
    [
      p?.charId,
      p?.id,
      p?._id,
      p?.name,
    ].forEach((key) => {
      const text = String(key || '').trim();
      if (text) map.set(text, name);
    });
  }
  return map;
}

function actorName(event, participantNames) {
  const direct = String(event?.whoName || event?.name || '').trim();
  if (direct) return direct;
  const key = String(event?.whoId || event?.who || '').trim();
  if (!key) return '';
  return participantNames.get(key) || key;
}

function sourceLabel(source) {
  const key = String(source || '').toLowerCase();
  if (key === 'drone') return '드론';
  if (key === 'kiosk') return '키오스크';
  if (key === 'pvp') return '교전';
  if (key === 'hunt') return '사냥';
  if (key === 'boss') return '보스';
  if (key === 'mutant') return '변이 야생동물';
  if (key === 'gather') return '파밍';
  if (key === 'box') return '상자';
  if (key === 'legend') return '전설 상자';
  if (key === 'natural') return '필드 오브젝트';
  if (key === 'foodcrate') return '보급 상자';
  if (key === 'craft') return '제작';
  return source ? String(source) : '출처 미기록';
}

function chosenLabel(chosen) {
  const key = String(chosen || '');
  if (key === 'flee') return '도주';
  if (key === 'moveTo') return '이동';
  if (key === 'routeFarm') return '루트 파밍';
  if (key === 'craft') return '제작';
  if (key === 'droneOrder') return '드론 호출';
  if (key === 'kioskBuy') return '키오스크 구매';
  if (key === 'kioskExchange') return '키오스크 교환';
  if (key === 'kioskSell') return '키오스크 판매';
  return key || '행동 미기록';
}

function chaseOutcomeLabel(event) {
  const outcome = String(event?.outcome || '');
  if (outcome === 'blink_escape') return '블링크로 이탈';
  if (outcome === 'escape_fail') return '도주 실패';
  if (outcome === 'escape_no_chase') return '추격 없이 이탈';
  if (outcome === 'escaped_after_chase') return '추격 후 도주 성공';
  if (outcome === 'caught') return event?.fatal ? '추격 중 결정타' : '추격 성공';
  return outcome || '추격';
}

function timelineTone(kind, event) {
  const text = `${kind} ${event?.outcome || ''} ${event?.source || ''}`.toLowerCase();
  if (kind === 'chase' || kind === 'battle' || text.includes('caught') || text.includes('fail')) return 'danger';
  if (kind === 'revive') return 'success';
  if (kind === 'craft' || kind === 'gain' || kind === 'objective') return 'loot';
  if (kind === 'queue' && Array.isArray(event?.blockedReasons) && event.blockedReasons.length) return 'warning';
  if (kind === 'move' || kind === 'hyperloop') return 'move';
  return 'info';
}

function isTimelineWorthy(event) {
  const kind = String(event?.kind || '');
  if (!kind) return false;
  if (['run_start', 'spawn_state', 'revive', 'chase', 'battle', 'skill', 'dimension_rift', 'sudden_death_gather', 'hyperloop', 'objective', 'craft', 'queue'].includes(kind)) {
    if (kind === 'queue') {
      return Boolean((Array.isArray(event?.blockedReasons) && event.blockedReasons.length) || event?.chosen);
    }
    return true;
  }
  if (kind === 'move') {
    return Boolean(event?.reason || event?.objectiveType || event?.objectiveSubkind);
  }
  if (kind === 'gain') {
    const source = String(event?.source || '').toLowerCase();
    return !['gather', 'hunt', 'craft'].includes(source) || Number(event?.tier || 0) >= 5 || String(event?.itemId || '') === 'CREDITS';
  }
  return false;
}

function describeEvent(event, index, participantNames) {
  const kind = String(event?.kind || 'unknown');
  const who = actorName(event, participantNames);
  const item = String(event?.itemId || '').trim();
  const source = sourceLabel(event?.source || event?.src);
  const objective = String(event?.objectiveSubkind || event?.objectiveType || '').trim();
  const blocked = Array.isArray(event?.blockedReasons) ? event.blockedReasons.map(String).filter(Boolean) : [];
  let title = '이벤트';
  let body = '';

  if (kind === 'run_start') {
    title = '경기 시작';
    body = '시뮬레이션 실행이 시작됐습니다.';
  } else if (kind === 'spawn_state') {
    title = '시작 배치';
    body = who ? `${who}의 초기 상태가 기록됐습니다.` : '참가자 초기 상태가 기록됐습니다.';
  } else if (kind === 'queue') {
    title = `${who ? `${who} ` : ''}행동 결정`;
    body = `${chosenLabel(event?.chosen)}${objective ? ` · 목표 ${objective}` : ''}${blocked.length ? ` · 막힘: ${blocked.join(', ')}` : ''}`;
  } else if (kind === 'move') {
    title = `${who ? `${who} ` : ''}이동`;
    body = `${event?.from ? `${event.from} → ` : ''}${event?.to || event?.zoneId || '지역 미기록'}${event?.reason ? ` · ${event.reason}` : ''}${objective ? ` · 목표 ${objective}` : ''}`;
  } else if (kind === 'hyperloop') {
    title = `${who ? `${who} ` : ''}하이퍼루프`;
    body = `${event?.fromMapId || event?.from || '출발지'} → ${event?.toZoneId || event?.toMapId || event?.to || '도착지'}`;
  } else if (kind === 'gain') {
    title = `${who ? `${who} ` : ''}획득`;
    body = `${source} · ${item || '아이템 미기록'}${event?.qty ? ` x${event.qty}` : ''}${event?.tier ? ` · T${event.tier}` : ''}`;
  } else if (kind === 'craft') {
    title = `${who ? `${who} ` : ''}제작`;
    body = `${item || '아이템 미기록'}${event?.tier ? ` · T${event.tier}` : ''}`;
  } else if (kind === 'objective') {
    title = `${who ? `${who} ` : ''}오브젝트`;
    body = `${objective || event?.subkind || '오브젝트'}${event?.zoneId ? ` · ${event.zoneId}` : ''}`;
  } else if (kind === 'revive') {
    title = `${who ? `${who} ` : ''}부활`;
    body = `${event?.source ? sourceLabel(event.source) : '부활'}${event?.cost ? ` · ${event.cost}Cr` : ''}`;
  } else if (kind === 'chase') {
    title = `${who || '대상'} 도주/추격`;
    body = `${event?.chaserName ? `${event.chaserName} 추격 · ` : ''}${chaseOutcomeLabel(event)}${event?.preDamage ? ` · 피해 ${event.preDamage}` : ''}`;
  } else if (kind === 'battle') {
    title = '교전';
    body = `${who || '참가자'}${event?.subkind ? ` · ${event.subkind}` : ''}${event?.damage ? ` · 피해 ${event.damage}` : ''}`;
  } else if (kind === 'skill') {
    title = `${who ? `${who} ` : ''}스킬`;
    body = `${event?.skill || '스킬'}${event?.mode ? ` · ${event.mode}` : ''}${event?.heal ? ` · 회복 ${event.heal}` : ''}`;
  } else if (kind === 'dimension_rift') {
    title = '차원의 틈';
    body = `${who ? `${who} · ` : ''}${event?.outcome || event?.subkind || '이벤트'}`;
  } else if (kind === 'sudden_death_gather') {
    title = '서든데스 파밍';
    body = `${who ? `${who} · ` : ''}${item || event?.source || '자원 획득'}`;
  } else {
    title = kind;
    body = [who, source, item, objective].filter(Boolean).join(' · ') || '상세 정보 없음';
  }

  return {
    id: `${kind}-${index}`,
    kind,
    tone: timelineTone(kind, event),
    atLabel: phaseLabel(event?.at),
    day: toNonNegativeInt(event?.at?.day),
    phase: String(event?.at?.phase || ''),
    second: Number(event?.at?.sec || 0),
    actor: who,
    title,
    body,
  };
}

function buildEventTimeline(runEvents, participants) {
  const participantNames = makeParticipantNameMap(participants);
  const source = (Array.isArray(runEvents) ? runEvents : [])
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => isTimelineWorthy(event))
    .sort(compareEventTime)
    .slice(0, 450);
  return source.map(({ event, index }) => describeEvent(event, index, participantNames));
}

function logTone(line) {
  const text = String(line || '');
  if (text.includes('💀') || text.includes('☠️') || text.includes('처치') || text.includes('쓰러뜨')) return 'danger';
  if (text.includes('부활')) return 'success';
  if (text.includes('제작') || text.includes('획득') || text.includes('🎁') || text.includes('🧰') || text.includes('초월') || text.includes('전설')) return 'loot';
  if (text.includes('이동') || text.includes('하이퍼루프')) return 'move';
  if (text.includes('막힘') || text.includes('실패') || text.includes('금지')) return 'warning';
  return 'info';
}

function buildLogTimeline(fullLog) {
  let currentAtLabel = '시간 미기록';
  return (Array.isArray(fullLog) ? fullLog : [])
    .map(String)
    .filter(Boolean)
    .slice(-350)
    .map((line, index) => {
      const phaseMatch = line.match(/(\d+)일차\s*(낮|밤)/);
      if (phaseMatch) currentAtLabel = `${phaseMatch[1]}일차 ${phaseMatch[2]}`;
      return {
        id: `log-${index}`,
        kind: 'log',
        tone: logTone(line),
        atLabel: currentAtLabel,
        day: phaseMatch ? toNonNegativeInt(phaseMatch[1]) : 0,
        phase: phaseMatch?.[2] || '',
        second: 0,
        actor: '',
        title: line.replace(/^[-=✅⚠️\s]+/, '').slice(0, 80),
        body: line,
      };
    });
}

function groupTimeline(items = []) {
  const groups = [];
  const byLabel = new Map();
  for (const item of items) {
    const label = item?.atLabel || '시간 미기록';
    if (!byLabel.has(label)) {
      const group = { label, items: [] };
      byLabel.set(label, group);
      groups.push(group);
    }
    byLabel.get(label).items.push(item);
  }
  return groups;
}

router.get('/runs/:id', async (req, res) => {
  try {
    const userId = getUserIdOrRespond(req, res);
    if (!userId) return;

    const id = String(req.params?.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '실행 기록 ID가 올바르지 않습니다.' });
    }

    const row = await GameLog.findOne({ _id: id, userId })
      .select('title playedAt winnerName winnerTeamId winnerTeamName matchMode teamSize participants fullLog runEvents summary')
      .lean();
    if (!row) {
      return res.status(404).json({ error: '실행 기록을 찾을 수 없습니다.' });
    }

    const participants = (Array.isArray(row.participants) ? row.participants : [])
      .map((p) => ({
        id: String(p?.charId || ''),
        name: p?.name || '이름 없음',
        teamId: p?.teamId || '',
        teamName: p?.teamName || '',
        kills: toNonNegativeInt(p?.killCount),
        assists: toNonNegativeInt(p?.assistCount),
        alive: p?.alive !== false,
        isWinner: Boolean(p?.isWinner),
      }))
      .sort((a, b) => (
        Number(b.isWinner) - Number(a.isWinner) ||
        b.kills - a.kills ||
        b.assists - a.assists ||
        String(a.name).localeCompare(String(b.name), 'ko')
      ));
    const eventTimeline = buildEventTimeline(row.runEvents, row.participants);
    const fallbackTimeline = eventTimeline.length ? [] : buildLogTimeline(row.fullLog);
    const timeline = eventTimeline.length ? eventTimeline : fallbackTimeline;

    return res.json({
      run: mapGameRun(row),
      participants,
      timeline: {
        source: eventTimeline.length ? 'events' : 'logs',
        totalEvents: Array.isArray(row.runEvents) ? row.runEvents.length : 0,
        totalLogLines: Array.isArray(row.fullLog) ? row.fullLog.length : 0,
        items: timeline,
        groups: groupTimeline(timeline),
      },
      fullLog: (Array.isArray(row.fullLog) ? row.fullLog : []).slice(-350),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '실행 기록 상세 로드 실패' });
  }
});

router.get('/', async (req, res) => {
  try {
    const userId = getUserIdOrRespond(req, res);
    if (!userId) return;

    const [charactersRaw, teamsRaw, runsRaw] = await Promise.all([
      Character.find({ userId }, 'name previewImage weaponType records createdAt').lean(),
      TeamRecord.find({ userId }).sort({ totalWins: -1, gamesPlayed: -1, totalKills: -1, updatedAt: -1 }).lean(),
      GameLog.find({ userId })
        .select('title playedAt winnerName winnerTeamId winnerTeamName matchMode teamSize participants fullLog summary')
        .sort({ playedAt: -1, _id: -1 })
        .limit(30)
        .lean(),
    ]);

    const characters = charactersRaw
      .map(mapCharacterRecord)
      .sort((a, b) => (
        (b.totalWins - a.totalWins) ||
        (b.totalKills - a.totalKills) ||
        (b.totalAssists - a.totalAssists) ||
        String(a.name).localeCompare(String(b.name), 'ko')
      ));
    const teams = teamsRaw.map(mapTeamRecord);
    const runs = runsRaw.map(mapGameRun);

    res.json({
      characters,
      teams,
      runs,
      totals: {
        characters: buildTotals(characters),
        teams: buildTotals(teams),
        runs: buildRunTotals(runs),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '기록소 로드 실패' });
  }
});

module.exports = router;
