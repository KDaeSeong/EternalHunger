import GameActionIcon from '../../_components/GameActionIcon';

export default function TonkatsuMethodStrip({ rows = [], compact = false }) {
  if (!rows.length) return <div className="games-empty">표시할 조리 공정이 없습니다.</div>;

  return (
    <div className={`tonkatsu-method-strip${compact ? ' is-compact' : ''}`}>
      {rows.map((row) => (
        <article className={`tonkatsu-method-row${row.selected ? ' is-selected' : ''}`} key={row.id}>
          <div className="tonkatsu-method-row__head">
            <span className="tonkatsu-method-row__identity">
              <GameActionIcon action={row.action} label={row.name} />
              <strong>{row.name}</strong>
            </span>
            <span className="tonkatsu-method-row__tools">
              <span>Lv.{row.level}</span>
              <button
                type="button"
                className="tonkatsu-method-sound"
                data-game-sfx={row.action}
                aria-label={`${row.name} 효과음 미리 듣기`}
                title={`${row.name} 효과음 미리 듣기`}
              >
                <GameActionIcon action="audio" label={`${row.name} 효과음`} />
              </button>
            </span>
          </div>
          <small>{row.effectText} · 기본 성공 {Math.round((1 - Number(row.baseFailPct || 0)) * 100)}%</small>
          <div className="tonkatsu-method-progress" aria-label={`${row.name} 숙련 ${row.progressPct}%`}>
            <span style={{ width: `${row.progressPct}%` }} />
          </div>
          <em>{row.masteryText}</em>
        </article>
      ))}
    </div>
  );
}
