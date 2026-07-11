import {
  ActionButton,
  GameControlButton,
} from '../../_components/GamePlayPrimitives';

export default function PrimitiveArchiveProjectsPanel({
  canAct,
  projectEstimate,
  projects = [],
  runProject,
  selectProject,
  selectedProject,
}) {
  const completed = projects.filter((project) => project.completed).length;
  return (
    <section className="games-panel primitive-projects-panel">
      <div className="games-panel-title">
        <div>
          <h2>부족 공동 프로젝트</h2>
          <span>한 번에 하나의 장기 사업에 행동력을 투자합니다.</span>
        </div>
        <strong>{completed}/{projects.length} 완성</strong>
      </div>

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
          <ActionButton
            action="project"
            cue="project"
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
        </div>
      ) : <div className="games-empty">현재 진행 가능한 부족 프로젝트가 없습니다.</div>}

      <div className="primitive-project-list">
        {projects.map((project) => (
          <article className={`${project.selected ? 'is-selected' : ''}${project.completed ? ' is-complete' : ''}`} key={project.id}>
            <div>
              <span>{project.statusLabel} · {project.progress}/{project.work}</span>
              <strong>{project.name}</strong>
              <small>{project.effectText}</small>
            </div>
            <GameControlButton
              action={project.completed ? 'complete' : 'target'}
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
