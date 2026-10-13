const crypto = require('node:crypto');

const STATS = ['attack', 'defense', 'strategy', 'sense', 'macro', 'scout', 'control', 'harass'];
const MAP = Object.freeze({ id: 'exchange-neutral-v1', name: '교류전 표준 전장', tags: [], rushDistance: 50, resources: 50, complexity: 50,
  matchupBalance: { TvT: 0, ZvZ: 0, PvP: 0, TvZ: 0, TvP: 0, ZvP: 0 } });
class ExchangeError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
function fail(status, code, message) { throw new ExchangeError(status, code, message); }
function plain(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function text(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) fail(400, 'INVALID_SNAPSHOT', `${label} 형식이 올바르지 않사와요.`);
  return value.trim();
}
function entityId(value) {
  const id = text(value, 100, 'ID');
  if (!/^[A-Za-z0-9_-]+$/.test(id) || (/^\d+$/.test(id) && (!/^[1-9]\d*$/.test(id) || BigInt(id) > 18446744073709551615n))) fail(400, 'INVALID_ID', '선수·팀 ID는 정확한 문자열이어야 한답니다.');
  return id;
}
function bounded(value, low, high, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) fail(400, 'INVALID_SNAPSHOT', `${label} 허용 범위를 확인하시와요.`);
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (plain(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function hash(value) { return crypto.createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex'); }
function normalizeSnapshot(value) {
  if (!plain(value) || Buffer.byteLength(JSON.stringify(value)) > 96 * 1024 || !plain(value.team)) fail(400, 'INVALID_SNAPSHOT', '구단 자료 형식이나 크기를 확인하시와요.');
  if (!Number.isSafeInteger(value.sourceSeasonNo)) fail(400, 'INVALID_SNAPSHOT', '시즌 번호는 정수여야 한답니다.');
  const team = value.team;
  if (!Array.isArray(team.roster) || team.roster.length < 1 || team.roster.length > 80) fail(400, 'INVALID_SNAPSHOT', '교류전 등록 선수는 1~80명이랍니다.');
  const ids = new Set();
  const roster = team.roster.map(p => {
    if (!plain(p) || !plain(p.stats)) fail(400, 'INVALID_SNAPSHOT', '선수 능력치가 필요하답니다.');
    const id = entityId(p.id);
    if (ids.has(id)) fail(400, 'DUPLICATE_PLAYER', '한 구단에 같은 선수 ID를 두 번 등록할 수 없사와요.');
    ids.add(id);
    if (!['T', 'Z', 'P'].includes(p.race)) fail(400, 'INVALID_SNAPSHOT', '선수 종족을 확인하시와요.');
    let offset = 0;
    if (p.statEncoding !== undefined) {
      if (!plain(p.statEncoding) || p.statEncoding.type !== 'legacy-additive-offset' || p.statEncoding.offset !== 816) fail(400, 'INVALID_SNAPSHOT', '원본 능력치 보정 표지가 올바르지 않사와요.');
      offset = 816;
    }
    const stats = Object.fromEntries(STATS.map(key => [key, bounded(p.stats[key], offset, 65535 + offset, key) - offset]));
    return { id, name: text(p.name, 60, '선수 이름'), race: p.race, level: 1,
      condition: bounded(p.condition, 0, 200, '컨디션'), ap: 0, fame: 0, stats };
  });
  // This friendly MVP accepts uploaded player stats, not local inventory/economy or coaching bonuses.
  return { schemaVersion: 1, sourceCareerId: text(value.sourceCareerId, 120, '커리어 ID'),
    sourceRevision: text(value.sourceRevision, 80, '커리어 시점'), sourceSeasonNo: bounded(value.sourceSeasonNo, 1, 1000000, '시즌'),
    verificationLevel: 'personal-save-unverified',
    team: { id: entityId(team.id), name: text(team.name, 80, '구단 이름'), coach: '교류전 감독', coachStyle: 'balanced', money: '0', roster } };
}
function commandId(value) { const id = text(value, 100, '요청 ID'); if (!/^[A-Za-z0-9_-]+$/.test(id)) fail(400, 'INVALID_COMMAND', '요청 ID를 확인하시와요.'); return id; }
function member(room, userId) { return room.members.find(m => m.userId === userId); }

function createExchangeService({ repository, engine, inviteSecret, clock = () => Date.now(), leaseMs = 30000 }) {
  if (!repository || !inviteSecret) throw new Error('Exchange repository and stable invite secret are required');
  function engineInfo() {
    if (!engine || typeof engine.simulate !== 'function' || !engine.engineVersion || !engine.buildHash) fail(503, 'ENGINE_UNAVAILABLE', '교류전 서버의 경기 엔진이 아직 준비되지 않았사와요.');
    return { engineVersion: engine.engineVersion, engineBuildHash: engine.buildHash };
  }
  const invite = id => crypto.createHmac('sha256', inviteSecret).update(`myanimecraft-exchange-v1:${id}`).digest('hex').slice(0, 32).toUpperCase();
  async function requireRoom(id, userId) {
    const room = await repository.get(id);
    if (!room || !member(room, userId)) fail(404, 'ROOM_NOT_FOUND', '참가 중인 교류전을 찾을 수 없사와요.');
    return room;
  }
  function view(room, userId, includeReplay = true) {
    const reveal = room.members.length === 2 && room.members.every(m => m.confirmed);
    return { id: room.id, revision: room.revision, status: room.status, createdAt: room.createdAt, updatedAt: room.updatedAt,
      ...room.engine, map: MAP, rules: 'personal-save-friendly-v1', noRewards: true, error: room.error || null,
      members: room.members.map(m => ({ userId: m.userId, teamId: m.snapshot.team.id, teamName: m.snapshot.team.name,
        rosterCount: m.snapshot.team.roster.length, confirmed: m.confirmed, snapshotHash: m.snapshotHash,
        ...(m.userId === userId || reveal ? { snapshot: m.snapshot, playerId: m.playerId || null } : {}) })),
      ...(room.hostId === userId && room.status === 'waiting' ? { inviteCode: invite(room.id) } : {}),
      ...(room.result ? { result: includeReplay ? room.result : { winner: room.result.winner, durationSec: room.result.durationSec, engineVersion: room.result.engineVersion }, resultHash: room.resultHash } : {}),
      ...(room.seed && reveal ? { seed: room.seed, ...(room.inputHash ? { inputHash: room.inputHash } : {}) } : {}),
      ...(room.status === 'running' ? { retryAfter: room.leaseUntil } : {}) };
  }
  async function save(old, next) {
    next.updatedAt = clock(); next.revision = old.revision + 1;
    if (!await repository.compareAndSwap(old.id, old.revision, next)) fail(409, 'REVISION_CONFLICT', '상태가 갱신되었사와요. 새 상태를 확인한 뒤 다시 확정하시와요.');
    return next;
  }
  function prior(room, userId, id, fingerprint) {
    const item = room.commands.find(c => c.userId === userId && c.id === id);
    if (!item) return false;
    if (item.fingerprint !== fingerprint) fail(409, 'COMMAND_REUSE', '동일한 요청 ID에 다른 내용을 보낼 수 없사와요.');
    return true;
  }
  function assertEngine(room) {
    const info = engineInfo();
    if (room.engine.engineVersion !== info.engineVersion || room.engine.engineBuildHash !== info.engineBuildHash) fail(409, 'ENGINE_VERSION_MISMATCH', '등록 당시 엔진과 서버 버전이 달라졌사와요. 기존 버전 서버에서 재개하거나 새 교류전을 만들어야 한답니다.');
  }
  return {
    async sessionInfo() { return { ready: true, ...engineInfo(), rules: 'personal-save-friendly-v1', noRewards: true }; },
    async create(userId, body) {
      const id = commandId(body.commandId), snapshot = normalizeSnapshot(body.snapshot), fingerprint = hash(snapshot);
      const createKey = `${userId}:${id}`;
      const previous = await repository.byCreateKey(createKey);
      if (previous) { prior(previous, userId, id, fingerprint); return view(previous, userId); }
      const roomId = crypto.randomUUID(), now = clock();
      const room = { id: roomId, createKey, hostId: userId, inviteHash: hash(invite(roomId)), engine: engineInfo(), revision: 0,
        status: 'waiting', createdAt: now, updatedAt: now,
        members: [{ userId, snapshot, snapshotHash: hash(snapshot), confirmed: false }], commands: [{ userId, id, fingerprint }] };
      try { await repository.create(room); }
      catch (error) { if (error.code !== 11000) throw error; const existing = await repository.byCreateKey(createKey); if (!existing) throw error; prior(existing, userId, id, fingerprint); return view(existing, userId); }
      return view(room, userId);
    },
    async join(userId, body) {
      const id = commandId(body.commandId), snapshot = normalizeSnapshot(body.snapshot), fingerprint = hash(snapshot);
      const code = text(body.inviteCode, 64, '초대 코드').replace(/\s/g, '').toUpperCase();
      const room = /^[A-F0-9]{32}$/.test(code) ? await repository.byInviteHash(hash(code)) : null;
      if (!room) fail(404, 'INVITE_NOT_FOUND', '초대 코드를 확인하시와요.');
      if (prior(room, userId, id, fingerprint)) return view(room, userId);
      if (member(room, userId)) {
        if (member(room, userId).snapshotHash !== fingerprint) fail(409, 'SNAPSHOT_LOCKED', '등록한 구단은 교류전 도중 바꿀 수 없사와요.');
        return view(room, userId);
      }
      if (room.status !== 'waiting' || room.members.length >= 2) fail(409, 'ROOM_FULL', '이미 두 구단이 참가한 교류전이랍니다.');
      assertEngine(room);
      const next = structuredClone(room);
      next.members.push({ userId, snapshot, snapshotHash: hash(snapshot), confirmed: false });
      next.commands.push({ userId, id, fingerprint });
      return view(await save(room, next), userId);
    },
    async get(userId, id) { return view(await requireRoom(id, userId), userId); },
    async list(userId) { return (await repository.list(userId)).map(room => view(room, userId, false)); },
    async confirm(userId, roomId, body) {
      const id = commandId(body.commandId), playerId = entityId(body.playerId), fingerprint = hash({ action: 'confirm', playerId });
      const room = await requireRoom(roomId, userId);
      if (prior(room, userId, id, fingerprint)) return view(room, userId);
      if (room.status !== 'waiting' || room.members.length !== 2) fail(409, 'NOT_READY', '두 구단 참가 후 엔트리를 확정할 수 있사와요.');
      if (!Number.isSafeInteger(body.revision) || room.revision !== body.revision) fail(409, 'REVISION_CONFLICT', '새 상태를 확인한 뒤 다시 확정하시와요.');
      const me = member(room, userId);
      if (me.confirmed) fail(409, 'ENTRY_LOCKED', '이미 확정한 엔트리랍니다.');
      if (!me.snapshot.team.roster.some(p => p.id === playerId)) fail(400, 'NOT_YOUR_PLAYER', '등록한 자기 구단의 선수만 선택할 수 있사와요.');
      assertEngine(room);
      const next = structuredClone(room), nextMe = member(next, userId);
      nextMe.playerId = playerId; nextMe.confirmed = true;
      next.commands.push({ userId, id, fingerprint });
      if (next.members.every(m => m.confirmed)) { next.status = 'ready'; next.seed = crypto.randomBytes(24).toString('hex'); }
      return view(await save(room, next), userId);
    },
    async resolve(userId, id) {
      const room = await requireRoom(id, userId);
      if (room.status === 'finished') return view(room, userId);
      if (room.status === 'running' && room.leaseUntil > clock()) return view(room, userId);
      if (!['ready', 'running', 'failed'].includes(room.status)) fail(409, 'NOT_READY', '양측 엔트리 확정 후 경기를 시작할 수 있사와요.');
      assertEngine(room);
      const next = structuredClone(room);
      next.status = 'running'; next.error = null; next.leaseUntil = clock() + leaseMs;
      const competitor = m => ({ team: m.snapshot.team, player: m.snapshot.team.roster.find(p => p.id === m.playerId) });
      const input = { seed: room.seed, map: MAP, home: competitor(room.members[0]), away: competitor(room.members[1]), maxDecisions: 16 };
      next.inputHash = hash({ ...room.engine, input });
      const claimed = await save(room, next);
      try {
        const result = await engine.simulate(input);
        if (!result || !['home', 'away'].includes(result.winner) || result.seed !== room.seed || result.engineVersion !== room.engine.engineVersion || !Array.isArray(result.frames) || !Array.isArray(result.events)) throw new Error('INVALID_ENGINE_RESULT');
        if (Buffer.byteLength(JSON.stringify(result)) > 8 * 1024 * 1024) throw new Error('RESULT_TOO_LARGE');
        const finished = { ...claimed, status: 'finished', result, resultHash: hash(result), leaseUntil: 0, error: null };
        try { return view(await save(claimed, finished), userId); }
        catch (error) { if (error.code !== 'REVISION_CONFLICT') throw error; return view(await requireRoom(id, userId), userId); }
      } catch (error) {
        const failed = { ...claimed, status: 'failed', leaseUntil: 0, error: '경기 계산을 완료하지 못했사와요. 같은 입력으로 다시 시도할 수 있답니다.' };
        try { await save(claimed, failed); } catch (conflict) { if (conflict.code !== 'REVISION_CONFLICT') throw conflict; }
        return view(await requireRoom(id, userId), userId);
      }
    },
  };
}
module.exports = { createExchangeService, normalizeSnapshot, ExchangeError, hash, MAP };
