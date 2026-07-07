import { ActionButton, SmallStat } from '../../_components/GamePlayPrimitives';
import {
  runJudgeBatchAction,
  startJudgeMatchAction,
} from '../_lib/tonkatsuTeacherEngine';

export default function TonkatsuJudgeTab(props) {
  const {
    canAct,
    judge,
    judgeBatchCount,
    judgeBatchMode,
    judgeTierId,
    setJudgePick,
    setJudgeText,
    setState,
  } = props;

  return (
    <>
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>심사 빠른 실행</h2>
                    <span>{judge.rank}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="심사" value={judge.judged} />
                    <SmallStat label="정답" value={judge.correct} />
                    <SmallStat label="정확도" value={`${judge.accuracy}%`} />
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton disabled={!canAct} onClick={() => {
                      setJudgePick('A');
                      setJudgeText('');
                      setState((current) => startJudgeMatchAction(current, judgeTierId));
                    }}>새 심사 매치</ActionButton>
                    <ActionButton disabled={!canAct} onClick={() => setState((current) => runJudgeBatchAction(current, judgeTierId, judgeBatchCount, judgeBatchMode))}>자동 심사 실행</ActionButton>
                  </div>
                </section>
              </section>
    </>
  );
}
