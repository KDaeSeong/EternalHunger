import { isValidFounderHistory } from './primitiveArchiveFounders.js';

const DOMAINS = ['gather', 'hunt', 'craft', 'study', 'care'];
const CHANCE_DOMAINS = ['gather', 'hunt', 'craft'];
const LABELS = { gather: '채집', hunt: '사냥', craft: '제작·건설', study: '연구·회의', care: '휴식 회복' };
const CONTRIBUTIONS = {
  gather: ['gather', 'specialized'], hunt: ['hunt'], craft: ['craft', 'camp', 'project'],
  study: ['research_contribution', 'civic_contribution', 'diplomacy', 'utility'], care: ['recovery'],
};
const EVIDENCE = {
  gather: '채집과 특화 생산', hunt: '사냥', craft: '제작·캠프·공동 건설',
  study: '연구·회의·외교·공동 운영', care: '회복과 돌봄',
};
const EFFECTS = {
  gather: '정상 채집 확률 시도 2회의 성공 가능성 +15%p · 기존 상한 유지',
  hunt: '정상 사냥 확률 시도 2회의 성공 가능성 +15%p · 기존 상한 유지',
  craft: '정상 제작 확률 시도 2회의 성공 가능성 +15%p · 기존 상한 유지',
  study: '실제 연구·회의 기여 2회에 RP 또는 CP +2 · 현재 목표의 남은 필요량까지',
  care: '실제 휴식 회복 2회에 HP +4 · 최대 HP 100까지',
};
const RESPONSES = {
  gather: '흩어진 흔적도 놓치지 마. 필요한 것을 찾았던 길을 기억해.',
  hunt: '서두르지 마. 함께 살아남을 기회를 기다려.',
  craft: '손에 남은 경험을 믿어. 하나를 만들더라도 끝까지 살펴.',
  study: '배운 것을 서로 나눠. 남겨 둔 기록이 다음 선택을 도울 거야.',
  care: '먼저 숨을 고르고 다친 곳을 살펴. 함께 돌아오는 것이 중요해.',
};
const BONUS = 0.15;
const USES = 2;
const MIN_CONTRIBUTIONS = 3;
const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasShape = (value, keys) => isRecord(value) && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));
const validDay = day => Number.isSafeInteger(day) && day >= 1;

function founders(state) {
  const history = state?.founderHistory;
  if (!state || typeof state.runId !== 'string' || !state.runId || !validDay(state.day)
    || !isValidFounderHistory(history, state) || history?.origin !== 'new_run'
    || history.foundersKnown !== true) return [];
  const rows = history.members.filter(member => member.isFounder);
  return rows.length === 3 ? rows : [];
}

function domainOf(member) {
  let domain = '';
  let count = 0;
  for (const candidate of DOMAINS) {
    const total = CONTRIBUTIONS[candidate].reduce((sum, kind) => sum + Number(member?.tallies?.[kind] || 0), 0);
    if (total > count) { domain = candidate; count = total; }
  }
  return { domain, count };
}

function statusOf(state, member) {
  const actor = state.party?.find(row => row.id === member.actorId);
  const lifecycle = state.lineage?.members?.find(row => row.actorId === member.actorId);
  const activeLiving = Number(actor?.hp || 0) > 0;
  const retiredLiving = lifecycle?.stage === 'retired' && Number(lifecycle.retiredSnapshot?.hp || 0) > 0;
  const death = member.deathRecord || lifecycle?.deathRecord;
  const confirmedDeath = death && ['action', 'night', 'natural'].includes(death.source)
    && validDay(death.day) && death.day <= state.day;
  if (confirmedDeath && !activeLiving && !retiredLiving) return { status: 'deceased', death };
  if (confirmedDeath) return { status: 'unconfirmed', death: null };
  if (activeLiving) return { status: 'living', death: null };
  if (retiredLiving) return { status: 'retired', death: null };
  return { status: 'unconfirmed', death: null };
}

export function createAncestralFaith(state) {
  return { version: 1, runId: state?.runId || '',
    origin: founders(state).length === 3 ? 'new_run' : 'legacy_disabled',
    lastRiteDay: 0, lastRiteFounderId: '', active: null };
}

export function isValidAncestralFaith(raw, state) {
  if (raw === undefined) return true;
  if (!hasShape(raw, ['version', 'runId', 'origin', 'lastRiteDay', 'lastRiteFounderId', 'active'])
    || raw.version !== 1 || raw.runId !== state?.runId || typeof raw.runId !== 'string'
    || !validDay(state?.day) || !['new_run', 'legacy_disabled'].includes(raw.origin)
    || !Number.isSafeInteger(raw.lastRiteDay) || raw.lastRiteDay < 0 || raw.lastRiteDay > state.day
    || typeof raw.lastRiteFounderId !== 'string') return false;
  if (raw.origin === 'legacy_disabled') {
    return raw.lastRiteDay === 0 && raw.lastRiteFounderId === '' && raw.active === null;
  }
  const rows = founders(state);
  if (rows.length !== 3) return false;
  if (raw.lastRiteDay === 0) return raw.lastRiteFounderId === '' && raw.active === null;
  const member = rows.find(row => row.actorId === raw.lastRiteFounderId);
  if (!member) return false;
  if (raw.active === null) return true;
  const active = raw.active;
  return hasShape(active, ['founderId', 'domain', 'day', 'remaining'])
    && active.founderId === member.actorId && DOMAINS.includes(active.domain)
    && active.day === raw.lastRiteDay && validDay(active.day)
    && Number.isInteger(active.remaining) && active.remaining >= 1 && active.remaining <= USES
    && CONTRIBUTIONS[active.domain].reduce((sum, kind) => sum + Number(member.tallies?.[kind] || 0), 0) >= MIN_CONTRIBUTIONS;
}

export function normalizeAncestralFaith(raw, state) {
  // A save from before this feature stays disabled even if its older founder
  // history was already known. Only explicit new-run creation activates faith.
  if (raw === undefined) return { version: 1, runId: state?.runId || '', origin: 'legacy_disabled',
    lastRiteDay: 0, lastRiteFounderId: '', active: null };
  if (!isValidAncestralFaith(raw, state)) throw new RangeError('Invalid ancestral faith');
  return { ...raw, active: raw.active?.day === state.day ? { ...raw.active } : null };
}

function readiness(state, actorId, member, faith) {
  if (faith.origin !== 'new_run') return ['legacy_disabled', '이전 런에서는 조상신 효과를 새로 활성화하지 않습니다.'];
  if (state.ended) return ['ended', '종료된 런에서는 가르침이나 의례를 실행할 수 없습니다.'];
  const actor = state.party?.find(row => row.id === actorId);
  if (!actor || !(Number(actor.hp) > 0)) return ['actor', '살아 있는 현재 대원이 필요합니다.'];
  if (!member) return ['founder', '처음 함께 시작한 인물만 가르침과 전승의 대상이 됩니다.'];
  const status = statusOf(state, member).status;
  if (status === 'unconfirmed') return ['unconfirmed', '현재 생존이나 사망을 확인할 수 없는 인물입니다.'];
  if (domainOf(member).count < MIN_CONTRIBUTIONS) {
    return ['contributions', '전승으로 이어질 한 분야에서 실제 기여 3회가 필요합니다.'];
  }
  if (!state.research?.completed?.SETTLEMENT || !state.research?.completed?.FOOD_STORAGE) {
    return ['settlement', '정착과 식량 저장이 마련되어야 전승을 공동으로 이어갈 수 있습니다.'];
  }
  if (!(Number(state.camp?.fireLevel) >= 1) || !(Number(state.camp?.fuel) >= 1)) {
    return ['fire', '연료가 있는 모닥불이 필요합니다.'];
  }
  if (!(Number(state.ap) >= 1)) return ['ap', '가르침을 사용할 다음 행동력이 남아 있어야 합니다.'];
  if (faith.lastRiteDay === state.day || faith.active) return ['cooldown', '가르침과 의례는 모든 인물이 하루 한 번을 함께 사용합니다.'];
  if (typeof state.inventory?.berry !== 'number' || !Number.isFinite(state.inventory.berry)
    || state.inventory.berry < 1) return ['food', '실제 비축 베리 1개가 필요합니다.'];
  return ['', ''];
}

export function runAncestralRite(state, { actorId, founderId } = {}) {
  const faith = normalizeAncestralFaith(state?.ancestralFaith, state);
  const member = founders(state).find(row => row.actorId === founderId);
  const [reason, message] = readiness(state, actorId, member, faith);
  if (reason) return { state, ok: false, reason, message };
  const { domain } = domainOf(member);
  const status = statusOf(state, member).status;
  const mode = status === 'deceased' ? '가호' : '가르침';
  const response = RESPONSES[domain];
  // This is a material transaction only. The engine must not call afterAction:
  // no AP, time, passive RP/CP, workforce production or gameplay RNG is granted.
  return {
    state: { ...state, inventory: { ...state.inventory, berry: state.inventory.berry - 1 },
      ancestralFaith: { ...faith, lastRiteDay: state.day, lastRiteFounderId: member.actorId,
        active: { founderId: member.actorId, domain, day: state.day, remaining: USES } } },
    ok: true, reason: '',
    message: `${member.name}의 ${mode}: “${response}” 베리 1개를 나누었습니다. 오늘 ${EFFECTS[domain]}.`,
    cost: { ap: 0, stamina: 0, hunger: 0, itemId: 'berry', quantity: 1 },
  };
}

export function ancestralActionChanceBonus(state, action) {
  if (!CHANCE_DOMAINS.includes(action)) return 0;
  return activeFor(state, action) ? BONUS : 0;
}

function activeFor(state, domain) {
  if (state?.ended) return null;
  const faith = normalizeAncestralFaith(state?.ancestralFaith, state);
  const active = faith.active;
  if (faith.origin !== 'new_run' || !active || active.domain !== domain) return null;
  const member = founders(state).find(row => row.actorId === active.founderId);
  return member && statusOf(state, member).status !== 'unconfirmed' ? active : null;
}

export function ancestralStudyBonus(state, baseContribution, remainingNeed) {
  if (!activeFor(state, 'study') || !Number.isFinite(baseContribution) || baseContribution <= 0
    || !Number.isFinite(remainingNeed) || remainingNeed <= 0) return 0;
  return Math.min(2, Math.max(0, remainingNeed - baseContribution));
}

export function ancestralCareBonus(state, hpBefore, baseHealing) {
  if (!activeFor(state, 'care') || !Number.isFinite(hpBefore) || hpBefore <= 0 || hpBefore > 100
    || !Number.isFinite(baseHealing) || baseHealing <= 0) return 0;
  return Math.min(4, Math.max(0, 100 - hpBefore - baseHealing));
}

export function consumeAncestralFavor(state, action, { attempted = false } = {}) {
  if (attempted !== true || !DOMAINS.includes(action)) return state;
  const faith = normalizeAncestralFaith(state?.ancestralFaith, state);
  if (!faith.active || faith.active.domain !== action) return state;
  return { ...state, ancestralFaith: { ...faith,
    active: faith.active.remaining > 1 ? { ...faith.active, remaining: faith.active.remaining - 1 } : null } };
}

export function ancestralFaithRows(state, actorId = '') {
  const faith = normalizeAncestralFaith(state?.ancestralFaith, state);
  const actingId = actorId || state?.party?.find(actor => Number(actor.hp || 0) > 0)?.id || '';
  return founders(state).map(member => {
    const { domain, count } = domainOf(member);
    const { status, death } = statusOf(state, member);
    const [reason, message] = readiness(state, actingId, member, faith);
    const mode = status === 'deceased' ? 'blessing' : status === 'unconfirmed' ? 'unavailable' : 'teaching';
    return { founderId: member.actorId, name: member.name, portrait: member.portrait, role: member.role,
      status, mode, domain, domainLabel: LABELS[domain] || '', contributionCount: count,
      ready: !reason, reason, message,
      legend: domain ? `${member.name}이 ${EVIDENCE[domain]}에서 남긴 실제 기여 ${count}회가 전승의 근거입니다. 원작의 기술을 복제하는 효과가 아닙니다.` : '전승으로 이어갈 실제 활동을 아직 기록하지 못했습니다.',
      effectText: EFFECTS[domain] || '',
      response: RESPONSES[domain] || '',
      tallies: { ...member.tallies },
      recentDeeds: member.recentDeeds.map(deed => ({ ...deed, gains: deed.gains.map(gain => [...gain]) })),
      deathRecord: death ? { ...death } : null };
  });
}

export function ancestralFaithSummary(state) {
  const faith = normalizeAncestralFaith(state?.ancestralFaith, state);
  const member = faith.active && founders(state).find(row => row.actorId === faith.active.founderId);
  return { enabled: faith.origin === 'new_run', origin: faith.origin,
    active: faith.active ? { ...faith.active } : null, lastRiteDay: faith.lastRiteDay,
    lastRiteFounderId: faith.lastRiteFounderId,
    activeFounderName: member?.name || '', activeDomainLabel: LABELS[faith.active?.domain] || '',
    activeResponse: RESPONSES[faith.active?.domain] || '', activeEffectText: EFFECTS[faith.active?.domain] || '',
    bonusPercentPoints: 15, maxUses: USES,
    costText: 'AP 소모 없음 · 베리 1개 · 정착과 식량 저장 · 타오르는 모닥불 · 해당 분야 기여 3회',
    effectText: '전승 분야에 따라 확률 +15%p, 실제 연구·회의 +2 RP/CP, 휴식 HP +4 중 하나 · 유효 행동 2회 · 상한 유지 · 당일 만료 · 전체 하루 1회',
  };
}
