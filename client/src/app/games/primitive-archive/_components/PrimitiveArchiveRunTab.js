import Link from 'next/link';
import { ActionButton, GameControlButton } from '../../_components/GamePlayPrimitives';
import {
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
import { archiveProgressionSummary } from '../_lib/primitiveArchiveProgression';
import { archiveAccountRewardPreview } from '../_lib/primitiveArchiveAccountRewards';

export default function PrimitiveArchiveRunTab(props) {
  const {
    applyAction,
    archiveVictory,
    busy,
    completeRun,
    currentDifficulty,
    hydrated,
    newRunDifficulty,
    recordRun,
    selectedDifficulty,
    setActiveTabId,
    setNewRunDifficulty,
    startNewRun,
    state,
    token,
  } = props;
  const recordStatus = runRecordStatus(state);
  const persistenceBusy = Boolean(busy);
  const runEnded = Boolean(state?.ended);
  const runSettled = Boolean(state?.runId) && state.meta?.lastSettledRunId === state.runId;
  const progression = archiveProgressionSummary(state, archiveVictory);
  const advancementCompleted = progression.longTerm.rows.reduce((sum, row) => sum + row.completed, 0);
  const advancementTotal = progression.longTerm.rows.reduce((sum, row) => sum + row.total, 0);
  const accountReward = archiveAccountRewardPreview(state);
  return (
    <section className="games-panel primitive-run-management" role="tabpanel">
      <PrimitiveArchivePanelTitle
        action="settings"
        title="런 관리"
        meta={`현재 ${currentDifficulty.label} · 다음 ${selectedDifficulty.label}`}
      >
        <strong>난이도는 새 런부터 적용</strong>
      </PrimitiveArchivePanelTitle>

      <div className="primitive-progression-goals">
        <section className="primitive-progression-goal" aria-label={progression.basic.title}>
          <h3>{progression.basic.title}</h3>
          <strong>{runEnded
            ? progression.basic.victory ? '기초 완주로 런 종료' : '기초 완주 없이 런 종료'
            : progression.basic.canComplete ? '기초 완주 가능' : `${progression.basic.completed}/${progression.basic.total} 목표 달성`}</strong>
          <p>{progression.basic.description}</p>
          <small>더 높은 시대의 기술·제도를 모두 마칠 필요는 없습니다.</small>
        </section>
        <section className="primitive-progression-goal" aria-label={progression.longTerm.title}>
          <h3>{progression.longTerm.title} · 선택 목표</h3>
          <p>{progression.longTerm.description}</p>
          <GameControlButton
            action="research"
            onClick={() => setActiveTabId?.('growth')}
            disabled={!hydrated || persistenceBusy || runEnded}
            title={runEnded ? '종료된 런에서는 추가 발전을 진행할 수 없습니다.' : '발전 탭으로 이동합니다. AP나 시간은 소모하지 않습니다.'}
          >
            문명 발전 계속
          </GameControlButton>
          <details className="primitive-progression-eras">
            <summary>시대별 발전 보기 · {advancementCompleted}/{advancementTotal}</summary>
            <p>이 표의 학술 진입은 해당 시대 항목 1개 이상 완료, 시대 항목 완료는 그 시대의 기술·제도를 모두 완료한 상태입니다.</p>
            <ul>
              {progression.longTerm.rows.map((row) => (
                <li key={row.id}>
                  <strong>{row.label}</strong>
                  <span>{row.completed}/{row.total} · {row.complete ? '시대 항목 완료' : row.entered ? '학술 진입' : '연구 완료 전'}</span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      </div>

      <section className="primitive-progression-goals" aria-label="완주 보상">
        <div className="primitive-progression-goal">
          <h3>기초 완주 보상</h3>
          <strong>{accountReward.basic.lp.toLocaleString('ko-KR')} LP · {accountReward.basic.credits.toLocaleString('ko-KR')} 크레딧</strong>
          <p>완주·런 종료 후 로그인하여 ‘런 기록·보상 받기’를 누르면 계정에 지급됩니다. 게임 안의 특전 포인트와는 별개입니다.</p>
        </div>
        <div className="primitive-progression-goal">
          <h3>발전 전체 완료 후 완주</h3>
          <strong>총 {accountReward.full.lp.toLocaleString('ko-KR')} LP · {accountReward.full.credits.toLocaleString('ko-KR')} 크레딧</strong>
          <p>기술·사회 제도 {accountReward.completed}/{accountReward.total} 완료. 기초 완주로 런을 종료하기 전에 전체 발전을 마쳐야 합니다. 기초 보상이 포함된 총액입니다.</p>
        </div>
        <p className="primitive-run-management__note">
          {accountReward.excluded
            ? '개발자 보정을 사용한 런은 특전 포인트·LP·크레딧 보상에서 제외됩니다.'
            : `같은 런은 한 번만 지급됩니다. 계정당 하루 최대 ${accountReward.dailyLimit.lp.toLocaleString('ko-KR')} LP · ${accountReward.dailyLimit.credits.toLocaleString('ko-KR')} 크레딧이며, 한도에 걸린 기록은 다음 날 다시 청구할 수 있습니다.`}
          {runSettled ? ` 이번 런의 특전 포인트: +${Number(state.meta?.lastAward || 0).toLocaleString('ko-KR')}.` : ' 특전 포인트는 런 종료·정산 때 이 기기의 다음 런용으로 지급됩니다.'}
        </p>
      </section>

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
          {busy === 'record' ? '기록 중...' : '런 기록·보상 받기'}
        </GameControlButton>
        <GameControlButton
          action="complete"
          onClick={completeRun}
          disabled={!hydrated || !archiveVictory.canComplete || persistenceBusy || runEnded || typeof completeRun !== 'function'}
          title={persistenceBusy ? '저장 작업이 끝난 뒤 완료할 수 있습니다.' : '기초 완주로 현재 런을 종료하고 보상을 정산합니다.'}
        >
          기초 아카이브 완성·런 종료
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
        <p className="primitive-run-management__note">로그인 없이 플레이하며 이 기기에 자동 저장하고 직전 런을 복구할 수 있습니다. 저장 상태는 상단 안내에서 확인하세요. 서버 저장·서버 불러오기·전적 기록은 로그인 후 사용할 수 있습니다.</p>
      ) : null}
    </section>
  );
}
