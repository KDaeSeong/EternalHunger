'use client';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function groupByTeam(actors) {
  const map = new Map();
  safeArray(actors).forEach((actor) => {
    const teamId = String(actor?.teamId || actor?._id || '');
    if (!teamId) return;
    const prev = map.get(teamId) || {
      teamId,
      name: String(actor?.teamName || actor?.squadName || `팀 ${teamId.slice(-4)}`),
      alive: 0,
      credits: 0,
      members: [],
    };
    prev.alive += 1;
    prev.credits += Math.max(0, Number(actor?.simCredits || 0));
    prev.members.push(actor);
    map.set(teamId, prev);
  });
  return [...map.values()].sort((a, b) => b.alive - a.alive || b.credits - a.credits);
}

function getObjectiveSummary(spawnState) {
  const state = spawnState && typeof spawnState === 'object' ? spawnState : {};
  const coreNodes = safeArray(state.coreNodes).filter((x) => x && !x.picked);
  const crates = safeArray(state.legendaryCrates).filter((x) => x && !x.opened);
  const transcendCrates = safeArray(state.transcendCrates).filter((x) => x && !x.opened);
  const rifts = safeArray(state.dimensionRifts).filter((x) => x && x.active !== false && !x.resolved);
  const bosses = state.bosses && typeof state.bosses === 'object' ? state.bosses : {};
  return {
    meteor: coreNodes.filter((x) => String(x.kind) === 'meteor').length,
    lifeTree: coreNodes.filter((x) => String(x.kind) === 'life_tree').length,
    legendaryCrates: crates.length,
    transcendCrates: transcendCrates.length,
    rifts: rifts.length,
    bosses: ['alpha', 'omega', 'weakline', 'gamma'].filter((key) => bosses?.[key]?.alive).length,
  };
}

function dangerCount(survivors, forbiddenNow) {
  const forbidden = forbiddenNow instanceof Set ? forbiddenNow : new Set(safeArray(forbiddenNow).map(String));
  return safeArray(survivors).filter((actor) => {
    const hp = Number(actor?.hp ?? actor?.maxHp ?? 100);
    const maxHp = Math.max(1, Number(actor?.maxHp || 100));
    const detonation = Number(actor?.detonationSec);
    return hp / maxHp <= 0.35 || forbidden.has(String(actor?.zoneId || '')) || (Number.isFinite(detonation) && detonation <= 8);
  }).length;
}

export default function SimulationMatchStatusPanel({
  day,
  phase,
  matchSec,
  survivors,
  dead,
  killCounts,
  activeMap,
  zones,
  forbiddenNow,
  spawnState,
  getZoneName,
}) {
  const alive = safeArray(survivors);
  const fallen = safeArray(dead);
  const teams = groupByTeam(alive);
  const topTeams = teams.slice(0, 4);
  const objective = getObjectiveSummary(spawnState);
  const forbiddenCount = forbiddenNow instanceof Set ? forbiddenNow.size : safeArray(forbiddenNow).length;
  const zoneTotal = safeArray(activeMap?.zones).length || safeArray(zones).length;
  const danger = dangerCount(alive, forbiddenNow);
  const topKillers = alive
    .map((actor) => ({ actor, kills: Number(killCounts?.[actor?._id] || 0) }))
    .filter((x) => x.kills > 0)
    .sort((a, b) => b.kills - a.kills)
    .slice(0, 3);

  return (
    <section className="match-status-panel" aria-label="경기 현황">
      <div className="match-status-head">
        <div>
          <p className="match-status-eyebrow">경기 현황</p>
          <h2>{day > 0 ? `${day}일차 ${phase === 'morning' ? '낮' : '밤'}` : '게임 준비'}</h2>
        </div>
        <div className="match-status-clock">{matchSec || '00:00'}</div>
      </div>

      <div className="match-status-metrics">
        <div><span>생존</span><strong>{alive.length}</strong></div>
        <div><span>탈락</span><strong>{fallen.length}</strong></div>
        <div><span>생존 팀</span><strong>{teams.length}</strong></div>
        <div><span>위험</span><strong className={danger > 0 ? 'danger' : ''}>{danger}</strong></div>
        <div><span>금지</span><strong>{forbiddenCount}/{zoneTotal || 0}</strong></div>
      </div>

      <div className="match-status-grid">
        <div className="match-status-card">
          <h3>상위 팀</h3>
          {topTeams.length ? topTeams.map((team) => (
            <div key={team.teamId} className="match-status-row">
              <span>{team.name}</span>
              <strong>{team.alive}명 · {team.credits}Cr</strong>
            </div>
          )) : <p>팀 정보 없음</p>}
        </div>

        <div className="match-status-card">
          <h3>오브젝트</h3>
          <div className="match-status-row"><span>운석 / 생명의 나무</span><strong>{objective.meteor} / {objective.lifeTree}</strong></div>
          <div className="match-status-row"><span>보급 상자</span><strong>{objective.legendaryCrates} / {objective.transcendCrates}</strong></div>
          <div className="match-status-row"><span>차원의 틈 / 보스</span><strong>{objective.rifts} / {objective.bosses}</strong></div>
        </div>

        <div className="match-status-card">
          <h3>킬 흐름</h3>
          {topKillers.length ? topKillers.map(({ actor, kills }) => (
            <div key={actor?._id} className="match-status-row">
              <span>{actor?.name || '-'}</span>
              <strong>{kills}킬 · {getZoneName?.(actor?.zoneId) || actor?.zoneId || '-'}</strong>
            </div>
          )) : <p>아직 처치 기록이 없습니다.</p>}
        </div>
      </div>
    </section>
  );
}
