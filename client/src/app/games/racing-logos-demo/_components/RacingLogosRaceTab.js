import { useState } from 'react';
import GameActionIcon from '../../_components/GameActionIcon';
import { ActionButton, RecentActionResult, SmallStat } from '../../_components/GamePlayPrimitives';
import {
  RACE_ENTRIES,
  RACE_PHASES,
  RACE_STRATEGIES,
  advanceRaceSegmentAction,
  advanceRaceToFinishAction,
  formatRaceGap,
  setRaceStrategyAction,
  startRaceSessionAction,
} from '../_lib/racingLogosEngine';
import { RacingLogosPanelTitle } from './RacingLogosVisuals';

const EVENT_ICONS = Object.freeze({
  blocked: 'race-blocked',
  finish: 'race-finish',
  'final-spurt': 'race-final-spurt',
  grid: 'race-grid',
  overtake: 'race-overtake',
  segment: 'race-pace',
  strategy: 'race-strategy-pace',
});

function raceEventIcon(type) {
  return EVENT_ICONS[type] || 'race-pace';
}

export default function RacingLogosRaceTab({
  events,
  recentActionText,
  resultPresentation,
  setState,
  state,
}) {
  const [eventId, setEventId] = useState(() => events[0]?.id || '');
  const [managedEntryId, setManagedEntryId] = useState(() => RACE_ENTRIES[0]?.id || '');
  const session = state.raceSession;
  const managedEntry = session?.entries?.find((entry) => entry.id === session.managedEntryId) || null;
  const phase = session?.segment > 0 ? RACE_PHASES[session.segment - 1] : null;
  const strategy = RACE_STRATEGIES[session?.strategy] || RACE_STRATEGIES.pace;
  const raceFinished = session?.status === 'finished';

  if (!session) {
    return (
      <section className="games-dashboard racing-session-setup">
        <section className="games-panel">
          <RacingLogosPanelTitle action="race-grid" title="레이스 등록" meta="5두 · 6구간" />
          <p className="games-panel-copy">
            이벤트와 관리할 출전마를 고른 뒤 출발합니다. 구간마다 작전을 바꾸면 체력과 순위 흐름이 달라집니다.
          </p>
          <div className="racing-session-setup__fields">
            <label className="game-save-json-field">
              <span>레이스</span>
              <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.raceName} · {event.distanceM.toLocaleString('ko-KR')}m · {event.surfaceName}
                  </option>
                ))}
              </select>
            </label>
            <label className="game-save-json-field">
              <span>관리 출전마</span>
              <select value={managedEntryId} onChange={(event) => setManagedEntryId(event.target.value)}>
                {RACE_ENTRIES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} · 지구력 {entry.stamina} · 스피드 {entry.pace}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ActionButton
            action="race-grid"
            cue="off"
            disabled={!eventId || !managedEntryId}
            onClick={() => setState((current) => startRaceSessionAction(current, eventId, managedEntryId))}
          >
            게이트 인
          </ActionButton>
        </section>
        <section className="games-panel">
          <RacingLogosPanelTitle action="race-pace" title="경주 흐름" meta="구간 작전" />
          <div className="racing-phase-preview">
            {RACE_PHASES.map((row, index) => (
              <div key={row.id}>
                <GameActionIcon action={row.icon} label={row.label} />
                <span>{index + 1}</span>
                <strong>{row.label}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="racing-session-layout">
      <section className="games-panel racing-session-control-panel">
        <RacingLogosPanelTitle
          action={raceFinished ? 'race-finish' : phase?.icon || 'race-grid'}
          title={session.raceName}
          meta={`${session.trackName} · ${session.distanceM.toLocaleString('ko-KR')}m`}
        />
        <div className="games-rank-split racing-session-stats">
          <SmallStat icon={phase?.icon || 'race-grid'} label="구간" value={`${session.segment}/${session.totalSegments}`} />
          <SmallStat icon="race-overtake" label="현재 순위" value={`${managedEntry?.position || '-'}위`} />
          <SmallStat icon="race-stamina" label="체력" value={`${Math.round(managedEntry?.staminaPct || 0)}%`} />
          <SmallStat icon="race-overtake" label="추월" value={`${session.overtakes}회`} />
          <SmallStat icon="race-blocked" label="진로 막힘" value={`${session.blockedCount}회`} />
        </div>
        <div className="racing-strategy-grid" aria-label="관리 출전마 작전">
          {Object.values(RACE_STRATEGIES).map((row) => (
            <ActionButton
              action={row.icon}
              cue="off"
              className={strategy.id === row.id ? 'is-active' : ''}
              disabled={raceFinished}
              key={row.id}
              onClick={() => setState((current) => setRaceStrategyAction(current, row.id))}
            >
              {row.label}
            </ActionButton>
          ))}
        </div>
        <div className="racing-session-actions">
          <ActionButton
            action={phase?.icon || 'race-pace'}
            cue="off"
            disabled={raceFinished}
            onClick={() => setState((current) => advanceRaceSegmentAction(current))}
          >
            다음 구간
          </ActionButton>
          <ActionButton
            action="race-finish"
            cue="off"
            disabled={raceFinished}
            onClick={() => setState((current) => advanceRaceToFinishAction(current))}
          >
            결승까지 진행
          </ActionButton>
          <ActionButton
            action="race-grid"
            cue="off"
            onClick={() => setState((current) => startRaceSessionAction(current, session.eventId, session.managedEntryId))}
          >
            같은 조건 재경주
          </ActionButton>
        </div>
        <RecentActionResult
          action={resultPresentation.action}
          label={resultPresentation.label}
          text={recentActionText}
          tone={resultPresentation.tone}
        />
      </section>

      <section className="games-panel racing-session-standings">
        <RacingLogosPanelTitle
          action={raceFinished ? 'race-finish' : 'race-pace'}
          title={raceFinished ? '최종 순위' : '실시간 순위'}
          meta={session.phaseLabel}
        />
        <div className="racing-leaderboard">
          {session.entries.map((entry) => {
            const entryStrategy = RACE_STRATEGIES[entry.activeStrategy] || RACE_STRATEGIES.pace;
            const isManaged = entry.id === session.managedEntryId;
            return (
              <div className={`racing-entry-row${isManaged ? ' is-managed' : ''}`} key={entry.id}>
                <strong className="racing-entry-position">{entry.position}</strong>
                <GameActionIcon action={entry.status === 'blocked' ? 'race-blocked' : entryStrategy.icon} label={entry.name} />
                <div className="racing-entry-copy">
                  <strong>{entry.name}{isManaged ? ' · 관리' : ''}</strong>
                  <span>{entryStrategy.label} · 구간점수 {entry.sectionScore.toFixed(1)}</span>
                  <div className="racing-entry-stamina" aria-label={`체력 ${Math.round(entry.staminaPct)}%`}>
                    <span style={{ width: `${entry.staminaPct}%` }} />
                  </div>
                </div>
                <span className="racing-entry-gap">{entry.position === 1 ? '선두' : formatRaceGap(entry.gapLengths)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="games-panel racing-session-events">
        <RacingLogosPanelTitle action="archive" title="중계 기록" meta={`${session.events.length}개`} />
        <div className="racing-event-list">
          {session.events.slice(0, 8).map((event) => (
            <div key={event.id}>
              <GameActionIcon action={raceEventIcon(event.type)} label={event.type} />
              <span>{event.segment ? `${event.segment}구간` : '출발 전'}</span>
              <strong>{event.message}</strong>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
