import { ActionButton, GameControlButton, SmallStat } from '../../_components/GamePlayPrimitives';
import { auditLogoPackAction, generateRaceCardAction, generateSeasonCardAction } from '../_lib/racingLogosEngine';

const QUEUE_ACTION_ICONS = {
  draft: 'code',
  calendar: 'calendar',
  'event-card': 'event',
  'season-card': 'season',
};

export default function RacingLogosAuditTab(props) {
  const {
    applyDraftPack,
    audit,
    events,
    packMatrix,
    productionQueue,
    runQueueAction,
    score,
    setState,
    showDraftPack,
    tracks,
  } = props;

  return (
              <section className="games-dashboard">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>완성도</h2>
                    <span>{audit.id}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="트랙 실명" value={`${audit.namedTracks}/${audit.tracks}`} />
                    <SmallStat label="이벤트 실명" value={`${audit.namedEvents}/${audit.events}`} />
                    <SmallStat label="로고키" value={`${audit.overriddenLogos}/${audit.tracks}`} />
                    <SmallStat label="placeholder" value={audit.placeholderOnly} />
                    <SmallStat label="후보 경로" value={audit.localCandidateCount} />
                    <SmallStat label="점수" value={score.toLocaleString('ko-KR')} />
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton action="analysis" onClick={() => setState((current) => auditLogoPackAction(current))}>로고팩 감사</ActionButton>
                    <ActionButton action="event" onClick={() => setState((current) => generateRaceCardAction(current))}>이벤트 카드 생성</ActionButton>
                    <ActionButton action="season" onClick={() => setState((current) => generateSeasonCardAction(current))}>시즌 카드 생성</ActionButton>
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>에셋 제작 큐</h2>
                    <span>{productionQueue.rows.length}개</span>
                  </div>
                  <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
                    <strong>{productionQueue.headline}</strong>
                  </div>
                  <div className="game-save-list">
                    {productionQueue.rows.map((item) => (
                      <article className="game-save-row" key={item.id}>
                        <div>
                          <span>{item.kind}</span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </div>
                        <GameControlButton
                          action={QUEUE_ACTION_ICONS[item.action] || 'action'}
                          className="tcg-primary-action"
                          onClick={() => runQueueAction(item)}
                        >
                          {item.actionLabel}
                        </GameControlButton>
                      </article>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton action="code" onClick={showDraftPack}>보강 JSON 초안 보기</ActionButton>
                    <ActionButton action="deploy" onClick={applyDraftPack}>샘플 보강팩 적용</ActionButton>
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>보강 우선순위</h2>
                    <span>{packMatrix.totals.completed}/{packMatrix.totals.rows}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="누락 이름" value={packMatrix.totals.missingNames} />
                    <SmallStat label="누락 로고키" value={packMatrix.totals.missingLogoOverrides} />
                    <SmallStat label="트랙명" value={packMatrix.totals.trackNameCount} />
                    <SmallStat label="이벤트명" value={packMatrix.totals.eventNameCount} />
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {packMatrix.rows.filter((row) => !row.complete).slice(0, 4).map((row) => (
                      <article className="game-save-row" key={row.id}>
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
