import { ActionButton } from '../../_components/GamePlayPrimitives';
import {
  claimQuestAction,
  equipWeaponAction,
} from '../_lib/baSrpgEngine';

export default function BaSrpgInventoryTab(props) {
  const {
    equips,
    quests,
    rows,
    setState,
    state,
  } = props;

  return (
    <>
              <>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>인벤토리</h2>
            <span>{rows.length}종</span>
          </div>
          <div className="game-save-list">
            {rows.map((row) => (
              <article className="game-save-row" key={row.itemId}>
                <div>
                  <span>{row.kind}</span>
                  <strong>{row.name}</strong>
                </div>
                <strong>{Number(row.qty || 0).toLocaleString('ko-KR')}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>장비</h2>
            <span>{equips.length}개</span>
          </div>
          <div className="game-save-list">
            {equips.length ? equips.map((equip) => (
              <article className="game-save-row" key={equip.uid}>
                <div>
                  <span>공격 {equip.stats.atk || 0} · 명중 {equip.stats.acc || 0}</span>
                  <strong>{equip.name}</strong>
                </div>
                <ActionButton action="equip" cue="off" onClick={() => setState((current) => equipWeaponAction(current, equip.uid))}>
                  {equip.equipped ? '장착 중' : '장착'}
                </ActionButton>
              </article>
            )) : <div className="games-empty">보유 장비가 없습니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>의뢰</h2>
            <span>{Object.keys(state.questClaims || {}).length}회 보고</span>
          </div>
          <div className="game-save-list">
            {quests.map((quest) => (
              <article className="game-save-row" key={quest.id}>
                <div>
                  <span>{quest.cadence} · {quest.progress}/{quest.required} · {quest.claimed ? '보고 완료' : quest.done ? '보고 가능' : '진행 중'}</span>
                  <strong>{quest.title}</strong>
                </div>
                <ActionButton action="claim" cue="off" disabled={!quest.done || quest.claimed} onClick={() => setState((current) => claimQuestAction(current, quest.id))}>
                  {quest.claimed ? '완료' : '보고'}
                </ActionButton>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="games-panel">
        <div className="games-panel-title">
          <h2>최근 로그</h2>
          <span>{state.runId}</span>
        </div>
        <div className="games-activity-list">
          {state.log.slice(0, 12).map((line, index) => (
            <div key={`${line}-${index}`}>
              <strong>{line}</strong>
            </div>
          ))}
        </div>
      </section>
              </>
    </>
  );
}
