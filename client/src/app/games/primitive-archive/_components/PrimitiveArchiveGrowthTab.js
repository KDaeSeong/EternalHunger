'use client';

import { useMemo, useState } from 'react';
import GameActionIcon from '../../_components/GameActionIcon';
import {
  ActionButton,
  GameControlButton,
  RecentActionResult,
  SmallStat,
} from '../../_components/GamePlayPrimitives';
import {
  RESEARCH_BRANCH_LABELS,
  RESEARCH_ERA_LABELS,
  RESEARCH_TAG_LABELS,
  advancementAction,
  advancementTierLabel,
} from '../_lib/primitiveArchivePageRuntime';
import PrimitiveArchiveProjectsPanel from './PrimitiveArchiveProjectsPanel';
import PrimitiveArchiveResearchTreePreview from './PrimitiveArchiveResearchTreePreview';

function AdvancementTrackSwitch({ activeTrack, civics, onChange, research }) {
  const rows = [
    {
      id: 'technology',
      icon: 'research',
      label: '기술',
      badge: `${research.completed}/${research.total}`,
      detail: 'RP · 유레카',
    },
    {
      id: 'civics',
      icon: 'policy',
      label: '사회 제도',
      badge: `${civics.completed}/${civics.total}`,
      detail: 'CP · 영감',
    },
  ];
  return (
    <div className="primitive-advancement-track-switch" role="tablist" aria-label="발전 트리 선택">
      {rows.map((row) => (
        <button
          type="button"
          role="tab"
          aria-selected={activeTrack === row.id}
          className={activeTrack === row.id ? 'is-active' : ''}
          data-game-sfx="tab"
          key={row.id}
          onClick={() => onChange(row.id)}
        >
          <GameActionIcon action={row.icon} label={row.label} />
          <span><strong>{row.label}</strong><small>{row.detail}</small></span>
          <em>{row.badge}</em>
        </button>
      ))}
    </div>
  );
}

function PerkPanel({ buyPerk, perks, perkPoints }) {
  return (
    <section className="games-panel">
      <div className="games-panel-title">
        <h2>특전</h2>
        <span>{perkPoints} pt</span>
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
  );
}

export default function PrimitiveArchiveGrowthTab(props) {
  const {
    buyPerk,
    canAct,
    civicAdvancements,
    civicInspirationRows,
    civicMap,
    civicPlannerRows,
    civics,
    inspirationRows,
    perks,
    priorityCivicRows,
    priorityPlannerRows,
    projectEstimate,
    projects,
    recentActionText,
    research,
    researchMap,
    researchPlannerOpen,
    runCivic,
    runProject,
    runResearch,
    selectCivicTarget,
    selectProject,
    selectResearchTarget,
    selectedCivicHelp,
    selectedCivicPlanner,
    selectedPlanner,
    selectedProject,
    selectedResearchHelp,
    setResearchPlannerOpen,
    state,
    techs,
    technologyPlannerRows,
  } = props;
  const [activeTrack, setActiveTrack] = useState('technology');
  const [treeFocusByTrack, setTreeFocusByTrack] = useState({
    technology: state.research.selectedTechId,
    civics: state.civics.selectedCivicId,
  });
  const [treeQuery, setTreeQuery] = useState('');
  const [treeEra, setTreeEra] = useState('ALL');
  const isCivics = activeTrack === 'civics';
  const summary = isCivics ? civics : research;
  const advancements = isCivics ? civicAdvancements : techs;
  const advancementMap = isCivics ? civicMap : researchMap;
  const breakthroughRows = isCivics ? civicInspirationRows : inspirationRows;
  const plannerRows = isCivics ? civicPlannerRows : technologyPlannerRows;
  const selectedPlan = isCivics ? selectedCivicPlanner : selectedPlanner;
  const priorityRows = isCivics ? priorityCivicRows : priorityPlannerRows;
  const selectedId = isCivics ? state.civics.selectedCivicId : state.research.selectedTechId;
  const selectTarget = isCivics ? selectCivicTarget : selectResearchTarget;
  const runAction = isCivics ? runCivic : runResearch;
  const selectedHelp = isCivics ? selectedCivicHelp : selectedResearchHelp;
  const trackLabel = isCivics ? '사회 제도' : '기술';
  const actionLabel = isCivics ? '추진' : '연구';
  const pointLabel = isCivics ? 'CP' : 'RP';
  const breakthroughLabel = isCivics ? '영감' : '유레카';
  const breakthrough = isCivics ? summary.selected?.inspiration : summary.selected?.eureka;
  const breakthroughDone = isCivics ? summary.selected?.inspirationDone : summary.selected?.eurekaDone;
  const breakthroughStatus = isCivics ? summary.selected?.inspirationStatus : summary.selected?.eurekaStatus;
  const treeFocusId = treeFocusByTrack[activeTrack];
  const focusedTreeNode = useMemo(() => (
    advancementMap.nodes.find((node) => node.id === treeFocusId)
    || advancementMap.nodes.find((node) => node.selected)
    || advancementMap.nodes[0]
  ), [advancementMap.nodes, treeFocusId]);
  const treeNodeById = useMemo(
    () => Object.fromEntries(advancementMap.nodes.map((node) => [node.id, node])),
    [advancementMap.nodes],
  );
  const normalizedTreeQuery = treeQuery.trim().toLowerCase();
  const completionState = isCivics ? state.civics : state.research;

  const setTreeFocusId = (id) => {
    setTreeFocusByTrack((current) => ({ ...current, [activeTrack]: id }));
  };
  const setTrack = (track) => {
    setActiveTrack(track);
    setTreeQuery('');
    setTreeEra('ALL');
  };
  const treeNodeMuted = (node) => {
    if (treeEra !== 'ALL' && node.era !== treeEra) return true;
    if (!normalizedTreeQuery) return false;
    return !`${node.name} ${node.id} ${RESEARCH_BRANCH_LABELS[node.branch] || ''} ${(node.tags || []).join(' ')}`.toLowerCase().includes(normalizedTreeQuery);
  };
  const openPlanner = () => setResearchPlannerOpen?.(true);
  const closePlanner = () => setResearchPlannerOpen?.(false);
  const scrollToPreview = () => {
    document.getElementById(`primitive-${activeTrack}-tree-preview`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!research.unlocked) {
    return (
      <>
        <RecentActionResult action={isCivics ? 'policy' : 'research'} label="최근 연구/성장 결과" text={recentActionText} tone="ready" pinned />
        <AdvancementTrackSwitch activeTrack={activeTrack} civics={civics} onChange={setTrack} research={research} />
        <section className="games-panel primitive-research-gate">
          <div className="games-panel-title">
            <div>
              <h2>부족 발전 필요</h2>
              <span>{summary.headline}</span>
            </div>
            <strong>{summary.gateCompleted}/{summary.gateTotal}</strong>
          </div>
          <p>{summary.reason}</p>
          <div className="primitive-research-gate__requirements">
            {summary.gateRows.map((row) => (
              <article className={row.done ? 'is-done' : ''} key={row.id}>
                <span>{row.done ? '완료' : '필요'}</span>
                <strong>{row.label}</strong>
                <small>현재 Lv.{row.current}</small>
              </article>
            ))}
          </div>
          <div className="games-empty">세 시설을 갖추면 기술 RP와 사회 제도 CP가 함께 축적되기 시작합니다.</div>
          <GameControlButton action={isCivics ? 'policy' : 'research'} className="primitive-research-preview-link" onClick={scrollToPreview}>
            전체 {trackLabel} 트리 미리보기
          </GameControlButton>
        </section>

        <PrimitiveArchiveResearchTreePreview key={activeTrack} researchMap={advancementMap} track={activeTrack} />

        <PrimitiveArchiveProjectsPanel
          canAct={canAct}
          projectEstimate={projectEstimate}
          projects={projects}
          runProject={runProject}
          selectProject={selectProject}
          selectedProject={selectedProject}
        />

        <PerkPanel buyPerk={buyPerk} perks={perks} perkPoints={state.meta.perkPoints} />
      </>
    );
  }

  return (
    <>
      <RecentActionResult action={isCivics ? 'policy' : 'research'} label="최근 연구/성장 결과" text={recentActionText} tone="ready" pinned />
      <AdvancementTrackSwitch activeTrack={activeTrack} civics={civics} onChange={setTrack} research={research} />

      <section className={`games-dashboard primitive-advancement-dashboard ${isCivics ? 'is-civics' : ''}`}>
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>{isCivics ? '사회 제도' : '기술 연구'}</h2>
            <span>핵심 {summary.archiveCompleted}/{summary.archiveTotal} · 전체 {summary.completed}/{summary.total}</span>
          </div>
          <label className="game-save-json-field">
            <span>목표 {trackLabel}</span>
            <select value={selectedId} onChange={(event) => selectTarget(event.target.value)}>
              {advancements.map((advancement) => (
                <option
                  value={advancement.id}
                  key={advancement.id}
                  disabled={!advancement.available && !advancement.completed && !advancement.selected}
                >
                  {advancement.completed ? '완료 · ' : advancement.selected ? '선택 · ' : advancement.available ? '가능 · ' : (isCivics ? advancement.inspirationStatus?.blocked : advancement.eurekaStatus?.blocked) ? '단서 확보 · 잠김 · ' : '잠김 · '}
                  {advancementTierLabel(advancement, activeTrack)} · {advancement.name} ({advancement.progress}/{advancement.cost})
                </option>
              ))}
            </select>
          </label>
          <div className="games-rank-split">
            <div><span>선택</span><strong>{summary.selected ? `${advancementTierLabel(summary.selected, activeTrack)} · ${summary.selected.name}` : '-'}</strong></div>
            <div><span>진행</span><strong>{summary.selected?.progressPct || 0}%</strong></div>
            <div><span>가능</span><strong>{summary.available}</strong></div>
            <div><span>직접 {actionLabel}</span><strong>{summary.actionUnlocked ? '해금' : `${summary.actionCompleted}/${summary.actionTotal}`}</strong></div>
          </div>
          <div className={summary.selected && !summary.selected.completed && !summary.selected.available ? 'games-empty games-error' : 'games-empty'} style={{ textAlign: 'left', marginTop: 12 }}>
            {selectedHelp}
          </div>
          <div className="primitive-breakthrough-summary">
            <GameActionIcon action={isCivics ? 'policy' : 'research'} label={breakthroughLabel} />
            <div>
              <span>{breakthroughLabel}</span>
              <strong>{breakthrough?.desc || '별도 조건 없음'}{breakthroughDone ? ' · 적용됨' : breakthroughStatus?.blocked ? ' · 확보, 선행 발전 필요' : ''}</strong>
              {breakthroughStatus?.note ? <small>{breakthroughStatus.note}</small> : null}
            </div>
          </div>
          <div className="game-save-list primitive-breakthrough-list">
            {breakthroughRows.slice(0, 4).map((row) => (
              <article className="game-save-row" key={row.id}>
                <div>
                  <span>{row.kindLabel} · {row.statusLabel} · {row.current}/{row.target}</span>
                  <strong>{row.techName}</strong>
                  <small>{row.note || row.desc} · {row.progressPct}%</small>
                </div>
              </article>
            ))}
          </div>
          <ActionButton
            action={isCivics ? 'policy' : 'research'}
            disabled={!canAct || !summary.actionUnlocked || !summary.selected?.available}
            onClick={runAction}
          >
            {summary.actionUnlocked ? `${isCivics ? '부족 회의' : '연구 실행'} · ${pointLabel}` : `직접 ${actionLabel} 잠김`}
          </ActionButton>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>{trackLabel} 플래너</h2>
            <span>{selectedPlan?.priorityLabel || '대기'}</span>
          </div>
          {selectedPlan ? (
            <>
              <div className="games-rank-split">
                <SmallStat label="목표" value={selectedPlan.name} />
                <SmallStat label="진행" value={`${selectedPlan.progress}/${selectedPlan.cost}${pointLabel}`} />
                <SmallStat
                  label={breakthroughLabel}
                  value={isCivics
                    ? selectedPlan.inspirationTarget ? `${selectedPlan.inspirationCurrent}/${selectedPlan.inspirationTarget}` : '없음'
                    : selectedPlan.eurekaTarget ? `${selectedPlan.eurekaCurrent}/${selectedPlan.eurekaTarget}` : '없음'}
                />
                <SmallStat label="상태" value={selectedPlan.priorityLabel} />
              </div>
              <div className={selectedPlan.available || selectedPlan.completed ? 'games-empty' : 'games-empty games-error'} style={{ textAlign: 'left', marginTop: 12 }}>
                <strong>{selectedPlan.blockerText}</strong>
                <br />
                {selectedPlan.nextAction}
              </div>
              <div className="games-activity-list" style={{ marginTop: 12 }}>
                <div><strong>해금</strong><span>{selectedPlan.unlockText}</span></div>
                <div>
                  <strong>{breakthroughLabel}</strong>
                  <span>
                    {isCivics ? selectedPlan.inspirationText : selectedPlan.eurekaText}
                    {' · '}
                    {isCivics ? selectedPlan.inspirationPct : selectedPlan.eurekaPct}%
                  </span>
                </div>
                <div><strong>다음 행동</strong><span>{selectedPlan.nextAction}</span></div>
              </div>
              <div className="game-save-row-actions">
                <GameControlButton action="analysis" onClick={openPlanner}>상세 보기</GameControlButton>
                <GameControlButton
                  action="target"
                  disabled={!selectedPlan.available || selectedPlan.completed || selectedPlan.selected}
                  onClick={() => selectTarget(selectedPlan.id)}
                >
                  {selectedPlan.selected ? '선택 중' : selectedPlan.available ? '목표 지정' : '대기'}
                </GameControlButton>
              </div>
            </>
          ) : <div className="games-empty">{trackLabel} 플래너 정보가 없습니다.</div>}

          <div className="games-panel-title" style={{ marginTop: 16 }}>
            <h2>다음 후보</h2>
            <span>{priorityRows.length}개</span>
          </div>
          <div className="game-save-list">
            {priorityRows.map((advancement) => (
              <article className="game-save-row" key={advancement.id}>
                <div>
                  <span>{advancementTierLabel(advancement, activeTrack)} · {advancement.priorityLabel} · 우선도 {advancement.priorityScore} · {advancement.progressPct}%</span>
                  <strong>{advancement.name}</strong>
                  <small>{advancement.nextAction}</small>
                </div>
                <GameControlButton action="target" disabled={!advancement.available || advancement.completed || advancement.selected} onClick={() => selectTarget(advancement.id)}>
                  {advancement.selected ? '선택 중' : advancement.available ? '목표' : '대기'}
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

        <section className={`games-panel primitive-research-workspace ${isCivics ? 'is-civics' : ''}`}>
          <div className="games-panel-title">
            <h2>{trackLabel} 트리</h2>
            <span>핵심 {summary.archiveCompleted}/{summary.archiveTotal} · 전체 {summary.completed}/{summary.total} · {advancementMap.tierCount}단계</span>
          </div>
          <div className="primitive-research-toolbar">
            <label className="game-save-json-field">
              <span>{trackLabel} 검색</span>
              <input value={treeQuery} onChange={(event) => setTreeQuery(event.target.value)} placeholder={`${trackLabel}명, ID, 분야`} />
            </label>
            <label className="game-save-json-field">
              <span>시대 필터</span>
              <select value={treeEra} onChange={(event) => setTreeEra(event.target.value)}>
                <option value="ALL">전체 시대</option>
                {advancementMap.eras.map((era) => (
                  <option value={era.era} key={era.era}>{era.label} · {era.completed}/{era.total}</option>
                ))}
              </select>
            </label>
            <div className="primitive-research-legend" aria-label={`${trackLabel} 상태 범례`}>
              <span className="is-complete">완료</span>
              <span className="is-ready">{actionLabel} 가능</span>
              <span className="is-selected">선택 목표</span>
              <span className="is-locked">잠김</span>
            </div>
          </div>

          <div className="primitive-research-layout">
            <div className="primitive-research-canvas-scroll" tabIndex={0} aria-label={`가로로 스크롤 가능한 ${trackLabel} 트리`}>
              <div className="primitive-research-canvas" style={{ width: advancementMap.width, height: advancementMap.height }}>
                <svg className="primitive-research-edges" width={advancementMap.width} height={advancementMap.height} viewBox={`0 0 ${advancementMap.width} ${advancementMap.height}`} aria-hidden="true">
                  {advancementMap.edges.map((edge) => (
                    <path
                      className={[
                        edge.pathClass,
                        edge.complete ? 'is-complete' : edge.available ? 'is-ready' : '',
                        edge.from === treeFocusId || edge.to === treeFocusId ? 'is-focused' : '',
                      ].filter(Boolean).join(' ')}
                      data-from={edge.from}
                      data-to={edge.to}
                      d={edge.path}
                      key={edge.id}
                    />
                  ))}
                </svg>
                <div className="primitive-research-tier-headers" aria-hidden="true">
                  {advancementMap.tierHeaders.map((tier) => (
                    <div className="primitive-research-tier-header" key={tier.tier} style={{ left: tier.x, width: tier.width }}>
                      <span>{tier.label}</span>
                      <strong>{tier.name}</strong>
                      <small>{tier.count}개 {trackLabel}</small>
                    </div>
                  ))}
                </div>
                {advancementMap.nodes.map((node) => {
                  const muted = treeNodeMuted(node);
                  const nodeClass = [
                    'primitive-research-node',
                    node.completed ? 'is-complete' : node.available ? 'is-ready' : 'is-locked',
                    node.selected ? 'is-selected' : '',
                    treeFocusId === node.id ? 'is-focused' : '',
                    Number(completionState.completionSerial || 0) > 0
                      && (isCivics ? completionState.lastCompletedCivicId : completionState.lastCompletedTechId) === node.id
                      ? 'is-completion-pulse'
                      : '',
                    muted ? 'is-muted' : '',
                  ].filter(Boolean).join(' ');
                  return (
                    <button
                      type="button"
                      className={nodeClass}
                      data-game-sfx="select"
                      data-tech-id={node.id}
                      key={node.id}
                      aria-pressed={treeFocusId === node.id}
                      onClick={() => {
                        setTreeFocusId(node.id);
                        if (node.available && !node.completed && !node.selected) selectTarget(node.id);
                      }}
                      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
                    >
                      <span className="primitive-research-node__head">
                        <span className="primitive-research-node__identity">
                          <GameActionIcon action={advancementAction(node.tags, activeTrack, node.branch)} label={node.name} />
                          <strong>{node.name}</strong>
                        </span>
                        <em>{node.statusLabel}</em>
                      </span>
                      <small>{node.tierLabel} · {RESEARCH_ERA_LABELS[node.era] || node.era} · {node.progress}/{node.cost}{pointLabel}</small>
                      <span className="primitive-research-node__tags">
                        {node.branch
                          ? <i>{RESEARCH_BRANCH_LABELS[node.branch] || node.branch}</i>
                          : (node.tags || []).slice(0, 1).map((tag) => <i key={tag}>{RESEARCH_TAG_LABELS[tag] || tag}</i>)}
                        {node.eureka ? <i className={node.eurekaDone ? 'is-done' : ''}>유</i> : null}
                        {node.inspiration ? <i className={node.inspirationDone ? 'is-done' : ''}>영</i> : null}
                      </span>
                      <span className="primitive-research-node__progress" aria-hidden="true"><i style={{ width: `${node.progressPct}%` }} /></span>
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
                      <span>{focusedTreeNode.tierLabel} · {advancementMap.tierHeaders.find((tier) => tier.tier === focusedTreeNode.tier)?.name || '발전 단계'} · {RESEARCH_ERA_LABELS[focusedTreeNode.era] || focusedTreeNode.era}</span>
                      <h3>
                        <GameActionIcon action={advancementAction(focusedTreeNode.tags, activeTrack, focusedTreeNode.branch)} label={focusedTreeNode.name} />
                        {focusedTreeNode.name}
                      </h3>
                    </div>
                    <strong>{focusedTreeNode.progress}/{focusedTreeNode.cost}{pointLabel}</strong>
                  </div>
                  <p>{focusedTreeNode.description || focusedTreeNode.nextStepText}</p>
                  <div className="primitive-research-inspector__section">
                    <span>선행 발전</span>
                    <div className="games-chip-row">
                      {(focusedTreeNode.prereqRows || []).length ? focusedTreeNode.prereqRows.map((prereq) => (
                        <button
                          type="button"
                          data-game-sfx="select"
                          disabled={!treeNodeById[prereq.id]}
                          key={prereq.id}
                          onClick={() => setTreeFocusId(prereq.id)}
                        >
                          {prereq.completed ? '완료 · ' : ''}{prereq.name}{!treeNodeById[prereq.id] ? ' · 다른 트리' : ''}
                        </button>
                      )) : <span className="games-tag">선행 발전 없음</span>}
                    </div>
                  </div>
                  <div className="primitive-research-inspector__section">
                    <span>후속 {trackLabel}</span>
                    <div className="games-chip-row">
                      {(focusedTreeNode.nextTechIds || []).length ? focusedTreeNode.nextTechIds.map((techId) => (
                        <button type="button" data-game-sfx="select" key={techId} onClick={() => setTreeFocusId(techId)}>
                          {treeNodeById[techId]?.name || techId}
                        </button>
                      )) : (
                        <span className="games-tag">
                          {(focusedTreeNode.nextCrossTrackRows || []).length ? '같은 트리 후속 없음' : `최종 ${trackLabel}`}
                        </span>
                      )}
                    </div>
                  </div>
                  {(focusedTreeNode.nextCrossTrackRows || []).length ? (
                    <div className="primitive-research-inspector__section">
                      <span>다른 트리 후속 발전</span>
                      <div className="games-chip-row">
                        {focusedTreeNode.nextCrossTrackRows.map((row) => (
                          <span className="games-tag" key={row.id}>
                            {row.completed ? '완료 · ' : ''}{row.name} · {row.track === 'civics' ? '사회 제도' : '기술'}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="primitive-research-inspector__section"><span>해금 효과</span><strong>{focusedTreeNode.unlockText}</strong></div>
                  <div className="primitive-research-inspector__section">
                    <span>{breakthroughLabel}</span>
                    <strong>
                      {breakthroughLabel} {isCivics ? focusedTreeNode.inspiration?.desc || '없음' : focusedTreeNode.eureka?.desc || '없음'}
                      {(isCivics ? focusedTreeNode.inspirationDone : focusedTreeNode.eurekaDone) ? ' · 적용' : ''}
                    </strong>
                  </div>
                  <div className="primitive-research-inspector__actions">
                    <GameControlButton action="target" disabled={!focusedTreeNode.available || focusedTreeNode.completed || focusedTreeNode.selected} onClick={() => selectTarget(focusedTreeNode.id)}>
                      {focusedTreeNode.completed ? '완료됨' : focusedTreeNode.selected ? '선택 중' : focusedTreeNode.available ? `${trackLabel} 목표 지정` : '선행 발전 필요'}
                    </GameControlButton>
                    <ActionButton action={isCivics ? 'policy' : 'research'} disabled={!canAct || !summary.actionUnlocked || !focusedTreeNode.selected || !focusedTreeNode.available} onClick={runAction}>
                      {summary.actionUnlocked ? `선택 ${trackLabel} ${actionLabel}` : `직접 ${actionLabel} 잠김`}
                    </ActionButton>
                  </div>
                </>
              ) : <div className="games-empty">표시할 {trackLabel}이 없습니다.</div>}
            </aside>
          </div>
          <p className="primitive-research-scroll-note">트리는 가로·세로로 스크롤할 수 있습니다. 다른 트리의 선행 발전은 이름과 완료 상태로 함께 표시됩니다.</p>
        </section>

        <PerkPanel buyPerk={buyPerk} perks={perks} perkPoints={state.meta.perkPoints} />
      </section>

      {researchPlannerOpen && selectedPlan ? (
        <div className="primitive-research-modal-backdrop" role="presentation" onClick={closePlanner}>
          <section className={`primitive-research-modal games-panel ${isCivics ? 'is-civics' : ''}`} role="dialog" aria-modal="true" aria-labelledby="primitive-research-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="games-panel-title">
              <div>
                <h2 id="primitive-research-modal-title">{selectedPlan.name}</h2>
                <span>{trackLabel} · {selectedPlan.priorityLabel} · 우선도 {selectedPlan.priorityScore}</span>
              </div>
              <GameControlButton action="close" className="primitive-research-modal__close" onClick={closePlanner}>닫기</GameControlButton>
            </div>
            <div className="games-rank-split">
              <SmallStat label="시대" value={RESEARCH_ERA_LABELS[selectedPlan.era] || selectedPlan.era || '-'} />
              <SmallStat label="진행" value={`${selectedPlan.progress}/${selectedPlan.cost}${pointLabel}`} />
              <SmallStat label={breakthroughLabel} value={`${isCivics ? selectedPlan.inspirationPct : selectedPlan.eurekaPct}%`} />
              <SmallStat label="상태" value={selectedPlan.priorityLabel} />
            </div>
            <div className={selectedPlan.available || selectedPlan.completed ? 'games-empty' : 'games-empty games-error'} style={{ textAlign: 'left' }}>
              <strong>{selectedPlan.blockerText}</strong><br />{selectedPlan.nextAction}
            </div>
            <section className="primitive-research-modal__grid">
              <article><span>해금 보상</span><strong>{selectedPlan.unlockText}</strong><small>완료 즉시 생존·제작·부족 운영 규칙에 적용됩니다.</small></article>
              <article>
                <span>{breakthroughLabel} 조건</span>
                <strong>{isCivics ? selectedPlan.inspirationText : selectedPlan.eurekaText}</strong>
                <small>현재 {isCivics ? selectedPlan.inspirationPct : selectedPlan.eurekaPct}% 진행 중입니다.</small>
              </article>
              <article><span>다음 행동</span><strong>{selectedPlan.nextAction}</strong><small>선행 발전은 기술과 사회 제도 양쪽에서 판정됩니다.</small></article>
            </section>
            <div className="games-panel-title"><h2>후보 비교</h2><span>{plannerRows.length}개</span></div>
            <div className="game-save-list">
              {plannerRows.slice(0, 8).map((advancement) => (
                <article className="game-save-row" key={`modal-${advancement.id}`}>
                  <div>
                    <span>{advancement.priorityLabel} · 우선도 {advancement.priorityScore} · {advancement.progressPct}%</span>
                    <strong>{advancement.name}</strong>
                    <small>{advancement.unlockText}</small>
                  </div>
                  <GameControlButton action="target" disabled={!advancement.available || advancement.completed || advancement.selected} onClick={() => selectTarget(advancement.id)}>
                    {advancement.selected ? '선택 중' : advancement.available ? '목표' : '대기'}
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
