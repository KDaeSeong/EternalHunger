import Link from 'next/link';
import { ActionButton, GameControlButton } from '../../_components/GamePlayPrimitives';
import {
  completeArchiveAction,
  difficultyRows,
  settleRunAction,
} from '../_lib/primitiveArchiveEngine';
import {
  FALLBACK_DIFFICULTY_TAGS,
  multiplierText,
  startInventoryText,
} from '../_lib/primitiveArchivePageRuntime';

export default function PrimitiveArchiveRunTab(props) {
  const {
    applyAction,
    archiveVictory,
    busy,
    currentDifficulty,
    hydrated,
    newRunDifficulty,
    recordRun,
    selectedDifficulty,
    setNewRunDifficulty,
    startNewRun,
    token,
  } = props;

  return (
    <section className="games-panel primitive-run-management" role="tabpanel">
      <div className="games-panel-title">
        <div>
          <h2>런 관리</h2>
          <span>현재 {currentDifficulty.label} · 다음 {selectedDifficulty.label}</span>
        </div>
        <strong>난이도는 새 런부터 적용</strong>
      </div>

      <div className="primitive-difficulty-grid">
        {difficultyRows().map((row) => (
          <button
            type="button"
            key={row.key}
            className={`primitive-difficulty-card${newRunDifficulty === row.key ? ' is-active' : ''}`}
            data-game-sfx="select"
            onClick={() => setNewRunDifficulty(row.key)}
            aria-pressed={newRunDifficulty === row.key}
          >
            <span className="primitive-difficulty-card__head">
              <strong>{row.label}</strong>
              <em>{row.startLabel || FALLBACK_DIFFICULTY_TAGS[row.key] || '시작'}</em>
            </span>
            <small>{row.recommendation || row.desc}</small>
            <span className="primitive-difficulty-card__stats">
              AP {row.apMax} · 허기 {multiplierText(row.hungerMultiplier)} · 추위 {multiplierText(row.coldMultiplier)} · 점수 {multiplierText(row.scoreMultiplier)}
            </span>
            <span className="primitive-difficulty-card__rule">{row.ruleSummary || row.desc}</span>
            <span className="primitive-difficulty-card__loadout">시작 보급: {startInventoryText(row)}</span>
          </button>
        ))}
      </div>

      <div className="primitive-run-management__actions">
        <ActionButton action="new" onClick={startNewRun}>{selectedDifficulty.label}으로 새 런</ActionButton>
        <GameControlButton action="archive" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>
          {busy === 'record' ? '기록 중...' : '런 기록'}
        </GameControlButton>
        <GameControlButton
          action="complete"
          onClick={() => applyAction('아카이브 완성', (current) => completeArchiveAction(current))}
          disabled={!archiveVictory.canComplete}
        >
          아카이브 완성
        </GameControlButton>
        <GameControlButton action="settle" onClick={() => applyAction('런 정산', (current) => settleRunAction(current))}>런 정산</GameControlButton>
        <Link href="/myanime/primitive-archive">게임 상세</Link>
      </div>

      {!token && hydrated ? (
        <p className="primitive-run-management__note">플레이는 가능하지만 저장·불러오기·전적 기록은 로그인 후 사용할 수 있습니다.</p>
      ) : null}
    </section>
  );
}
