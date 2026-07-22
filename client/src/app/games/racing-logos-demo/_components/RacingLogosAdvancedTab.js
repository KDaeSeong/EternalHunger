import { ActionButton, RecentActionResult, SmallStat } from '../../_components/GamePlayPrimitives';
import {
  auditLogoPackAction,
  clearLocalPackAction,
  generateRaceCardAction,
  setFilterAction,
} from '../_lib/racingLogosEngine';
import { TrackCard, EventRow } from './RacingLogosPlayPanels';
import { RacingLogosInfoRow, RacingLogosPanelTitle } from './RacingLogosVisuals';

export default function RacingLogosAdvancedTab(props) {
  const {
    applyTextPack,
    audit,
    busy,
    events,
    latestRaceCard,
    loadPublicLocalPack,
    packMatrix,
    packText,
    recentActionText,
    resultPresentation,
    score,
    setPackText,
    setState,
    state,
    tracks,
  } = props;

  return (
              <>
      <section className="games-detail-grid">
        <section className="games-panel">
          <RacingLogosPanelTitle action="pack-apply" title="로컬팩" meta={`${Object.keys(state.localPack.trackNames).length} tracks`} />
          <label className="game-save-json-field">
            <span>real_names.json</span>
            <textarea
              rows={12}
              value={packText}
              onChange={(event) => setPackText(event.target.value)}
              spellCheck={false}
            />
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton action="pack-apply" cue="off" onClick={applyTextPack}>수동 JSON 적용</ActionButton>
            <ActionButton action="load" cue="off" onClick={() => void loadPublicLocalPack()} disabled={busy === 'local-pack'}>{busy === 'local-pack' ? '불러오는 중...' : 'public/local_pack 불러오기'}</ActionButton>
            <ActionButton action="pack-clear" cue="off" onClick={() => setState((current) => clearLocalPackAction(current))}>로컬팩 비우기</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <RacingLogosPanelTitle action="settings" title="필터 / 액션" meta={state.filters.preferLocalLogos ? 'local first' : 'fallback only'} />
          <label className="game-save-json-field">
            <span>지역</span>
            <select value={state.filters.region} onChange={(event) => setState((current) => setFilterAction(current, { region: event.target.value }))}>
              <option value="all">전체</option>
              <option value="japan">일본</option>
              <option value="europe">유럽</option>
              <option value="usa">미국</option>
            </select>
          </label>
          <label className="game-save-json-field">
            <span>주로</span>
            <select value={state.filters.surface} onChange={(event) => setState((current) => setFilterAction(current, { surface: event.target.value }))}>
              <option value="all">전체</option>
              <option value="turf">잔디</option>
              <option value="dirt">더트</option>
            </select>
          </label>
          <label className="game-save-json-field">
            <span>로고 모드</span>
            <select value={state.filters.preferLocalLogos ? 'local' : 'placeholder'} onChange={(event) => setState((current) => setFilterAction(current, { preferLocalLogos: event.target.value === 'local' }))}>
              <option value="local">로컬팩 우선</option>
              <option value="placeholder">placeholder만</option>
            </select>
          </label>
          <label className="game-save-json-field">
            <span>경로 디버그</span>
            <select value={state.filters.showDebug ? 'on' : 'off'} onChange={(event) => setState((current) => setFilterAction(current, { showDebug: event.target.value === 'on' }))}>
              <option value="off">끄기</option>
              <option value="on">켜기</option>
            </select>
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton action="logo-audit" cue="off" onClick={() => setState((current) => auditLogoPackAction(current))}>로고팩 감사</ActionButton>
            <ActionButton action="race-card" cue="off" onClick={() => setState((current) => generateRaceCardAction(current))}>이벤트 카드 생성</ActionButton>
          </div>
          <RecentActionResult action={resultPresentation.action} label={resultPresentation.label} text={recentActionText} tone={resultPresentation.tone} />
        </section>

        <section className="games-panel">
          <RacingLogosPanelTitle action={audit.completeness >= 100 ? 'logo-perfect' : 'logo-audit'} title="감사 결과" meta={audit.id} />
          <div className="games-rank-split">
            <SmallStat icon="map" label="트랙 실명" value={`${audit.namedTracks}/${audit.tracks}`} />
            <SmallStat icon="race-card" label="이벤트 실명" value={`${audit.namedEvents}/${audit.events}`} />
            <SmallStat icon="logo-audit" label="로고키" value={`${audit.overriddenLogos}/${audit.tracks}`} />
            <SmallStat icon="search" label="후보 경로" value={audit.localCandidateCount} />
          </div>
          <div className="game-save-list">
            {state.auditHistory.slice(0, 4).map((item) => (
              <RacingLogosInfoRow
                action={item.completeness >= 100 ? 'logo-perfect' : 'logo-audit'}
                className={item.completeness >= 100 ? 'is-good' : 'is-warning'}
                label={`감사 완성도 ${item.completeness}%`}
                key={item.id}
              >
                <div>
                  <span>{new Date(item.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <strong>완성도 {item.completeness}%</strong>
                </div>
                <strong>{item.score.toLocaleString('ko-KR')}</strong>
              </RacingLogosInfoRow>
            ))}
            {!state.auditHistory.length ? <div className="games-empty">아직 감사 기록이 없습니다.</div> : null}
          </div>
        </section>

        <section className="games-panel">
          <RacingLogosPanelTitle action="tactics" title="로컬팩 매트릭스" meta={`${packMatrix.totals.completed}/${packMatrix.totals.rows}`} />
          <div className="games-rank-split">
            <SmallStat icon="draft" label="누락 이름" value={packMatrix.totals.missingNames} />
            <SmallStat icon="pack-invalid" label="누락 로고키" value={packMatrix.totals.missingLogoOverrides} />
            <SmallStat icon="map" label="트랙명" value={packMatrix.totals.trackNameCount} />
            <SmallStat icon="race-card" label="이벤트명" value={packMatrix.totals.eventNameCount} />
          </div>
          <div className="game-save-list">
            {packMatrix.rows.map((row) => (
              <RacingLogosInfoRow
                action={row.complete ? 'complete' : 'draft'}
                className={row.complete ? 'is-good' : 'is-warning'}
                label={row.name}
                key={row.id}
              >
                <div>
                  <span>{row.kindLabel} / {row.requiredKey}</span>
                  <strong>{row.name}</strong>
                  <span>{row.logoKeyPath} · logoKey: {row.logoKey}</span>
                  <span>{row.candidateText}</span>
                </div>
                <span className="game-save-chip">{row.status}</span>
              </RacingLogosInfoRow>
            ))}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <RacingLogosPanelTitle action="map" title="트랙 로고" meta={`${tracks.length}개`} />
          <div className="game-save-list">
            {tracks.map((track) => <TrackCard key={track.id} track={track} filters={state.filters} />)}
          </div>
        </section>

        <section className="games-panel">
          <RacingLogosPanelTitle action="calendar" title="이벤트" meta={`${events.length}개`} />
          <div className="game-save-list">
            {events.map((event) => <EventRow key={event.id} event={event} filters={state.filters} />)}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <RacingLogosPanelTitle action="race-card" title="이벤트 카드" meta={`${latestRaceCard ? latestRaceCard.results.length : 0} races`} />
          <div className="game-save-list">
            {latestRaceCard ? latestRaceCard.results.map((result, index) => (
              <RacingLogosInfoRow action="trophy" className="is-good" label={`${result.raceName} 우승`} key={`${result.eventId}-${result.week || index}`}>
                <div>
                  <span>{result.trackName} / {result.surface.toUpperCase()} / {result.distanceM.toLocaleString('ko-KR')}m</span>
                  <strong>{result.raceName}</strong>
                  <span>2위 {result.runnerUp}</span>
                </div>
                <strong>{result.winner}</strong>
              </RacingLogosInfoRow>
            )) : <div className="games-empty">이벤트 카드를 생성하면 간단한 레이스 결과가 표시됩니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <RacingLogosPanelTitle action="logs" title="운영 로그" meta={state.runId} />
          <div className="games-activity-list">
            {state.log.slice(0, 12).map((line, index) => (
              <div key={`${line}-${index}`}>
                <strong>{line}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>
              </>
  );
}
