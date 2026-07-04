import { getPhaseDurationSec, getRuleset } from '../../../utils/rulesets';
import { LUMIA_ZONE_POS } from './simulationEngine';

const ZONE_POS_ALIASES = {
  골목길: 'alley',
  주유소: 'gas_station',
  양궁장: 'archery',
  학교: 'school',
  경찰서: 'police',
  소방서: 'firestation',
  절: 'temple',
  개울: 'stream',
  공원: 'park',
  연못: 'park',
  병원: 'hospital',
  호텔: 'hotel',
  해수욕장: 'beach',
  모래사장: 'beach',
  숲: 'forest',
  아파트단지: 'apartment',
  '고급 주택가': 'apartment',
  고급주택가: 'apartment',
  묘지: 'cemetery',
  성당: 'cathedral',
  창고: 'warehouse',
  항구: 'port',
  바지선: 'barge',
  공장: 'factory',
  연구소: 'lab',
  pond: 'park',
  residential: 'apartment',
  uptown: 'apartment',
  gasstation: 'gas_station',
  gas_station: 'gas_station',
  fire_station: 'firestation',
  firestation: 'firestation',
  sandybeach: 'beach',
  sandy_beach: 'beach',
};

const RECENT_PING_TTL_MS = 2800;
const RECENT_PING_LIMIT = 3;
const RECENT_PING_TAIL = 160;
const IMPORTANT_GAIN_SOURCES = new Set(['legend', 'natural', 'boss', 'mutant', 'transcend', 'rift']);

function compactZoneKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[()]/g, '');
}

function resolveZonePosKey(zone) {
  const candidates = [
    zone?.zoneId,
    zone?.id,
    zone?._id,
    zone?.key,
    zone?.name,
    zone?.nameKr,
    zone?.nameKo,
    zone?.zoneName,
    zone?.areaName,
    zone?.placeName,
    zone?.displayName,
    zone?.label,
  ];

  for (const raw of candidates) {
    const text = String(raw || '').trim();
    if (!text) continue;
    if (LUMIA_ZONE_POS[text]) return text;
    if (ZONE_POS_ALIASES[text]) return ZONE_POS_ALIASES[text];

    const compact = compactZoneKey(text);
    if (LUMIA_ZONE_POS[compact]) return compact;
    if (ZONE_POS_ALIASES[compact]) return ZONE_POS_ALIASES[compact];
  }

  return '';
}

export function buildZonePositions(zones) {
  const list = Array.isArray(zones) ? zones : [];
  const rows = list
    .map((zone) => ({
      id: String(zone?.zoneId || zone?.id || zone?._id || '').trim(),
      posKey: resolveZonePosKey(zone),
    }))
    .filter((row) => row.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  const out = {};
  if (!rows.length) return out;

  rows.forEach(({ id, posKey }) => {
    const pos = LUMIA_ZONE_POS[posKey] || LUMIA_ZONE_POS[id];
    if (pos) out[id] = { x: pos.x, y: pos.y };
  });

  const missing = rows.filter(({ id }) => !out[id]).map(({ id }) => id);
  if (missing.length) {
    const cx = 50;
    const cy = 54;
    const radius = missing.length <= 2 ? 18 : missing.length <= 6 ? 26 : 34;
    missing.forEach((id, idx) => {
      const angle = (Math.PI * 2 * idx) / missing.length;
      out[id] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });
  }

  return out;
}

export function buildZoneEdges({ zones, zoneGraph }) {
  const ids = (Array.isArray(zones) ? zones : []).map((zone) => String(zone?.zoneId || '')).filter(Boolean);
  const idSet = new Set(ids);
  const uniq = new Set();
  const edges = [];

  Object.keys(zoneGraph || {}).forEach((a) => {
    if (!idSet.has(a)) return;
    const arr = Array.isArray(zoneGraph?.[a]) ? zoneGraph[a] : [];
    arr.forEach((b) => {
      if (!idSet.has(b) || a === b) return;
      const key = a < b ? `${a}::${b}` : `${b}::${a}`;
      if (uniq.has(key)) return;
      uniq.add(key);
      edges.push([a, b]);
    });
  });

  return edges;
}

function pingZoneId(event) {
  if (!event) return '';
  if (String(event.kind || '') === 'move') return String(event.to || '');
  return String(event.zoneId || '');
}

function pingIcon(event) {
  const kind = String(event?.kind || '');
  if (kind === 'battle') return '⚔️';
  if (kind === 'death') return '💀';
  if (kind === 'objective') {
    const objective = String(event?.objective || '');
    const subkind = String(event?.subkind || event?.objectiveSubkind || '');
    if (objective === 'boss') return '👹';
    if (objective === 'legendary_crate' || objective === 'transcend_crate') return '🎁';
    if (objective === 'natural_core' && subkind.includes('life')) return '🌳';
    if (objective === 'natural_core') return '✨';
    return '⭐';
  }
  if (kind === 'move') return String(event?.transport || '') === 'hyperloop' ? '🌀' : '🚶';
  if (kind === 'skill') return String(event?.mode || '') === 'character_skill' ? '🌀' : '🎯';
  if (kind === 'gain') {
    const itemId = String(event?.itemId || '');
    if (itemId === 'CREDITS') return '💳';
    const source = String(event?.source || '');
    if (source === 'legend') return '🟪';
    if (source === 'natural') return '✨';
    if (source === 'boss') return '👹';
    if (source === 'mutant') return '🧪';
    return '📦';
  }
  return '•';
}

function shouldShowRecentPing(event) {
  const kind = String(event?.kind || '');
  if (kind === 'death') return true;
  if (kind === 'objective') return true;
  if (kind === 'battle') return event?.lethal === true || String(event?.winner || '');
  if (kind === 'gain') {
    const itemId = String(event?.itemId || '');
    if (itemId === 'CREDITS') return false;
    return IMPORTANT_GAIN_SOURCES.has(String(event?.source || ''));
  }
  return false;
}

function pingPriority(event) {
  const kind = String(event?.kind || '');
  if (kind === 'death') return 5;
  if (kind === 'objective') return 4;
  if (kind === 'battle') return 3;
  if (kind === 'gain') return 2;
  return 1;
}

export function buildRecentPings({ runEvents, pingNow, zonePos }) {
  const now = Number(pingNow || Date.now());
  const tail = (Array.isArray(runEvents) ? runEvents : []).slice(-RECENT_PING_TAIL);
  const bestByZone = new Map();

  for (let i = tail.length - 1; i >= 0; i -= 1) {
    const event = tail[i];
    const ts = Number(event?.ts || 0);
    if (!ts || (now - ts) > RECENT_PING_TTL_MS) continue;
    if (!shouldShowRecentPing(event)) continue;
    const zoneId = pingZoneId(event);
    if (!zoneId || !zonePos?.[zoneId]) continue;

    const row = {
      id: String(event._id || event.ts || `${i}`),
      zoneId,
      kind: String(event.kind || ''),
      icon: pingIcon(event),
      priority: pingPriority(event),
      ts,
    };
    const prev = bestByZone.get(zoneId);
    if (!prev || row.priority > prev.priority || (row.priority === prev.priority && row.ts > prev.ts)) {
      bestByZone.set(zoneId, row);
    }
  }

  return Array.from(bestByZone.values())
    .sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)) || (Number(b.ts || 0) - Number(a.ts || 0)))
    .slice(0, RECENT_PING_LIMIT);
}

export function getEmptyDetonationRiskSummary() {
  return {
    visible: false,
    total: 0,
    forbiddenCnt: 0,
    safeLeft: 0,
    riskyCount: 0,
    riskyTitle: '',
    willForceAllThisPhase: false,
    fzHoverText: '현재 금지구역 없음',
  };
}

export function buildDetonationRiskSummary({
  day,
  activeMap,
  zones,
  forbiddenNow,
  rulesetId,
  survivors,
  phase,
  getZoneName,
}) {
  if (day <= 0) return getEmptyDetonationRiskSummary();

  const total = Array.isArray(activeMap?.zones) ? activeMap.zones.length : (Array.isArray(zones) ? zones.length : 0);
  const forbiddenCnt = forbiddenNow?.size ? forbiddenNow.size : 0;
  const safeLeft = Math.max(0, total - forbiddenCnt);
  const ruleset = getRuleset(rulesetId);
  const critical = Math.max(0, Number(ruleset?.detonation?.criticalSec ?? 5));
  const riskyChars = [];

  for (const char of (Array.isArray(survivors) ? survivors : [])) {
    const detonationSec = Number(char?.detonationSec);
    if (!Number.isFinite(detonationSec)) continue;
    const sec = Math.max(0, Math.floor(detonationSec));
    if (sec > critical) continue;
    riskyChars.push({ name: char?.name, sec });
  }

  riskyChars.sort((a, b) => Number(a?.sec || 0) - Number(b?.sec || 0));
  const riskyCount = riskyChars.length;
  const riskyMin = riskyCount ? Number(riskyChars[0]?.sec || 0) : null;
  const riskyNames = riskyCount
    ? riskyChars
        .map((char) => String(char?.name || '미상').trim())
        .filter(Boolean)
        .slice(0, 5)
        .join(', ')
    : '';
  const riskyExtra = riskyCount > 5 ? ` 외 ${riskyCount - 5}명` : '';
  const riskyTitle = riskyCount
    ? `폭발 타이머 임계치(${critical}s) 이하 · 최소 ${riskyMin}s: ${riskyNames}${riskyExtra}`
    : `폭발 타이머 임계치(${critical}s) 이하 생존자 없음`;

  const detForceAll = Math.max(0, Number(ruleset?.detonation?.forceAllAfterSec ?? 40));
  const isEndgame = safeLeft <= 2 && total > 0;
  const curPhaseDur = Math.max(0, Number(getPhaseDurationSec(ruleset, day, phase) || 0));
  const willForceAllThisPhase = isEndgame && curPhaseDur >= detForceAll;
  const fzNameArr = forbiddenCnt
    ? Array.from(forbiddenNow)
        .map((zoneId) => String(getZoneName?.(zoneId) || ''))
        .filter((name) => name && name !== '__default__')
    : [];
  const fzHead = fzNameArr.slice(0, 5);
  const fzExtra = fzNameArr.length > 5 ? ` (+${fzNameArr.length - 5})` : '';
  const fzNamesShort = fzNameArr.length ? `${fzHead.join(', ')}${fzExtra}` : '';
  const fzHoverText = forbiddenCnt ? `금지구역: ${fzNamesShort}` : '현재 금지구역 없음';

  return {
    visible: true,
    total,
    forbiddenCnt,
    safeLeft,
    riskyCount,
    riskyTitle,
    willForceAllThisPhase,
    fzHoverText,
  };
}
