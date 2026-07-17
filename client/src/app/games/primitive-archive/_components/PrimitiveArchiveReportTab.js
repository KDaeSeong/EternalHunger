import {
  SmallStat,
} from '../../_components/GamePlayPrimitives';

export default function PrimitiveArchiveReportTab(props) {
  const {
    archiveReport,
    state,
  } = props;

  return (
    <>

          <section className="games-detail-grid primitive-report-workspace">
            <section className="games-panel">
              <div className="games-panel-title">
                <h2>{archiveReport.title}</h2>
                <span>{archiveReport.grade}등급 · {archiveReport.archiveScore}%</span>
              </div>
              <div className="games-rank-split">
                <SmallStat label="목표" value={`${archiveReport.objectivePct}%`} />
                <SmallStat label="점수" value={archiveReport.score.toLocaleString('ko-KR')} />
                <SmallStat label="상태" value={archiveReport.status === 'complete' ? '완성' : archiveReport.status === 'ready' ? '완성 가능' : archiveReport.status === 'settled' ? '정산' : '진행'} />
                <SmallStat label="생존일" value={`Day ${state.day}`} />
                <SmallStat label="탐험 사건" value={`${archiveReport.recordSummary.eventCount || 0}회`} />
                <SmallStat label="희귀 소재" value={`${archiveReport.recordSummary.rareResourceTotal || 0}개`} />
              </div>
              <div className="game-save-list" style={{ marginTop: 12 }}>
                {archiveReport.handoff.map((line, index) => (
                  <article className="game-save-row" key={`${line}-${index}`}>
                    <div>
                      <span>인계 {index + 1}</span>
                      <strong>{line}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="games-panel">
              <div className="games-panel-title">
                <h2>아카이브 챕터</h2>
                <span>{archiveReport.chapters.filter((chapter) => chapter.status === '완성').length}/{archiveReport.chapters.length}</span>
              </div>
              <div className="game-save-list">
                {archiveReport.chapters.map((chapter) => (
                  <article className="game-save-row" key={chapter.id}>
                    <div>
                      <span>{chapter.status} · {chapter.pct}%</span>
                      <strong>{chapter.title}</strong>
                      <small>{chapter.detail}</small>
                    </div>
                    <strong>{chapter.pct >= 100 ? 'OK' : '진행'}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="games-panel">
              <div className="games-panel-title">
                <h2>전적 요약</h2>
                <span>저장/전적 payload</span>
              </div>
              <div className="games-rank-split">
                <SmallStat label="연구" value={`${archiveReport.recordSummary.researchPct}%`} />
                <SmallStat label="생존" value={`${archiveReport.recordSummary.survivalPct}%`} />
                <SmallStat label="사건" value={`${archiveReport.recordSummary.eventPct || 0}%`} />
                <SmallStat label="안정도" value={`${archiveReport.recordSummary.stabilityPct}%`} />
                <SmallStat label="완성" value={archiveReport.recordSummary.victory ? '예' : '아니오'} />
              </div>
              <div className="games-empty" style={{ textAlign: 'left', marginTop: 12 }}>
                기록서 핵심값은 런 저장과 전적 기록의 summary에 함께 들어갑니다.
              </div>
            </section>
          </section>
                </>
  );
}
