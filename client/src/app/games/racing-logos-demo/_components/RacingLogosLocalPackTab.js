import { ActionButton } from '../../_components/GamePlayPrimitives';
import { clearLocalPackAction, setFilterAction } from '../_lib/racingLogosEngine';

export default function RacingLogosLocalPackTab(props) {
  const {
    applyDraftPack,
    applyTextPack,
    busy,
    events,
    loadPublicLocalPack,
    packText,
    setPackText,
    setState,
    showDraftPack,
    state,
  } = props;

  return (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>real_names.json</h2>
                    <span>{Object.keys(state.localPack.eventNames).length} events</span>
                  </div>
                  <label className="game-save-json-field">
                    <span>JSON</span>
                    <textarea
                      rows={12}
                      value={packText}
                      onChange={(event) => setPackText(event.target.value)}
                      spellCheck={false}
                    />
                  </label>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionButton action="deploy" onClick={applyTextPack}>수동 JSON 적용</ActionButton>
                    <ActionButton action="code" onClick={showDraftPack}>보강 JSON 초안 불러오기</ActionButton>
                    <ActionButton action="deploy" onClick={applyDraftPack}>샘플 보강팩 적용</ActionButton>
                    <ActionButton action="load" onClick={() => void loadPublicLocalPack()} disabled={busy === 'local-pack'}>{busy === 'local-pack' ? '불러오는 중...' : 'public/local_pack 불러오기'}</ActionButton>
                    <ActionButton action="reset" onClick={() => setState((current) => clearLocalPackAction(current))}>로컬팩 비우기</ActionButton>
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>필터</h2>
                    <span>{state.filters.preferLocalLogos ? 'local first' : 'fallback only'}</span>
                  </div>
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
                </section>
              </section>
  );
}
