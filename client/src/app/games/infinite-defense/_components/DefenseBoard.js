'use client';

import { ENEMY_TYPES, MAP, PADS, ROUTE, STUDENTS } from '../_lib/infiniteDefenseData.js';
import { pointAt, studentStats } from '../_lib/infiniteDefenseEngine.js';

export default function DefenseBoard({ state, selectedId, onPad, disabled }) {
  const selected = studentStats(state, selectedId);
  const selectedPad = PADS.find(p => p.id === state.assignments[selectedId].padId);
  return (
    <div className="defense-map" aria-label="방어 지도">
      <svg viewBox="0 0 12 8" role="img" aria-label="적 진입로와 학생 방어 범위">
        <defs>
          <pattern id="defense-grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#ffffff" strokeOpacity=".055" strokeWidth=".025" />
          </pattern>
          <linearGradient id="defense-ground" x2="1" y2="1">
            <stop stopColor="#122d3d" /><stop offset="1" stopColor="#183c49" />
          </linearGradient>
        </defs>
        <rect width="12" height="8" fill="url(#defense-ground)" />
        <rect width="12" height="8" fill="url(#defense-grid)" />
        <g fill="#2d6270" opacity=".65">
          <path d="M .6 5.8 l .25 -.5 .3 .45 -.25 .55 z M 1.3 6.2 l .2 -.35 .2 .3 -.2 .4 z" />
          <path d="M 9.3 6.7 l .25 -.5 .3 .45 -.25 .55 z M 10 6.3 l .2 -.35 .2 .3 -.2 .4 z" />
          <path d="M 5.2 .5 l .25 -.4 .3 .35 -.25 .45 z" />
        </g>
        <polyline points={ROUTE.map(p => p.x + ',' + p.y).join(' ')} fill="none" stroke="#091e2a" strokeWidth=".9" strokeLinejoin="round" />
        <polyline points={ROUTE.map(p => p.x + ',' + p.y).join(' ')} fill="none" stroke="#47626b" strokeWidth=".66" strokeLinejoin="round" />
        <polyline points={ROUTE.map(p => p.x + ',' + p.y).join(' ')} fill="none" stroke="#7da5ac" strokeWidth=".025" strokeDasharray=".13 .18" />
        <text x=".25" y=".63" fill="#a8d9df" fontSize=".22" letterSpacing=".06">ENEMY ENTRY</text>
        <g transform="translate(11.35,2.5)">
          <path d="M -.3 -.4 L .3 -.4 L .4 .15 L 0 .5 L -.4 .15 Z" fill="#69d7c9" stroke="#b9fff3" strokeWidth=".035" />
          <path d="M -.14 -.16 L .14 -.16 L .14 .13 L -.14 .13 Z" fill="#173f4b" />
        </g>
        {selectedPad ? <circle cx={selectedPad.x} cy={selectedPad.y} r={selected.range} fill={selected.color} fillOpacity=".07" stroke={selected.color} strokeWidth=".025" strokeDasharray=".08 .09" /> : null}
        {state.effects.map(fx => <line key={fx.id} x1={fx.from.x} y1={fx.from.y} x2={fx.to.x} y2={fx.to.y} stroke={fx.color} strokeWidth=".055" opacity=".8" />)}
        {state.enemies.map(enemy => {
          const p = pointAt(enemy.distance), type = ENEMY_TYPES[enemy.type], size = enemy.type === 'boss' ? .36 : .18;
          return (
            <g key={enemy.id} transform={'translate(' + p.x + ',' + p.y + ')'}>
              {type.shape === 'square' ? <rect x={-size} y={-size} width={size * 2} height={size * 2} rx=".03" fill={type.color} />
                : type.shape === 'diamond' ? <path d={'M 0 ' + -size + ' L ' + size + ' 0 L 0 ' + size + ' L ' + -size + ' 0 Z'} fill={type.color} />
                : type.shape === 'triangle' ? <path d={'M 0 ' + -size + ' L ' + size + ' ' + size + ' L ' + -size + ' ' + size + ' Z'} fill={type.color} />
                : <circle r={size} fill={type.color} stroke={enemy.type === 'boss' ? '#ffd6df' : 'none'} strokeWidth=".06" />}
              <rect x={-size - .04} y={-size - .14} width={(size + .04) * 2} height=".065" rx=".025" fill="#122a35" />
              <rect x={-size - .04} y={-size - .14} width={(size + .04) * 2 * Math.max(0, enemy.hp / enemy.maxHp)} height=".065" rx=".025" fill={enemy.slowUntil > state.elapsed ? '#8cc9ff' : '#83ead1'} />
            </g>
          );
        })}
      </svg>
      {PADS.map((pad, i) => {
        const occupant = STUDENTS.find(s => state.assignments[s.id].mode === 'defend' && state.assignments[s.id].padId === pad.id);
        return (
          <button key={pad.id} type="button"
            className={'defense-pad' + (occupant ? ' is-occupied' : '') + (occupant?.id === selectedId ? ' is-selected' : '')}
            style={{ left: pad.x / MAP.width * 100 + '%', top: pad.y / MAP.height * 100 + '%', '--unit-color': occupant?.color || '#77c6c8' }}
            aria-label={occupant ? (i + 1) + '번 거점 ' + occupant.name + ' 선택' : (i + 1) + '번 거점에 ' + selected.name + ' 배치'}
            disabled={disabled || (!occupant && !state.assignments[selectedId].paid && state.coins < selected.cost)}
            onClick={() => onPad(pad.id, occupant?.id)}>
            <span aria-hidden="true">{occupant ? occupant.name : '+'}</span>
            <small>{occupant ? '화력 +' + state.assignments[occupant.id].power : i + 1}</small>
          </button>
        );
      })}
      <div className="defense-map-key"><span><i />방어 거점</span><span>선택한 학생의 사거리가 지도에 표시됩니다.</span></div>
    </div>
  );
}
