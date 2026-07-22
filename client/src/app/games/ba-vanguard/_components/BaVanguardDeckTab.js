import { SmallStat } from '../../_components/GamePlayPrimitives';
import { CardSummary, DeckEntryLine } from './BaVanguardBoard';
import { BaVanguardIconRow, BaVanguardPanelTitle } from './BaVanguardVisuals';
import { getCard } from '../_lib/baVanguardCatalog';

export default function BaVanguardDeckTab(props) {
  const {
    compositionRows,
    deck,
    deckReport,
    matchupReport,
    openingHand,
    openingStats,
    opponentValidation,
    rules,
    seed,
    summary,
    valid,
    validation,
    visibleCards,
  } = props;

  return (
    <>

      <section className="games-dashboard">
        <section className="games-panel">
          <BaVanguardPanelTitle action="inspect" title="검증" meta={valid ? '통과' : '오류 있음'} />
          <div className="games-activity-list">
            {validation.errors.length ? validation.errors.map((row) => <div key={row}><strong>{row}</strong></div>) : <div><strong>내 덱 필수 규칙 오류가 없습니다.</strong></div>}
            {validation.warnings.map((row) => <div key={row}><strong>{row}</strong></div>)}
            {opponentValidation.errors.map((row) => <div key={`opp-${row}`}><strong>AI: {row}</strong></div>)}
            {opponentValidation.warnings.map((row) => <div key={`opp-w-${row}`}><strong>AI: {row}</strong></div>)}
          </div>
        </section>

        <section className="games-panel">
          <BaVanguardPanelTitle action="hand" title="오프닝 핸드" meta={`Seed ${seed}`} />
          <div className="game-save-list">
            {openingHand.map((cardId, index) => <CardSummary cardId={cardId} key={`${cardId}-${index}`} right={`G${getCard(cardId)?.grade ?? '-'}`} />)}
          </div>
        </section>

        <section className="games-panel">
          <BaVanguardPanelTitle action="deck" title="덱 요약" meta={`${summary.mainCount}/${rules.mainSize}`} />
          <div className="games-rank-split">
            <SmallStat label="평균 파워" value={summary.averagePower.toLocaleString('ko-KR')} />
            <SmallStat label="실드 총합" value={summary.totalShield.toLocaleString('ko-KR')} />
            <SmallStat label="G3" value={summary.grade3Count} />
          </div>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>{deck.description}</p>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <BaVanguardPanelTitle
            action="analysis"
            title="매치업 실험실"
            meta={matchupReport.samples ? `${matchupReport.samples}판 자동 실험` : '대기'}
          />
          <div className="games-rank-split">
            <SmallStat label="승률" value={`${matchupReport.winRate}%`} />
            <SmallStat label="전적" value={`${matchupReport.wins}승 ${matchupReport.losses}패`} />
            <SmallStat label="평균 턴" value={matchupReport.averageTurn} />
            <SmallStat label="선공 승률" value={`${matchupReport.firstWinRate}%`} />
            <SmallStat label="후공 승률" value={`${matchupReport.secondWinRate}%`} />
            <SmallStat label="평균 피해" value={`${matchupReport.averageMeDamage}/${matchupReport.averageOppDamage}`} />
          </div>
          <div className="games-activity-list" style={{ marginTop: 12 }}>
            {matchupReport.recommendations.map((row) => (
              <div key={row}><strong>{row}</strong></div>
            ))}
          </div>
          {matchupReport.rows.length ? (
            <div className="game-save-list" style={{ marginTop: 12 }}>
              {matchupReport.rows.slice(0, 4).map((row) => (
                <BaVanguardIconRow action="match" key={row.index}>
                  <div>
                    <span>{row.first === 'me' ? '내 선공' : 'AI 선공'} · {row.turn}턴</span>
                    <strong>{row.winner === 'me' ? '승리' : row.winner === 'opp' ? '패배' : '미결'}</strong>
                    <small>피해 {row.meDamage}/{row.oppDamage} · 덱 {row.meDeck}/{row.oppDeck}</small>
                  </div>
                  <strong>#{row.index}</strong>
                </BaVanguardIconRow>
              ))}
            </div>
          ) : null}
        </section>

        <section className="games-panel">
          <BaVanguardPanelTitle action="tactics" title="덱 분석" meta={`${openingStats.samples}회 샘플`} />
          <div className="games-rank-split">
            <SmallStat label="G1 확보" value={`${openingStats.grade1Rate}%`} />
            <SmallStat label="G2 확보" value={`${openingStats.grade2Rate}%`} />
            <SmallStat label="G3 확보" value={`${openingStats.grade3Rate}%`} />
            <SmallStat label="라인 완성" value={`${openingStats.rideLineRate}%`} />
          </div>
          <div className="games-rank-split" style={{ marginTop: 12 }}>
            <SmallStat label="센티넬" value={`${openingStats.sentinelRate}%`} />
            <SmallStat label="평균 트리거" value={openingStats.triggerAverage} />
            <SmallStat label="평균 실드" value={openingStats.shieldAverage.toLocaleString('ko-KR')} />
            <SmallStat label="평균 파워" value={openingStats.powerAverage.toLocaleString('ko-KR')} />
          </div>
          <div className="games-activity-list" style={{ marginTop: 12 }}>
            {deckReport.recommendations.map((row) => (
              <div key={row}><strong>{row}</strong></div>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <BaVanguardPanelTitle action="cards" title="구성표" meta={`${compositionRows.length}개 묶음`} />
          <div className="game-save-list">
            {compositionRows.map((row) => (
              <BaVanguardIconRow action="cards" key={row.key}>
                <div>
                  <span>{row.label}</span>
                  <strong>{row.count}장</strong>
                  <small>평균 파워 {row.averagePower.toLocaleString('ko-KR')} · 실드 합계 {row.shieldTotal.toLocaleString('ko-KR')}</small>
                </div>
                <strong>{row.zoneLabel}</strong>
              </BaVanguardIconRow>
            ))}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <BaVanguardPanelTitle action="deck" title="메인 덱" meta={`${summary.mainCount}장`} />
          <div className="game-save-list">
            {deck.main.map((entry) => <DeckEntryLine cardId={entry.cardId} count={entry.count} key={entry.cardId} />)}
          </div>
        </section>

        <section className="games-panel">
          <BaVanguardPanelTitle action="vanguard-stride" title="G존" meta={`${summary.gCount}장`} />
          <div className="game-save-list">
            {deck.gzone.map((entry) => <DeckEntryLine cardId={entry.cardId} count={entry.count} key={entry.cardId} />)}
          </div>
        </section>

        <section className="games-panel">
          <BaVanguardPanelTitle action="library" title="카드 라이브러리" meta={`${visibleCards.length}장`} />
          <div className="game-save-list">
            {visibleCards.map((card) => <CardSummary cardId={card.id} key={card.id} />)}
          </div>
        </section>
      </section>
    </>
  );
}
