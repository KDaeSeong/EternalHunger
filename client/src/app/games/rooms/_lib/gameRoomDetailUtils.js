import { dynamicGameCandidateToGame } from '../../_lib/gameCatalog';

export const RECORD_RESULT_OPTIONS = [
  ['none', '기록'],
  ['win', '승리'],
  ['loss', '패배'],
  ['draw', '무승부'],
  ['clear', '클리어'],
  ['fail', '실패'],
];

export const ROOM_SAVE_VERSION = 'room-state-v1';

export function normalizeRouteId(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw == null ? '' : String(raw);
}

export function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function statusLabel(value) {
  if (value === 'open') return '모집 중';
  if (value === 'playing') return '진행 중';
  if (value === 'finished') return '완료';
  if (value === 'closed') return '종료';
  return '대기';
}

export function playerStatusLabel(value) {
  if (value === 'ready') return '준비';
  if (value === 'left') return '퇴장';
  return '참가';
}

export function userIdOf(value) {
  return String(value?._id || value?.id || value?.userId || value || '');
}

export function cleanSlotKey(value, fallback = 'room-save') {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

export function getPlayTimeSec(startedAt) {
  const start = new Date(startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function activeRoomPlayers(room) {
  return Array.isArray(room?.players) ? room.players.filter((player) => player?.status !== 'left') : [];
}

export function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

export function findDynamicGameCandidate(payload, slug) {
  const key = String(slug || '').trim();
  if (!key) return null;
  return normalizeList(payload?.candidates)
    .map(dynamicGameCandidateToGame)
    .find((game) => game?.slug === key) || null;
}

export function playerDisplayName(player) {
  return safeText(player?.displayName || player?.user?.displayName || player?.user?.nickname || player?.user?.username, '사용자');
}

export function isRoomSaveSlot(save) {
  const summary = save?.summary && typeof save.summary === 'object' ? save.summary : {};
  return summary.source === 'game-room';
}

export function saveSlotLabel(save) {
  const summary = save?.summary && typeof save.summary === 'object' ? save.summary : {};
  const revision = Number(summary.revision || 0);
  const roomTitle = safeText(summary.roomTitle, save?.saveName || save?.slotKey || '저장 슬롯');
  return `${roomTitle} · ${save?.slotKey || 'slot'} · r${revision}`;
}

export function buildDefaultRecordForm(room) {
  const roomState = room?.state && typeof room.state === 'object' ? room.state : {};
  const matchState = roomState.state && typeof roomState.state === 'object' ? roomState.state : {};
  const hostId = userIdOf(room?.hostId);
  const winner = String(matchState.winner || '');
  const playTimeSec = getPlayTimeSec(matchState.startedAt || room?.startedAt || room?.createdAt);
  return {
    roomId: userIdOf(room?._id || room?.id),
    title: `${safeText(room?.title, '게임방')} 결과`,
    winnerUserId: winner === 'player' ? hostId : '',
    result: winner === 'enemy' ? 'loss' : 'none',
    score: winner === 'player' ? '100' : '0',
    playTimeSec: String(playTimeSec),
    note: '',
  };
}

export function buildDefaultSaveForm(room) {
  const roomId = userIdOf(room?._id || room?.id);
  return {
    roomId,
    slotKey: cleanSlotKey(roomId ? `room-${roomId}` : 'room-save'),
    saveName: `${safeText(room?.title, '게임방')} 저장`,
    note: '',
  };
}

export function buildRoomSavePayload(room, form = {}) {
  const roomState = room?.state && typeof room.state === 'object' ? room.state : {};
  const settings = room?.settings && typeof room.settings === 'object' ? room.settings : {};
  const summary = room?.summary && typeof room.summary === 'object' ? room.summary : {};
  const roomId = userIdOf(room?._id || room?.id);
  return {
    saveName: safeText(form.saveName, `${safeText(room?.title, '게임방')} 저장`),
    version: ROOM_SAVE_VERSION,
    summary: {
      source: 'game-room',
      roomId,
      roomTitle: safeText(room?.title, '게임방'),
      roomStatus: safeText(room?.status, 'open'),
      mode: safeText(room?.mode, ''),
      revision: Number(room?.revision || 0),
      playerCount: Number(room?.playerCount || 0),
      stateBytes: Number(room?.stateBytes || 0),
      note: safeText(form.note, ''),
    },
    payload: {
      source: 'game-room',
      roomId,
      gameSlug: safeText(room?.gameSlug, ''),
      roomTitle: safeText(room?.title, '게임방'),
      roomMode: safeText(room?.mode, ''),
      roomStatus: safeText(room?.status, 'open'),
      revision: Number(room?.revision || 0),
      summary,
      settings,
      state: roomState,
      savedAt: new Date().toISOString(),
    },
  };
}

export function buildRoomRecordPayload(room, form = {}) {
  const roomState = room?.state && typeof room.state === 'object' ? room.state : {};
  const matchState = roomState.state && typeof roomState.state === 'object' ? roomState.state : {};
  const players = activeRoomPlayers(room);
  const hostId = userIdOf(room?.hostId);
  const winner = String(matchState.winner || '');
  const manualWinnerUserId = userIdOf(form.winnerUserId);
  const winnerUserId = manualWinnerUserId || (winner === 'player' ? hostId : '');
  const commonResult = String(form.result || (winner === 'enemy' ? 'loss' : 'none')).trim() || 'none';
  const manualScore = Number(form.score);
  const hasManualScore = Number.isFinite(manualScore);
  const resultByUserId = {};
  const scoreByUserId = {};
  const turn = Number(matchState.turn || 0);
  const playerHealth = Number(matchState.playerHealth || 0);
  const enemyHealth = Number(matchState.enemyHealth || 0);

  players.forEach((player) => {
    const playerId = userIdOf(player?.userId);
    if (!playerId) return;
    if (winnerUserId) resultByUserId[playerId] = playerId === winnerUserId ? 'win' : 'loss';
    else resultByUserId[playerId] = commonResult;
    scoreByUserId[playerId] = hasManualScore
      ? manualScore
      : resultByUserId[playerId] === 'win'
      ? 100 + Math.max(0, playerHealth) + Math.max(0, 12 - turn)
      : Math.max(0, enemyHealth);
  });

  const playTimeSec = Number(form.playTimeSec);
  return {
    title: safeText(form.title, `${safeText(room?.title, '게임방')} 결과`),
    mode: safeText(room?.mode, room?.gameSlug || ''),
    winnerUserId,
    resultByUserId,
    scoreByUserId,
    result: winnerUserId ? 'none' : commonResult,
    playTimeSec: Number.isFinite(playTimeSec) ? Math.max(0, Math.floor(playTimeSec)) : getPlayTimeSec(matchState.startedAt || room?.startedAt || room?.createdAt),
    summary: {
      deckName: roomState.deckName || '',
      turn,
      playerHealth,
      enemyHealth,
      winner: winner || 'none',
      manualWinnerUserId,
      commonResult,
      note: safeText(form.note, ''),
    },
    payload: {
      roomState,
    },
  };
}
