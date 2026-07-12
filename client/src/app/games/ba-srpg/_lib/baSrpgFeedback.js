function aliveCount(rows) {
  return Array.isArray(rows) ? rows.filter((row) => Number(row?.hp || 0) > 0).length : 0;
}

function normalizeSnapshot(value) {
  return value?.battle ? createBaSrpgFeedbackSnapshot(value) : value || {};
}

function resultSignal(lastResult) {
  const text = String(lastResult || '').trim();
  if (!text) return { action: 'deploy', cue: '', label: '작전 대기', tone: 'ready' };
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
    battleWins: Math.max(0, Number(state?.battleWins || 0)),
  };
}

export function baSrpgFeedbackPresentation(value) {
  const snapshot = normalizeSnapshot(value);
  if (snapshot.phase === 'cleared') {
    return { action: 'victory', cue: 'victory', label: '임무 클리어', tone: 'success', detail: snapshot.lastResult || '승리' };
  }
  if (snapshot.phase === 'failed') {
    return { action: 'defeat', cue: 'defeat', label: '작전 실패', tone: 'danger', detail: snapshot.lastResult || '패배' };
  }
  const signal = resultSignal(snapshot.lastResult);
  return { ...signal, detail: snapshot.lastResult || '학생과 표적을 선택해 작전을 시작하세요.' };
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
  if (current.turn > previous.turn) return 'turn';
  return '';
}
