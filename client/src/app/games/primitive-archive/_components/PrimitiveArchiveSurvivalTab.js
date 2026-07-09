import Image from 'next/image';
import {
  ActionButton,
  RecentActionResult,
  SmallStat,
} from '../../_components/GamePlayPrimitives';
import {
  EQUIPMENT_SLOT_LABELS,
  ZONES,
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

export default function PrimitiveArchiveSurvivalTab(props) {
  const {
    actor,
    actorId,
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
    gatherChance,
    huntChance,
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
    runGather,
    runHunt,
    runProgressReport,
    runResearch,
    runRest,
    selectedRecruit,
    setActorId,
    setPartySort,
    setRecipeId,
    setSelectedRecruitId,
    setZoneId,
    state,
    zone,
    zoneId,
  } = props;

  return (
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
                  {(recipeRows || []).map((row) => (
                    <option value={row.id} key={row.id}>
                      {row.unlocked ? row.name : `${row.name} · 잠김`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="games-action-dock__notes">
              <span>{zone.note}</span>
              <span>
                {recipe?.unlocked
                  ? `제작: ${formatRequires(recipe.requires)} · ${recipe.note}${recipe.prototype ? ` · ${recipe.statusLabel}` : ''}`
                  : `제작 잠김: ${recipe?.lockedReason || '연구 조건을 확인하세요.'}`}
              </span>
            </div>
            <div className="games-action-dock__buttons">
              <ActionButton disabled={!canAct} onClick={runGather}>채집 · {Math.round(gatherChance * 100)}%</ActionButton>
              <ActionButton disabled={!canAct} onClick={runHunt}>사냥 · {Math.round(huntChance * 100)}%</ActionButton>
              <ActionButton disabled={!canAct || !recipe?.unlocked} onClick={runCraft}>제작 · {Math.round(craftChance * 100)}%</ActionButton>
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
  );
}
