import GameActionIcon from '../../_components/GameActionIcon';
import { ActionButton, GameControlButton, RecentActionResult, SmallStat } from '../../_components/GamePlayPrimitives';
import { auditLogoPackAction, generateRaceCardAction, generateSeasonCardAction } from '../_lib/racingLogosEngine';
import { RacingLogosPanelTitle } from './RacingLogosVisuals';

const QUEUE_ACTION_ICONS = {
  draft: 'draft',
  calendar: 'calendar',
  'event-card': 'event-card',
  'season-card': 'season-card',
};

export default function RacingLogosAuditTab(props) {
  const {
    applyDraftPack,
    audit,
    events,
    packMatrix,
    productionQueue,
    recentActionText,
    resultPresentation,
    runQueueAction,
    score,
    setState,
    showDraftPack,
    tracks,
  } = props;

  return (
              <section className="games-dashboard">
                <section className="games-panel">
                  <RacingLogosPanelTitle action={audit.completeness >= 100 ? 'logo-perfect' : 'logo-audit'} title="완성도" meta={audit.id} />
                  <div className="games-rank-split">
                    <SmallStat icon="map" label="트랙 실명" value={`${audit.namedTracks}/${audit.tracks}`} />
                    <SmallStat icon="race-card" label="이벤트 실명" value={`${audit.namedEvents}/${audit.events}`} />
                    <SmallStat icon="logo-audit" label="로고키" value={`${audit.overriddenLogos}/${audit.tracks}`} />
                    <SmallStat icon="pack-invalid" label="placeholder" value={audit.placeholderOnly} />
                    <SmallStat icon="search" label="후보 경로" value={audit.localCandidateCount} />
                    <SmallStat icon="title" label="점수" value={score.toLocaleString('ko-KR')} />
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton action="logo-audit" cue="off" onClick={() => setState((current) => auditLogoPackAction(current))}>로고팩 감사</ActionButton>
                    <ActionButton action="race-card" cue="off" onClick={() => setState((current) => generateRaceCardAction(current))}>이벤트 카드 생성</ActionButton>
                    <ActionButton action="season-card" cue="off" onClick={() => setState((current) => generateSeasonCardAction(current))}>시즌 카드 생성</ActionButton>
                  </div>
                  <RecentActionResult action={resultPresentation.action} label={resultPresentation.label} text={recentActionText} tone={resultPresentation.tone} />
                </section>
                <section className="games-panel">
                  <RacingLogosPanelTitle action="draft" title="에셋 제작 큐" meta={`${productionQueue.rows.length}개`} />
                  <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
                    <strong>{productionQueue.headline}</strong>
                  </div>
                  <div className="game-save-list">
                    {productionQueue.rows.map((item) => (
                      <article className="game-save-row racing-logo-icon-row" key={item.id}>
                        <GameActionIcon action={QUEUE_ACTION_ICONS[item.action] || 'race-card'} label={item.kind} />
                        <div>
                          <span>{item.kind}</span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </div>
                        <GameControlButton
                          action={QUEUE_ACTION_ICONS[item.action] || 'action'}
                          cue={item.action === 'calendar' ? 'tab' : 'off'}
                          className="tcg-primary-action"
                          onClick={() => runQueueAction(item)}
                        >
                          {item.actionLabel}
                        </GameControlButton>
                      </article>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton action="draft" cue="off" onClick={showDraftPack}>보강 JSON 초안 보기</ActionButton>
                    <ActionButton action="pack-apply" cue="off" onClick={applyDraftPack}>샘플 보강팩 적용</ActionButton>
                  </div>
                </section>
                <section className="games-panel">
                  <RacingLogosPanelTitle action="target" title="보강 우선순위" meta={`${packMatrix.totals.completed}/${packMatrix.totals.rows}`} />
                  <div className="games-rank-split">
                    <SmallStat icon="draft" label="누락 이름" value={packMatrix.totals.missingNames} />
                    <SmallStat icon="pack-invalid" label="누락 로고키" value={packMatrix.totals.missingLogoOverrides} />
                    <SmallStat icon="map" label="트랙명" value={packMatrix.totals.trackNameCount} />
                    <SmallStat icon="race-card" label="이벤트명" value={packMatrix.totals.eventNameCount} />
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {packMatrix.rows.filter((row) => !row.complete).slice(0, 4).map((row) => (
                      <article className="game-save-row racing-logo-icon-row is-warning" key={row.id}>
                        <GameActionIcon action="draft" label="보강 필요" />
                        <div>
                          <span>{row.kindLabel} · {row.requiredKey}</span>
                          <strong>{row.name}</strong>
                          <small>{row.status}</small>
                        </div>
                        <span className="game-save-chip">보강</span>
                      </article>
                    ))}
                    {!packMatrix.rows.some((row) => !row.complete) ? <div className="games-empty">로컬팩 매트릭스가 모두 채워졌습니다.</div> : null}
                  </div>
                </section>
              </section>
  );
}
