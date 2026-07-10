import {
  ActionButton,
  SmallStat,
} from '../../_components/GamePlayPrimitives';
import {
  claimSeasonRewardsAction,
} from '../_lib/schaleIdleEngine';

export default function SchaleIdleSeasonTab(props) {
  const {
    rows,
    seasonReport,
    seasonRewards,
    setState,
  } = props;

  return (
    <>
        <section className="games-detail-grid">
          <section className="games-panel">
            <div className="games-panel-title">
              <h2>시즌 운영</h2>
              <span>{seasonReport.headline}</span>
            </div>
            <div className="games-rank-split" style={{ marginBottom: 12 }}>
              <SmallStat label="시즌" value={seasonReport.seasonId} />
              <SmallStat label="진행도" value={`${seasonReport.seasonPct}%`} />
              <SmallStat label="일차" value={`${seasonReport.seasonDay}/${seasonReport.seasonLengthDays}`} />
              <SmallStat label="남은 기간" value={`${seasonReport.daysLeft}일`} />
              <SmallStat label="상태" value={seasonReport.riskLabel} />
            </div>
            <div className="game-save-list">
              {seasonReport.tracks.map((track) => (
                <article className="game-save-row" key={track.id}>
                  <div>
                    <span>{track.phase} · {track.pct}% · {track.priority === 'high' ? '우선' : track.priority === 'low' ? '보류' : '권장'}</span>
                    <strong>{track.title}</strong>
                    <small>{track.detail}</small>
                  </div>
                  <strong>{track.status === 'complete' ? '완료' : track.status === 'close' ? '근접' : track.action}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>시즌 보상</h2>
              <span>{seasonRewards.headline}</span>
            </div>
            <div className="games-rank-split" style={{ marginBottom: 12 }}>
              <SmallStat label="수령" value={`${seasonRewards.claimedCount}/${seasonRewards.totalCount}`} />
              <SmallStat label="대기" value={`${seasonRewards.claimableCount}개`} />
              <SmallStat label="시즌 진행" value={`${seasonRewards.seasonPct}%`} />
            </div>
            <ActionButton
              action="claim"
              disabled={!seasonRewards.claimableCount}
              onClick={() => setState((current) => claimSeasonRewardsAction(current))}
            >
              {seasonRewards.claimableCount ? `${seasonRewards.claimableCount}개 수령` : '수령 없음'}
            </ActionButton>
            <div className="game-save-list" style={{ marginTop: 12 }}>
              {seasonRewards.rows.map((reward) => (
                <article className="game-save-row" key={reward.id}>
                  <div>
                    <span>{reward.target}% 보상 · {reward.pct}% · {reward.status === 'claimed' ? '수령 완료' : reward.status === 'ready' ? '수령 가능' : '잠김'}</span>
                    <strong>{reward.name}</strong>
                    <small>{reward.desc} · {reward.rewardText}</small>
                  </div>
                  <strong>{reward.status === 'claimed' ? '완료' : reward.status === 'ready' ? '수령' : `${reward.target}%`}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>장기 밸런스</h2>
              <span>{seasonReport.balanceRows.filter((row) => row.tone === 'warn').length ? '점검 필요' : '안정'}</span>
            </div>
            <div className="game-save-list">
              {seasonReport.balanceRows.map((row) => (
                <article className="game-save-row" key={row.id}>
                  <div>
                    <span>{row.tone === 'warn' ? '경고' : row.tone === 'good' ? '양호' : '관찰'}</span>
                    <strong>{row.label} · {row.value}</strong>
                    <small>{row.detail}</small>
                  </div>
                  <strong>{row.tone === 'warn' ? '점검' : 'OK'}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>시즌 추천</h2>
              <span>{seasonReport.seasonName}</span>
            </div>
            <div className="game-save-list">
              {seasonReport.recommendations.map((line, index) => (
                <article className="game-save-row" key={`${line}-${index}`}>
                  <div>
                    <span>{index + 1}순위</span>
                    <strong>{line}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
                </>
  );
}
