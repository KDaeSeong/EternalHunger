import { SmallStat } from '../../_components/GamePlayPrimitives';
import { SIDE_LABELS } from '../_lib/baVanguardCatalog';
import { BaVanguardIconRow, BaVanguardPanelTitle } from './BaVanguardVisuals';

export default function BaVanguardTacticsTab(props) {
  const {
    duel,
    me,
    opp,
    tacticalReport,
    tacticalTone,
  } = props;

  return (
    <>
      <section className="games-dashboard">
        <section className="games-panel">
          <BaVanguardPanelTitle action="advisor" title="현재 판단" meta={`${tacticalReport.phase} · ${SIDE_LABELS[tacticalReport.active]}`} />
          <section className={`tcg-event-callout is-${tacticalTone}`}>
            <span>{tacticalReport.riskLabel}</span>
            <strong>{tacticalReport.headline}</strong>
            <p>
              준비도 {tacticalReport.readinessPct}% · 데미지 차이 {tacticalReport.damageDelta >= 0 ? '+' : ''}{tacticalReport.damageDelta}
              {' · '}
              필드 {tacticalReport.fieldDelta >= 0 ? '+' : ''}{tacticalReport.fieldDelta}
            </p>
          </section>
          <div className="games-rank-split">
            <SmallStat label="내 데미지" value={`${tacticalReport.playerDamage}/6`} />
            <SmallStat label="AI 데미지" value={`${tacticalReport.enemyDamage}/6`} />
            <SmallStat label="내 덱" value={tacticalReport.playerDeck} />
            <SmallStat label="AI 덱" value={tacticalReport.enemyDeck} />
            <SmallStat label="파워 차이" value={tacticalReport.powerDelta >= 0 ? `+${tacticalReport.powerDelta}` : tacticalReport.powerDelta} />
            <SmallStat label="총 실드" value={tacticalReport.shield.totalShield.toLocaleString('ko-KR')} />
          </div>
        </section>

        <section className="games-panel">
          <BaVanguardPanelTitle action="tactics" title="추천 행동" meta={tacticalReport.recommendedAction} />
          <div className="game-save-list">
            {tacticalReport.recommendations.map((item, index) => (
              <BaVanguardIconRow action="target" key={item.id}>
                <div>
                  <span>{item.priority === 'high' ? '우선' : item.priority === 'low' ? '후순위' : '검토'} · {index + 1}</span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
                <strong>{item.priority}</strong>
              </BaVanguardIconRow>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <BaVanguardPanelTitle action="guard" title="방어 자원" meta={`센티넬 ${tacticalReport.shield.sentinels}장`} />
          <div className="games-rank-split">
            <SmallStat label="총 실드" value={tacticalReport.shield.totalShield.toLocaleString('ko-KR')} />
            <SmallStat label="센티넬" value={tacticalReport.shield.sentinels} />
            <SmallStat label="트리거" value={tacticalReport.shield.triggers} />
            <SmallStat label="일반 유닛" value={tacticalReport.shield.normalUnits} />
          </div>
          {tacticalReport.guard ? (
            <div className="games-activity-list" style={{ marginTop: 12 }}>
              <div>
                <strong>가드 필요량 {tacticalReport.guard.guardNeeded.toLocaleString('ko-KR')}</strong>
                <span>
                  공격 {tacticalReport.guard.attackPower.toLocaleString('ko-KR')} · 기본 방어 {tacticalReport.guard.baseDefense.toLocaleString('ko-KR')} · 현재 실드 {tacticalReport.guard.currentShield.toLocaleString('ko-KR')}
                </span>
              </div>
              <div>
                <strong>{tacticalReport.guard.perfectGuard ? '퍼펙트 가드 적용됨' : '퍼펙트 가드 미적용'}</strong>
                <span>가용 패 실드 {tacticalReport.guard.availableShield.toLocaleString('ko-KR')}</span>
              </div>
            </div>
          ) : (
            <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
              방어 창이 열리면 필요한 실드와 가용 방어 자원을 여기서 계산합니다.
            </p>
          )}
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <BaVanguardPanelTitle action="attack" title="공격 후보" meta={`${tacticalReport.attackCandidates.length}라인`} />
          <div className="game-save-list">
            {tacticalReport.attackCandidates.length ? tacticalReport.attackCandidates.map((row) => (
              <BaVanguardIconRow action="attack" key={row.circle}>
                <div>
                  <span>{row.circle} · 부스트 {row.boostPower.toLocaleString('ko-KR')}</span>
                  <strong>{row.cardName}</strong>
                </div>
                <strong>{row.power.toLocaleString('ko-KR')}</strong>
              </BaVanguardIconRow>
            )) : (
              <BaVanguardIconRow action="warning">
                <div>
                  <span>공격 후보 없음</span>
                  <strong>배틀 페이즈나 스탠드 상태를 확인하세요.</strong>
                </div>
                <strong>-</strong>
              </BaVanguardIconRow>
            )}
          </div>
        </section>

        <section className="games-panel">
          <BaVanguardPanelTitle
            action="board"
            title="현재 전장 요약"
            meta={duel.winner ? `${SIDE_LABELS[duel.winner]} 승리` : `${SIDE_LABELS[duel.active]} 차례`}
          />
          <div className="games-rank-split">
            <SmallStat label="내 패" value={me.hand.length} />
            <SmallStat label="AI 패" value={opp.hand.length} />
            <SmallStat label="내 드롭" value={me.drop.length} />
            <SmallStat label="AI 드롭" value={opp.drop.length} />
            <SmallStat label="내 G존" value={me.gzone.length} />
            <SmallStat label="AI G존" value={opp.gzone.length} />
          </div>
        </section>
      </section>
    </>
  );
}
