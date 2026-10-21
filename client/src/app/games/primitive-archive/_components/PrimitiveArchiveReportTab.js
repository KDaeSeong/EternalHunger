import {
  SmallStat,
} from '../../_components/GamePlayPrimitives';
import GameActionIcon from '../../_components/GameActionIcon';
import { PrimitiveArchivePanelTitle } from './PrimitiveArchiveVisuals';

const CHAPTER_ICONS = Object.freeze({
  survival: 'survival',
  research: 'research',
  facilities: 'archive',
  books: 'guide',
  exploration_events: 'discover',
  party: 'formation',
});

export default function PrimitiveArchiveReportTab(props) {
  const {
    archiveReport,
    state,
  } = props;

  return (
    <>

          <section className="games-detail-grid primitive-report-workspace">
            <section className="games-panel">
              <PrimitiveArchivePanelTitle
                action={archiveReport.status === 'complete' ? 'primitive-victory' : 'archive'}
                title={archiveReport.title}
                meta={`${archiveReport.grade}등급 · ${archiveReport.archiveScore}%`}
              />
              <p className="primitive-run-management__note">런 완주 여부는 기초 목표와 완성·종료 선택으로 결정됩니다. 아래 등급과 기술·제도 진척은 별도 기록이며, 후기 근대까지 모두 마칠 필요는 없습니다. 런 관리에서 시대별 진척을 확인할 수 있습니다.</p>
              <div className="games-rank-split">
                <SmallStat icon="target" label="목표" value={`${archiveReport.objectivePct}%`} />
                <SmallStat icon="title" label="점수" value={archiveReport.score.toLocaleString('ko-KR')} />
                <SmallStat icon="status" label="상태" value={archiveReport.status === 'complete' ? '완성' : archiveReport.status === 'ready' ? '완성 가능' : archiveReport.status === 'settled' ? '정산' : '진행'} />
                <SmallStat icon="calendar" label="생존일" value={`Day ${state.day}`} />
                <SmallStat icon="event" label="탐험 사건" value={`${archiveReport.recordSummary.eventCount || 0}회`} />
                <SmallStat icon="discover" label="희귀 소재" value={`${archiveReport.recordSummary.rareResourceTotal || 0}개`} />
              </div>
              <div className="game-save-list" style={{ marginTop: 12 }}>
                {archiveReport.handoff.map((line, index) => (
                  <article className="game-save-row game-save-row--icon" key={`${line}-${index}`}>
                    <GameActionIcon action="guide" label={`인계 ${index + 1}`} />
                    <div>
                      <span>인계 {index + 1}</span>
                      <strong>{line}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="games-panel">
              <PrimitiveArchivePanelTitle
                action="guide"
                title="분야별 진행 기록"
                meta={`${archiveReport.chapters.filter((chapter) => chapter.status === '완성').length}/${archiveReport.chapters.length}`}
              />
              <div className="game-save-list">
                {archiveReport.chapters.map((chapter) => (
                  <article className="game-save-row game-save-row--icon" key={chapter.id}>
                    <GameActionIcon action={CHAPTER_ICONS[chapter.id] || 'archive'} label={chapter.title} />
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
              <PrimitiveArchivePanelTitle action="archive" title="전적 요약" meta="서버 저장·전적에 남기는 정보" />
              <div className="games-rank-split">
                <SmallStat icon="research" label="연구" value={`${archiveReport.recordSummary.researchPct}%`} />
                <SmallStat icon="survival" label="생존" value={`${archiveReport.recordSummary.survivalPct}%`} />
                <SmallStat icon="event" label="사건" value={`${archiveReport.recordSummary.eventPct || 0}%`} />
                <SmallStat icon="status" label="안정도" value={`${archiveReport.recordSummary.stabilityPct}%`} />
                <SmallStat icon="complete" label="완성" value={archiveReport.recordSummary.victory ? '예' : '아니오'} />
              </div>
              <div className="games-empty" style={{ textAlign: 'left', marginTop: 12 }}>
                기록서 핵심값은 런 저장과 전적 기록의 summary에 함께 들어갑니다.
              </div>
            </section>
          </section>
                </>
  );
}
