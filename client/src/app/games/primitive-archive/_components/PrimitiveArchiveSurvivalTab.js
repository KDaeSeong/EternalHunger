import Image from 'next/image';
import {
  ActionButton,
  GameControlButton,
  RecentActionResult,
  SmallStat,
} from '../../_components/GamePlayPrimitives';
import {
  EQUIPMENT_SLOT_LABELS,
  completeArchiveAction,
  equipmentChoicesForSlot,
  formatRequires,
  itemName,
} from '../_lib/primitiveArchiveEngine';
import {
  BASE_CAMP_ACTIONS,
  PARTY_SORT_OPTIONS,
  actionLabel,
  chanceText,
} from '../_lib/primitiveArchivePageRuntime';
import PrimitiveArchiveTurnHorizon from './PrimitiveArchiveTurnHorizon';
import PrimitiveArchiveWorldMap from './PrimitiveArchiveWorldMap';

export default function PrimitiveArchiveSurvivalTab(props) {
  const {
    actor,
    actorId,
    actionForecasts,
    applyAction,
    archiveVictory,
    autoEquip,
    campFacilities,
    canAct,
    changeEquipmentSlot,
    clearEquipment,
    craftChance,
    currentEquipmentRows,
    equipmentAdviceMode,
    equipmentAdviceRows,
    equipmentInventory,
    exploration,
    gatherChance,
    huntChance,
    milestones,
    partyCap,
    partySort,
    partyView,
    recentActionText,
    recipe,
    recipeId,
    recipeRows,
    recruitCandidates,
    recruitMember,
    research,
    runCamp,
    runCraft,
    runEat,
    runEventChain,
    runGather,
    runHunt,
    runProgressReport,
    runRecoveryChoice,
    runResearch,
    runRest,
    selectRegion,
    selectedRecruit,
    selectedRegion,
    setActorId,
    setPartySort,
    setRecipeId,
    setSelectedRecruitId,
    regions,
    state,
    zone,
    zoneId,
    zoneSelectionUnlocked,
  } = props;

  return (
    <>
          <PrimitiveArchiveTurnHorizon milestones={milestones} />
          <section className="games-panel games-action-dock">
            <div className="games-panel-title">
              <h2>빠른 행동</h2>
              <span>{actor?.name || '대상'} · AP {state.ap}/{state.apMax}</span>
            </div>
            <div className="games-action-dock__controls">
              <label className="game-save-json-field">
                <span>지역</span>
                <select
                  value={zoneSelectionUnlocked ? selectedRegion?.id || zoneId : 'random'}
                  disabled={!zoneSelectionUnlocked}
                  onChange={(event) => selectRegion(event.target.value)}
                >
                  {!zoneSelectionUnlocked ? <option value="random">미지의 구역 · 행동 시 무작위</option> : null}
                  {(regions || []).filter((row) => row.revealed && !row.safe).map((row) => (
                    <option value={row.id} key={row.id}>{row.name} · {row.dangerLabel}</option>
                  ))}
                </select>
                <small>{zoneSelectionUnlocked ? '지도 제작 완료 · 구역 지정 가능' : '지도 제작 연구를 완료하면 구역을 지정할 수 있습니다.'}</small>
              </label>
              <label className="game-save-json-field">
                <span>제작</span>
                <select value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
                  {(recipeRows || []).map((row) => (
                    <option value={row.id} key={row.id}>
                      {row.unlocked ? row.name : `${row.name} · 잠김`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="games-action-dock__notes">
              <span>
                {zoneSelectionUnlocked
                  ? `${selectedRegion?.landmark || zone.note} · ${selectedRegion?.yieldHint || zone.note}`
                  : `현재 발견한 ${exploration?.revealed || 0}개 지역 중 한 곳에서 행동합니다. 지도 제작 후 원하는 지역을 지정할 수 있습니다.`}
              </span>
              <span>
                {recipe?.unlocked
                  ? `제작: ${formatRequires(recipe.requires)} · ${recipe.note}${recipe.prototype ? ` · ${recipe.statusLabel}` : ''}`
                  : `제작 잠김: ${recipe?.lockedReason || '연구 조건을 확인하세요.'}`}
              </span>
            </div>
            <div className="games-action-dock__buttons">
              <ActionButton action="gather" disabled={!canAct} onClick={runGather}>채집 · {Math.round(gatherChance * 100)}%</ActionButton>
              <ActionButton action="combat" disabled={!canAct} onClick={runHunt}>사냥 · {Math.round(huntChance * 100)}%</ActionButton>
              <ActionButton action="craft" disabled={!canAct || !recipe?.unlocked} onClick={runCraft}>제작 · {Math.round(craftChance * 100)}%</ActionButton>
              <ActionButton action="consume" disabled={!canAct} onClick={runEat}>식사</ActionButton>
              <ActionButton action="rest" disabled={!canAct} onClick={runRest}>휴식</ActionButton>
              <ActionButton action="research" disabled={!canAct || !research.actionUnlocked || !research.selected?.available} onClick={runResearch}>
                {research.actionUnlocked ? '연구' : '직접 연구 잠김'}
              </ActionButton>
            </div>
            <div className="primitive-action-forecast-grid" aria-label="행동별 기대수익">
              {(actionForecasts || []).map((forecast) => (
                <article className={`primitive-action-forecast${forecast.locked ? ' is-locked' : ''}`} key={forecast.id}>
                  <div>
                    <strong>{forecast.label}</strong>
                    <span>{forecast.chancePct}%</span>
                  </div>
                  <small>{forecast.context}</small>
                  <p>{forecast.outcome}</p>
                  <em>{forecast.cost}</em>
                </article>
              ))}
            </div>
            <div className="games-action-dock__buttons games-action-dock__buttons--camp">
              {BASE_CAMP_ACTIONS.map((row) => (
                <ActionButton action={row.id === 'fuel' ? 'fuel' : 'camp'} disabled={!canAct} onClick={() => runCamp(row.id)} key={row.id}>{row.label}</ActionButton>
              ))}
              {campFacilities.map((facility) => (
                <ActionButton
                  action="camp"
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

          <PrimitiveArchiveWorldMap
            exploration={exploration}
            onSelect={selectRegion}
            regions={regions}
            selectedRegion={selectedRegion}
            selectionUnlocked={zoneSelectionUnlocked}
          />

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
                  <GameControlButton
                    action="recruit"
                    className="tcg-secondary-action"
                    disabled={!selectedRecruit || state.party.length >= partyCap}
                    onClick={recruitMember}
                  >
                    합류
                  </GameControlButton>
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
                    data-game-sfx="select"
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
              <ActionButton action="complete" disabled={!archiveVictory.canComplete} onClick={() => applyAction('아카이브 완성', (current) => completeArchiveAction(current))}>
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
                <SmallStat label="사건" value={runProgressReport.eventLabel} />
                <SmallStat label="희귀" value={`${runProgressReport.rareResourceTotal}개`} />
              </div>
              <div className="game-save-list">
                <article className="game-save-row">
                  <div>
                    <span>탐험 사건</span>
                    <strong>{runProgressReport.recentEvents?.[0]?.title || '아직 기록된 사건이 없습니다'}</strong>
                    <small>{runProgressReport.rareResourceLabel}</small>
                  </div>
                  <strong>{runProgressReport.eventPct}%</strong>
                </article>
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
                {(runProgressReport.activeEventChains || []).map((chain) => (
                  <article className="game-save-row" key={chain.id}>
                    <div>
                      <span>{chain.stageLabel} · {chain.costText}</span>
                      <strong>{chain.title}</strong>
                      <small>{chain.detail}</small>
                    </div>
                    <GameControlButton
                      action="event"
                      className="tcg-secondary-action"
                      disabled={!canAct || !chain.enabled}
                      onClick={() => runEventChain(chain.id)}
                    >
                      {chain.actionLabel}
                    </GameControlButton>
                  </article>
                ))}
                {(runProgressReport.recoveryChoices || []).map((choice) => (
                  <article className="game-save-row" key={choice.id}>
                    <div>
                      <span>{choice.costText} · {choice.tone === 'danger' ? '긴급' : choice.tone === 'low' ? '정비' : '대응'}</span>
                      <strong>{choice.title}</strong>
                      <small>{choice.detail}</small>
                    </div>
                    <GameControlButton
                      action="execute"
                      className="tcg-secondary-action"
                      disabled={!canAct || !choice.enabled}
                      onClick={() => runRecoveryChoice(choice.id)}
                    >
                      실행
                    </GameControlButton>
                  </article>
                ))}
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
                <ActionButton action="fuel" disabled={!canAct} onClick={() => runCamp('fuel')}>연료 넣기 · 나무 1</ActionButton>
                <ActionButton action="camp" disabled={!canAct} onClick={() => runCamp('fire')}>모닥불 강화 · 나무 2, 돌 2</ActionButton>
                <ActionButton action="camp" disabled={!canAct} onClick={() => runCamp('shelter')}>대피소 강화 · 나무 3, 섬유 2, 가죽 1</ActionButton>
                <ActionButton action="craft" disabled={!canAct} onClick={() => runCamp('workbench')}>작업대 제작 · 나무 4, 돌 2</ActionButton>
                <ActionButton action="consume" disabled={!canAct} onClick={() => runCamp('cook')}>고기 굽기 · 고기 1, 연료 1</ActionButton>
                {campFacilities.map((facility) => (
                  <ActionButton
                    action="camp"
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
                <GameControlButton action="equip" className="tcg-secondary-action" onClick={() => autoEquip('role')}>
                  역할 추천 장착
                </GameControlButton>
                <GameControlButton action="equip" className="tcg-secondary-action" onClick={() => autoEquip('weather')}>
                  날씨 대응 장착
                </GameControlButton>
                <GameControlButton action="reset" className="tcg-secondary-action" onClick={clearEquipment}>
                  전체 해제
                </GameControlButton>
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
  );
}
