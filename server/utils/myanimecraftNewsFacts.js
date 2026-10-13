const crypto = require('node:crypto');
const MAX_BYTES = 128 * 1024;
const labels = { OPENING: '개막 특집', MIDSEASON: '전반기 결산', LATE_SEASON: '후반기 전망' };
function bad(message = '기사 자료가 올바르지 않습니다.') { const e = new Error(message); e.status = 400; throw e; }
function text(v, max = 100) { if (typeof v !== 'string' || !v.length || v.length > max || /[\u0000-\u001f\u007f]/.test(v)) bad(); return v; }
function int(v, min, max) { if (!Number.isSafeInteger(v) || v < min || v > max) bad(); return v; }
function array(v, min, max) { if (!Array.isArray(v) || v.length < min || v.length > max) bad(); return v; }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function validateSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad();
  if (Buffer.byteLength(JSON.stringify(value)) > MAX_BYTES) { const e = new Error('기사 자료가 너무 큽니다.'); e.status = 413; throw e; }
  const s = { version: int(value.version, 1, 1), careerId: text(value.careerId, 160), seasonNo: int(value.seasonNo, 1, 1000000),
    edition: value.edition, mode: value.mode, recordsRevision: int(value.recordsRevision, 0, Number.MAX_SAFE_INTEGER),
    playerTeamId: text(value.playerTeamId, 160), totalFixtures: int(value.totalFixtures, 1, 2000) };
  if (!Object.hasOwn(labels, s.edition) || !['PROLEAGUE', 'WINNERS'].includes(s.mode)) bad();
  s.teams = array(value.teams, 2, 32).map((t) => ({ id: text(t?.id, 160), name: text(t?.name), rosterSize: int(t?.rosterSize, 0, 1000) }));
  const ids = new Set(s.teams.map((t) => t.id));
  if (ids.size !== s.teams.length || !ids.has(s.playerTeamId)) bad();
  s.matches = array(value.matches, 0, s.totalFixtures).map((m) => ({ id: text(m?.id, 160), round: int(m?.round, 1, 10000),
    homeTeamId: text(m?.homeTeamId, 160), awayTeamId: text(m?.awayTeamId, 160), scoreHome: int(m?.scoreHome, 0, 99), scoreAway: int(m?.scoreAway, 0, 99) }));
  if (new Set(s.matches.map((m) => m.id)).size !== s.matches.length) bad();
  const standings = new Map(s.teams.map((t) => [t.id, { teamId: t.id, win: 0, lose: 0, diff: 0 }]));
  for (const m of s.matches) {
    if (!ids.has(m.homeTeamId) || !ids.has(m.awayTeamId) || m.homeTeamId === m.awayTeamId || m.scoreHome === m.scoreAway) bad();
    const h = standings.get(m.homeTeamId), a = standings.get(m.awayTeamId);
    h.diff += m.scoreHome - m.scoreAway; a.diff += m.scoreAway - m.scoreHome;
    if (m.scoreHome > m.scoreAway) { h.win++; a.lose++; } else { a.win++; h.lose++; }
  }
  s.standings = [...standings.values()].sort((a, b) => b.win - a.win || b.diff - a.diff || a.teamId.localeCompare(b.teamId));
  // Reject contradictory statistics. This verifies a user's local snapshot, not competitive authenticity.
  if (canonical(value.standings) !== canonical(s.standings)) bad('경기 결과와 순위가 일치하지 않습니다.');
  s.individuals = array(value.individuals, 2, 2).map((p) => {
    if (!['ANIME', 'GAME'].includes(p?.id) || !['NOT_STARTED', 'IN_PROGRESS', 'DONE'].includes(p?.stage)) bad();
    return { id: p.id, stage: p.stage };
  }).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(s.individuals.map((p) => p.id)).size !== 2) bad();
  if ((s.edition === 'OPENING' && s.matches.length !== 0)
    || (s.edition === 'MIDSEASON' && !s.matches.length)
    || (s.edition === 'LATE_SEASON' && s.matches.length !== Math.ceil(s.totalFixtures * .8))) bad('발행 시점과 경기 자료가 일치하지 않습니다.');
  return s;
}
function buildFacts(s) {
  const facts = [{ id: 'progress', text: s.edition === 'OPENING'
    ? `시즌 ${s.seasonNo} ${s.mode === 'WINNERS' ? '위너스리그' : '프로리그'}가 시작됐다. ${s.teams.length}개 팀이 정규리그 ${s.totalFixtures}경기를 치른다.`
    : `정규리그 ${s.totalFixtures}경기 중 ${s.matches.length}경기가 끝났으며, ${s.totalFixtures - s.matches.length}경기가 남아 있다.` }];
  if (s.edition === 'OPENING') {
    facts.push({ id: 'teams', text: `참가 팀은 ${s.teams.map((t) => t.name).join(', ')}다.` });
    const ours = s.teams.find((t) => t.id === s.playerTeamId);
    facts.push({ id: 'our-team', text: `${ours.name}는 소속 선수 ${ours.rosterSize}명과 함께 새 시즌을 맞는다.` });
  } else {
    for (const [index, row] of s.standings.entries()) {
      if (index >= 3 && row.teamId !== s.playerTeamId) continue;
      const team = s.teams.find((t) => t.id === row.teamId);
      facts.push({ id: `team:${team.id}`, text: `${team.name}는 정규리그 ${index + 1}위로, ${row.win}승 ${row.lose}패와 세트 득실 ${row.diff > 0 ? '+' : ''}${row.diff}를 기록 중이다.` });
    }
    if (s.edition === 'LATE_SEASON') facts.push({ id: 'outlook', text: '이 기사는 현재까지 완료된 경기 기준이다. 남은 경기 결과에 따라 최종 순위가 달라질 수 있다.' });
  }
  for (const p of s.individuals) facts.push({ id: `individual:${p.id}`, text: `${p.id === 'ANIME' ? '애니메리그' : '게임리그'}는 ${p.stage === 'DONE' ? '일정을 마쳤다' : p.stage === 'IN_PROGRESS' ? '진행 중이다' : '아직 시작하지 않았다'}.` });
  return facts;
}
function headlines(s) { return [`시즌 ${s.seasonNo}, ${labels[s.edition]}`, `${s.teams.length}개 팀의 도전 · ${labels[s.edition]}`, `마이애니크래프트 리그 소식 · 시즌 ${s.seasonNo}`]; }
function validatePlan(plan, facts) {
  if (!plan || !Number.isInteger(plan.headlineIndex) || plan.headlineIndex < 0 || plan.headlineIndex > 2) bad();
  const factIds = array(plan.factIds, 1, facts.length), allowed = new Set(facts.map((f) => f.id));
  if (new Set(factIds).size !== factIds.length || factIds.some((id) => !allowed.has(id)) || factIds[0] !== 'progress'
    || (allowed.has('outlook') && !factIds.includes('outlook'))) bad();
  return { headlineIndex: plan.headlineIndex, factIds: [...factIds] };
}
const snapshotHash = (s) => crypto.createHash('sha256').update(canonical(s)).digest('hex');
module.exports = { MAX_BYTES, validateSnapshot, buildFacts, headlines, validatePlan, snapshotHash, canonical };
