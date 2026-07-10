import {
  GameControlButton,
  SmallStat,
} from '../../_components/GamePlayPrimitives';
import {
  applyEquipmentPresetAction,
  buyTowerShopOfferAction,
  buyTowerShopOfferMaxAction,
  claimAchievementRewardsAction,
  claimMissionRewardsAction,
  deleteEquipmentPresetAction,
  enhanceEquipmentAction,
  equipTitleAction,
  rerollEquipmentAction,
  resetTowerShopRotationAction,
  saveEquipmentPresetAction,
  setSalvageCandidateOnlyAction,
  slotLabel,
  toggleEquipmentAffixLockAction,
} from '../_lib/schaleIdleEngine';
import {
  formatAffixes,
  formatRolls,
} from '../_lib/schaleEquipmentTuning';

export default function SchaleIdleGearTab(props) {
  const {
    achievements,
    activePresetId,
    claimableAchievements,
    equipped,
    equippedTitle,
    equipmentTuning,
    missions,
    presetName,
    presets,
    rows,
    runAutoSalvage,
    runSelectedSalvage,
    salvage,
    salvageInfo,
    selectedPreset,
    selectedSalvageInfo,
    setEnhanceSlot,
    setPresetName,
    setSelectedPresetId,
    setSelectedSalvageUids,
    setState,
    shopOffers,
    shopRotation,
    titles,
    toggleSalvageSelection,
    validSelectedSalvageUids,
  } = props;

  return (
    <>

        <section className="games-dashboard">
          <section className="games-panel">
            <div className="games-panel-title">
              <h2>장비 정비 판단</h2>
              <span>{equipmentTuning.headline}</span>
            </div>
            <div className="games-rank-split" style={{ marginBottom: 12 }}>
              <SmallStat label="평균 옵션" value={`${equipmentTuning.avgOptionScore}점`} />
              <SmallStat label="고점 미잠금" value={`${equipmentTuning.highUnlockedCount}개`} />
              <SmallStat label="저점 옵션" value={`${equipmentTuning.lowOptionCount}개`} />
              <SmallStat label="잠금 옵션" value={`${equipmentTuning.lockedCount}개`} />
              <SmallStat label="잠금 후 비용" value={equipmentTuning.nextLockCostText} />
              <SmallStat label="재련 여력" value={equipmentTuning.lockBudgetText} />
              <SmallStat label="즉시 재련" value={`${equipmentTuning.rerollReadyCount}슬롯`} />
              <SmallStat label="리롤권" value={equipmentTuning.rerollTickets} />
              <SmallStat label="탑 토큰" value={equipmentTuning.towerTokens} />
              <SmallStat label="강화석" value={equipmentTuning.enhanceStones} />
            </div>
            <div className="game-save-list">
              {equipmentTuning.actions.map((action) => (
                <article className="game-save-row" key={action.id}>
                  <div>
                    <span>{action.label}</span>
                    <strong>{action.title}</strong>
                    <small>{action.detail}</small>
                  </div>
                  {action.type === 'lock' ? (
                    <GameControlButton
                      action="lock"
                      disabled={!action.enabled}
                      onClick={() => setState((current) => toggleEquipmentAffixLockAction(current, action.slot, action.affixId))}
                    >
                      잠금
                    </GameControlButton>
                  ) : null}
                  {action.type === 'reroll' ? (
                    <GameControlButton
                      action="reroll"
                      disabled={!action.enabled}
                      onClick={() => {
                        setEnhanceSlot(action.slot);
                        setState((current) => rerollEquipmentAction(current, action.slot));
                      }}
                    >
                      재련
                    </GameControlButton>
                  ) : null}
                  {action.type === 'enhance' ? (
                    <GameControlButton
                      action="upgrade"
                      disabled={!action.enabled}
                      onClick={() => {
                        setEnhanceSlot(action.slot);
                        setState((current) => enhanceEquipmentAction(current, action.slot));
                      }}
                    >
                      강화
                    </GameControlButton>
                  ) : null}
                  {action.type === 'idle' ? <strong>대기</strong> : null}
                </article>
              ))}
            </div>
            {equipmentTuning.lockPlans.length ? (
              <>
                <div className="games-empty" style={{ textAlign: 'left', marginTop: 12 }}>
                  <strong>잠금 비용 규칙</strong>
                  {' · '}
                  옵션을 잠그면 다음 재련 비용이 리롤권 +1장 또는 시련 토큰 +8개씩 증가합니다.
                  고점 옵션은 보존하되, 잠금 후 바로 재련 가능한 후보를 우선 표시합니다.
                </div>
                <div className="game-save-list" style={{ marginTop: 12 }}>
                  {equipmentTuning.lockPlans.slice(0, 4).map((plan) => (
                    <article className="game-save-row" key={plan.id}>
                      <div>
                        <span>{slotLabel(plan.slot)} · {plan.rarity} · 비용 압박 {plan.pressure}</span>
                        <strong>{plan.label} x{plan.value} · 점수 {plan.score}</strong>
                        <small>
                          현재 {plan.currentCostText} → 잠금 후 {plan.afterLockCostText}
                          {' · '}
                          {plan.canRerollAfterLock ? '즉시 재련 가능' : plan.shortageText}
                        </small>
                      </div>
                      <strong>{plan.canRerollAfterLock ? '추천' : '재화 필요'}</strong>
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>장비</h2>
              <span>{equipped.length}개</span>
            </div>
            {equipped.length ? (
              <div className="game-save-list">
                {equipped.map((equip) => (
                  <article className="game-save-row" key={equip.uid}>
                    <div>
                      <span>{slotLabel(equip.slot)} · {equip.rarity}</span>
                      <strong>{equip.name}</strong>
                      <small>{formatRolls(equip)}</small>
                      <small>{formatAffixes(equip) || '옵션 없음'}</small>
                      {(equip.affixes || []).length ? (
                        <div className="games-chip-row" style={{ marginTop: 8 }}>
                          {equip.affixes.map((affix) => (
                            <GameControlButton
                              action="lock"
                              className={`schale-salvage-toggle${affix.locked ? ' is-on' : ''}`}
                              key={`${equip.uid}-${affix.id}`}
                              onClick={() => setState((current) => toggleEquipmentAffixLockAction(current, equip.slot, affix.id))}
                            >
                              {affix.locked ? '잠금' : '잠금 해제'} · {affix.label}
                            </GameControlButton>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <strong>+{equip.enhance || 0}</strong>
                  </article>
                ))}
              </div>
            ) : <div className="games-empty">장착 중인 장비가 없습니다. 제작으로 장비를 확보하세요.</div>}
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>장비 프리셋</h2>
              <span>{presets.length}/12</span>
            </div>
            <label className="game-save-json-field">
              <span>프리셋 이름</span>
              <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="프리셋 이름" />
            </label>
            <label className="game-save-json-field">
              <span>적용 대상</span>
              <select value={activePresetId} onChange={(event) => setSelectedPresetId(event.target.value)} disabled={!presets.length}>
                {presets.length ? presets.map((preset) => (
                  <option value={preset.id} key={preset.id}>
                    {preset.active ? '★ ' : ''}{preset.name} · {preset.availableCount}/{preset.equippedCount}
                  </option>
                )) : <option value="">저장된 프리셋 없음</option>}
              </select>
            </label>
            <div className="games-chip-row" style={{ marginBottom: 12 }}>
              <GameControlButton action="preset" className="tcg-primary-action" disabled={!equipped.length} onClick={() => {
                setSelectedPresetId('');
                setState((current) => saveEquipmentPresetAction(current, presetName));
              }}>
                현재 장비 저장
              </GameControlButton>
              <GameControlButton action="preset" className="tcg-primary-action" disabled={!selectedPreset} onClick={() => setState((current) => applyEquipmentPresetAction(current, activePresetId))}>
                프리셋 적용
              </GameControlButton>
              <GameControlButton action="reset" className="tcg-secondary-action" disabled={!selectedPreset} onClick={() => {
                setSelectedPresetId('');
                setState((current) => deleteEquipmentPresetAction(current, activePresetId));
              }}>
                삭제
              </GameControlButton>
            </div>
            <div className="game-save-list">
              {presets.length ? presets.slice(0, 5).map((preset) => (
                <article className="game-save-row" key={preset.id}>
                  <div>
                    <span>{preset.active ? '활성' : '저장'} · 사용 가능 {preset.availableCount}/{preset.equippedCount}</span>
                    <strong>{preset.name}</strong>
                    <small>{preset.missingCount ? `누락 슬롯 ${preset.missingCount}개` : '모든 장비 사용 가능'}</small>
                  </div>
                  <strong>{preset.equippedCount}슬롯</strong>
                </article>
              )) : (
                <article className="game-save-row">
                  <div>
                    <span>현재 장비 저장으로 생성</span>
                    <strong>저장된 프리셋이 없습니다.</strong>
                  </div>
                  <strong>대기</strong>
                </article>
              )}
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>인벤토리</h2>
              <span>{rows.length}종</span>
            </div>
            <div className="game-save-list">
              {rows.slice(0, 14).map((row) => (
                <article className="game-save-row" key={row.itemId}>
                  <div>
                    <span>{row.rarity}</span>
                    <strong>{row.name}</strong>
                  </div>
                  <strong>{Number(row.qty || 0).toLocaleString('ko-KR')}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>타워 상점</h2>
              <span>토큰 {shopRotation.tokenCount}</span>
            </div>
            <div className="games-rank-split" style={{ marginBottom: 12 }}>
              <SmallStat label="오늘 픽업" value={`${shopRotation.dailyCount}개`} />
              <SmallStat label="오늘 리셋" value={`${shopRotation.dailyResetsUsed}/${shopRotation.dailyResetMax}`} />
              <SmallStat label="오늘 피티" value={`${shopRotation.dailyPityCounter}/${shopRotation.dailyPityTrigger}`} />
              <SmallStat label="이번주 픽업" value={`${shopRotation.weeklyCount}개`} />
              <SmallStat label="주간 리셋" value={`${shopRotation.weeklyResetsUsed}/${shopRotation.weeklyResetMax}`} />
              <SmallStat label="주간 피티" value={`${shopRotation.weeklyPityCounter}/${shopRotation.weeklyPityTrigger}`} />
            </div>
            <div className="games-chip-row" style={{ marginBottom: 12 }}>
              <GameControlButton
                action="reroll"
                className="tcg-primary-action"
                disabled={!shopRotation.canResetDaily}
                onClick={() => setState((current) => resetTowerShopRotationAction(current, 'DAILY'))}
              >
                오늘 픽업 리셋 · {shopRotation.dailyResetCost}토큰
              </GameControlButton>
              <GameControlButton
                action="reroll"
                className="tcg-primary-action"
                disabled={!shopRotation.canResetWeekly}
                onClick={() => setState((current) => resetTowerShopRotationAction(current, 'WEEKLY'))}
              >
                이번주 픽업 리셋 · {shopRotation.weeklyResetCost}토큰
              </GameControlButton>
            </div>
            <div className="game-save-list">
              {shopOffers.map((offer) => (
                <article className="game-save-row" key={offer.id}>
                  <div>
                    <span>{offer.pickupLabel} · {offer.costText} · {offer.limitText}</span>
                    <strong>{offer.name}</strong>
                    <small>남은 구매 {offer.remaining}</small>
                  </div>
                  <div className="game-save-row-actions">
                    <GameControlButton action="shop" disabled={!offer.canBuy} onClick={() => setState((current) => buyTowerShopOfferAction(current, offer.id))}>구매</GameControlButton>
                    <GameControlButton action="shop" disabled={!offer.canBuyMax} onClick={() => setState((current) => buyTowerShopOfferMaxAction(current, offer.id))}>
                      최대 {offer.maxBuyCount || 0}
                    </GameControlButton>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>분해 대기열</h2>
              <GameControlButton action="salvage" className="tcg-primary-action" disabled={!salvageInfo.executableCount} onClick={runAutoSalvage}>
                자동 분해{salvageInfo.candidateOnly ? ' · 후보만' : ''}
              </GameControlButton>
            </div>
            {salvage.length ? (
              <>
                <div className="games-chip-row" style={{ marginBottom: 12 }}>
                  <GameControlButton
                    action="salvage"
                    className={`schale-salvage-toggle${salvageInfo.candidateOnly ? ' is-on' : ''}`}
                    onClick={() => setState((current) => setSalvageCandidateOnlyAction(current, !salvageInfo.candidateOnly))}
                  >
                    후보만 분해
                    {salvageInfo.candidateOnly ? <span>ON</span> : <span>OFF</span>}
                  </GameControlButton>
                  <GameControlButton
                    action="target"
                    className="schale-salvage-toggle"
                    disabled={!salvageInfo.executableCount}
                    onClick={() => setSelectedSalvageUids(salvage.filter((entry) => entry.executable).map((entry) => entry.uid))}
                  >
                    실행 대상 선택
                  </GameControlButton>
                  <GameControlButton
                    action="reset"
                    className="schale-salvage-toggle"
                    disabled={!validSelectedSalvageUids.length}
                    onClick={() => setSelectedSalvageUids([])}
                  >
                    선택 해제
                  </GameControlButton>
                  <GameControlButton
                    action="salvage"
                    className="tcg-primary-action"
                    disabled={!selectedSalvageInfo.executableCount}
                    onClick={runSelectedSalvage}
                  >
                    선택 분해
                  </GameControlButton>
                </div>
                <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
                  {salvageInfo.candidateOnly ? (
                    <>
                      <strong>후보만 분해 ON</strong> · 실행 대상 {salvageInfo.executableCount}개 / 보호 유지 {salvageInfo.protectedByCandidateOnly}개입니다.
                      장착 장비 {salvageInfo.protectedEquipped}개는 별도로 보호 중입니다.
                    </>
                  ) : (
                    <>
                      <strong>후보만 분해 OFF</strong> · 전체 대기열 {salvageInfo.totalQueued}개를 자동 분해 대상으로 처리합니다.
                      위험 후보까지 포함되므로 실행 전 목록을 확인하세요.
                    </>
                  )}
                </div>
                <div className="games-rank-split" style={{ marginBottom: 12 }}>
                  <SmallStat label="대기열" value={`${salvageInfo.totalQueued}개`} />
                  <SmallStat label="실행 대상" value={`${salvageInfo.executableCount}개`} />
                  <SmallStat label="보호" value={`${salvageInfo.protectedByCandidateOnly}개`} />
                  <SmallStat label="고철" value={salvageInfo.totals.scrap} />
                  <SmallStat label="강화석" value={salvageInfo.totals.stone} />
                  <SmallStat label="리롤권" value={salvageInfo.totals.ticket} />
                  <SmallStat label="위험 후보" value={`${salvageInfo.highRiskCount}개`} />
                </div>
                {validSelectedSalvageUids.length ? (
                  <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
                    <strong>선택 {selectedSalvageInfo.selectedCount}개</strong>
                    {' · '}
                    실행 {selectedSalvageInfo.executableCount}개 / 보호 {selectedSalvageInfo.protectedByCandidateOnly}개
                    {' · '}
                    예상 보상 {selectedSalvageInfo.totalRewardText}
                    {selectedSalvageInfo.candidateOnly && selectedSalvageInfo.highRiskCount ? ' · 위험 후보는 보호됩니다.' : ''}
                  </div>
                ) : null}
                <div className="game-save-list">
                  <article className="game-save-row">
                    <div>
                      <span>희귀도: {salvageInfo.byRarityText}</span>
                      <strong>슬롯 분포: {salvageInfo.bySlotText}</strong>
                    </div>
                  </article>
                  {salvageInfo.highRiskCount ? (
                    <article className="game-save-row">
                      <div>
                        <span>RARE 이상 / 강화 +3 이상 / 점수 120 이상</span>
                        <strong>위험 후보 상위: {salvageInfo.topRiskRows.map((entry) => `${entry.name}(${entry.score})`).join(', ')}</strong>
                      </div>
                      <strong>주의</strong>
                    </article>
                  ) : null}
                  {salvage.slice(0, 8).map((entry) => (
                    <article className="game-save-row" key={`${entry.uid}-${entry.createdAt}`}>
                      <div>
                        <span>{slotLabel(entry.slot)} · {entry.rarity} · {entry.reason}</span>
                        <strong>{entry.name}</strong>
                        <small>{entry.rewardText}</small>
                        <small>점수 {entry.score} · {entry.executable ? '실행 대상' : '보호'}</small>
                      </div>
                      <label className="schale-salvage-check">
                        <input
                          type="checkbox"
                          checked={validSelectedSalvageUids.includes(entry.uid)}
                          onChange={() => toggleSalvageSelection(entry.uid)}
                        />
                        <span>선택</span>
                      </label>
                    </article>
                  ))}
                </div>
              </>
            ) : <div className="games-empty">분해 대기 중인 장비가 없습니다.</div>}
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>미션</h2>
              <GameControlButton action="claim" className="tcg-primary-action" onClick={() => setState((current) => claimMissionRewardsAction(current))}>보상 수령</GameControlButton>
            </div>
            <div className="game-save-list">
              {missions.map((mission) => (
                <article className="game-save-row" key={mission.id}>
                  <div>
                    <span>{mission.type} · {mission.progress}/{mission.target}</span>
                    <strong>{mission.name}</strong>
                  </div>
                  <strong>{mission.claimed ? '수령' : mission.done ? '완료' : '진행'}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>업적</h2>
              <GameControlButton action="claim" className="tcg-primary-action" disabled={!claimableAchievements} onClick={() => setState((current) => claimAchievementRewardsAction(current))}>
                {claimableAchievements ? `${claimableAchievements}개 수령` : '수령 없음'}
              </GameControlButton>
            </div>
            <div className="game-save-list">
              {achievements.map((achievement) => (
                <article className="game-save-row" key={achievement.id}>
                  <div>
                    <span>{achievement.progress}/{achievement.target}{achievement.titleName ? ` · ${achievement.titleName}` : ''}</span>
                    <strong>{achievement.name}</strong>
                    <small>{achievement.desc}</small>
                  </div>
                  <strong>{achievement.claimed ? '수령' : achievement.done ? '완료' : '진행'}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>칭호</h2>
              <span>{equippedTitle ? equippedTitle.name : '미장착'}</span>
            </div>
            <div className="game-save-list">
              {titles.map((title) => (
                <article className="game-save-row" key={title.id}>
                  <div>
                    <span>{title.kind === 'POWER_MUL' ? '전투력' : '크레딧'} x{Number(title.mul || 1).toFixed(2)}</span>
                    <strong>{title.name}</strong>
                    <small>{title.desc}</small>
                  </div>
                  <GameControlButton action="title" disabled={!title.unlocked} onClick={() => setState((current) => equipTitleAction(current, title.equipped ? null : title.id))}>
                    {title.equipped ? '해제' : title.unlocked ? '장착' : '잠김'}
                  </GameControlButton>
                </article>
              ))}
            </div>
          </section>
        </section>
                </>
  );
}
