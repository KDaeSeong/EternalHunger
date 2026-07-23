function counter(state, key) {
  return Number(state?.counters?.[key] || 0);
}

function collectionSize(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.values(value).filter(Boolean).length;
  return 0;
}

function latestLogText(value) {
  if (typeof value === 'string') return value.trim();
  return String(value?.log?.[0] || '').trim();
}

function totalUpgradeLevel(value) {
  return Object.values(value?.upgrades || {}).reduce(
    (sum, level) => sum + Math.max(0, Number(level || 0)),
    0,
  );
}

function signedValue(value, suffix = '') {
  const amount = Number(value || 0);
  return `${amount > 0 ? '+' : ''}${amount.toLocaleString('ko-KR')}${suffix}`;
}

function normalizeFeedbackSnapshot(value) {
  if (Array.isArray(value?.log) || value?.equipmentInventory || value?.upgrades) {
    return createSchaleIdleFeedbackSnapshot(value);
  }
  return value || {};
}

export function createSchaleIdleFeedbackSnapshot(state) {
  return {
    runId: String(state?.runId || ''),
    latestLog: latestLogText(state),
    maxClearedFloor: Math.max(0, Number(state?.maxClearedFloor || 0)),
    towerMaxCleared: Math.max(0, Number(state?.towerMaxCleared || 0)),
    credits: Number(state?.credits || 0),
    stamina: Number(state?.stamina || 0),
    equipmentCount: Object.keys(state?.equipmentInventory || {}).length,
    claimCount: collectionSize(state?.claimedMissions)
      + collectionSize(state?.achievementClaims)
      + collectionSize(state?.seasonRewardClaims),
    upgradeLevel: totalUpgradeLevel(state),
  };
}

function towerResultPresentation(text) {
  const successCount = Number(text.match(/성공\s+(\d+)/)?.[1] || 0);
  const failureCount = Number(text.match(/실패\s+(\d+)/)?.[1] || 0);
  if (successCount <= 0) {
    return { action: 'tower', cue: 'towerFail', label: '탑 도전 실패', tone: 'danger' };
  }
  if (failureCount > 0) {
    return { action: 'tower-partial', cue: 'towerPartial', label: '탑 일부 돌파', tone: 'warning' };
  }
  return { action: 'tower', cue: 'towerClear', label: '탑 돌파', tone: 'success' };
}

function dutyFailurePresentation(value) {
  const cleared = Array.isArray(value?.lastDutyReport?.details)
    ? value.lastDutyReport.details.filter((entry) => entry?.kind === 'FLOOR_CLEAR').length
    : 0;
  if (cleared > 0) {
    return { action: 'duty-partial', cue: 'dutyPartial', label: '정산 일부 진행', tone: 'warning' };
  }
  return { action: 'duty-defeat', cue: 'dutyDefeat', label: '정산 실패', tone: 'danger' };
}

export function schaleIdleFeedbackPresentation(value) {
  const detail = latestLogText(value);
  if (!detail) {
    return { action: 'growth', cue: '', label: '성장 대기', tone: 'highlight', detail: '실행한 성장 행동이 없습니다.' };
  }

  let presentation;
  if (/샬레 당직이 시작/.test(detail)) presentation = { action: 'growth', cue: '', label: '당직 시작', tone: 'highlight' };
  else if (/^시련의 탑\s+\d+회 요청:/.test(detail)) presentation = towerResultPresentation(detail);
  else if (/층 정산 실패/.test(detail)) presentation = dutyFailurePresentation(value);
  else if (/방치 정산.*0층 클리어/.test(detail)) presentation = { action: 'wait', cue: 'settle', label: '정산 결과 없음', tone: 'warning' };
  else if (/방치 정산/.test(detail)) presentation = { action: 'settle', cue: 'dutyComplete', label: '방치 정산 완료', tone: 'success' };
  else if (/오프라인 진행/.test(detail)) presentation = { action: 'settle', cue: 'settle', label: '오프라인 보상', tone: 'success' };
  else if (/재정비/.test(detail)) presentation = { action: 'rest', cue: 'rest', label: '재정비 완료', tone: 'success' };
  else if (/제작.*완료/.test(detail)) presentation = { action: 'craft', cue: 'craftComplete', label: '제작 완료', tone: 'success' };
  else if (/제작.*(?:실패|부족)/.test(detail)) presentation = { action: 'craft', cue: 'warning', label: '제작 불가', tone: 'warning' };
  else if (/하드 천장 발동/.test(detail)) presentation = { action: 'enhance-pity', cue: 'enhancePity', label: '강화 천장 성공', tone: 'success' };
  else if (/강화 실패.*패널티 방지/.test(detail)) presentation = { action: 'enhance-protected', cue: 'enhanceProtected', label: '보호권 발동', tone: 'highlight' };
  else if (/강화 실패.*장비 파괴/.test(detail)) presentation = { action: 'enhance-destroyed', cue: 'enhanceDestroyed', label: '장비 파괴', tone: 'danger' };
  else if (/강화 실패.*하락/.test(detail)) presentation = { action: 'enhance-downgrade', cue: 'enhanceDowngrade', label: '강화 단계 하락', tone: 'warning' };
  else if (/강화.*성공/.test(detail)) presentation = { action: 'upgrade', cue: 'enhanceSuccess', label: '장비 강화 성공', tone: 'success' };
  else if (/강화.*(?:실패|부족|없습니다)/.test(detail)) presentation = { action: 'upgrade', cue: 'enhanceFail', label: '장비 강화 실패', tone: 'danger' };
  else if (/옵션 재련.*완료/.test(detail)) presentation = { action: 'reroll', cue: 'reroll', label: '옵션 재련 완료', tone: 'success' };
  else if (/옵션 재련.*(?:실패|필요합니다|없습니다)/.test(detail)) presentation = { action: 'reroll', cue: 'warning', label: '옵션 재련 불가', tone: 'warning' };
  else if (/분해.*완료/.test(detail)) presentation = { action: 'salvage', cue: 'salvage', label: '장비 분해 완료', tone: 'success' };
  else if (/분해/.test(detail)) presentation = { action: 'salvage', cue: 'warning', label: '분해 설정 확인', tone: 'warning' };
  else if (/상점.*리셋/.test(detail)) presentation = { action: 'refresh', cue: 'shopRefresh', label: '상점 갱신', tone: 'success' };
  else if (/구매.*완료/.test(detail)) presentation = { action: 'shop', cue: 'shop', label: '상점 구매 완료', tone: 'success' };
  else if (/구매/.test(detail)) presentation = { action: 'shop', cue: 'warning', label: '구매 불가', tone: 'warning' };
  else if (/연구 완료/.test(detail)) presentation = { action: 'research', cue: 'research', label: '상시 연구 완료', tone: 'success' };
  else if (/연구.*(?:실패|부족|찾을 수)/.test(detail)) presentation = { action: 'research', cue: 'warning', label: '연구 불가', tone: 'warning' };
  else if (/보상.*수령/.test(detail)) presentation = { action: 'claim', cue: 'reward', label: '보상 수령', tone: 'success' };
  else if (/프리셋/.test(detail)) presentation = { action: 'preset', cue: 'preset', label: '장비 프리셋', tone: /찾을 수|누락/.test(detail) ? 'warning' : 'success' };
  else if (/즐겨찾기/.test(detail)) presentation = { action: 'favorite', cue: 'favorite', label: '즐겨찾기 변경', tone: 'highlight' };
  else if (/잠금|옵션 .*해제/.test(detail)) presentation = { action: 'lock', cue: 'lock', label: '보호 설정 변경', tone: 'highlight' };
  else if (/칭호/.test(detail)) presentation = { action: 'title', cue: 'equip', label: '칭호 설정', tone: 'highlight' };
  else if (/장착/.test(detail)) presentation = { action: 'equip', cue: 'equip', label: '장비 장착', tone: 'success' };
  else if (/실패|부족|없습니다|찾을 수|도달했습니다|필요합니다/.test(detail)) presentation = { action: 'warning', cue: 'warning', label: '행동 불가', tone: 'warning' };
  else presentation = { action: 'growth', cue: 'complete', label: '성장 진행', tone: 'highlight' };

  return { ...presentation, detail };
}

export function schaleIdleResultCue(previous, next) {
  if (!previous || !next || previous.runId !== next.runId) return '';

  const previousTowerAt = Number(previous.towerLastBatchReport?.at || 0);
  const nextTowerAt = Number(next.towerLastBatchReport?.at || 0);
  if (nextTowerAt > previousTowerAt) {
    const successes = Number(next.towerLastBatchReport?.successes || 0);
    const failures = Number(next.towerLastBatchReport?.failures || 0);
    if (successes > 0 && failures > 0) return 'towerPartial';
    return successes > 0 ? 'towerClear' : 'towerFail';
  }

  const previousDutyAt = Number(previous.lastDutyReport?.at || 0);
  const nextDutyAt = Number(next.lastDutyReport?.at || 0);
  if (nextDutyAt > previousDutyAt) {
    const cleared = counter(next, 'CLEAR_FLOOR') > counter(previous, 'CLEAR_FLOOR');
    if (next.lastDutyReport?.stoppedReason === 'FAILED') {
      return cleared ? 'dutyPartial' : 'dutyDefeat';
    }
    return cleared ? 'dutyComplete' : 'settle';
  }

  if (counter(next, 'ENHANCE_TRY') > counter(previous, 'ENHANCE_TRY')) {
    const outcomeCue = {
      pity_success: 'enhancePity',
      protected: 'enhanceProtected',
      downgrade: 'enhanceDowngrade',
      destroyed: 'enhanceDestroyed',
      success: 'enhanceSuccess',
      failed_stable: 'enhanceFail',
    }[next.lastEnhanceResult?.outcome];
    if (outcomeCue) return outcomeCue;
    return counter(next, 'ENHANCE_SUCCESS') > counter(previous, 'ENHANCE_SUCCESS')
      ? 'enhanceSuccess'
      : 'enhanceFail';
  }
  if (counter(next, 'CRAFT') > counter(previous, 'CRAFT')) return 'craftComplete';
  if (counter(next, 'REROLL') > counter(previous, 'REROLL')) return 'reroll';
  if (counter(next, 'SALVAGE') > counter(previous, 'SALVAGE')) return 'salvage';
  if (counter(next, 'SHOP_BUY') > counter(previous, 'SHOP_BUY')) return 'shop';
  if (counter(next, 'SHOP_RESET') > counter(previous, 'SHOP_RESET')) return 'shopRefresh';
  if (counter(next, 'UPGRADE') > counter(previous, 'UPGRADE')) return 'research';
  if (counter(next, 'EQUIP') > counter(previous, 'EQUIP')) return 'equip';
  if (counter(next, 'EQUIP_LOCK') > counter(previous, 'EQUIP_LOCK')) return 'lock';
  if (counter(next, 'EQUIP_FAVORITE') > counter(previous, 'EQUIP_FAVORITE')) return 'favorite';
  if (counter(next, 'PRESET') > counter(previous, 'PRESET')) return 'preset';

  const previousClaims = collectionSize(previous.claimedMissions)
    + collectionSize(previous.achievementClaims)
    + collectionSize(previous.seasonRewardClaims);
  const nextClaims = collectionSize(next.claimedMissions)
    + collectionSize(next.achievementClaims)
    + collectionSize(next.seasonRewardClaims);
  if (nextClaims > previousClaims) return 'reward';

  const previousLog = latestLogText(previous);
  const nextLog = latestLogText(next);
  if (nextLog && nextLog !== previousLog) {
    return schaleIdleFeedbackPresentation(nextLog).cue;
  }

  return '';
}

export function schaleIdleFeedbackImpacts(previousValue, currentValue) {
  if (!previousValue || !currentValue) return [];
  const previous = normalizeFeedbackSnapshot(previousValue);
  const current = normalizeFeedbackSnapshot(currentValue);
  if (previous.runId && current.runId && previous.runId !== current.runId) return [];

  const impacts = [];
  const floorDelta = current.maxClearedFloor - previous.maxClearedFloor;
  const towerDelta = current.towerMaxCleared - previous.towerMaxCleared;
  const creditDelta = current.credits - previous.credits;
  const staminaDelta = current.stamina - previous.stamina;
  const equipmentDelta = current.equipmentCount - previous.equipmentCount;
  const claimDelta = current.claimCount - previous.claimCount;
  const upgradeDelta = current.upgradeLevel - previous.upgradeLevel;

  if (floorDelta !== 0) {
    impacts.push({
      action: 'growth',
      label: '최고 층',
      value: signedValue(floorDelta, '층'),
      tone: floorDelta > 0 ? 'success' : 'warning',
    });
  }
  if (towerDelta !== 0) {
    impacts.push({
      action: 'tower',
      label: '시련의 탑',
      value: signedValue(towerDelta, '층'),
      tone: towerDelta > 0 ? 'success' : 'warning',
    });
  }
  if (equipmentDelta !== 0) {
    impacts.push({
      action: equipmentDelta > 0 ? 'equip' : 'salvage',
      label: '보유 장비',
      value: signedValue(equipmentDelta, '개'),
      tone: equipmentDelta > 0 ? 'highlight' : 'warning',
    });
  }
  if (upgradeDelta !== 0) {
    impacts.push({
      action: 'research',
      label: '상시 연구',
      value: signedValue(upgradeDelta, ' Lv.'),
      tone: upgradeDelta > 0 ? 'success' : 'warning',
    });
  }
  if (claimDelta > 0) {
    impacts.push({
      action: 'claim',
      label: '보상 수령',
      value: `+${claimDelta}개`,
      tone: 'success',
    });
  }
  if (creditDelta !== 0) {
    impacts.push({
      action: 'settle',
      label: '크레딧',
      value: signedValue(creditDelta, ' Cr'),
      tone: creditDelta > 0 ? 'success' : 'warning',
    });
  }
  if (staminaDelta !== 0) {
    impacts.push({
      action: 'rest',
      label: '스태미나',
      value: signedValue(staminaDelta),
      tone: staminaDelta > 0 ? 'highlight' : 'warning',
    });
  }

  if (!impacts.length && current.latestLog && current.latestLog !== previous.latestLog) {
    const presentation = schaleIdleFeedbackPresentation(current.latestLog);
    impacts.push({
      action: presentation.action,
      label: presentation.label,
      value: '수치 변화 없음',
      tone: presentation.tone,
    });
  }

  return impacts.slice(0, 4);
}
