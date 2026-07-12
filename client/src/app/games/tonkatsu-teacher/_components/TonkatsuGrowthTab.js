import { ActionButton, SmallStat } from '../../_components/GamePlayPrimitives';
import { enterTournamentAction } from '../_lib/tonkatsuTeacherEngine';

export default function TonkatsuGrowthTab(props) {
  const {
    canAct,
    operationsReport,
    recipeId,
    recipeStatus,
    setState,
    setTournamentTierId,
    tournament,
    tournamentTierId,
  } = props;

  return (
    <>
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>성장 후보</h2>
                    <span>시설 · 연구</span>
                  </div>
                  <div className="games-rank-split">
                    {operationsReport.growthRows.map((row) => (
                      <SmallStat label={row.label} value={row.value} key={row.label} />
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>대회 미리보기</h2>
                    <span>{tournament.theme.name}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="예상 점수" value={tournament.total} />
                    <SmallStat label="목표" value={tournament.tier.targetScore} />
                    <SmallStat label="판정" value={tournament.win ? '우승권' : '부족'} />
                  </div>
                  <ActionButton action="tournament" cue="off" disabled={!canAct || !recipeStatus.unlocked} onClick={() => setState((current) => enterTournamentAction(current, recipeId, tournamentTierId))}>선택 메뉴로 출전</ActionButton>
                </section>
              </section>
    </>
  );
}
