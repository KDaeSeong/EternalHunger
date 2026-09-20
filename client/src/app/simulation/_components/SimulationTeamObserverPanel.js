'use client';

export default function SimulationTeamObserverPanel({ model, onTeamChange, isGameOver }) {
  if (!model.team) return <section className="team-observer-panel">참가자를 준비하고 있습니다.</section>;
  return (
    <section className="team-observer-panel" aria-label="팀 관전">
      <label className="team-observer-select">
        <span>관전 팀</span>
        <select value={model.team.id} onChange={(event) => onTeamChange(event.target.value)}>
          {model.teams.map((team) => <option key={team.id} value={team.id}>{team.name} · 생존 {team.alive}/{team.members.length}</option>)}
        </select>
      </label>
      <div className="team-observer-heading">
        <h2>{model.team.name} · {model.status}</h2>
        <p>{model.summary}</p>
        <small>지도에서 고유 팀 색·번호로 구분 · 관전 팀에는 금색 외곽선 추가 · 선택은 경기 판단에 영향을 주지 않음</small>
        <small>지역 내부 위치는 축약 표시 · 원작 지형의 축척이 아님</small>
      </div>
      <div className="team-observer-members">
        {model.members.map((actor) => (
          <article key={actor.id} className={`team-observer-member ${actor.alive ? '' : 'fallen'}`} aria-label={`${actor.name} 관전 상태`}>
            <header><strong>{actor.name}</strong><span>{actor.alive ? `HP ${actor.hp}/${actor.maxHp}` : '사망'}</span></header>
            <p>{actor.zone} · {actor.kills}처치 / {actor.assists}어시스트</p>
            {actor.alive ? <>
              {actor.spatial ? <p>{actor.spatial}</p> : null}
              {!isGameOver && actor.motion ? <p className="team-observer-reason">{actor.motion}</p> : null}
              {!isGameOver && actor.hunt ? <p className="team-observer-reason">{actor.hunt}</p> : null}
              {!isGameOver && actor.casting ? <p className="team-observer-reason">{actor.casting}</p> : null}
              {!isGameOver && actor.armed ? <p className="team-observer-reason">{actor.armed}</p> : null}
              <p>목표 장비 확보 {actor.hasGoals ? actor.progress : '목표 미설정'}{actor.readyIn > 0 && !isGameOver ? ` · 다음 행동까지 ${actor.readyIn}초` : ''}</p>
              {actor.decision ? <p className="team-observer-reason"><time>{actor.decision.clock}</time> 최근 판단: {actor.decision.text}</p> : <p className="team-observer-reason">아직 판단 기록이 없습니다.</p>}
            </> : <p className="team-observer-reason">{actor.death}</p>}
            <details><summary>장비와 성장 목표</summary><p>{actor.equipment}</p>{actor.goal ? <p>미확보 목표: {actor.goal}</p> : null}</details>
          </article>
        ))}
      </div>
      <details className="team-observer-events" open={isGameOver || undefined}>
        <summary>{isGameOver ? '이 팀의 마지막 주요 사건' : '이 팀의 최근 사건'}</summary>
        <p><small>{model.historyNote}</small></p>
        {(isGameOver ? model.turningPoints : model.recent).length ? <ol>
          {(isGameOver ? model.turningPoints : model.recent).map((row) => <li key={row.key}><time>{row.clock}</time> {row.text}</li>)}
        </ol> : <p>아직 해당 팀의 사건 기록이 없습니다.</p>}
      </details>
    </section>
  );
}
