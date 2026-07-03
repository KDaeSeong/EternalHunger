import {
  createObjectiveFallback,
  objectiveEvents,
  objectiveLabel,
  stampText,
  topEntries,
  zoneName,
} from './runSummaryShared';

export function buildObjectiveSummary({ runEvents, zoneNameById }) {
  const out = createObjectiveFallback();
  const typeAcc = {};
  const actorAcc = {};
  const zoneAcc = {};
  let firstAt = null;

  for (const event of objectiveEvents(runEvents)) {
    const objective = String(event?.objective || '').trim() || 'unknown';
    const subkind = String(event?.subkind || '').trim();
    const whoName = String(event?.whoName || event?.name || event?.who || '').trim();
    const zoneId = String(event?.zoneId || '').trim();

    out.total += 1;
    if (objective === 'natural_core') out.naturalCore += 1;
    else if (objective === 'legendary_crate') out.legendaryCrate += 1;
    else if (objective === 'transcend_crate') out.transcendCrate += 1;
    else if (objective === 'boss') out.boss += 1;
    else if (objective === 'mutant_wildlife') out.mutantWildlife += 1;

    if (event?.success !== false) out.successCount += 1;
    if (Number(event?.danger || 0) > 0) out.dangerCount += 1;
    if (!firstAt) firstAt = event?.at || null;

    const typeKey = subkind || objective;
    if (typeKey) typeAcc[typeKey] = (typeAcc[typeKey] || 0) + 1;
    if (whoName) actorAcc[whoName] = (actorAcc[whoName] || 0) + 1;
    if (zoneId) zoneAcc[zoneId] = (zoneAcc[zoneId] || 0) + 1;
  }

  const topTypes = topEntries(typeAcc, 4).map(([key, count]) => `${objectiveLabel(key)}x${count}`).join(', ');
  const topActors = topEntries(actorAcc, 3).map(([name, count]) => `${name}x${count}`).join(', ');
  const topZones = topEntries(zoneAcc, 3).map(([id, count]) => `${zoneName(zoneNameById, id)}x${count}`).join(', ');
  const counts = [
    out.naturalCore ? `코어 ${out.naturalCore}` : '',
    out.legendaryCrate ? `전설상자 ${out.legendaryCrate}` : '',
    out.transcendCrate ? `초월상자 ${out.transcendCrate}` : '',
    out.boss ? `보스 ${out.boss}` : '',
    out.mutantWildlife ? `변이 ${out.mutantWildlife}` : '',
  ].filter(Boolean).join(' · ');
  const detailLine = [
    topTypes ? `TOP ${topTypes}` : '',
    topActors ? `획득자 ${topActors}` : '',
    topZones ? `구역 ${topZones}` : '',
  ].filter(Boolean).join(' | ');

  return {
    ...out,
    topTypes,
    topActors,
    topZones,
    firstText: stampText(firstAt),
    line: out.total ? `오브젝트 ${out.total}회${counts ? ` · ${counts}` : ''}${out.dangerCount ? ` · 교전위험 ${out.dangerCount}` : ''}` : '',
    detailLine,
  };
}
