import {
  createRunActionFallback,
  objectiveLabel,
  topEntries,
} from './runSummaryShared';

export function buildRunActionSummary(runEvents) {
  const out = createRunActionFallback();
  const blockedAcc = {};
  const deferredAcc = {};
  const objectiveAcc = {};
  let escapeN = 0;
  let chaseN = 0;
  let catchN = 0;
  let preDamageN = 0;

  for (const event of (Array.isArray(runEvents) ? runEvents : [])) {
    if (!event) continue;
    if (event.kind === 'queue') {
      out.queued += 1;
      const chosen = String(event.chosen || '');
      if (chosen === 'flee') out.fleeChosen += 1;
      else if (chosen === 'moveTo') out.moveChosen += 1;
      else if (chosen === 'routeFarm') out.routeFarmChosen += 1;
      else if (chosen === 'craft') out.craftChosen += 1;
      else if (chosen === 'droneOrder') out.droneChosen += 1;
      else if (chosen.startsWith('kiosk')) out.kioskChosen += 1;
      const objectiveType = String(event?.objectiveType || '').trim();
      const objectiveSubkind = String(event?.objectiveSubkind || '').trim();
      const contestPressure = Math.max(0, Number(event?.contestPressure || 0));
      if (objectiveType) {
        out.objectiveMoveChosen += 1;
        const objectiveKey = objectiveSubkind || objectiveType;
        objectiveAcc[objectiveKey] = (objectiveAcc[objectiveKey] || 0) + 1;
      }
      if (contestPressure > 0) {
        out.objectivePressureCount += 1;
        out.objectivePressureTotal += contestPressure;
      }
      (Array.isArray(event.blockedReasons) ? event.blockedReasons : []).forEach((reason) => {
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

    if (event.kind === 'chase') {
      const outcome = String(event.outcome || '');
      if (outcome === 'escape_fail') out.escapeFail += 1;
      else if (outcome === 'escape_no_chase') out.escapeNoChase += 1;
      else if (outcome === 'escaped_after_chase') out.escapedAfterChase += 1;
      else if (outcome === 'caught') out.caught += 1;
      else if (outcome === 'blink_escape') out.blinkEscape += 1;

      const pEscape = Number(event?.pEscape);
      const pChase = Number(event?.pChase);
      const pCatch = Number(event?.pCatch);
      const preDamage = Number(event?.preDamage);
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
  const topObjectiveMoves = topEntries(objectiveAcc, 3).map(([key, count]) => `${objectiveLabel(key)}x${count}`).join(', ');
  const avgObjectivePressure = out.objectivePressureCount > 0 ? out.objectivePressureTotal / out.objectivePressureCount : 0;

  return {
    ...out,
    topBlocked,
    topDeferred,
    topObjectiveMoves,
    line: `queue ${out.queued} · blocked ${out.blocked} · flee ${out.fleeChosen} · move ${out.moveChosen} · obj ${out.objectiveMoveChosen} · route ${out.routeFarmChosen} · craft ${out.craftChosen} · drone ${out.droneChosen} · kiosk ${out.kioskChosen}`,
    chaseLine: `escapeFail ${out.escapeFail} · noChase ${out.escapeNoChase} · escaped ${out.escapedAfterChase + out.blinkEscape} · caught ${out.caught}`,
    tuningLine: `avgEscape ${(out.avgEscape * 100).toFixed(0)}% · avgChase ${(out.avgChase * 100).toFixed(0)}% · avgCatch ${(out.avgCatch * 100).toFixed(0)}% · preDmg ${out.avgPreDamage.toFixed(1)} · objPressure ${avgObjectivePressure.toFixed(2)}`,
  };
}
