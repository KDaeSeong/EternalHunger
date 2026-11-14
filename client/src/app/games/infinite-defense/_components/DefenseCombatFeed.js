'use client';

const TRAITS={splash:'광역',pierce:'관통',slow:'둔화',precision:'정밀'};
export default function DefenseCombatFeed({ presentation }) {
  const actions=presentation.actions;
  return <section className="defense-combat-feed" aria-label="현재 공격과 고유 효과">
    <div><strong>공격·스킬 흐름</strong><span>캐릭터 → 표적</span></div>
    {actions.length?<ol>{actions.slice(0,4).map(action=><li key={action.id}>
      <b>{action.name}</b><span aria-hidden="true">→</span><span>{action.target}{action.count>1?' 외 '+(action.count-1)+'기':''}</span>
      <strong>{action.mine?'생산 지원':action.damage?'−'+action.damage:'명중'}</strong>
      <small>{action.label}{action.traits.length?' · '+action.traits.map(trait=>TRAITS[trait]).join('·'):''}</small>
    </li>)}</ol>:<p>공격이 발생하면 피해량과 광역·관통·둔화 효과가 표시됩니다.</p>}
  </section>;
}
