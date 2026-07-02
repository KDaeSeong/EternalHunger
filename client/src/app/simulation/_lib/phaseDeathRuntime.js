import { dedupeRuntimeParticipants, getRuntimeActorKey } from './runtimeParticipantRuntime';
import { normalizeDeadSnapshot } from './survivorLifecycleRuntime';
import { normalizeRuntimeSurvivorList } from './survivorRuntime';

function setDeathMetadata(actor, reason, meta = {}, currentActionSec = () => 0) {
  if (!actor || typeof actor !== 'object') return actor;
  const code = String(reason || actor?._deathBy || actor?.deathReason || actor?.lastDeathReason || 'unknown').trim() || 'unknown';
  actor._deathBy = code;
  actor.deathReason = code;
  actor.lastDeathReason = code;
  const causeName = String(meta?.causeName || actor?._deathCauseName || actor?.deathCauseName || '').trim();
  if (causeName) {
    actor._deathCauseName = causeName;
    actor.deathCauseName = causeName;
  }
  const killerId = String(meta?.by || actor?._deathKillerId || actor?.deathKillerId || actor?.lastDamagedBy || '').trim();
  if (killerId) {
    actor._deathKillerId = killerId;
    actor.deathKillerId = killerId;
  }
  const at = Number(meta?.atSec ?? actor?._deathAt ?? currentActionSec());
  if (Number.isFinite(at) && at >= 0) actor._deathAt = at;
  return actor;
}

function formatFallbackDeathReason(actor) {
  const causeName = String(actor?._deathCauseName || actor?.deathCauseName || actor?.deathCause || '').trim();
  if (causeName) return causeName;
  const raw = String(actor?._deathBy || actor?.deathReason || actor?.lastDeathReason || '').toLowerCase();
  if (raw.includes('detonation')) return '폭발 타이머';
  if (raw.includes('forbidden')) return '금지구역';
  if (raw.includes('wildlife') || raw.includes('hunt')) return '야생동물/사냥';
  if (raw.includes('sudden')) return '서든데스';
  if (raw.includes('character_skill')) return '캐릭터 스킬';
  if (raw.includes('critical_flee')) return '빈사 추격';
  if (raw.includes('accident')) return '사고';
  if (raw.includes('status') || raw.includes('effect')) return '상태 효과';
  if (raw.includes('elimination')) return '팀 전멸';
  if (raw.includes('hp_zero')) return '체력 0';
  return '전투';
}

function createPhaseDeathRuntime(opts = {}) {
  const {
    addLog,
    atNow,
    currentActionSec,
    emitRunEvent,
    fullLogEntriesRef,
    phaseDeathLogStartIndex = 0,
    phaseIdxNow = 0,
    ruleset,
    setDead,
  } = opts;
  const phaseDeadSnapshots = [];
  const fallbackDeathLogKeys = new Set();
  const emittedDeathEventKeys = new Set();

  const emitDeathRunEventOnce = (actor, meta = {}) => {
    const who = getRuntimeActorKey(actor);
    if (!who) return;
    const reason = String(meta?.reason || actor?._deathBy || actor?.deathReason || actor?.lastDeathReason || 'unknown').trim() || 'unknown';
    const by = String(meta?.by || actor?._deathKillerId || actor?.deathKillerId || actor?.lastDamagedBy || '').trim();
    const key = `${who}:${phaseIdxNow}:${reason}:${by}`;
    if (emittedDeathEventKeys.has(key)) return;
    emittedDeathEventKeys.add(key);
    emitRunEvent?.('death', {
      who,
      by,
      zoneId: String(meta?.zoneId || actor?.zoneId || ''),
      reason,
      cause: String(meta?.cause || actor?._deathCauseName || actor?.deathCauseName || ''),
    }, meta?.at || atNow?.());
  };

  const hasDirectDeathLogForActor = (actor) => {
    const key = getRuntimeActorKey(actor);
    if (key && fallbackDeathLogKeys.has(key)) return true;
    const name = String(actor?.name || '').trim();
    if (!name) return false;
    const marker = `[${name}]`;
    const entries = (Array.isArray(fullLogEntriesRef?.current) ? fullLogEntriesRef.current : []).slice(phaseDeathLogStartIndex);
    return entries.some((entry) => {
      if (String(entry?.type || '') !== 'death') return false;
      const text = String(entry?.text || '');
      const markerIndex = text.indexOf(marker);
      if (markerIndex < 0 || markerIndex > 8) return false;
      return /사망|죽|탈락|폭발|전멸|전투불능|쓰러|치명상/.test(text);
    });
  };

  const addFallbackDeathLog = (actor) => {
    const key = getRuntimeActorKey(actor);
    if (!key || hasDirectDeathLogForActor(actor)) return;
    fallbackDeathLogKeys.add(key);
    const name = String(actor?.name || '생존자').trim() || '생존자';
    addLog?.(`💀 [${name}] 사망: ${formatFallbackDeathReason(actor)}`, 'death');
  };

  const appendPhaseDeadSnapshots = (actors) => {
    const snapshots = normalizeRuntimeSurvivorList(
      (Array.isArray(actors) ? actors : [actors])
        .filter(Boolean)
        .map((actor) => normalizeDeadSnapshot(actor, ruleset))
    );
    const added = [];
    for (const snapshot of snapshots) {
      const key = getRuntimeActorKey(snapshot);
      if (!key || phaseDeadSnapshots.some((entry) => getRuntimeActorKey(entry) === key)) continue;
      addFallbackDeathLog(snapshot);
      phaseDeadSnapshots.push(snapshot);
      added.push(snapshot);
    }
    return added;
  };

  const flushDeadSnapshots = (snapshots) => {
    const list = Array.isArray(snapshots) ? snapshots : [];
    if (!list.length) return;
    setDead?.((prev) => dedupeRuntimeParticipants([...(Array.isArray(prev) ? prev : []), ...list]));
  };

  const reconcileZeroHpDeaths = (params = {}) => {
    const {
      canReviveThisMatch = false,
      newDeadIds = [],
      reviveCutoffIdx = 0,
      survivorMap,
    } = params;
    const missed = [];
    if (!survivorMap || typeof survivorMap.values !== 'function') return missed;

    for (const actor of survivorMap.values()) {
      if (!actor || !actor._id) continue;
      const id = String(actor._id);
      if (newDeadIds.includes(id)) continue;
      if (Number(actor.hp || 0) > 0) continue;
      actor.hp = 0;
      setDeathMetadata(actor, actor._deathBy || 'hp_zero_reconcile', {
        causeName: actor._deathCauseName || actor.deathCauseName || '체력 0',
        by: String(actor?.lastDamagedBy || ''),
      }, currentActionSec);
      actor.deadAtPhaseIdx = phaseIdxNow;
      actor.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
      newDeadIds.push(id);
      missed.push(actor);
      emitDeathRunEventOnce(actor, {
        by: String(actor?.lastDamagedBy || ''),
        zoneId: String(actor?.zoneId || ''),
        reason: actor._deathBy || 'hp_zero_reconcile',
        cause: actor._deathCauseName || actor.deathCauseName || '체력 0',
      });
    }
    if (missed.length > 0) {
      flushDeadSnapshots(appendPhaseDeadSnapshots(missed));
    }
    return missed;
  };

  return {
    addFallbackDeathLog,
    appendPhaseDeadSnapshots,
    emitDeathRunEventOnce,
    flushDeadSnapshots,
    formatFallbackDeathReason,
    hasDirectDeathLogForActor,
    phaseDeadSnapshots,
    reconcileZeroHpDeaths,
    setDeathMetadata: (actor, reason, meta = {}) => setDeathMetadata(actor, reason, meta, currentActionSec),
  };
}

export {
  createPhaseDeathRuntime,
  formatFallbackDeathReason,
  setDeathMetadata,
};
