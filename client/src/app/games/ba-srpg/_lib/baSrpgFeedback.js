function aliveCount(rows) {
  return Array.isArray(rows) ? rows.filter((row) => Number(row?.hp || 0) > 0).length : 0;
}

function normalizeSnapshot(value) {
  return value?.battle ? createBaSrpgFeedbackSnapshot(value) : value || {};
}

function feedbackText(snapshot) {
  return String(snapshot?.latestLog || snapshot?.lastResult || '').trim();
}

function resultSignal(lastResult) {
  const text = String(lastResult || '').trim();
  if (!text) return { action: 'deploy', cue: '', label: '작전 대기', tone: 'ready' };
  if (/클리어|승리/.test(text)) return { action: 'victory', cue: 'victory', label: '임무 클리어', tone: 'success' };
  if (/임무 실패|작전 실패|전멸/.test(text)) return { action: 'defeat', cue: 'defeat', label: '작전 실패', tone: 'danger' };
  if (/출정 준비|출정을 시작/.test(text)) return { action: 'deploy', cue: 'deploy', label: '작전 배치', tone: 'highlight' };
  if (/편성 변경|편성 프리셋 적용/.test(text)) return { action: 'formation', cue: 'formation', label: '편성 변경', tone: 'highlight' };
  if (/여관에서 하루를 쉬었습니다/.test(text)) return { action: 'rest', cue: 'rest', label: '휴식 완료', tone: 'success' };
  if (/부동산 구매:/.test(text)) return { action: 'property-buy', cue: 'propertyBuy', label: '시설 구매', tone: 'success' };
  if (/부동산 임차:|임차를 종료/.test(text)) return { action: 'property-rent', cue: 'propertyRent', label: '시설 임차 변경', tone: 'highlight' };
  if (/임대를 시작|임대를 종료/.test(text)) return { action: 'property-lease', cue: 'propertyLease', label: '시설 임대 변경', tone: 'highlight' };
  if (/업그레이드 Lv\./.test(text)) return { action: 'property-upgrade', cue: 'propertyUpgrade', label: '시설 강화', tone: 'success' };
  if (/칙령 발령:/.test(text)) return { action: 'edict', cue: 'edict', label: '칙령 발령', tone: 'highlight' };
  if (/상점을 .*갱신했습니다/.test(text)) return { action: 'refresh', cue: 'shopRefresh', label: '상점 갱신', tone: 'highlight' };
  if (/구매\. -\d+ Cr/.test(text)) return { action: 'shop', cue: 'shop', label: '상점 구매', tone: 'success' };
  if (/완료\. -\d+ Cr/.test(text)) return { action: 'craft', cue: 'craftComplete', label: '제작 완료', tone: 'success' };
  if (/장비 장착:/.test(text)) return { action: 'equip', cue: 'equip', label: '장비 장착', tone: 'success' };
  if (/완료\. \+\d+ Cr, 평판/.test(text)) return { action: 'claim', cue: 'claim', label: '의뢰 보고', tone: 'success' };
  if (/부족|없습니다|아닙니다|불가|이미 |사거리 밖|할 수 없|최대 레벨|마감/.test(text)) {
    return { action: 'warning', cue: 'warning', label: '실행 불가', tone: 'warning' };
  }
  if (/격파/.test(text)) return { action: 'elimination', cue: 'elimination', label: '적 격파', tone: 'success' };
  if (/\[오버워치\]|오버워치.*반응 사격.*(?:→|피해|빗나감)/.test(text)) return { action: 'overwatch', cue: 'reactionShot', label: '반응 사격', tone: 'success' };
  if (/오버워치/.test(text)) return { action: 'overwatch', cue: 'overwatch', label: '감시 태세', tone: 'support' };
  if (/연막/.test(text)) return { action: 'smoke', cue: 'smoke', label: '연막 전개', tone: 'support' };
  if (/엄폐 파괴/.test(text)) return { action: 'cover-break', cue: 'coverBreak', label: '엄폐 파괴', tone: 'success' };
  if (/사기 고양|명중.*강화/.test(text)) return { action: 'buff', cue: 'buff', label: '아군 강화', tone: 'support' };
  if (/표식|제압 사격|회피.*적용|이동.*적용/.test(text)) return { action: 'debuff', cue: 'debuff', label: '적 약화', tone: 'warning' };
  if (/저항/.test(text)) return { action: 'status', cue: 'statusResist', label: '상태 저항', tone: 'warning' };
  if (/출혈 부여|화상 부여|기절 부여|혼란 부여/.test(text)) return { action: 'status', cue: 'statusApply', label: '상태 이상', tone: 'danger' };
  if (/점사/.test(text)) return { action: 'burst', cue: 'burst', label: '점사 명중', tone: 'danger' };
  if (/빗나감/.test(text)) return { action: 'miss', cue: 'attackMiss', label: '공격 빗나감', tone: 'warning' };
  if (/붕대|HP\s*\+|회복/.test(text)) return { action: 'consume', cue: 'consume', label: '회복 실행', tone: 'support' };
  if (/보호막/.test(text)) return { action: 'guard', cue: 'guard', label: '방어 전개', tone: 'support' };
  if (/피해|공격|->|→/.test(text)) return { action: 'combat', cue: 'combat', label: '교전 발생', tone: 'danger' };
  if (/이동/.test(text)) return { action: 'move', cue: 'move', label: '전술 이동', tone: 'ready' };
  if (/대기|턴 종료/.test(text)) return { action: 'turn', cue: 'turn', label: '턴 전환', tone: 'ready' };
  return { action: 'signal', cue: 'select', label: '작전 신호', tone: 'ready' };
}

export function createBaSrpgFeedbackSnapshot(state) {
  const battle = state?.battle || {};
  return {
    runId: String(state?.runId || ''),
    missionId: String(battle.missionId || ''),
    phase: String(battle.phase || ''),
    turn: Math.max(0, Number(battle.turn || 0)),
    aliveAllies: aliveCount(battle.units),
    aliveEnemies: aliveCount(battle.enemies),
    lastResult: String(battle.lastResult || '').trim(),
    latestLog: String(Array.isArray(state?.log) ? state.log[0] || '' : '').trim(),
    battleWins: Math.max(0, Number(state?.battleWins || 0)),
  };
}

export function baSrpgFeedbackPresentation(value) {
  const snapshot = normalizeSnapshot(value);
  const detail = feedbackText(snapshot);
  if (snapshot.phase === 'cleared' && /클리어|승리/.test(detail)) {
    return { action: 'victory', cue: 'victory', label: '임무 클리어', tone: 'success', detail: detail || '승리' };
  }
  if (snapshot.phase === 'failed' && /실패|패배|전멸/.test(detail)) {
    return { action: 'defeat', cue: 'defeat', label: '작전 실패', tone: 'danger', detail: detail || '패배' };
  }
  const signal = resultSignal(detail);
  return { ...signal, detail: detail || '학생과 표적을 선택해 작전을 시작하세요.' };
}

export function baSrpgFeedbackCue(previousValue, currentValue) {
  if (!previousValue || !currentValue) return '';
  const previous = normalizeSnapshot(previousValue);
  const current = normalizeSnapshot(currentValue);
  if (previous.runId && current.runId && previous.runId !== current.runId) return '';

  if (previous.phase !== 'cleared' && current.phase === 'cleared') return 'victory';
  if (previous.phase !== 'failed' && current.phase === 'failed') return 'defeat';

  const battleRestarted = current.phase === 'player'
    && current.turn === 1
    && (
      current.missionId !== previous.missionId
      || previous.phase === 'cleared'
      || previous.phase === 'failed'
      || current.aliveEnemies > previous.aliveEnemies
    );
  if (battleRestarted) return 'deploy';
  if (current.aliveAllies < previous.aliveAllies) return 'unitDown';
  if (current.aliveEnemies < previous.aliveEnemies) return 'elimination';
  if (current.lastResult && current.lastResult !== previous.lastResult) {
    return resultSignal(current.lastResult).cue;
  }
  if (current.latestLog && current.latestLog !== previous.latestLog) {
    return resultSignal(current.latestLog).cue;
  }
  if (current.turn > previous.turn) return 'turn';
  return '';
}
