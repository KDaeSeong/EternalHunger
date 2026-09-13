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
  const team = { regroupMoves: 0, regroupHolds: 0, rotations: 0, retreats: 0 };
  const coordinatedTeams = new Set();
  const teamCombat = { rounds: 0, strikes: 0, focusFire: 0, cover: 0, damage: 0, assists: 0 };
  const growth = { opportunities: 0, farm: 0, craft: 0, hunt: 0, move: 0, rest: 0 };
  const fieldResources = { pickups: 0, units: 0, depleted: 0, replans: 0 };
  let escapeN = 0;
  let chaseN = 0;
  let catchN = 0;
  let preDamageN = 0;

  for (const event of (Array.isArray(runEvents) ? runEvents : [])) {
    if (!event) continue;
    if (event.kind === 'field_resource') {
      fieldResources.pickups++;
      fieldResources.units += Math.max(0, Number(event.qty || 0));
      if (event.depleted) fieldResources.depleted++;
    }
    if (event.kind === 'resource_replan') fieldResources.replans++;
    if (event.kind === 'team_engagement') teamCombat.rounds++;
    if (event.kind === 'team_strike') {
      teamCombat.strikes++;
      teamCombat.damage += Math.max(0, Number(event.damage || 0));
      if (event.reason === 'focus_fire') teamCombat.focusFire++;
    }
    if (event.kind === 'team_cover') teamCombat.cover += new Set(event.helpers || []).size;
    if (event.kind === 'elimination') teamCombat.assists += new Set(event.assistIds || []).size;
    if (event.kind === 'action_cycle') {
      growth.opportunities += 1;
      if (event.chosen === 'routeFarm') growth.farm += 1;
      if (event.chosen === 'craft') growth.craft += 1;
      if (['hunt', 'hunt_combat'].includes(event.chosen)) growth.hunt += 1;
      if (['moveTo', 'flee'].includes(event.chosen)) growth.move += 1;
      if (event.chosen === 'rest') growth.rest += 1;
    }
    if (event.kind === 'team_decision') {
      if (event.reason === 'team_regroup') {
        if (event.moved) team.regroupMoves += 1;
        else team.regroupHolds += 1;
      } else if (event.reason === 'team_rotate' && event.moved) team.rotations += 1;
      else if (['team_outnumbered', 'team_power_gap'].includes(event.reason) && event.moved) team.retreats += 1;
      if (['team_regroup', 'team_rotate'].includes(event.reason) && event.teamId) coordinatedTeams.add(event.teamId);
    }
    if (event.kind === 'move' && event.reason === 'avoid_power' && event.teamAssessment?.shouldAvoid) team.retreats += 1;
    if (event.kind === 'queue') {
      out.queued += 1;
      const chosen = String(event.chosen || '');
      if (chosen === 'flee') out.fleeChosen += 1;
      else if (chosen === 'rest') out.restChosen += 1;
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
    team,
    teamCombat,
    fieldResources,
    fieldResourceLine: `공유 재고 획득 ${fieldResources.units}개 (${fieldResources.pickups}회) · 지역별 품목 소진 ${fieldResources.depleted}건 · 고갈 후 경로 재계획 ${fieldResources.replans}회`,
    teamCombatLine: `팀 교전 ${teamCombat.rounds}회 · 팀원 공격 ${teamCombat.strikes}회 (집중 공격 ${teamCombat.focusFire}회) · 퇴로 엄호 ${teamCombat.cover}명·회 · 기여 어시스트 ${teamCombat.assists}명·회`,
    growth,
    growthLine: `반복 행동 ${growth.opportunities}회 · 루트 탐색 ${growth.farm}회 · 제작 선택 ${growth.craft}회 · 사냥 선택 ${growth.hunt}회 · 이동·도주 ${growth.move}회 · 안전 대기 ${growth.rest}회 (참가자 행동 기준, 성공 횟수와 별개)`,
    teamLine: `협동 판단 ${coordinatedTeams.size}팀 · 합류 이동 ${team.regroupMoves}회 · 합류 대기 ${team.regroupHolds}회 · 공동 이동 ${team.rotations}회 · 열세 후퇴 ${team.retreats}회 (참가자 행동 기준)`,
    line: `queue ${out.queued} · blocked ${out.blocked} · flee ${out.fleeChosen} · rest ${out.restChosen} · move ${out.moveChosen} · obj ${out.objectiveMoveChosen} · route ${out.routeFarmChosen} · craft ${out.craftChosen} · drone ${out.droneChosen} · kiosk ${out.kioskChosen}`,
    chaseLine: `escapeFail ${out.escapeFail} · noChase ${out.escapeNoChase} · escaped ${out.escapedAfterChase + out.blinkEscape} · caught ${out.caught}`,
    tuningLine: `avgEscape ${(out.avgEscape * 100).toFixed(0)}% · avgChase ${(out.avgChase * 100).toFixed(0)}% · avgCatch ${(out.avgCatch * 100).toFixed(0)}% · preDmg ${out.avgPreDamage.toFixed(1)} · objPressure ${avgObjectivePressure.toFixed(2)}`,
  };
}
