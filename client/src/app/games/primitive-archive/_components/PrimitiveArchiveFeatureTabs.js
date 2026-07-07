import Image from 'next/image';
import { GameFeatureTabs } from '../../_components/GamePlayShell';
import { ActionButton, RecentActionResult, SmallStat } from '../../_components/GamePlayPrimitives';
import {
  EQUIPMENT_SLOT_LABELS,
  ITEMS,
  RECIPES,
  ZONES,
  completeArchiveAction,
  equipmentChoicesForSlot,
  formatRequires,
  itemName,
  totalCarryWeight,
} from '../_lib/primitiveArchiveEngine';
import {
  BASE_CAMP_ACTIONS,
  PARTY_SORT_OPTIONS,
  actionLabel,
  chanceText,
} from '../_lib/primitiveArchivePageRuntime';

export default function PrimitiveArchiveFeatureTabs(props) {
  const {
    actor,
    actorId,
    applyAction,
    archiveReport,
    archiveVictory,
    autoEquip,
    buyPerk,
    campFacilities,
    canAct,
    changeEquipmentSlot,
    clearEquipment,
    craftChance,
    currentEquipmentRows,
    currentLogCapacity,
    equipmentAdviceMode,
    equipmentAdviceRows,
    equipmentInventory,
    gatherChance,
    huntChance,
    inspirationRows,
    inventoryRows,
    partyCap,
    partySort,
    partyView,
    perks,
    priorityPlannerRows,
    recentActionText,
    recipe,
    recipeId,
    recruitCandidates,
    recruitMember,
    research,
    researchMap,
    runCamp,
    runCraft,
    runEat,
    runGather,
    runHunt,
    runProgressReport,
    runResearch,
    runRest,
    selectResearchTarget,
    selectedPlanner,
    selectedRecruit,
    selectedResearchHelp,
    setActorId,
    setPartySort,
    setRecipeId,
    setSelectedRecruitId,
    setZoneId,
    state,
    techs,
    zone,
    zoneId,
  } = props;

  return (
<GameFeatureTabs
      tabs={[
        {
          id: 'survival',
          label: '생존 운영',
          badge: `AP ${state.ap}`,
          children: (
            <>
      <section className="games-panel games-action-dock">
        <div className="games-panel-title">
          <h2>빠른 행동</h2>
          <span>{actor?.name || '대상'} · AP {state.ap}/{state.apMax}</span>
        </div>
        <div className="games-action-dock__controls">
          <label className="game-save-json-field">
            <span>지역</span>
            <select value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
              {ZONES.map((row) => <option value={row.id} key={row.id}>{row.name}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>제작</span>
            <select value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
              {RECIPES.map((row) => <option value={row.id} key={row.id}>{row.name}</option>)}
            </select>
          </label>
        </div>
        <div className="games-action-dock__notes">
          <span>{zone.note}</span>
          <span>제작: {formatRequires(recipe.requires)} · {recipe.note}</span>
        </div>
        <div className="games-action-dock__buttons">
          <ActionButton disabled={!canAct} onClick={runGather}>채집 · {Math.round(gatherChance * 100)}%</ActionButton>
          <ActionButton disabled={!canAct} onClick={runHunt}>사냥 · {Math.round(huntChance * 100)}%</ActionButton>
          <ActionButton disabled={!canAct || !recipe} onClick={runCraft}>제작 · {Math.round(craftChance * 100)}%</ActionButton>
          <ActionButton disabled={!canAct} onClick={runEat}>식사</ActionButton>
          <ActionButton disabled={!canAct} onClick={runRest}>휴식</ActionButton>
          <ActionButton disabled={!canAct || !research.selected?.available} onClick={runResearch}>연구</ActionButton>
        </div>
        <div className="games-action-dock__buttons games-action-dock__buttons--camp">
          {BASE_CAMP_ACTIONS.map((row) => (
            <ActionButton disabled={!canAct} onClick={() => runCamp(row.id)} key={row.id}>{row.label}</ActionButton>
          ))}
          {campFacilities.map((facility) => (
            <ActionButton
              key={facility.id}
              disabled={!canAct || !facility.unlocked || facility.maxed}
              onClick={() => runCamp(facility.action)}
            >
              {facility.buttonLabel}
            </ActionButton>
          ))}
        </div>
        <RecentActionResult text={recentActionText} pinned />
      </section>

      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>파티</h2>
            <span>파티 {state.party.length}/{partyCap} · {state.weather.name} · {state.weather.temp}°C</span>
          </div>
          <label className="game-save-json-field">
            <span>정렬</span>
            <select value={partySort} onChange={(event) => setPartySort(event.target.value)}>
              {PARTY_SORT_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {recruitCandidates.length ? (
            <div className="games-chip-row" style={{ marginBottom: 12 }}>
              <select
                value={selectedRecruit?.id || ''}
                onChange={(event) => setSelectedRecruitId(event.target.value)}
                style={{ minWidth: 180 }}
              >
                {recruitCandidates.map((candidate) => (
                  <option value={candidate.id} key={candidate.id}>
                    {candidate.name} · {candidate.role}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="tcg-secondary-action"
                disabled={!selectedRecruit || state.party.length >= partyCap}
                onClick={recruitMember}
              >
                합류
              </button>
              <span style={{ color: '#cbd5e1', fontWeight: 800 }}>
                {state.party.length >= partyCap ? '정착 연구로 정원을 늘릴 수 있습니다.' : selectedRecruit?.trait}
              </span>
            </div>
          ) : null}
          <div style={{ display: 'grid', gap: 10 }}>
            {partyView.map(({ member, chances, basisAction, basisChance, badges }) => (
              <button
                type="button"
                key={member.id}
                onClick={() => setActorId(member.id)}
                style={{
                  minWidth: 0,
                  display: 'grid',
                  gridTemplateColumns: '52px minmax(0, 1fr)',
                  gap: 10,
                  alignItems: 'center',
                  border: actorId === member.id ? '1px solid rgba(56, 189, 248, 0.75)' : '1px solid rgba(148, 163, 184, 0.22)',
                  borderRadius: 8,
                  background: actorId === member.id ? 'rgba(8, 47, 73, 0.56)' : 'rgba(15, 23, 42, 0.46)',
                  color: '#f8fafc',
                  padding: 9,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <Image src={member.portrait} alt={member.name} width={52} height={52} />
                <span>
                  <strong style={{ display: 'block' }}>{member.name} · {member.role}</strong>
                  <small style={{ display: 'block', color: '#cbd5e1', marginTop: 3 }}>
                    HP {member.hp} · 허기 {member.hunger} · ST {member.stamina} · 체온 {Number(member.bodyTemp ?? 37).toFixed(1)}도 · {badges.join(' / ')}
                  </small>
                  <small style={{ display: 'block', color: '#bae6fd', marginTop: 3 }}>
                    추천 {actionLabel(basisAction)} {chanceText(basisChance)} · 채집 {chanceText(chances.gather)} · 사냥 {chanceText(chances.hunt)} · 제작 {chanceText(chances.craft)}
                  </small>
                  <small style={{ display: 'block', color: '#94a3b8', marginTop: 3 }}>{member.trait}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>아카이브 목표</h2>
            <span>{archiveVictory.label}</span>
          </div>
          <div className="game-save-list">
            {archiveVictory.rows.map((row) => (
              <article className="game-save-row" key={row.id}>
                <div>
                  <span>{row.done ? '완료' : '진행 중'}</span>
                  <strong>{row.label}</strong>
                </div>
                <strong>{row.current}/{row.target}</strong>
              </article>
            ))}
          </div>
          <ActionButton disabled={!archiveVictory.canComplete} onClick={() => applyAction('아카이브 완성', (current) => completeArchiveAction(current))}>
            아카이브 완성
          </ActionButton>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>런 리포트</h2>
            <span>{runProgressReport.riskLevel} · 목표 {runProgressReport.objectivePct}%</span>
          </div>
          <p style={{ color: '#5f6c78', fontWeight: 800, lineHeight: 1.5, margin: 0 }}>
            {runProgressReport.headline}
          </p>
          <div className="games-rank-split games-rank-split--compact">
            <SmallStat label="목표" value={runProgressReport.objectiveLabel} />
            <SmallStat label="남은 생존" value={`${runProgressReport.daysLeft}일`} />
            <SmallStat label="식량" value={runProgressReport.foodUnits} />
            <SmallStat label="연료" value={runProgressReport.fuel} />
            <SmallStat label="보온" value={runProgressReport.insulation} />
            <SmallStat label="무게" value={runProgressReport.weight} />
          </div>
          <div className="game-save-list">
            <article className="game-save-row">
              <div>
                <span>병목</span>
                <strong>{runProgressReport.blockers.length ? runProgressReport.blockers.join(' / ') : '뚜렷한 병목 없음'}</strong>
              </div>
              <strong>{runProgressReport.riskTone === 'danger' ? '위험' : runProgressReport.riskTone === 'warning' ? '주의' : '안정'}</strong>
            </article>
            <article className="game-save-row">
              <div>
                <span>다음 추천</span>
                <strong>{runProgressReport.recommendations.join(' / ')}</strong>
              </div>
              <strong>추천</strong>
            </article>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>캠프</h2>
            <span>연료 {state.camp.fuel}</span>
          </div>
          <div className="games-rank-split games-rank-split--compact">
            <div><span>모닥불</span><strong>Lv.{state.camp.fireLevel}</strong></div>
            <div><span>대피소</span><strong>Lv.{state.camp.shelterLevel}</strong></div>
            <div><span>작업대</span><strong>Lv.{state.camp.workbenchLevel}</strong></div>
            <div><span>기록실</span><strong>Lv.{state.camp.archiveRoomLevel || 0}</strong></div>
            <div><span>필사대</span><strong>Lv.{state.camp.scribeDeskLevel || 0}</strong></div>
            <div><span>서가</span><strong>Lv.{state.camp.libraryShelfLevel || 0}</strong></div>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={!canAct} onClick={() => runCamp('fuel')}>연료 넣기 · 나무 1</ActionButton>
            <ActionButton disabled={!canAct} onClick={() => runCamp('fire')}>모닥불 강화 · 나무 2, 돌 2</ActionButton>
            <ActionButton disabled={!canAct} onClick={() => runCamp('shelter')}>대피소 강화 · 나무 3, 섬유 2, 가죽 1</ActionButton>
            <ActionButton disabled={!canAct} onClick={() => runCamp('workbench')}>작업대 제작 · 나무 4, 돌 2</ActionButton>
            <ActionButton disabled={!canAct} onClick={() => runCamp('cook')}>고기 굽기 · 고기 1, 연료 1</ActionButton>
            {campFacilities.map((facility) => (
              <ActionButton
                key={facility.id}
                disabled={!canAct || !facility.unlocked || facility.maxed}
                onClick={() => runCamp(facility.action)}
              >
                {facility.buttonLabel}
              </ActionButton>
            ))}
          </div>
          <RecentActionResult label="최근 캠프/행동 결과" text={recentActionText} />
          {campFacilities.map((facility) => (
            <p key={`${facility.id}-desc`} style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5, margin: 0 }}>
              {facility.name}: {facility.desc}
            </p>
          ))}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>장비</h2>
            <span>{actor?.name || '대상'} · 보온 {actor ? currentEquipmentRows.reduce((sum, row) => sum + Number(row.insulation || 0), 0) : 0}</span>
          </div>
          <div className="games-chip-row" style={{ marginBottom: 12 }}>
            <button type="button" className="tcg-secondary-action" onClick={() => autoEquip('role')}>
              역할 추천 장착
            </button>
            <button type="button" className="tcg-secondary-action" onClick={() => autoEquip('weather')}>
              날씨 대응 장착
            </button>
            <button type="button" className="tcg-secondary-action" onClick={clearEquipment}>
              전체 해제
            </button>
          </div>
          <div className="game-save-list">
            {equipmentAdviceRows.length ? (
              <article className="game-save-row">
                <div>
                  <span>{equipmentAdviceMode === 'weather' ? '날씨 대응 추천' : '역할 추천'} · {state.weather.name} {state.weather.temp}도</span>
                  <strong>{equipmentAdviceRows[0].slotLabel}: {equipmentAdviceRows[0].name}</strong>
                  <small>{equipmentAdviceRows[0].detail}</small>
                </div>
                <strong>{equipmentAdviceRows[0].equipped ? '착용 중' : '추천'}</strong>
              </article>
            ) : null}
            {currentEquipmentRows.map((row) => {
              const choices = equipmentChoicesForSlot(state, actorId, row.slot);
              return (
                <article className="game-save-row" key={row.slot}>
                  <div>
                    <span>{row.label}{row.successText ? ` · ${row.successText}` : ''}</span>
                    <strong>{row.itemName}</strong>
                  </div>
                  <select
                    value={row.itemId}
                    onChange={(event) => changeEquipmentSlot(row.slot, event.target.value)}
                  >
                    {choices.map((choice) => (
                      <option value={choice.itemId} key={`${row.slot}-${choice.itemId || 'none'}`}>
                        {choice.name}{choice.qty ? ` x${choice.qty}` : ''}
                      </option>
                    ))}
                  </select>
                </article>
              );
            })}
          </div>
          <div className="game-save-list" style={{ marginTop: 12 }}>
            {equipmentAdviceRows.slice(1).map((row) => (
              <article className="game-save-row" key={`advice-${row.slot}`}>
                <div>
                  <span>{row.slotLabel} · 현재 {row.currentName}</span>
                  <strong>{row.name}</strong>
                  <small>{row.detail}</small>
                </div>
                <strong>{row.equipped ? '착용 중' : '교체'}</strong>
              </article>
            ))}
            {!equipmentAdviceRows.length ? <div className="games-empty">추천할 보유 장비가 없습니다. 제작 탭에서 장비를 먼저 만들어 주세요.</div> : null}
          </div>
          <div className="games-panel-title" style={{ marginTop: 16 }}>
            <h2>장비 보유</h2>
            <span>{equipmentInventory.reduce((sum, item) => sum + Number(item.qty || 0), 0)}개</span>
          </div>
          <div className="games-chip-row">
            {equipmentInventory.length ? equipmentInventory.map((item) => (
              <span className="games-tag" key={item.itemId}>
                {EQUIPMENT_SLOT_LABELS[item.slot] || item.slot} · {item.name} x{item.qty}
              </span>
            )) : <span className="games-tag">보유 장비 없음</span>}
          </div>
        </section>
      </section>
            </>
          ),
        },
        {
          id: 'archive-report',
          label: '기록서',
          badge: archiveReport.grade,
          children: (
            <>

      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>{archiveReport.title}</h2>
            <span>{archiveReport.grade}등급 · {archiveReport.archiveScore}%</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="목표" value={`${archiveReport.objectivePct}%`} />
            <SmallStat label="점수" value={archiveReport.score.toLocaleString('ko-KR')} />
            <SmallStat label="상태" value={archiveReport.status === 'complete' ? '완성' : archiveReport.status === 'ready' ? '완성 가능' : archiveReport.status === 'settled' ? '정산' : '진행'} />
            <SmallStat label="생존일" value={`Day ${state.day}`} />
          </div>
          <div className="game-save-list" style={{ marginTop: 12 }}>
            {archiveReport.handoff.map((line, index) => (
              <article className="game-save-row" key={`${line}-${index}`}>
                <div>
                  <span>인계 {index + 1}</span>
                  <strong>{line}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>아카이브 챕터</h2>
            <span>{archiveReport.chapters.filter((chapter) => chapter.status === '완성').length}/{archiveReport.chapters.length}</span>
          </div>
          <div className="game-save-list">
            {archiveReport.chapters.map((chapter) => (
              <article className="game-save-row" key={chapter.id}>
                <div>
                  <span>{chapter.status} · {chapter.pct}%</span>
                  <strong>{chapter.title}</strong>
                  <small>{chapter.detail}</small>
                </div>
                <strong>{chapter.pct >= 100 ? 'OK' : '진행'}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>전적 요약</h2>
            <span>저장/전적 payload</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="연구" value={`${archiveReport.recordSummary.researchPct}%`} />
            <SmallStat label="생존" value={`${archiveReport.recordSummary.survivalPct}%`} />
            <SmallStat label="안정도" value={`${archiveReport.recordSummary.stabilityPct}%`} />
            <SmallStat label="완성" value={archiveReport.recordSummary.victory ? '예' : '아니오'} />
          </div>
          <div className="games-empty" style={{ textAlign: 'left', marginTop: 12 }}>
            기록서 핵심값은 런 저장과 전적 기록의 summary에 함께 들어갑니다.
          </div>
        </section>
      </section>
            </>
          ),
        },
        {
          id: 'growth',
          label: '연구/성장',
          badge: `${research.completed}/${research.total}`,
          children: (
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
          ),
        },
        {
          id: 'inventory',
          label: '인벤토리/로그',
          badge: `${inventoryRows.length}종`,
          children: (
            <>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>인벤토리</h2>
            <span>{totalCarryWeight(state).toLocaleString('ko-KR')} 무게</span>
          </div>
          {inventoryRows.length ? (
            <div className="game-save-list">
              {inventoryRows.map(([id, qty]) => (
                <article className="game-save-row" key={id}>
                  <div>
                    <span>{ITEMS[id]?.icon || 'item'}</span>
                    <strong>{itemName(id)}</strong>
                  </div>
                  <strong>{Number(qty || 0).toLocaleString('ko-KR')}</strong>
                </article>
              ))}
            </div>
          ) : <div className="games-empty">보유 아이템이 없습니다.</div>}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>로그</h2>
            <span>{state.log.length}/{currentLogCapacity}</span>
          </div>
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
          ),
        },
      ]}
    />
  );
}
