import Link from 'next/link';
import { ActionButton, GameControlButton } from '../../_components/GamePlayPrimitives';
import {
  completeArchiveAction,
  difficultyRows,
  runRecordStatus,
  settleRunAction,
} from '../_lib/primitiveArchiveEngine';
import {
  FALLBACK_DIFFICULTY_TAGS,
  multiplierText,
  startInventoryText,
} from '../_lib/primitiveArchivePageRuntime';
import { PrimitiveArchivePanelTitle } from './PrimitiveArchiveVisuals';

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
    state,
    token,
  } = props;
  const recordStatus = runRecordStatus(state);
  const persistenceBusy = Boolean(busy);
  const runEnded = Boolean(state?.ended);
  const runSettled = Boolean(state?.runId) && state.meta?.lastSettledRunId === state.runId;

  return (
    <section className="games-panel primitive-run-management" role="tabpanel">
      <PrimitiveArchivePanelTitle
        action="settings"
        title="런 관리"
        meta={`현재 ${currentDifficulty.label} · 다음 ${selectedDifficulty.label}`}
      >
        <strong>난이도는 새 런부터 적용</strong>
      </PrimitiveArchivePanelTitle>

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
              AP {row.apMax} · 허기 {multiplierText(row.hungerMultiplier)} · 추위 {multiplierText(row.coldMultiplier)} · 성공 {Number(row.actionChanceBonus || 0) > 0 ? `+${Math.round(Number(row.actionChanceBonus) * 100)}%p` : '기본'} · 점수 {multiplierText(row.scoreMultiplier)}
            </span>
            <span className="primitive-difficulty-card__rule">{row.ruleSummary || row.desc}</span>
            <span className="primitive-difficulty-card__loadout">시작 보급: {startInventoryText(row)}</span>
          </button>
        ))}
      </div>

      <div className="primitive-run-management__actions">
        <ActionButton action="new" onClick={startNewRun} disabled={persistenceBusy}>{selectedDifficulty.label}으로 새 런</ActionButton>
        <GameControlButton
          action="archive"
          onClick={() => void recordRun()}
          disabled={!hydrated || !token || persistenceBusy || !recordStatus.canRecord}
          title={recordStatus.reason}
        >
          {busy === 'record' ? '기록 중...' : '런 기록'}
        </GameControlButton>
        <GameControlButton
          action="complete"
          onClick={() => applyAction('아카이브 완성', (current) => completeArchiveAction(current))}
          disabled={!archiveVictory.canComplete || persistenceBusy || runEnded}
          title={persistenceBusy ? '저장 작업이 끝난 뒤 완료할 수 있습니다.' : undefined}
        >
          아카이브 완성
        </GameControlButton>
        <GameControlButton
          action="settle"
          onClick={() => applyAction('런 정산', (current) => settleRunAction(current))}
          disabled={persistenceBusy || runSettled || archiveVictory.victory}
          title={persistenceBusy
            ? '저장 작업이 끝난 뒤 정산할 수 있습니다.'
            : runSettled
              ? '이미 정산한 런입니다.'
              : runEnded
                ? '종료된 런의 특전 보상을 정산합니다.'
                : '미완성 상태로 런을 종료하고 특전 보상을 정산합니다.'}
        >
          {runEnded ? '런 보상 정산' : '런 정산·종료'}
        </GameControlButton>
        <Link href="/myanime/primitive-archive">게임 상세</Link>
      </div>

      <p className="primitive-run-management__note" role="status">
        런 상태: {recordStatus.label}. {recordStatus.reason}
        {runEnded && !runSettled && !archiveVictory.victory
          ? ' 특전 보상은 런 보상 정산을 눌러 받으세요. 전적 기록과는 별개입니다.'
          : null}
      </p>
      {!token && hydrated ? (
        <p className="primitive-run-management__note">플레이는 가능하지만 저장·불러오기·전적 기록은 로그인 후 사용할 수 있습니다.</p>
      ) : null}
    </section>
  );
}
