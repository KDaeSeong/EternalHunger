'use client';

import Image from 'next/image';
import { DEFAULT_RULESET_ID, getRuleset, normalizeRulesetId } from '../../../utils/rulesets';
import GameActionIcon from '../../games/_components/GameActionIcon';
import { itemDisplayName, itemIcon } from '../_lib/simulationCommon';
import { getVisibleRuntimeEffects } from '../_lib/runtimeStatus';
import { getEquipSummary } from '../_lib/survivorRuntime';
import { getInvRules } from '../_lib/inventoryItemRules';
import { getActionStatePresentation } from '../_lib/runtimeStatusDisplay.js';
import { getCombatSpacePresentation } from '../_lib/combatSpacePresentation.js';
import { getUniqueResourceSnapshot } from '../_lib/uniqueResourceRuntime.js';
import { getDetonationMaxSec } from '../_lib/detonationTimerRuntime.js';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function TeamBadge({ actor, getTeamStateForActor }) {
  const teamState = getTeamStateForActor?.(actor);
  if (!teamState) return null;
  return (
    <div
      className={`team-status-badge ${teamState.missingCount > 0 ? 'damaged' : ''}`}
      title={`${teamState.teamName} 원래 팀원: ${teamState.rosterNames.join(', ') || '확인 불가'}`}
    >
      👥 {teamState.label}
    </div>
  );
}

function DetonationBadge({ actor, forbiddenNow, settings }) {
  const detVal = Number(actor?.detonationSec);
  if (!Number.isFinite(detVal)) return null;

  const ruleset = getRuleset(settings?.rulesetId, settings?.simulationRuleset);
  const detMax = getDetonationMaxSec(actor, ruleset);
  const critical = Math.max(0, Number(ruleset?.detonation?.criticalSec ?? 5));
  const zoneId = String(actor?.zoneId || '');
  const isForbidden = forbiddenNow?.has?.(zoneId);
  const detFloor = Math.max(0, Math.floor(detVal));
  const maxFloor = Number.isFinite(detMax) ? Math.max(0, Math.floor(detMax)) : null;
  const isCritical = detFloor <= critical;
  const label = maxFloor !== null ? `${detFloor}/${maxFloor}s` : `${detFloor}s`;
  const paused = isForbidden && getActionStatePresentation(actor).collarPaused;
  const timerState = paused ? '경직: 금지구역 카운트 정지' : isForbidden ? '금지구역: 폭발 타이머 감소' : '안전구역: 폭발 타이머 회복';

  return (
    <span
      title={`${timerState} · ${actor?.detonationFinalNight ? '마지막 밤 이후' : '평소'} 상한 ${detMax}초`}
      style={{
        fontWeight: 900,
        padding: '2px 8px',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.20)',
        background: paused ? '#155e75' : isCritical ? '#9f1239' : isForbidden ? '#991b1b' : '#374151',
        color: '#fff',
      }}
    >
      {paused ? '⏸️ ' : isCritical ? '⚠️ ' : ''}⏳ {label}{paused ? ' · 정지' : ''}
    </span>
  );
}

function InventorySummary({ actor, settings }) {
  const inventory = safeArray(actor?.inventory);
  const { maxSlots } = getInvRules(getRuleset(settings?.rulesetId, settings?.simulationRuleset));
  return (
    <div className="inventory-summary" title={`가방 ${inventory.length}/${maxSlots}칸 사용 · 같은 아이템 묶음은 한 칸`}>
      <span className="bag-icon">🎒</span>
      <span className="inv-count">{inventory.length}/{maxSlots}</span>
      <div className="inv-tooltip">
        {inventory.map((item, index) => (
          <div key={`${item?._id || item?.itemId || index}`} className="inv-item-mini">
            {itemIcon(item)} {itemDisplayName(item)}
            {Number(item?.qty || 1) > 1 ? ` x${Number(item.qty)}` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

function UniqueResourceBadge({ actor }) {
  const { resource, value } = getUniqueResourceSnapshot(actor);
  if (!resource.enabled) return null;
  const display = (number) => Number.isInteger(number) ? number : Number(number.toFixed(1));
  return <span title={`${resource.name} · 초당 ${display(resource.regenPerSec)} 회복`}>
    ◈ {resource.name} {display(value)}/{display(resource.maxValue)}
  </span>;
}

function StatusEffects({ actor, day, timeOfDay }) {
  const combatSpace = getCombatSpacePresentation(actor);
  const uiPhaseIdx = Math.max(0, Number(day || 0) * 2 + (timeOfDay === 'day' ? 0 : 1));
  const dangerUntil = Number(actor?._immediateDangerUntilPhaseIdx ?? -1);
  const dangerValue = Math.max(0, Number(actor?._immediateDanger || 0));
  const showDanger = dangerValue > 0 && dangerUntil === uiPhaseIdx;

  return (
    <div className="status-effects-container">
      {combatSpace ? <span className="effect-badge" title={combatSpace.title}
        style={{ background: '#312e81', color: '#fff', border: '1px solid #c7d2fe' }}>{combatSpace.label}</span> : null}
      {showDanger ? (
        <span title="수집/사냥 직후: 교전 유발(표적 우선)" className="effect-badge">
          ⚠️ 노출 +{Math.min(99, Math.max(1, Math.round(dangerValue * 100)))}%
        </span>
      ) : null}
      {getVisibleRuntimeEffects(actor?.activeEffects).map((effect, index) => {
        const name = String(effect?.name || '');
        const duration = Number.isFinite(Number(effect?.remainingDuration)) ? Math.max(0, Number(effect.remainingDuration)) : null;
        const stacks = Math.max(1, Number(effect?.stacks || 1));
        const label = effect?._boardLabel || (
          duration !== null
            ? `${String(effect?.icon || '🤕')}${name}${stacks > 1 ? ` x${stacks}` : ''} ${duration}s`
            : `${String(effect?.icon || '🤕')}${name}${stacks > 1 ? ` x${stacks}` : ''}`
        );
        const title = effect?._boardTitle || (duration !== null ? `${name}${stacks > 1 ? ` x${stacks}` : ''} (${duration}s)` : name);
        return (
          <span key={`${name}-${index}`} title={title} className="effect-badge">
            {label}
          </span>
        );
      })}
    </div>
  );
}

function AliveSurvivorCard(props) {
  const {
    actor,
    activeMap,
    day,
    forbiddenNow,
    getTeamStateForActor,
    getZoneName,
    killCounts,
    phase,
    settings,
    timeOfDay,
    zones,
  } = props;
  const equipSummary = getEquipSummary(actor);
  const actionState = getActionStatePresentation(actor);

  return (
    <div className="survivor-card alive" style={{ color: '#1f2937' }}>
      {actionState.polymorphed ? <div role="img" aria-label={`${actor.name} 변이 중 · 양 모습`}
        style={{ width: 60, height: 60, fontSize: 44, lineHeight: '60px', margin: '0 auto' }}>🐑</div> : <Image
        src={actor.previewImage || '/Images/default_image.svg'}
        alt={actor.name}
        width={60}
        height={60}
        unoptimized
      />}
      <span>{actor.name}</span>
      <TeamBadge actor={actor} getTeamStateForActor={getTeamStateForActor} />
      <div className="skill-tag">⭐ {actor.specialSkill?.name || '기본 공격'}</div>
      <div className={`zone-badge ${forbiddenNow?.has?.(String(actor.zoneId || '')) ? 'forbidden' : ''}`}>
        📍 {getZoneName(actor.zoneId || '__default__')}
      </div>
      <div style={{ fontSize: 12, marginTop: 6, opacity: 0.95 }}>💳 {Number(actor.simCredits || 0)} Cr</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, rowGap: 4, justifyContent: 'center', fontSize: 12, opacity: 0.95 }}>
        <span>❤️ {Math.max(0, Math.floor(Number(actor.hp ?? 0)))}/{Math.max(1, Math.floor(Number(actor.maxHp ?? 100)))}</span>
        <DetonationBadge actor={actor} activeMap={activeMap} day={day} forbiddenNow={forbiddenNow} phase={phase} settings={settings} zones={zones} />
        {normalizeRulesetId(settings?.rulesetId) === DEFAULT_RULESET_ID ? (
          <span>⚡ {Number.isFinite(Number(actor.gadgetEnergy)) ? Math.floor(Number(actor.gadgetEnergy)) : 0}</span>
        ) : null}
        <UniqueResourceBadge actor={actor} />
      </div>
      <div className="equip-summary" title={equipSummary.full}>
        🧰 {equipSummary.short}
      </div>
      <InventorySummary actor={actor} settings={settings} />
      {killCounts?.[actor._id] > 0 ? <span className="kill-badge">⚔️{killCounts[actor._id]}</span> : null}
      <StatusEffects actor={actor} day={day} timeOfDay={timeOfDay} />
      {actionState.text ? <div style={{ fontSize: 11, lineHeight: 1.5, marginTop: 4 }}>{actionState.text}</div> : null}
    </div>
  );
}

function DeadSurvivorCard({ actor, getTeamStateForActor, getZoneName, killCounts }) {
  return (
    <div className="survivor-card dead">
      <Image
        src={actor.previewImage || '/Images/default_image.svg'}
        alt={actor.name}
        width={60}
        height={60}
        unoptimized
      />
      <span>{actor.name}</span>
      <TeamBadge actor={actor} getTeamStateForActor={getTeamStateForActor} />
      <div className="zone-badge dead">📍 {getZoneName(actor.zoneId || '__default__')}</div>
      <div style={{ fontSize: 12, marginTop: 6, opacity: 0.95 }}>💳 {Number(actor.simCredits || 0)} Cr</div>
      {killCounts?.[actor._id] > 0 ? <span className="kill-badge">⚔️{killCounts[actor._id]}</span> : null}
    </div>
  );
}

export default function SimulationSurvivorBoard(props) {
  const {
    activeMap,
    closeUiModal,
    day,
    dead,
    forbiddenNow,
    getTeamStateForActor,
    getZoneName,
    killCounts,
    phase,
    settings,
    survivors,
    timeOfDay,
    uiModal,
    zones,
  } = props;

  return (
    <aside className={`survivor-board ${uiModal === 'chars' ? 'modal-open' : ''}`}>
      {uiModal === 'chars' ? (
        <button className="eh-modal-close" type="button" data-game-sfx="click" onClick={closeUiModal} aria-label="닫기" title="닫기">
          <GameActionIcon action="close" label="닫기" />
        </button>
      ) : null}
      <h2>생존자 ({safeArray(survivors).length}명)</h2>
      <div className="survivor-grid">
        {safeArray(survivors).map((actor) => (
          <AliveSurvivorCard
            key={actor._id}
            actor={actor}
            activeMap={activeMap}
            day={day}
            forbiddenNow={forbiddenNow}
            getTeamStateForActor={getTeamStateForActor}
            getZoneName={getZoneName}
            killCounts={killCounts}
            phase={phase}
            settings={settings}
            timeOfDay={timeOfDay}
            zones={zones}
          />
        ))}
      </div>

      <h2 style={{ marginTop: '30px', color: '#ff5252' }}>사망자 ({safeArray(dead).length}명)</h2>
      <div className="survivor-grid">
        {safeArray(dead).map((actor) => (
          <DeadSurvivorCard
            key={actor._id}
            actor={actor}
            getTeamStateForActor={getTeamStateForActor}
            getZoneName={getZoneName}
            killCounts={killCounts}
          />
        ))}
      </div>
    </aside>
  );
}
