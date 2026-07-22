import {
  ActionButton,
  GameControlButton,
  SmallStat,
  RecentActionResult,
} from '../../_components/GamePlayPrimitives';
import {
  EQUIPMENT_SLOT_LABELS,
  RACE_LABELS,
  applyTradeAction,
  buyShopItemAction,
  consumeInventoryItemAction,
  equipInventoryItemAction,
  unequipSlotAction,
} from '../_lib/myAnimeCraftEngine';
import { MyAnimeCraftIconRow, MyAnimeCraftPanelTitle } from './MyAnimeCraftVisuals';

export default function MyAnimeCraftMarketTab(props) {
  const {
    applyStateAction,
    ended,
    equipmentRows,
    inventoryRows,
    marketOfficeReport,
    recentActionText,
    resultPresentation,
    selectedPlayer,
    selectedTeam,
    setSelectedPlayerId,
    setTradeCash,
    setTradeTargetPlayerId,
    setTradeTargetTeamId,
    shopRows,
    state,
    tradeCash,
    tradeInfo,
    tradeTargetPlayer,
    tradeTargetTeam,
    tradeTeams,
  } = props;
  const officeTradeRows = marketOfficeReport?.tradeRows || [];
  const officeShopRows = marketOfficeReport?.shopPriorityRows || [];
  const suggestedCash = Number(marketOfficeReport?.cashSuggestion || 0);
  const canApplySuggestedCash = !ended && Number.isFinite(suggestedCash) && suggestedCash !== Number(tradeCash || 0);

  return (
              <>
      <section className="games-detail-grid">

        <section className="games-panel">
          <MyAnimeCraftPanelTitle action="advisor" title="프런트 오피스" meta={marketOfficeReport?.warnings?.length ? '주의' : '권장'} />
          <RecentActionResult label="시장 판단" text={marketOfficeReport?.summary || '상대 팀과 선수를 선택하면 시장 판단 리포트가 표시됩니다.'} />
          <div className="games-rank-split" style={{ marginTop: 12 }}>
            {officeTradeRows.length ? officeTradeRows.map((row) => (
              <SmallStat key={row.label} label={row.label} value={row.value} />
            )) : (
              <SmallStat label="상태" value="대기" />
            )}
          </div>
          {officeTradeRows.length ? (
            <div className="game-save-list" style={{ marginTop: 12 }}>
              {officeTradeRows.map((row) => (
                <MyAnimeCraftIconRow action="analysis" label={row.label} key={`${row.label}-detail`}>
                  <div>
                    <span>{row.label}</span>
                    <strong>{row.detail}</strong>
                  </div>
                </MyAnimeCraftIconRow>
              ))}
            </div>
          ) : null}
          {marketOfficeReport?.warnings?.length ? (
            <div className="game-save-list" style={{ marginTop: 12 }}>
              {marketOfficeReport.warnings.map((warning) => (
                <MyAnimeCraftIconRow action="warning" label="시장 리스크" key={warning}>
                  <div>
                    <span>리스크</span>
                    <strong>{warning}</strong>
                  </div>
                </MyAnimeCraftIconRow>
              ))}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <GameControlButton action="finance" disabled={!canApplySuggestedCash} onClick={() => setTradeCash(suggestedCash)}>
              추천 보정 {suggestedCash} Cr 적용
            </GameControlButton>
          </div>
          <MyAnimeCraftPanelTitle action="shop" title="추천 상점" meta={`${officeShopRows.length}개`} style={{ marginTop: 16 }} />
          <div className="game-save-list">
            {officeShopRows.map((row) => (
              <MyAnimeCraftIconRow action="shop" label={row.title} key={`office-shop-${row.offerId}`}>
                <div>
                  <span>{row.price} Cr · 점수 {row.score}</span>
                  <strong>{row.title}</strong>
                  <small>{row.reason}</small>
                </div>
                <GameControlButton
                  action="shop"
                  cue="off"
                  disabled={ended || !row.canBuy}
                  onClick={() => applyStateAction('추천 상점 구매', (current) => buyShopItemAction(current, selectedTeam.id, row.offerId))}
                >
                  구매
                </GameControlButton>
              </MyAnimeCraftIconRow>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <MyAnimeCraftPanelTitle action="shop" title="주간 상점" meta={`${state.shop?.week || state.week}주차`} />
          <div className="game-save-list">
            {shopRows.map((offer) => (
              <MyAnimeCraftIconRow action={offer.stock > 0 ? 'shop' : 'warning'} label={offer.name} key={offer.offerId}>
                <div>
                  <span>
                    {offer.featured ? '추천 · ' : ''}{EQUIPMENT_SLOT_LABELS[offer.slot] || offer.kind}
                    {offer.salePct ? ` · ${offer.salePct}% 할인` : ''}
                  </span>
                  <strong>{offer.name}</strong>
                  <small>
                    {offer.effects?.statsDelta ? Object.entries(offer.effects.statsDelta).map(([key, amount]) => `${key}+${amount}`).join(' · ') : ''}
                    {offer.effects?.conditionDelta ? `컨디션 +${offer.effects.conditionDelta}` : ''}
                    {offer.effects?.fameDelta ? ` · 명성 +${offer.effects.fameDelta}` : ''}
                  </small>
                </div>
                <GameControlButton action="shop" cue="off" disabled={ended || offer.stock <= 0} onClick={() => applyStateAction('상점 구매', (current) => buyShopItemAction(current, selectedTeam.id, offer.offerId))}>
                  {offer.stock <= 0 ? '품절' : `${offer.price} Cr`}
                </GameControlButton>
              </MyAnimeCraftIconRow>
            ))}
          </div>
          <RecentActionResult action={resultPresentation.action} label={resultPresentation.label} text={recentActionText} tone={resultPresentation.tone} />
        </section>

        <section className="games-panel">
          <MyAnimeCraftPanelTitle action="transfer" title="트레이드" meta={tradeInfo ? `${Math.round(tradeInfo.acceptChance * 100)}%` : '대기'} />
          <label className="game-save-json-field">
            <span>상대 팀</span>
            <select value={tradeTargetTeam?.teamId || ''} onChange={(event) => {
              setTradeTargetTeamId(event.target.value);
              setTradeTargetPlayerId('');
            }}>
              {tradeTeams.map((team) => (
                <option value={team.teamId} key={team.teamId}>{team.teamName} · 전력 {team.power}</option>
              ))}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>상대 선수</span>
            <select value={tradeTargetPlayer?.playerId || ''} onChange={(event) => setTradeTargetPlayerId(event.target.value)} disabled={!tradeTargetTeam}>
              {(tradeTargetTeam?.roster || []).map((member) => (
                <option value={member.playerId} key={member.playerId}>
                  {member.playerName} · {RACE_LABELS[member.race] || member.race} · 가치 {member.marketValue}
                </option>
              ))}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>현금 보정</span>
            <input
              type="number"
              min="0"
              step="25"
              value={tradeCash}
              onChange={(event) => setTradeCash(Math.max(0, Number(event.target.value || 0)))}
            />
          </label>
          <div className="games-rank-split">
            <SmallStat label="우리 선수" value={`${selectedPlayer?.name || '-'} · ${tradeInfo?.ourValue || 0}`} />
            <SmallStat label="상대 선수" value={`${tradeTargetPlayer?.playerName || '-'} · ${tradeInfo?.theirValue || 0}`} />
            <SmallStat label="가치비" value={tradeInfo ? tradeInfo.ratio.toFixed(2) : '-'} />
          </div>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
            {tradeInfo?.note || '트레이드할 선수와 상대 팀을 선택하세요.'}
          </p>
          <ActionButton
            action="transfer"
            cue="off"
            disabled={!tradeInfo?.canTrade}
            onClick={() => applyStateAction('트레이드 제안', (current) => applyTradeAction(
              current,
              selectedTeam.id,
              selectedPlayer.id,
              tradeTargetTeam.teamId,
              tradeTargetPlayer.playerId,
              tradeCash,
            ))}
          >
            1:1 트레이드 제안
          </ActionButton>
        </section>

        <section className="games-panel">
          <MyAnimeCraftPanelTitle action="equip" title="장비 관리" meta={selectedPlayer?.name || '선수 없음'} />
          <label className="game-save-json-field">
            <span>대상 선수</span>
            <select value={selectedPlayer?.id || ''} onChange={(event) => setSelectedPlayerId(event.target.value)}>
              {selectedTeam.roster.map((member) => (
                <option value={member.id} key={member.id}>{member.name} · {RACE_LABELS[member.race] || member.race}</option>
              ))}
            </select>
          </label>
          <div className="game-save-list">
            {equipmentRows.map((row) => (
              <MyAnimeCraftIconRow action={row.itemId ? 'equip' : 'unequip'} label={row.label} key={row.slot}>
                <div>
                  <span>{row.label}</span>
                  <strong>{row.itemName || '미장착'}</strong>
                </div>
                <GameControlButton action="unequip" cue="off" disabled={!row.itemId} onClick={() => applyStateAction('장비 해제', (current) => unequipSlotAction(current, selectedTeam.id, selectedPlayer.id, row.slot))}>해제</GameControlButton>
              </MyAnimeCraftIconRow>
            ))}
          </div>
          <MyAnimeCraftPanelTitle action="inventory" title="인벤토리" meta={`${inventoryRows.reduce((sum, item) => sum + Number(item.qty || 0), 0)}개`} style={{ marginTop: 16 }} />
          <div className="game-save-list">
            {inventoryRows.length ? inventoryRows.map((item) => (
              <MyAnimeCraftIconRow action={item.slot ? 'equip' : 'consume'} label={item.name} key={item.itemId}>
                <div>
                  <span>
                    {EQUIPMENT_SLOT_LABELS[item.slot] || '소모품'} · 보유 {item.qty}
                    {item.equippedCount ? ` · 장착 ${item.equippedCount}` : ''}
                  </span>
                  <strong>{item.name}</strong>
                </div>
                {item.slot ? (
                  <GameControlButton action="equip" cue="off" disabled={!selectedPlayer || item.qty <= item.equippedCount} onClick={() => applyStateAction('장비 장착', (current) => equipInventoryItemAction(current, selectedTeam.id, selectedPlayer.id, item.itemId))}>장착</GameControlButton>
                ) : (
                  <GameControlButton action="consume" cue="off" disabled={!selectedPlayer || item.qty <= 0} onClick={() => applyStateAction('아이템 사용', (current) => consumeInventoryItemAction(current, selectedTeam.id, selectedPlayer.id, item.itemId))}>사용</GameControlButton>
                )}
              </MyAnimeCraftIconRow>
            )) : (
              <div className="games-empty">보유 아이템이 없습니다.</div>
            )}
          </div>
          </section>
        </section>
              </>
  );
}
