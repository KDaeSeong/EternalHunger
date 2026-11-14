'use client';

function EffectSymbol({ kind }) {
  return <span aria-hidden="true">{kind === 'heal' ? '+' : kind === 'shield' ? '◇' : kind === 'buff' ? '↑' : '✦'}</span>;
}

export default function AutochessCombatEffects({ presentation, frameKey, duration }) {
  const { effects, casts, fallen } = presentation;
  return <>
    <svg className="ac-shots" viewBox="0 0 600 800" preserveAspectRatio="none" aria-hidden="true" style={{ '--fx-duration': duration + 'ms' }}>
      {effects.filter(fx => fx.link).map(fx => <g key={frameKey + ':' + fx.id}
        className={'ac-shot is-' + fx.kind + ' is-' + fx.from.tone} style={{ '--fx-color': fx.color }}
        data-ac-from={fx.from.uid} data-ac-to={fx.to.uid} data-ac-effect={fx.kind}>
        <line {...{ x1: fx.link.x1, y1: fx.link.y1, x2: fx.link.x2, y2: fx.link.y2 }} className="ac-shot-outline" vectorEffect="non-scaling-stroke" />
        <line {...{ x1: fx.link.x1, y1: fx.link.y1, x2: fx.link.x2, y2: fx.link.y2 }} className="ac-shot-path" vectorEffect="non-scaling-stroke" />
        <line {...{ x1: fx.link.x1, y1: fx.link.y1, x2: fx.link.x2, y2: fx.link.y2 }} className="ac-shot-tracer" pathLength="100" vectorEffect="non-scaling-stroke" />
        <polygon points={fx.link.arrow} className="ac-shot-arrow" />
      </g>)}
    </svg>
    <div className="ac-fx-layer" aria-hidden="true" style={{ '--fx-duration': duration + 'ms' }}>
      {effects.map(fx => <div key={frameKey + ':' + fx.id} className={'ac-impact-point is-' + fx.kind + ' is-' + fx.variant + (fx.to.point.y === 50 ? ' is-edge' : '')}
        style={{ left: fx.x + '%', top: fx.y + '%', '--fx-color': fx.color, '--fx-stack': fx.stack }}
        data-ac-from={fx.from.uid} data-ac-to={fx.to.uid} data-ac-effect={fx.kind}>
        <span className="ac-impact-ring" /><span className="ac-impact-spark"><EffectSymbol kind={fx.kind} /></span>
        <strong className="ac-damage-number">{fx.amountLabel}</strong>
      </div>)}
      {fallen.map(target => <span key={frameKey + ':fallen:' + target.uid} className="ac-defeat-label"
        style={{ left: target.point.x / 6 + '%', top: target.point.y / 8 + '%' }}>격파 · {target.badge} {target.name}</span>)}
      {casts.map(cast => <div key={frameKey + ':cast:' + cast.uid} className={'ac-cast-label is-' + cast.kind + (cast.point.y === 50 ? ' is-edge' : '')}
        style={{ '--fx-x': cast.point.x / 6 + '%', top: cast.point.y / 8 + '%', '--fx-color': cast.color }}
        data-ac-caster={cast.uid}>
        <EffectSymbol kind={cast.kind} />{cast.label}
      </div>)}
      {effects.filter((fx, index) => effects.findIndex(row => row.from.uid === fx.from.uid) === index).map(fx =>
        <div key={frameKey + ':source:' + fx.from.uid} className={'ac-source-ring is-' + fx.kind}
          style={{ left: fx.from.point.x / 6 + '%', top: fx.from.point.y / 8 + '%', '--fx-color': fx.color }} />)}
    </div>
  </>;
}

function ActionRow({ action }) {
  return <li className={'ac-action-row is-' + action.kind} data-ac-action={action.id}>
    <span className={'ac-action-from is-' + action.from.tone}><b>{action.from.badge}</b>{action.from.name}</span>
    <span className="ac-action-arrow" aria-label="대상">→</span>
    <span className="ac-action-targets">{action.kind === 'buff' ? '같은 진영 전체' : action.targets.map((target, index) =>
      <span className={'is-' + target.tone} key={index}><b>{target.badge}</b>{target.name} <em>{target.amountLabel}</em></span>)}</span>
    <strong>{action.label}</strong>
  </li>;
}

export function AutochessCombatFeed({ presentation }) {
  const actions = presentation.actions;
  return <section className="ac-combat-feed" aria-label="현재 공격과 스킬">
    <div className="ac-combat-feed-heading"><strong>공격·스킬 흐름</strong><span>공격자 → 대상</span></div>
    <div className="ac-effect-legend" aria-hidden="true">
      <span className="is-blue">아군 공격</span><span className="is-red">적군 공격</span><span className="is-skill">스킬</span>
      <span className="is-heal">회복</span><span className="is-shield">보호막</span><span className="is-buff">강화</span>
    </div>
    {actions.length ? <>
      <ol>{actions.slice(0, 4).map(action => <ActionRow key={action.id} action={action} />)}</ol>
      {actions.length > 4 ? <details className="ac-action-more"><summary>다른 행동 {actions.length - 4}건</summary>
        <ol>{actions.slice(4).map(action => <ActionRow key={action.id} action={action} />)}</ol></details> : null}
      <p className="ac-combat-note">피해 수치는 보호막이 흡수한 양을 포함합니다.</p>
    </> : <p className="ac-combat-note">공격·스킬이 발생하면 공격자와 대상이 여기에 표시됩니다.</p>}
  </section>;
}
