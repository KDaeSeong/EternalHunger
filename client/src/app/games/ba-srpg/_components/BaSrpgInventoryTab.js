import { ActionButton } from '../../_components/GamePlayPrimitives';
import {
  claimQuestAction,
  equipWeaponAction,
} from '../_lib/baSrpgEngine';
import { BaSrpgIconRow, BaSrpgPanelTitle } from './BaSrpgVisuals';

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
          <BaSrpgPanelTitle action="inventory" title="인벤토리" meta={`${rows.length}종`} />
          <div className="game-save-list">
            {rows.map((row) => (
              <BaSrpgIconRow action="inventory" label={row.name} key={row.itemId}>
                <div>
                  <span>{row.kind}</span>
                  <strong>{row.name}</strong>
                </div>
                <strong>{Number(row.qty || 0).toLocaleString('ko-KR')}</strong>
              </BaSrpgIconRow>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <BaSrpgPanelTitle action="equip" title="장비" meta={`${equips.length}개`} />
          <div className="game-save-list">
            {equips.length ? equips.map((equip) => (
              <BaSrpgIconRow action="equip" label={equip.name} key={equip.uid}>
                <div>
                  <span>공격 {equip.stats.atk || 0} · 명중 {equip.stats.acc || 0}</span>
                  <strong>{equip.name}</strong>
                </div>
                <ActionButton action="equip" cue="off" onClick={() => setState((current) => equipWeaponAction(current, equip.uid))}>
                  {equip.equipped ? '장착 중' : '장착'}
                </ActionButton>
              </BaSrpgIconRow>
            )) : <div className="games-empty">보유 장비가 없습니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <BaSrpgPanelTitle action="claim" title="의뢰" meta={`${Object.keys(state.questClaims || {}).length}회 보고`} />
          <div className="game-save-list">
            {quests.map((quest) => (
              <BaSrpgIconRow action={quest.claimed ? 'complete' : quest.done ? 'claim' : 'target'} label={quest.title} key={quest.id}>
                <div>
                  <span>{quest.cadence} · {quest.progress}/{quest.required} · {quest.claimed ? '보고 완료' : quest.done ? '보고 가능' : '진행 중'}</span>
                  <strong>{quest.title}</strong>
                </div>
                <ActionButton action="claim" cue="off" disabled={!quest.done || quest.claimed} onClick={() => setState((current) => claimQuestAction(current, quest.id))}>
                  {quest.claimed ? '완료' : '보고'}
                </ActionButton>
              </BaSrpgIconRow>
            ))}
          </div>
        </section>
      </section>

      <section className="games-panel">
        <BaSrpgPanelTitle action="logs" title="최근 로그" meta={state.runId} />
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
