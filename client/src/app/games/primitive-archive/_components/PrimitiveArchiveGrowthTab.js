import {
  ActionButton,
  GameControlButton,
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
    researchPlannerOpen,
    runResearch,
    selectResearchTarget,
    selectedPlanner,
    selectedResearchHelp,
    setResearchPlannerOpen,
    state,
    techs,
  } = props;
  const openPlanner = () => setResearchPlannerOpen?.(true);
  const closePlanner = () => setResearchPlannerOpen?.(false);

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
              <ActionButton action="research" disabled={!canAct || !research.selected?.available} onClick={runResearch}>
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
                    <div>
                      <strong>후반 보정</strong>
                      <span>{selectedPlanner.pressureLabel}</span>
                    </div>
                  </div>
                  <div className="game-save-row-actions">
                    <GameControlButton action="analysis" onClick={openPlanner}>상세 보기</GameControlButton>
                    <GameControlButton action="target" disabled={!selectedPlanner.available || selectedPlanner.completed || selectedPlanner.selected} onClick={() => selectResearchTarget(selectedPlanner.id)}>
                      {selectedPlanner.selected ? '선택 중' : selectedPlanner.available ? '목표 지정' : '대기'}
                    </GameControlButton>
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
                      <small>{tech.nextAction}{tech.pressureBonus ? ` · ${tech.pressureLabel}` : ''}</small>
                    </div>
                    <GameControlButton action="target" disabled={!tech.available || tech.completed || tech.selected} onClick={() => selectResearchTarget(tech.id)}>
                      {tech.selected ? '선택 중' : tech.available ? '목표' : '대기'}
                    </GameControlButton>
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
                          data-game-sfx="select"
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
                    <GameControlButton
                      action="upgrade"
                      className="tcg-primary-action"
                      disabled={!perk.canBuy}
                      onClick={() => buyPerk(perk)}
                    >
                      {perk.maxed ? '완료' : '구매'}
                    </GameControlButton>
                  </article>
                ))}
              </div>
            </section>
          </section>
          {researchPlannerOpen && selectedPlanner ? (
            <div className="primitive-research-modal-backdrop" role="presentation" onClick={closePlanner}>
              <section
                className="primitive-research-modal games-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="primitive-research-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="games-panel-title">
                  <div>
                    <h2 id="primitive-research-modal-title">{selectedPlanner.name}</h2>
                    <span>{selectedPlanner.priorityLabel} · 우선도 {selectedPlanner.priorityScore}</span>
                  </div>
                  <GameControlButton action="close" className="primitive-research-modal__close" onClick={closePlanner}>닫기</GameControlButton>
                </div>

                <div className="games-rank-split">
                  <SmallStat label="시대" value={selectedPlanner.era || '-'} />
                  <SmallStat label="진행" value={`${selectedPlanner.progress}/${selectedPlanner.cost}`} />
                  <SmallStat label="유레카" value={selectedPlanner.eurekaTarget ? `${selectedPlanner.eurekaCurrent}/${selectedPlanner.eurekaTarget}` : '없음'} />
                  <SmallStat label="후반 보정" value={selectedPlanner.pressureBonus ? `+${selectedPlanner.pressureBonus}` : '없음'} />
                  <SmallStat label="상태" value={selectedPlanner.priorityLabel} />
                </div>

                <div className={selectedPlanner.available || selectedPlanner.completed ? 'games-empty' : 'games-empty games-error'} style={{ textAlign: 'left' }}>
                  <strong>{selectedPlanner.blockerText}</strong>
                  <br />
                  {selectedPlanner.nextAction}
                </div>

                <section className="primitive-research-modal__grid">
                  <article>
                    <span>해금 보상</span>
                    <strong>{selectedPlanner.unlockText}</strong>
                    <small>제작/시설/패시브가 실제 생존 루프와 자동 제작 우선순위에 연결됩니다.</small>
                  </article>
                  <article>
                    <span>유레카 조건</span>
                    <strong>{selectedPlanner.eurekaText}</strong>
                    <small>현재 {selectedPlanner.eurekaPct}% 진행 중입니다. 유레카는 연구 비용을 줄이는 단서로 처리됩니다.</small>
                  </article>
                  <article>
                    <span>다음 행동</span>
                    <strong>{selectedPlanner.nextAction}</strong>
                    <small>잠긴 고대 연구는 선행 연구와 재료 조건을 먼저 맞춰야 안정적으로 이어집니다.</small>
                  </article>
                  <article>
                    <span>후반 보정</span>
                    <strong>{selectedPlanner.pressureLabel}</strong>
                    <small>식량, 체온, 희귀 재료, 기록 시설 상태가 고대 연구 우선도에 반영됩니다.</small>
                  </article>
                </section>

                <div className="games-panel-title">
                  <h2>후보 비교</h2>
                  <span>{priorityPlannerRows.length}개</span>
                </div>
                <div className="game-save-list">
                  {priorityPlannerRows.map((tech) => (
                    <article className="game-save-row" key={`modal-${tech.id}`}>
                      <div>
                        <span>{tech.priorityLabel} · 우선도 {tech.priorityScore} · {tech.progressPct}%</span>
                        <strong>{tech.name}</strong>
                        <small>{tech.unlockText}{tech.pressureBonus ? ` · ${tech.pressureLabel}` : ''}</small>
                      </div>
                      <GameControlButton action="target" disabled={!tech.available || tech.completed || tech.selected} onClick={() => selectResearchTarget(tech.id)}>
                        {tech.selected ? '선택 중' : tech.available ? '목표' : '대기'}
                      </GameControlButton>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
                </>
  );
}
