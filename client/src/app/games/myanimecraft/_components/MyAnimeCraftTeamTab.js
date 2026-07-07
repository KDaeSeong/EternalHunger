import { ActionButton, SmallStat, RecentActionResult } from '../../_components/GamePlayPrimitives';
import {
  investTrainingAction,
  negotiateSponsorAction,
  releasePlayerAction,
  renewContractAction,
  runTeamActionAction,
  signFreeAgentAction,
  teamPower,
} from '../_lib/myAnimeCraftEngine';

export default function MyAnimeCraftTeamTab(props) {
  const {
    applyStateAction,
    ended,
    freeAgentPreview,
    recentActionText,
    selectedCareer,
    selectedContracts,
    selectedEconomy,
    selectedPlayer,
    selectedStanding,
    selectedTeam,
    selectedTeamId,
    setSelectedTeamId,
    state,
    teamActions,
  } = props;

  return (
              <>
      <section className="games-detail-grid">

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>팀 분석</h2>
            <span>{selectedStanding ? `${selectedStanding.wins}승 ${selectedStanding.losses}패` : '대기'}</span>
          </div>
          <label className="game-save-json-field">
            <span>팀</span>
            <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}>
              {state.teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}
            </select>
          </label>
          <div className="games-rank-split">
            <SmallStat label="감독" value={selectedTeam.coach} />
            <SmallStat label="전력" value={teamPower(selectedTeam, state)} />
            <SmallStat label="자금" value={`${Number(selectedStanding?.money || selectedTeam.money || 0).toLocaleString('ko-KR')} Cr`} />
          </div>
          <div className="games-rank-split">
            <SmallStat label="스폰서" value={`Lv.${selectedCareer.sponsorTier}`} />
            <SmallStat label="팬" value={selectedCareer.fanBase.toLocaleString('ko-KR')} />
            <SmallStat label="훈련" value={`Lv.${selectedCareer.trainingLevel}`} />
            <SmallStat label="스카우팅" value={`Lv.${selectedCareer.scoutingLevel}`} />
            <SmallStat label="예상 연봉" value={`${selectedCareer.payroll.toLocaleString('ko-KR')} Cr`} />
            <SmallStat label="FA 후보" value={`${freeAgentPreview.player.name} · ${freeAgentPreview.signingBonus} Cr`} />
          </div>
          <div className="games-rank-split">
            <SmallStat label="시즌 수입" value={`${selectedEconomy.income.toLocaleString('ko-KR')} Cr`} />
            <SmallStat label="시즌 지출" value={`${selectedEconomy.expense.toLocaleString('ko-KR')} Cr`} />
            <SmallStat label="순이익" value={`${selectedEconomy.net.toLocaleString('ko-KR')} Cr`} />
            <SmallStat label="만료 임박" value={`${selectedEconomy.expiringCount}명`} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={ended} onClick={() => applyStateAction('스폰서 협상', (current) => negotiateSponsorAction(current, selectedTeam.id))}>스폰서 협상</ActionButton>
            <ActionButton disabled={ended} onClick={() => applyStateAction('훈련 투자', (current) => investTrainingAction(current, selectedTeam.id))}>훈련 투자</ActionButton>
            <ActionButton disabled={ended} onClick={() => applyStateAction('FA 영입', (current) => signFreeAgentAction(current, selectedTeam.id))}>FA 영입</ActionButton>
          </div>
          <div className="games-panel-title" style={{ marginTop: 16 }}>
            <h2>계약 관리</h2>
            <span>만료 임박 {selectedEconomy.expiringCount}명</span>
          </div>
          <div className="game-save-list">
            {selectedContracts.slice(0, 6).map((contract) => (
              <article className="game-save-row" key={contract.playerId}>
                <div>
                  <span>
                    {contract.riskLabel} · 연봉 {contract.salary}Cr · {contract.yearsLeft}년
                    {' · '}
                    재계약 {contract.renewalBonus}Cr / {contract.renewalSalary}Cr
                  </span>
                  <strong>{contract.playerName}</strong>
                  <small>시장가 {contract.marketValue} · 방출 위약금 {contract.releaseFee}Cr</small>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button type="button" disabled={ended || !contract.canRenew} onClick={() => applyStateAction('재계약', (current) => renewContractAction(current, selectedTeam.id, contract.playerId))}>
                    재계약
                  </button>
                  <button type="button" disabled={ended || !contract.canRelease} onClick={() => applyStateAction('방출', (current) => releasePlayerAction(current, selectedTeam.id, contract.playerId))}>
                    방출
                  </button>
                </div>
              </article>
            ))}
          </div>
          <RecentActionResult label="최근 팀 운영 결과" text={recentActionText} />
          <div className="games-panel-title" style={{ marginTop: 16 }}>
            <h2>주간 운영</h2>
            <span>{selectedPlayer?.name || '선수 없음'}</span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {teamActions.map((action) => (
              <ActionButton
                key={action.id}
                disabled={!action.canRun}
                onClick={() => applyStateAction('주간 운영', (current) => runTeamActionAction(current, selectedTeam.id, selectedPlayer.id, action.id))}
              >
                {action.label} · {action.effectText}{action.disabledReason ? ` · ${action.disabledReason}` : ''}
              </ActionButton>
            ))}
          </div>
        </section>
      </section>
              </>
  );
}
