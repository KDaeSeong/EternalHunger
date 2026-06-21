import { inferItemCategory, isAtOrAfterWorldTime } from './simulationEngine';

const GAIN_SOURCE_LABELS = {
  box: '상자',
  foodcrate: '음식상자',
  natural: '자연스폰',
  gather: '채집',
  craft: '제작',
  hunt: '사냥',
  mutant: '변이',
  boss: '보스',
  legend: '전설상자',
  kiosk: '키오스크',
  drone: '드론',
  pvp: 'PvP루팅',
  event: '이벤트',
  unknown: '기타',
};

const DETAIL_SOURCE_LABELS = {
  box: '상자',
  foodcrate: '음식',
  natural: '자연',
  gather: '채집',
  craft: '제작',
  hunt: '사냥',
  mutant: '변이',
  boss: '보스',
  legend: '전설',
  kiosk: '키오스크',
  drone: '드론',
  pvp: 'PvP',
  event: '이벤트',
  unknown: '기타',
};

function createRunProgressFallback() {
  return {
    droneCalls: 0,
    kioskGains: 0,
    craftCount: 0,
    totalDeaths: 0,
    totalRevives: 0,
    totalFlees: 0,
    firstLegendAt: null,
    firstTransAt: null,
    latestLegendAt: null,
    latestTransAt: null,
    legendWho: new Set(),
    transWho: new Set(),
    legendCount: 0,
    transCount: 0,
    reviveRate: 0,
    fleeRate: 0,
    legendPace: 'pending',
    transPace: 'pending',
    firstLegendText: '',
    firstTransText: '',
    latestLegendText: '',
    latestTransText: '',
  };
}

function createRunSupportFallback() {
  return {
    autoUseCount: 0,
    manualUseCount: 0,
    totalHeal: 0,
    totalCleanse: 0,
    skillUseCount: 0,
    tacticalSkillCount: 0,
    weaponSkillCount: 0,
    appliedEffects: 0,
    immuneEffects: 0,
    resistedEffects: 0,
    topItems: '',
    topEffects: '',
    topTacticalSkills: '',
    topWeaponSkills: '',
    line: '',
    combatLine: '',
  };
}

function createRunActionFallback() {
  return {
    queued: 0,
    blocked: 0,
    fleeChosen: 0,
    moveChosen: 0,
    routeFarmChosen: 0,
    craftChosen: 0,
    droneChosen: 0,
    kioskChosen: 0,
    escapeFail: 0,
    escapeNoChase: 0,
    escapedAfterChase: 0,
    caught: 0,
    blinkEscape: 0,
    avgEscape: 0,
    avgChase: 0,
    avgCatch: 0,
    avgPreDamage: 0,
    topBlocked: '',
    topDeferred: '',
    line: '',
    chaseLine: '',
    tuningLine: '',
  };
}

function gainEvents(runEvents) {
  return (Array.isArray(runEvents) ? runEvents : []).filter((e) => e && e.kind === 'gain');
}

function positiveQty(e) {
  return Math.max(0, Number(e?.qty ?? 0));
}

function sourceKey(e) {
  return String(e?.source || 'unknown');
}

function itemName(itemNameById, id) {
  return itemNameById?.[String(id)] || String(id);
}

function zoneName(zoneNameById, id) {
  return zoneNameById?.[String(id)] || String(id);
}

function topEntries(acc, limit) {
  return Object.entries(acc)
    .filter(([, qty]) => Number(qty) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function stampText(at) {
  if (!at) return '';
  const d = Number(at?.day || 0);
  const ph = String(at?.phase || '-');
  const sec = Math.max(0, Math.floor(Number(at?.sec || 0)));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `D${d} ${ph} ${mm}:${ss}`;
}

export function getEmptyRunSummaries() {
  return {
    gainSourceSummary: '',
    creditSourceSummary: '',
    gainDetailSummary: '',
    specialSourceSummary: '',
    runProgressSummary: createRunProgressFallback(),
    runSupportSummary: createRunSupportFallback(),
    runActionSummary: createRunActionFallback(),
    topRankedCharacters: [],
  };
}

export function buildGainSourceSummary(runEvents) {
  const acc = {};
  for (const e of gainEvents(runEvents)) {
    const itemId = String(e.itemId || '');
    if (!itemId || itemId === 'CREDITS') continue;
    const qty = positiveQty(e);
    if (qty <= 0) continue;
    const src = sourceKey(e);
    acc[src] = (acc[src] || 0) + qty;
  }
  return topEntries(acc, 99).map(([key, qty]) => `${GAIN_SOURCE_LABELS[key] || key}:${qty}`).join(' / ');
}

export function buildCreditSourceSummary(runEvents) {
  const acc = {};
  for (const e of gainEvents(runEvents)) {
    if (String(e.itemId || '') !== 'CREDITS') continue;
    const qty = positiveQty(e);
    if (qty <= 0) continue;
    const src = sourceKey(e);
    acc[src] = (acc[src] || 0) + qty;
  }
  return topEntries(acc, 99).map(([key, qty]) => `${GAIN_SOURCE_LABELS[key] || key}:${qty}`).join(' / ');
}

export function buildGainDetailSummary({ runEvents, itemNameById, zoneNameById }) {
  const itemAcc = {};
  const zoneAcc = {};
  const itemSourceAcc = {};

  for (const e of gainEvents(runEvents)) {
    const id = String(e.itemId || '');
    if (!id || id === 'CREDITS') continue;
    const qty = positiveQty(e);
    if (qty <= 0) continue;

    itemAcc[id] = (itemAcc[id] || 0) + qty;

    const src = sourceKey(e);
    if (!itemSourceAcc[id]) itemSourceAcc[id] = {};
    itemSourceAcc[id][src] = (itemSourceAcc[id][src] || 0) + qty;

    const zid = String(e.zoneId || '');
    if (zid) zoneAcc[zid] = (zoneAcc[zid] || 0) + qty;
  }

  const itemStr = topEntries(itemAcc, 3)
    .map(([id, qty]) => {
      const srcs = itemSourceAcc[String(id)] || {};
      let bestSource = '';
      let bestQty = -1;
      for (const [key, sourceQty] of Object.entries(srcs)) {
        if (Number(sourceQty) > bestQty) {
          bestQty = Number(sourceQty);
          bestSource = String(key);
        }
      }
      const sourceText = bestSource ? `(${DETAIL_SOURCE_LABELS[bestSource] || bestSource})` : '';
      return `${itemName(itemNameById, id)}x${qty}${sourceText}`;
    })
    .join(', ');

  const zoneStr = topEntries(zoneAcc, 3)
    .map(([id, qty]) => `${zoneName(zoneNameById, id)} ${qty}`)
    .join(', ');

  if (itemStr && zoneStr) return `TOP 아이템: ${itemStr} | TOP 구역: ${zoneStr}`;
  if (itemStr) return `TOP 아이템: ${itemStr}`;
  if (zoneStr) return `TOP 구역: ${zoneStr}`;
  return '';
}

export function buildSpecialSourceSummary(runEvents) {
  const out = {
    bossCredits: 0,
    bossItems: 0,
    mutantItems: 0,
    mutantCredits: 0,
    eventCredits: 0,
    eventItems: 0,
    huntItems: 0,
    huntCredits: 0,
    alpha: 0,
    omega: 0,
    weakline: 0,
  };

  for (const e of gainEvents(runEvents)) {
    const src = sourceKey(e);
    const itemId = String(e.itemId || '');
    const qty = positiveQty(e);
    if (qty <= 0) continue;
    const isCredit = itemId === 'CREDITS';

    if (src === 'boss') {
      if (isCredit) out.bossCredits += qty;
      else out.bossItems += qty;
      const bossKind = String(e.subkind || e.sourceKind || '').toLowerCase();
      if (bossKind.includes('alpha')) out.alpha += qty;
      if (bossKind.includes('omega')) out.omega += qty;
      if (bossKind.includes('weakline') || bossKind.includes('wickeline')) out.weakline += qty;
    } else if (src === 'mutant') {
      if (isCredit) out.mutantCredits += qty;
      else out.mutantItems += qty;
    } else if (src === 'event') {
      if (isCredit) out.eventCredits += qty;
      else out.eventItems += qty;
    } else if (src === 'hunt') {
      if (isCredit) out.huntCredits += qty;
      else out.huntItems += qty;
    }
  }

  const parts = [];
  if (out.bossItems || out.bossCredits) {
    const bossKinds = [
      out.alpha ? `A:${out.alpha}` : '',
      out.omega ? `O:${out.omega}` : '',
      out.weakline ? `W:${out.weakline}` : '',
    ].filter(Boolean).join(' / ');
    parts.push(`보스 보상 아이템 ${out.bossItems}${out.bossCredits ? ` · 크레딧 ${out.bossCredits}` : ''}${bossKinds ? ` (${bossKinds})` : ''}`);
  }
  if (out.mutantItems || out.mutantCredits) {
    parts.push(`변이 야생동물 아이템 ${out.mutantItems}${out.mutantCredits ? ` · 크레딧 ${out.mutantCredits}` : ''}`);
  }
  if (out.huntItems || out.huntCredits) {
    parts.push(`일반 사냥 아이템 ${out.huntItems}${out.huntCredits ? ` · 크레딧 ${out.huntCredits}` : ''}`);
  }
  if (out.eventItems || out.eventCredits) {
    parts.push(`이벤트 보상 아이템 ${out.eventItems}${out.eventCredits ? ` · 크레딧 ${out.eventCredits}` : ''}`);
  }
  return parts.join(' | ');
}

export function buildRunProgressSummary({ runEvents, itemMetaById }) {
  const out = createRunProgressFallback();

  function touchTier(tier, at, who) {
    const t = Math.max(0, Number(tier || 0));
    const wid = String(who || '');
    if (t >= 5 && !out.firstLegendAt) out.firstLegendAt = at || null;
    if (t >= 6 && !out.firstTransAt) out.firstTransAt = at || null;
    if (t >= 5) out.latestLegendAt = at || null;
    if (t >= 6) out.latestTransAt = at || null;
    if (t >= 5 && wid) out.legendWho.add(wid);
    if (t >= 6 && wid) out.transWho.add(wid);
  }

  for (const e of (Array.isArray(runEvents) ? runEvents : [])) {
    if (!e) continue;
    const who = String(e.who || '');
    if (e.kind === 'gain') {
      const src = sourceKey(e);
      if (src === 'drone') out.droneCalls += 1;
      if (src === 'kiosk') out.kioskGains += 1;
      const meta = itemMetaById?.[String(e.itemId || '')] || null;
      const tier = Number(meta?.tier || 0);
      const category = inferItemCategory(meta);
      if (category === 'equipment' && tier > 0) touchTier(tier, e.at || null, who);
    }
    if (e.kind === 'craft') {
      out.craftCount += 1;
      touchTier(Number(e.tier || 0), e.at || null, who);
    }
    if (e.kind === 'death') out.totalDeaths += 1;
    if (e.kind === 'revive') out.totalRevives += 1;
    if (e.kind === 'move') {
      const reason = String(e.reason || '');
      if (reason.includes('escape') || reason.includes('flee')) out.totalFlees += 1;
    }
  }

  const deathBase = Math.max(1, out.totalDeaths);
  const isLegendOnTime = !!out.firstLegendAt
    && isAtOrAfterWorldTime(Number(out.firstLegendAt?.day || 0), String(out.firstLegendAt?.phase || ''), 0, 'morning')
    && !isAtOrAfterWorldTime(Number(out.firstLegendAt?.day || 0), String(out.firstLegendAt?.phase || ''), 3, 'day');
  const isTransOnTime = !!out.firstTransAt
    && isAtOrAfterWorldTime(Number(out.firstTransAt?.day || 0), String(out.firstTransAt?.phase || ''), 0, 'morning')
    && !isAtOrAfterWorldTime(Number(out.firstTransAt?.day || 0), String(out.firstTransAt?.phase || ''), 5, 'day');

  return {
    ...out,
    legendCount: out.legendWho.size,
    transCount: out.transWho.size,
    reviveRate: out.totalRevives / deathBase,
    fleeRate: out.totalFlees / deathBase,
    legendPace: out.firstLegendAt ? (isLegendOnTime ? 'on-track' : 'late') : 'pending',
    transPace: out.firstTransAt ? (isTransOnTime ? 'on-track' : 'late') : 'pending',
    firstLegendText: stampText(out.firstLegendAt),
    firstTransText: stampText(out.firstTransAt),
    latestLegendText: stampText(out.latestLegendAt),
    latestTransText: stampText(out.latestTransAt),
  };
}

export function buildRunSupportSummary({ runEvents, itemNameById }) {
  const out = createRunSupportFallback();
  const itemAcc = {};
  const effectAcc = {};
  const tacticalSkillAcc = {};
  const weaponSkillAcc = {};

  for (const e of (Array.isArray(runEvents) ? runEvents : [])) {
    if (!e) continue;
    if (e.kind === 'use') {
      if (e.manual) out.manualUseCount += 1;
      else out.autoUseCount += 1;
      out.totalHeal += Math.max(0, Number(e.heal || 0));
      out.totalCleanse += Math.max(0, Number(e.cleansed || 0));
      const id = String(e.itemId || '');
      if (id) itemAcc[id] = (itemAcc[id] || 0) + 1;
    }
    if (e.kind === 'skill') {
      out.skillUseCount += 1;
      const skillName = String(e.skill || '').trim();
      const mode = String(e.mode || '').trim();
      if (mode === 'weapon_skill') {
        out.weaponSkillCount += 1;
        if (skillName) weaponSkillAcc[skillName] = (weaponSkillAcc[skillName] || 0) + 1;
      } else {
        out.tacticalSkillCount += 1;
        if (skillName) tacticalSkillAcc[skillName] = (tacticalSkillAcc[skillName] || 0) + 1;
      }
    }
    if (e.kind === 'effect') {
      const effectName = String(e.effect || '');
      const outcome = String(e.outcome || '');
      if (outcome === 'applied') out.appliedEffects += 1;
      else if (outcome === 'immune') out.immuneEffects += 1;
      else if (outcome === 'resisted') out.resistedEffects += 1;
      if (effectName && outcome === 'applied') effectAcc[effectName] = (effectAcc[effectName] || 0) + 1;
    }
  }

  const topItems = topEntries(itemAcc, 3).map(([id, count]) => `${itemName(itemNameById, id)}x${count}`).join(', ');
  const topEffects = topEntries(effectAcc, 4).map(([name, count]) => `${name}x${count}`).join(', ');
  const topTacticalSkills = topEntries(tacticalSkillAcc, 3).map(([name, count]) => `${name}x${count}`).join(', ');
  const topWeaponSkills = topEntries(weaponSkillAcc, 3).map(([name, count]) => `${name}x${count}`).join(', ');
  const skillBits = [
    `전술 ${out.tacticalSkillCount}회`,
    `무기 ${out.weaponSkillCount}회`,
    topTacticalSkills ? `전술 TOP ${topTacticalSkills}` : '',
    topWeaponSkills ? `무기 TOP ${topWeaponSkills}` : '',
  ].filter(Boolean);
  return {
    ...out,
    topItems,
    topEffects,
    topTacticalSkills,
    topWeaponSkills,
    line: `use ${out.autoUseCount + out.manualUseCount}회 (auto ${out.autoUseCount} / dev ${out.manualUseCount}) · heal ${out.totalHeal} · cleanse ${out.totalCleanse} · skill ${out.skillUseCount} · effect ${out.appliedEffects}/${out.immuneEffects}/${out.resistedEffects}`,
    combatLine: skillBits.length ? skillBits.join(' · ') : '',
  };
}

export function buildRunActionSummary(runEvents) {
  const out = createRunActionFallback();
  const blockedAcc = {};
  const deferredAcc = {};
  let escapeN = 0;
  let chaseN = 0;
  let catchN = 0;
  let preDamageN = 0;

  for (const e of (Array.isArray(runEvents) ? runEvents : [])) {
    if (!e) continue;
    if (e.kind === 'queue') {
      out.queued += 1;
      const chosen = String(e.chosen || '');
      if (chosen === 'flee') out.fleeChosen += 1;
      else if (chosen === 'moveTo') out.moveChosen += 1;
      else if (chosen === 'routeFarm') out.routeFarmChosen += 1;
      else if (chosen === 'craft') out.craftChosen += 1;
      else if (chosen === 'droneOrder') out.droneChosen += 1;
      else if (chosen.startsWith('kiosk')) out.kioskChosen += 1;
      (Array.isArray(e.blockedReasons) ? e.blockedReasons : []).forEach((reason) => {
        const key = String(reason || '').trim();
        if (!key) return;
        out.blocked += 1;
        blockedAcc[key] = (blockedAcc[key] || 0) + 1;
        if (key.startsWith('deferred:')) {
          const deferred = key.replace('deferred:', '');
          deferredAcc[deferred] = (deferredAcc[deferred] || 0) + 1;
        }
      });
    }

    if (e.kind === 'chase') {
      const outcome = String(e.outcome || '');
      if (outcome === 'escape_fail') out.escapeFail += 1;
      else if (outcome === 'escape_no_chase') out.escapeNoChase += 1;
      else if (outcome === 'escaped_after_chase') out.escapedAfterChase += 1;
      else if (outcome === 'caught') out.caught += 1;
      else if (outcome === 'blink_escape') out.blinkEscape += 1;

      const pEscape = Number(e?.pEscape);
      const pChase = Number(e?.pChase);
      const pCatch = Number(e?.pCatch);
      const preDamage = Number(e?.preDamage);
      if (Number.isFinite(pEscape) && pEscape > 0) {
        out.avgEscape += pEscape;
        escapeN += 1;
      }
      if (Number.isFinite(pChase) && pChase > 0) {
        out.avgChase += pChase;
        chaseN += 1;
      }
      if (Number.isFinite(pCatch) && pCatch > 0) {
        out.avgCatch += pCatch;
        catchN += 1;
      }
      if (Number.isFinite(preDamage) && preDamage >= 0) {
        out.avgPreDamage += preDamage;
        preDamageN += 1;
      }
    }
  }

  out.avgEscape = escapeN > 0 ? out.avgEscape / escapeN : 0;
  out.avgChase = chaseN > 0 ? out.avgChase / chaseN : 0;
  out.avgCatch = catchN > 0 ? out.avgCatch / catchN : 0;
  out.avgPreDamage = preDamageN > 0 ? out.avgPreDamage / preDamageN : 0;

  const topBlocked = topEntries(blockedAcc, 4).map(([reason, count]) => `${reason}x${count}`).join(', ');
  const topDeferred = topEntries(deferredAcc, 3).map(([reason, count]) => `${reason}x${count}`).join(', ');

  return {
    ...out,
    topBlocked,
    topDeferred,
    line: `queue ${out.queued} · blocked ${out.blocked} · flee ${out.fleeChosen} · move ${out.moveChosen} · route ${out.routeFarmChosen} · craft ${out.craftChosen} · drone ${out.droneChosen} · kiosk ${out.kioskChosen}`,
    chaseLine: `escapeFail ${out.escapeFail} · noChase ${out.escapeNoChase} · escaped ${out.escapedAfterChase + out.blinkEscape} · caught ${out.caught}`,
    tuningLine: `avgEscape ${(out.avgEscape * 100).toFixed(0)}% · avgChase ${(out.avgChase * 100).toFixed(0)}% · avgCatch ${(out.avgCatch * 100).toFixed(0)}% · preDmg ${out.avgPreDamage.toFixed(1)}`,
  };
}

export function buildTopRankedCharacters({ survivors, dead, killCounts, assistCounts }) {
  return [...(Array.isArray(survivors) ? survivors : []), ...(Array.isArray(dead) ? dead : [])]
    .filter(Boolean)
    .sort((a, b) => (
      (Number(killCounts?.[b?._id] || 0) - Number(killCounts?.[a?._id] || 0))
      || (Number(assistCounts?.[b?._id] || 0) - Number(assistCounts?.[a?._id] || 0))
    ))
    .slice(0, 3);
}

export function buildRunSummaries({
  runEvents,
  itemNameById,
  zoneNameById,
  itemMetaById,
  survivors,
  dead,
  killCounts,
  assistCounts,
}) {
  return {
    gainSourceSummary: buildGainSourceSummary(runEvents),
    creditSourceSummary: buildCreditSourceSummary(runEvents),
    gainDetailSummary: buildGainDetailSummary({ runEvents, itemNameById, zoneNameById }),
    specialSourceSummary: buildSpecialSourceSummary(runEvents),
    runProgressSummary: buildRunProgressSummary({ runEvents, itemMetaById }),
    runSupportSummary: buildRunSupportSummary({ runEvents, itemNameById }),
    runActionSummary: buildRunActionSummary(runEvents),
    topRankedCharacters: buildTopRankedCharacters({ survivors, dead, killCounts, assistCounts }),
  };
}
