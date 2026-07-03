import { inferItemCategory, isAtOrAfterWorldTime } from './simulationEngine';
import {
  createRunProgressFallback,
  sourceKey,
  stampText,
} from './runSummaryShared';

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

  for (const event of (Array.isArray(runEvents) ? runEvents : [])) {
    if (!event) continue;
    const who = String(event.who || '');
    if (event.kind === 'gain') {
      const src = sourceKey(event);
      if (src === 'drone') out.droneCalls += 1;
      if (src === 'kiosk') out.kioskGains += 1;
      const meta = itemMetaById?.[String(event.itemId || '')] || null;
      const tier = Number(meta?.tier || 0);
      const category = inferItemCategory(meta);
      if (category === 'equipment' && tier > 0) touchTier(tier, event.at || null, who);
    }
    if (event.kind === 'craft') {
      out.craftCount += 1;
      touchTier(Number(event.tier || 0), event.at || null, who);
    }
    if (event.kind === 'death') out.totalDeaths += 1;
    if (event.kind === 'revive') out.totalRevives += 1;
    if (event.kind === 'move') {
      const reason = String(event.reason || '');
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
