'use client';

import { useMemo, useState } from 'react';
import {
  ActionButton,
  GameControlButton,
  RecentActionResult,
  SmallStat,
} from '../../_components/GamePlayPrimitives';
import {
  RESEARCH_ERA_LABELS,
  RESEARCH_TAG_LABELS,
} from '../_lib/primitiveArchivePageRuntime';
import PrimitiveArchiveProjectsPanel from './PrimitiveArchiveProjectsPanel';
import PrimitiveArchiveResearchTreePreview from './PrimitiveArchiveResearchTreePreview';

export default function PrimitiveArchiveGrowthTab(props) {
  const {
    buyPerk,
    canAct,
    inspirationRows,
    perks,
    priorityPlannerRows,
    projectEstimate,
    projects,
    recentActionText,
    research,
    researchMap,
    researchPlannerOpen,
    runResearch,
    runProject,
    selectProject,
    selectResearchTarget,
    selectedPlanner,
    selectedProject,
    selectedResearchHelp,
    setResearchPlannerOpen,
    state,
    techs,
  } = props;
  const openPlanner = () => setResearchPlannerOpen?.(true);
  const closePlanner = () => setResearchPlannerOpen?.(false);
  const scrollToPreview = () => {
    document.getElementById('primitive-research-tree-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const [treeFocusId, setTreeFocusId] = useState(state.research.selectedTechId);
  const [treeQuery, setTreeQuery] = useState('');
  const [treeEra, setTreeEra] = useState('ALL');
  const focusedTreeNode = useMemo(() => (
    researchMap.nodes.find((node) => node.id === treeFocusId)
    || researchMap.nodes.find((node) => node.selected)
    || researchMap.nodes[0]
  ), [researchMap.nodes, treeFocusId]);
  const treeNodeById = useMemo(
    () => Object.fromEntries(researchMap.nodes.map((node) => [node.id, node])),
    [researchMap.nodes],
  );
  const normalizedTreeQuery = treeQuery.trim().toLowerCase();

  const treeNodeMuted = (node) => {
    if (treeEra !== 'ALL' && node.era !== treeEra) return true;
    if (!normalizedTreeQuery) return false;
    return !`${node.name} ${node.id} ${(node.tags || []).join(' ')}`.toLowerCase().includes(normalizedTreeQuery);
  };

  if (!research.unlocked) {
    return (
      <>
        <RecentActionResult label="최근 연구/성장 결과" text={recentActionText} pinned />
        <section className="games-panel primitive-research-gate">
          <div className="games-panel-title">
            <div>
              <h2>부족 발전 필요</h2>
              <span>{research.headline}</span>
            </div>
            <strong>{research.gateCompleted}/{research.gateTotal}</strong>
          </div>
          <p>{research.reason}</p>
          <div className="primitive-research-gate__requirements">
            {research.gateRows.map((row) => (
              <article className={row.done ? 'is-done' : ''} key={row.id}>
                <span>{row.done ? '완료' : '필요'}</span>
                <strong>{row.label}</strong>
                <small>현재 Lv.{row.current}</small>
              </article>
            ))}
          </div>
          <div className="games-empty">세 시설을 갖추면 기술 목표 지정, 매 행동 턴 RP, 일일 자동 연구가 동시에 해금됩니다.</div>
          <GameControlButton action="research" className="primitive-research-preview-link" onClick={scrollToPreview}>
            전체 기술 트리 미리보기
          </GameControlButton>
        </section>

        <PrimitiveArchiveResearchTreePreview researchMap={researchMap} />

        <PrimitiveArchiveProjectsPanel
          canAct={canAct}
          projectEstimate={projectEstimate}
          projects={projects}
          runProject={runProject}
          selectProject={selectProject}
          selectedProject={selectedProject}
        />

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
                  <small>{perk.desc}</small>
                </div>
                <GameControlButton action="upgrade" disabled={!perk.canBuy} onClick={() => buyPerk(perk)}>
                  {perk.maxed ? '완료' : '구매'}
                </GameControlButton>
              </article>
            ))}
          </div>
        </section>
      </>
    );
  }

  return (
    <>
          <RecentActionResult label="최근 연구/성장 결과" text={recentActionText} pinned />

          <section className="games-dashboard">
            <section className="games-panel">
              <div className="games-panel-title">
                <h2>연구</h2>
                <span>핵심 {research.archiveCompleted}/{research.archiveTotal} · 전체 {research.completed}/{research.total}</span>
              </div>
              <label className="game-save-json-field">
                <span>목표 기술</span>
                <select
                  value={state.research.selectedTechId}
                  onChange={(event) => selectResearchTarget(event.target.value)}
                >
                  {techs.map((tech) => (
                    <option value={tech.id} key={tech.id} disabled={!tech.available && !tech.completed && !tech.selected}>
                      {tech.completed ? '완료 · ' : tech.selected ? '선택 · ' : tech.available ? '가능 · ' : tech.eurekaStatus?.blocked || tech.inspirationStatus?.blocked ? '단서 확보 · 잠김 · ' : '잠김 · '}
                      T{tech.tier} · {tech.name} ({tech.progress}/{tech.cost})
                    </option>
                  ))}
                </select>
              </label>
              <div className="games-rank-split">
                <div><span>선택</span><strong>{research.selected ? `T${research.selected.tier} · ${research.selected.name}` : '-'}</strong></div>
                <div><span>진행</span><strong>{research.selected?.progressPct || 0}%</strong></div>
                <div><span>가능</span><strong>{research.available}</strong></div>
                <div><span>직접 연구</span><strong>{research.actionUnlocked ? '해금' : `${research.actionCompleted}/${research.actionTotal}`}</strong></div>
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
              <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
                영감: {research.selected?.inspiration?.desc || '없음'} {research.selected?.inspirationDone ? '· 적용됨' : research.selected?.inspirationStatus?.blocked ? '· 단서 확보, 선행 연구 필요' : ''}
              </p>
              {!research.actionUnlocked ? (
                <div className="primitive-research-action-gate">
                  <strong>{research.actionReason}</strong>
                  <div className="games-chip-row">
                    {research.actionGateRows.map((row) => <span className={row.done ? 'is-done' : ''} key={row.id}>{row.done ? '완료' : '대기'} · {row.label}</span>)}
                  </div>
                </div>
              ) : null}
              <div className="game-save-list">
                {inspirationRows.slice(0, 4).map((row) => (
                  <article className="game-save-row" key={row.id}>
                    <div>
                      <span>
                        {row.kindLabel} · {row.statusLabel || (row.completed ? '완료' : row.breakthroughDone ? '달성' : row.available ? '진행 가능' : '잠김')}
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
              <ActionButton action="research" disabled={!canAct || !research.actionUnlocked || !research.selected?.available} onClick={runResearch}>
                {research.actionUnlocked ? '연구 실행' : '직접 연구 잠김'}
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
                    <SmallStat label="영감" value={selectedPlanner.inspirationTarget ? `${selectedPlanner.inspirationCurrent}/${selectedPlanner.inspirationTarget}` : '없음'} />
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
                      <strong>영감</strong>
                      <span>{selectedPlanner.inspirationText} · {selectedPlanner.inspirationPct}%</span>
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
                      <span>T{tech.tier} · {tech.priorityLabel} · 우선도 {tech.priorityScore} · {tech.progressPct}%</span>
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

            <PrimitiveArchiveProjectsPanel
              canAct={canAct}
              projectEstimate={projectEstimate}
              projects={projects}
              runProject={runProject}
              selectProject={selectProject}
              selectedProject={selectedProject}
            />

            <section className="games-panel primitive-research-workspace">
              <div className="games-panel-title">
                <h2>연구 트리 맵</h2>
                <span>
                  핵심 {research.archiveCompleted}/{research.archiveTotal} · 전체 {research.completed}/{research.total} · {researchMap.tierCount}단계
                </span>
              </div>
              <div className="primitive-research-toolbar">
                <label className="game-save-json-field">
                  <span>기술 검색</span>
                  <input
                    value={treeQuery}
                    onChange={(event) => setTreeQuery(event.target.value)}
                    placeholder="기술명, ID, 분야"
                  />
                </label>
                <label className="game-save-json-field">
                  <span>시대 필터</span>
                  <select value={treeEra} onChange={(event) => setTreeEra(event.target.value)}>
                    <option value="ALL">전체 시대</option>
                    {researchMap.eras.map((era) => (
                      <option value={era.era} key={era.era}>{era.label} · {era.completed}/{era.total}</option>
                    ))}
                  </select>
                </label>
                <div className="primitive-research-legend" aria-label="연구 상태 범례">
                  <span className="is-complete">완료</span>
                  <span className="is-ready">연구 가능</span>
                  <span className="is-selected">선택 목표</span>
                  <span className="is-locked">잠김</span>
                </div>
              </div>

              <div className="primitive-research-layout">
                <div className="primitive-research-canvas-scroll" tabIndex={0} aria-label="가로로 스크롤 가능한 연구 트리">
                  <div
                    className="primitive-research-canvas"
                    style={{ width: researchMap.width, height: researchMap.height }}
                  >
                    <svg
                      className="primitive-research-edges"
                      width={researchMap.width}
                      height={researchMap.height}
                      viewBox={`0 0 ${researchMap.width} ${researchMap.height}`}
                      aria-hidden="true"
                    >
                      {researchMap.edges.map((edge) => (
                        <path
                          className={`${edge.complete ? 'is-complete' : edge.available ? 'is-ready' : ''}${edge.from === treeFocusId || edge.to === treeFocusId ? ' is-focused' : ''}`}
                          d={edge.path}
                          key={edge.id}
                        />
                      ))}
                    </svg>
                    <div className="primitive-research-tier-headers" aria-hidden="true">
                      {researchMap.tierHeaders.map((tier) => (
                        <div
                          className="primitive-research-tier-header"
                          key={tier.tier}
                          style={{ left: tier.x, width: tier.width }}
                        >
                          <span>T{tier.tier}</span>
                          <strong>{tier.name}</strong>
                          <small>{tier.count}개 기술</small>
                        </div>
                      ))}
                    </div>
                    {researchMap.nodes.map((node) => {
                      const muted = treeNodeMuted(node);
                      const nodeClass = [
                        'primitive-research-node',
                        node.completed ? 'is-complete' : node.available ? 'is-ready' : 'is-locked',
                        node.selected ? 'is-selected' : '',
                        treeFocusId === node.id ? 'is-focused' : '',
                        Number(state.research.completionSerial || 0) > 0 && state.research.lastCompletedTechId === node.id ? 'is-completion-pulse' : '',
                        muted ? 'is-muted' : '',
                      ].filter(Boolean).join(' ');
                      return (
                        <button
                          type="button"
                          className={nodeClass}
                          data-game-sfx="select"
                          key={node.id}
                          aria-pressed={treeFocusId === node.id}
                          onClick={() => {
                            setTreeFocusId(node.id);
                            if (node.available && !node.completed && !node.selected) selectResearchTarget(node.id);
                          }}
                          style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
                        >
                          <span className="primitive-research-node__head">
                            <strong>{node.name}</strong>
                            <em>{node.statusLabel}</em>
                          </span>
                          <small>T{node.tier} · {RESEARCH_ERA_LABELS[node.era] || node.era} · {node.progress}/{node.cost}</small>
                          <span className="primitive-research-node__tags">
                            {(node.tags || []).slice(0, 1).map((tag) => <i key={tag}>{RESEARCH_TAG_LABELS[tag] || tag}</i>)}
                            {node.eureka ? <i className={node.eurekaDone ? 'is-done' : ''}>유</i> : null}
                            {node.inspiration ? <i className={node.inspirationDone ? 'is-done' : ''}>영</i> : null}
                          </span>
                          <span className="primitive-research-node__progress" aria-hidden="true">
                            <i style={{ width: `${node.progressPct}%` }} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <aside className="primitive-research-inspector">
                  {focusedTreeNode ? (
                    <>
                      <div className="primitive-research-inspector__head">
                        <div>
                          <span>T{focusedTreeNode.tier} · {researchMap.tierHeaders.find((tier) => tier.tier === focusedTreeNode.tier)?.name || '연구 단계'} · {RESEARCH_ERA_LABELS[focusedTreeNode.era] || focusedTreeNode.era}</span>
                          <h3>{focusedTreeNode.name}</h3>
                        </div>
                        <strong>{focusedTreeNode.progress}/{focusedTreeNode.cost}</strong>
                      </div>
                      <p>{focusedTreeNode.description || focusedTreeNode.nextStepText}</p>
                      <div className="primitive-research-inspector__section">
                        <span>선행 기술</span>
                        <div className="games-chip-row">
                          {(focusedTreeNode.prereqs || []).length ? focusedTreeNode.prereqs.map((techId) => (
                            <button
                              type="button"
                              data-game-sfx="select"
                              key={techId}
                              onClick={() => setTreeFocusId(techId)}
                            >
                              {treeNodeById[techId]?.completed ? '완료 · ' : ''}{treeNodeById[techId]?.name || techId}
                            </button>
                          )) : <span className="games-tag">선행 기술 없음</span>}
                        </div>
                      </div>
                      <div className="primitive-research-inspector__section">
                        <span>후속 기술</span>
                        <div className="games-chip-row">
                          {(focusedTreeNode.nextTechIds || []).length ? focusedTreeNode.nextTechIds.map((techId) => (
                            <button
                              type="button"
                              data-game-sfx="select"
                              key={techId}
                              onClick={() => setTreeFocusId(techId)}
                            >
                              {treeNodeById[techId]?.name || techId}
                            </button>
                          )) : <span className="games-tag">최종 기술</span>}
                        </div>
                      </div>
                      <div className="primitive-research-inspector__section">
                        <span>해금 효과</span>
                        <strong>{focusedTreeNode.unlockText}</strong>
                      </div>
                      <div className="primitive-research-inspector__section">
                        <span>유레카 · 영감</span>
                        <strong>
                          유레카 {focusedTreeNode.eureka?.desc || '없음'}{focusedTreeNode.eurekaDone ? ' · 적용' : ''}
                          <br />
                          영감 {focusedTreeNode.inspiration?.desc || '없음'}{focusedTreeNode.inspirationDone ? ' · 적용' : ''}
                        </strong>
                      </div>
                      <div className="primitive-research-inspector__actions">
                        <GameControlButton
                          action="target"
                          disabled={!focusedTreeNode.available || focusedTreeNode.completed || focusedTreeNode.selected}
                          onClick={() => selectResearchTarget(focusedTreeNode.id)}
                        >
                          {focusedTreeNode.completed ? '완료됨' : focusedTreeNode.selected ? '선택 중' : focusedTreeNode.available ? '연구 목표 지정' : '선행 연구 필요'}
                        </GameControlButton>
                        <ActionButton
                          action="research"
                          disabled={!canAct || !research.actionUnlocked || !focusedTreeNode.selected || !focusedTreeNode.available}
                          onClick={runResearch}
                        >
                          {research.actionUnlocked ? '선택 기술 연구' : '직접 연구 잠김'}
                        </ActionButton>
                      </div>
                    </>
                  ) : <div className="games-empty">표시할 연구 기술이 없습니다.</div>}
                </aside>
              </div>
              <p className="primitive-research-scroll-note">트리는 가로·세로로 스크롤할 수 있습니다. 노드를 선택하면 연구 목표와 상세 정보가 함께 갱신됩니다.</p>
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
                  <SmallStat label="영감" value={selectedPlanner.inspirationTarget ? `${selectedPlanner.inspirationCurrent}/${selectedPlanner.inspirationTarget}` : '없음'} />
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
                    <span>영감 조건</span>
                    <strong>{selectedPlanner.inspirationText}</strong>
                    <small>현재 {selectedPlanner.inspirationPct}% 진행 중입니다. 생활·문화 경험이 별도 연구 보너스로 적용됩니다.</small>
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
