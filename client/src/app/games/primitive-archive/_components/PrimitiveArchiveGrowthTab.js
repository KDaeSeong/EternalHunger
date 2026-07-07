import {
  ActionButton,
  RecentActionResult,
  SmallStat,
} from '../../_components/GamePlayPrimitives';

export default function PrimitiveArchiveGrowthTab(props) {
  const {
    buyPerk,
    canAct,
    inspirationRows,
    perks,
    priorityPlannerRows,
    recentActionText,
    research,
    researchMap,
    runResearch,
    selectResearchTarget,
    selectedPlanner,
    selectedResearchHelp,
    state,
    techs,
  } = props;

  return (
    <>
          <RecentActionResult label="최근 연구/성장 결과" text={recentActionText} pinned />

          <section className="games-dashboard">
            <section className="games-panel">
              <div className="games-panel-title">
                <h2>연구</h2>
                <span>{research.completed}/{research.total}</span>
              </div>
              <label className="game-save-json-field">
                <span>목표 기술</span>
                <select
                  value={state.research.selectedTechId}
                  onChange={(event) => selectResearchTarget(event.target.value)}
                >
                  {techs.map((tech) => (
                    <option value={tech.id} key={tech.id} disabled={!tech.available && !tech.completed && !tech.selected}>
                      {tech.completed ? '완료 · ' : tech.selected ? '선택 · ' : tech.available ? '가능 · ' : tech.eurekaStatus?.blocked ? '단서 확보 · 잠김 · ' : '잠김 · '}
                      {tech.name} ({tech.progress}/{tech.cost})
                    </option>
                  ))}
                </select>
              </label>
              <div className="games-rank-split">
                <div><span>선택</span><strong>{research.selected?.name || '-'}</strong></div>
                <div><span>진행</span><strong>{research.selected?.progressPct || 0}%</strong></div>
                <div><span>가능</span><strong>{research.available}</strong></div>
              </div>
              <div className={research.selected && !research.selected.completed && !research.selected.available ? 'games-empty games-error' : 'games-empty'} style={{ textAlign: 'left', marginTop: 12 }}>
                {selectedResearchHelp}
              </div>
              <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
                유레카: {research.selected?.eureka?.desc || '없음'} {research.selected?.eurekaDone ? '· 적용됨' : research.selected?.eurekaStatus?.blocked ? '· 단서 확보, 선행 연구 필요' : ''}
              </p>
              {research.selected?.eurekaStatus?.note ? (
                <p style={{ color: research.selected.eurekaStatus.blocked ? '#facc15' : '#94a3b8', fontWeight: 800, lineHeight: 1.5, marginTop: -6 }}>
                  {research.selected.eurekaStatus.note}
                </p>
              ) : null}
              <div className="game-save-list">
                {inspirationRows.slice(0, 4).map((row) => (
                  <article className="game-save-row" key={row.techId}>
                    <div>
                      <span>
                        {row.statusLabel || (row.completed ? '완료' : row.eurekaDone ? '달성' : row.available ? '진행 가능' : '잠김')}
                        {' · '}
                        {row.current}/{row.target}
                      </span>
                      <strong>{row.techName}</strong>
                      <small style={{ display: 'block', color: '#94a3b8', marginTop: 4 }}>
                        {row.note || row.desc} · {row.progressPct}%
                      </small>
                    </div>
                  </article>
                ))}
              </div>
              <ActionButton disabled={!canAct || !research.selected?.available} onClick={runResearch}>
                연구 실행
              </ActionButton>
            </section>

            <section className="games-panel">
              <div className="games-panel-title">
                <h2>상세 연구 플래너</h2>
                <span>{selectedPlanner?.priorityLabel || '대기'}</span>
              </div>
              {selectedPlanner ? (
                <>
                  <div className="games-rank-split">
                    <SmallStat label="목표" value={selectedPlanner.name} />
                    <SmallStat label="진행" value={`${selectedPlanner.progress}/${selectedPlanner.cost}`} />
                    <SmallStat label="유레카" value={selectedPlanner.eurekaTarget ? `${selectedPlanner.eurekaCurrent}/${selectedPlanner.eurekaTarget}` : '없음'} />
                  </div>
                  <div className={selectedPlanner.available || selectedPlanner.completed ? 'games-empty' : 'games-empty games-error'} style={{ textAlign: 'left', marginTop: 12 }}>
                    <strong>{selectedPlanner.blockerText}</strong>
                    <br />
                    {selectedPlanner.nextAction}
                  </div>
                  <div className="games-activity-list" style={{ marginTop: 12 }}>
                    <div>
                      <strong>해금</strong>
                      <span>{selectedPlanner.unlockText}</span>
                    </div>
                    <div>
                      <strong>유레카</strong>
                      <span>{selectedPlanner.eurekaText} · {selectedPlanner.eurekaPct}%</span>
                    </div>
                  </div>
                </>
              ) : <div className="games-empty">연구 플래너 정보가 없습니다.</div>}

              <div className="games-panel-title" style={{ marginTop: 16 }}>
                <h2>다음 후보</h2>
                <span>{priorityPlannerRows.length}개</span>
              </div>
              <div className="game-save-list">
                {priorityPlannerRows.map((tech) => (
                  <article className="game-save-row" key={tech.id}>
                    <div>
                      <span>{tech.priorityLabel} · 우선도 {tech.priorityScore} · {tech.progressPct}%</span>
                      <strong>{tech.name}</strong>
                      <small>{tech.nextAction}</small>
                    </div>
                    <button type="button" disabled={!tech.available || tech.completed || tech.selected} onClick={() => selectResearchTarget(tech.id)}>
                      {tech.selected ? '선택 중' : tech.available ? '목표' : '대기'}
                    </button>
                  </article>
                ))}
              </div>
            </section>

            <section className="games-panel">
              <div className="games-panel-title">
                <h2>연구 지도</h2>
                <span>{researchMap.map((era) => `${era.label} ${era.completed}/${era.total}`).join(' · ')}</span>
              </div>
              <div className="game-save-list">
                {researchMap.map((era) => (
                  <div key={era.era} style={{ display: 'grid', gap: 8 }}>
                    <strong style={{ color: '#f8fafc' }}>{era.label} · {era.completed}/{era.total}</strong>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {era.rows.map((tech) => (
                        <button
                          type="button"
                          className="game-save-row"
                          key={tech.id}
                          disabled={tech.completed || !tech.available}
                          onClick={() => selectResearchTarget(tech.id)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            borderColor: tech.selected
                              ? 'rgba(56, 189, 248, 0.78)'
                              : tech.completed
                                ? 'rgba(34, 197, 94, 0.42)'
                                : tech.available
                                  ? 'rgba(250, 204, 21, 0.5)'
                                  : undefined,
                          }}
                        >
                          <div>
                            <span>{tech.statusLabel} · {tech.progress}/{tech.cost} · {tech.progressPct}%</span>
                            <strong>{tech.name}</strong>
                            <small>{tech.unlockText}</small>
                            <small>{tech.nextStepText}</small>
                          </div>
                          <strong>{tech.completed ? 'OK' : tech.available ? '목표' : '대기'}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="games-panel">
              <div className="games-panel-title">
                <h2>특전</h2>
                <span>{state.meta.perkPoints} pt</span>
              </div>
              <div className="game-save-list">
                {perks.map((perk) => (
                  <article className="game-save-row" key={perk.id}>
                    <div>
                      <span>Lv.{perk.level}/{perk.maxLevel} · 비용 {perk.cost}</span>
                      <strong>{perk.name}</strong>
                      <small style={{ display: 'block', color: '#94a3b8', marginTop: 4 }}>{perk.desc}</small>
                    </div>
                    <button
                      type="button"
                      className="tcg-primary-action"
                      disabled={!perk.canBuy}
                      onClick={() => buyPerk(perk)}
                    >
                      {perk.maxed ? '완료' : '구매'}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </section>
                </>
  );
}
