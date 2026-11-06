import {
  ActionButton,
  GameControlButton,
  RecentActionResult,
} from '../../_components/GamePlayPrimitives';
import { PrimitiveArchivePanelTitle } from './PrimitiveArchiveVisuals';

export default function PrimitiveArchiveProjectsPanel({
  actionFeedback,
  busy = false,
  canAct,
  ended = false,
  hydrated = false,
  projectEstimate,
  projectTradition,
  projects = [],
  recentActionText,
  reserveProjectTradition,
  runProject,
  selectProject,
  selectedProject,
}) {
  const completed = projects.filter((project) => project.completed).length;
  const traditionRecords = projectTradition?.records || [];
  const selectedTraditionRecords = traditionRecords.filter((record) => record.projectId === selectedProject?.id);
  const processingPending = projectTradition?.pending?.kind === 'processing';
  const processingSettlement = projectTradition?.lastSettlement?.kind === 'processing';
  const canReserveTradition = hydrated && !busy && !ended && projectTradition?.enabled && projectTradition?.canReserve
    && typeof reserveProjectTradition === 'function';
  const traditionBlockedText = !hydrated ? '진행 기록 확인이 끝난 뒤 예약할 수 있습니다.'
    : busy ? '저장 또는 진행 보호 작업 중에는 예약할 수 없습니다.'
      : ended ? '종료된 런에서는 전승을 예약할 수 없습니다.' : projectTradition?.reason || '';
  return (
    <section className="games-panel primitive-projects-panel">
      <PrimitiveArchivePanelTitle
        action="primitive-project"
        title="부족 공동 프로젝트"
        meta="한 번에 하나의 장기 사업에 행동력을 투자합니다."
      >
        <strong>{completed}/{projects.length} 완성</strong>
      </PrimitiveArchivePanelTitle>

      {selectedProject ? (
        <div className={`primitive-project-focus${selectedProject.completed ? ' is-complete' : ''}`}>
          <div className="primitive-project-focus__head">
            <div>
              <span>{selectedProject.statusLabel} · {selectedProject.costText}</span>
              <strong>{selectedProject.name}</strong>
              <small>{selectedProject.description}</small>
            </div>
            <b>{selectedProject.progress}/{selectedProject.work}</b>
          </div>
          <div className="primitive-project-progress" aria-label={`프로젝트 진행도 ${selectedProject.progressPct}%`}>
            <i style={{ width: `${selectedProject.progressPct}%` }} />
          </div>
          <div className="primitive-project-focus__effect">
            <span>{selectedProject.effectText}</span>
            <span>이번 작업 +{projectEstimate?.work || 0} · ST {projectEstimate?.staminaCost || 0}</span>
          </div>
          {projectTradition ? (
            <section className="primitive-project-tradition" aria-label="선택 사업의 전승">
              <details className="primitive-project-tradition__details">
                <summary><strong>공동 건설 전승</strong><span title={projectTradition.pending ? projectTradition.pendingText : projectTradition.summaryText}>{projectTradition.pending ? projectTradition.pendingText : projectTradition.summaryText}</span></summary>
                <div className="primitive-project-tradition__body">
                  <dl>
                    <div><dt>현재 전승</dt><dd>{projectTradition.founderName || '활성 전승 없음'} · 개인 제작과 공유하는 남은 횟수 {projectTradition.availableCharges}</dd></div>
                    <div><dt>대상 사업</dt><dd>{projectTradition.selectedProjectName || '선택된 사업 없음'}</dd></div>
                    {projectTradition.evidenceText ? <div><dt>전승의 근거</dt><dd>{projectTradition.evidenceText}</dd></div> : null}
                    <div><dt>비용·조건</dt><dd>{projectTradition.costText}</dd></div>
                    <div><dt>예약 효과</dt><dd>{projectTradition.effectText}</dd></div>
                    <div><dt>{processingPending ? '현재 공유 예약 · 가공대' : '현재 예약'}</dt><dd>{projectTradition.pendingText || '현재 예약 없음'}</dd></div>
                    <div><dt>{processingSettlement ? '최근 공유 예약 정산 · 가공대' : '최근 실제 정산'}</dt><dd>{projectTradition.lastSettlementText || '실제 전승 정산 기록 없음'}</dd></div>
                  </dl>
                  {projectTradition.pending && !processingPending && projectTradition.pending.projectId !== projectTradition.selectedProjectId ? (
                    <div className="primitive-project-tradition__warning">현재 선택 사업이 예약 대상과 다릅니다. 다음 아침에도 다르면 추가 전승 없이 만료되며 이월·환급되지 않습니다.</div>
                  ) : null}
                  {selectedTraditionRecords.length ? (
                    <div aria-label="선택 사업의 실제 전승 기록">
                      <strong>사업에 남은 실제 전승</strong>
                      <ul className="primitive-project-tradition-records">
                        {selectedTraditionRecords.map((record) => <li key={record.founderId}>{record.text}</li>)}
                      </ul>
                      <small>실제 공동 건설에 적용된 전승 기록입니다. 기존 사업의 완성 효과는 별도로 유지합니다.</small>
                    </div>
                  ) : null}
                  <div className="primitive-project-tradition__reserve">
                    <GameControlButton action="primitive-project" cue="off" disabled={!canReserveTradition}
                      title={canReserveTradition ? projectTradition.costText : traditionBlockedText}
                      onClick={() => { if (canReserveTradition) reserveProjectTradition(); }}>
                      다음 아침 건설에 전승 예약
                    </GameControlButton>
                    {!canReserveTradition && traditionBlockedText ? <small>{traditionBlockedText}</small> : null}
                  </div>
                </div>
              </details>
            </section>
          ) : null}
          <ActionButton
            action="project"
            cue="off"
            disabled={!canAct || !selectedProject.canWork || selectedProject.completed}
            onClick={runProject}
          >
            {selectedProject.completed
              ? '프로젝트 완성'
              : !selectedProject.available
                ? `${selectedProject.missingPrereqs.join(', ')} 연구 필요`
                : !selectedProject.hasCost
                  ? '프로젝트 자재 부족'
                  : selectedProject.committed
                    ? '공동 작업 진행'
                    : '자재 투입 후 착수'}
          </ActionButton>
          <RecentActionResult
            action={actionFeedback?.action || 'primitive-project'}
            label={actionFeedback?.label || '최근 프로젝트 결과'}
            text={recentActionText}
            tone={actionFeedback?.tone || 'ready'}
          />
        </div>
      ) : <div className="games-empty">현재 진행 가능한 부족 프로젝트가 없습니다.</div>}

      <div className="primitive-project-list">
        {projects.map((project) => (
          <article className={`${project.selected ? 'is-selected' : ''}${project.completed ? ' is-complete' : ''}`} key={project.id}>
            <div>
              <span>{project.statusLabel} · {project.progress}/{project.work}</span>
              <strong>{project.name}</strong>
              <small>{project.effectText}</small>
              {project.completed && traditionRecords.some((record) => record.projectId === project.id) ? (
                <ul className="primitive-project-tradition-records" aria-label={`${project.name}의 실제 전승 기록`}>
                  {traditionRecords.filter((record) => record.projectId === project.id)
                    .map((record) => <li key={record.founderId}>{record.text}</li>)}
                </ul>
              ) : null}
            </div>
            <GameControlButton
              action={project.completed ? 'complete' : 'target'}
              cue="off"
              disabled={project.completed || !project.available || project.selected}
              onClick={() => selectProject?.(project.id)}
            >
              {project.completed ? '완성' : !project.available ? '잠김' : project.selected ? '진행 중' : '지정'}
            </GameControlButton>
          </article>
        ))}
      </div>
    </section>
  );
}
