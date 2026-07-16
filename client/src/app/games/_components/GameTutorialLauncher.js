'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import GameActionIcon from './GameActionIcon';
import { GameControlButton } from './GamePlayPrimitives';
import GameSoundControl from './GameSoundControl';
import useGameSfx from '../_lib/useGameSfx';
import { gameAudioThemeForPath } from '../_lib/gameAudioThemes';
import { getGameTutorialForPath } from '../_lib/gameTutorials';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

function progressStorageKey(slug) {
  return `eh_game_tutorial_v1:${slug}`;
}

function readStoredProgress(slug, stepCount) {
  if (!slug || typeof window === 'undefined') return 0;
  try {
    return clamp(Number(window.localStorage.getItem(progressStorageKey(slug)) || 0), 0, stepCount);
  } catch {
    return 0;
  }
}

function writeStoredProgress(slug, value) {
  if (!slug || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(progressStorageKey(slug), String(value));
  } catch {
    // Tutorial progress must not block gameplay when storage is unavailable.
  }
}

export default function GameTutorialLauncher() {
  const pathname = usePathname();
  const tutorial = getGameTutorialForPath(pathname);
  const audioTheme = tutorial?.theme || gameAudioThemeForPath(pathname);
  const titleId = useId();
  const closeButtonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const playGameSfx = useGameSfx({ theme: audioTheme || 'default', volume: 0.13 });

  const steps = tutorial?.steps || [];
  const lastIndex = Math.max(0, steps.length - 1);
  const safeStepIndex = clamp(stepIndex, 0, lastIndex);
  const currentStep = steps[safeStepIndex];
  const complete = steps.length > 0 && completedCount >= steps.length;
  const progressPct = steps.length ? Math.round((completedCount / steps.length) * 100) : 0;

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        playGameSfx('click');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, playGameSfx]);

  if (!tutorial || !steps.length) {
    return audioTheme ? (
      <div className="game-tutorial-root game-utility-dock">
        <GameSoundControl theme={audioTheme} />
      </div>
    ) : null;
  }

  const openTutorial = () => {
    const saved = readStoredProgress(tutorial.slug, steps.length);
    setCompletedCount(saved);
    setStepIndex(saved >= steps.length ? lastIndex : saved);
    setOpen(true);
    playGameSfx('select');
  };

  const closeTutorial = () => {
    setOpen(false);
    playGameSfx('click');
  };

  const selectStep = (index) => {
    setStepIndex(clamp(index, 0, lastIndex));
    playGameSfx('select');
  };

  const resetTutorial = () => {
    setCompletedCount(0);
    setStepIndex(0);
    writeStoredProgress(tutorial.slug, 0);
    playGameSfx('warning');
  };

  const goPrevious = () => {
    setStepIndex((current) => clamp(current - 1, 0, lastIndex));
    playGameSfx('nav');
  };

  const goNext = () => {
    if (complete) {
      closeTutorial();
      return;
    }
    const nextCompleted = Math.max(completedCount, safeStepIndex + 1);
    setCompletedCount(nextCompleted);
    writeStoredProgress(tutorial.slug, nextCompleted);
    if (safeStepIndex < lastIndex) {
      setStepIndex(safeStepIndex + 1);
      playGameSfx('advance');
      return;
    }
    playGameSfx('complete');
  };

  return (
    <div className="game-tutorial-root game-utility-dock">
      <GameSoundControl theme={audioTheme} />
      <button
        type="button"
        className="game-tutorial-launcher"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`${tutorial.title} 열기`}
        onClick={openTutorial}
      >
        <GameActionIcon action="guide" label="튜토리얼" />
        <span>튜토리얼</span>
        {completedCount > 0 ? <strong>{progressPct}%</strong> : null}
      </button>

      {open ? (
        <div className="game-tutorial-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeTutorial();
        }}>
          <section
            className="game-tutorial-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <header className="game-tutorial-header">
              <div>
                <span>{tutorial.subtitle} · {tutorial.estimatedTime}</span>
                <h2 id={titleId}>{tutorial.title}</h2>
                <p>{tutorial.goal}</p>
              </div>
              <button
                type="button"
                className="game-tutorial-close"
                aria-label="튜토리얼 닫기"
                title="닫기"
                onClick={closeTutorial}
                ref={closeButtonRef}
              >
                <GameActionIcon action="close" />
              </button>
            </header>

            <div className="game-tutorial-progress" aria-label={`튜토리얼 진행률 ${progressPct}%`}>
              <div>
                <span>{complete ? '완료' : `STEP ${safeStepIndex + 1}`}</span>
                <strong>{completedCount}/{steps.length} · {progressPct}%</strong>
              </div>
              <div className="game-tutorial-progress__track">
                <span style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <nav className="game-tutorial-step-nav" aria-label="튜토리얼 단계">
              {steps.map((step, index) => (
                <button
                  type="button"
                  className={index === safeStepIndex ? 'is-active' : index < completedCount ? 'is-complete' : ''}
                  aria-current={index === safeStepIndex ? 'step' : undefined}
                  title={`${index + 1}. ${step.title}`}
                  onClick={() => selectStep(index)}
                  key={step.id}
                >
                  {index + 1}
                </button>
              ))}
            </nav>

            <article className="game-tutorial-step">
              <span>{currentStep.label}</span>
              <h3>{currentStep.title}</h3>
              <p>{currentStep.detail}</p>
              <dl>
                <div>
                  <dt>해볼 행동</dt>
                  <dd>{currentStep.action}</dd>
                </div>
                <div>
                  <dt>완료 확인</dt>
                  <dd>{currentStep.check}</dd>
                </div>
              </dl>
            </article>

            <div className="game-tutorial-notes">
              <section>
                <strong>기억할 점</strong>
                <ul>
                  {(tutorial.remember || []).map((line) => <li key={line}>{line}</li>)}
                </ul>
              </section>
              <section className="is-warning">
                <strong>피해야 할 실수</strong>
                <ul>
                  {(tutorial.avoid || []).map((line) => <li key={line}>{line}</li>)}
                </ul>
              </section>
            </div>

            <footer className="game-tutorial-footer">
              <GameControlButton action="reset" onClick={resetTutorial}>처음부터</GameControlButton>
              <div>
                <GameControlButton action="pass" disabled={safeStepIndex === 0} onClick={goPrevious}>이전</GameControlButton>
                <GameControlButton action={complete || safeStepIndex === lastIndex ? 'complete' : 'advance'} onClick={goNext}>
                  {complete ? '튜토리얼 닫기' : safeStepIndex === lastIndex ? '완료' : '다음'}
                </GameControlButton>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
