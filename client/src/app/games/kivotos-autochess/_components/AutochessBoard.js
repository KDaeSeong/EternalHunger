'use client';

import OfficialStudentIcon from '../../_components/OfficialStudentIcon';
import { ACADEMIES, BOARD, STUDENT_BY_ID } from '../_lib/autochessData.js';
import { battleTeam, compactFrame } from '../_lib/autochessCombat.js';

export default function AutochessBoard({ player, opponent, watch, frameIndex, selectedUid, onCell, editable, onUnitPointerDown, draggingUid, dropKey }) {
  const preview = watch ? null : compactFrame(0, [...battleTeam(player, 0), ...(opponent ? battleTeam(opponent, 1) : [])], []);
  const frame = watch ? watch.frames[Math.min(frameIndex, watch.frames.length - 1)] : preview;
  const units = frame?.[1] || [], effects = frame?.[2] || [];
  const ownedAt = (x, y) => player.units.find(u => u.position.kind === 'field' && u.position.x === x && u.position.y === y - 4);
  return (
    <div className="ac-board" aria-label="6열 8행 전장">
      <div className="ac-grid">
        {Array.from({ length: 48 }, (_, index) => {
          const x = index % BOARD.cols, y = Math.floor(index / BOARD.cols), unit = y >= 4 ? ownedAt(x, y) : null;
          const targetKey = 'field:' + x + ':' + (y - 4);
          return y >= 4 && !watch ? (
            <button key={index} type="button" className={'ac-cell is-home' + (selectedUid && selectedUid === unit?.uid ? ' is-selected' : '') + (draggingUid && draggingUid === unit?.uid ? ' is-drag-source' : '') + (dropKey === targetKey ? ' is-drop-target' : '')}
              data-ac-drop={editable ? targetKey : undefined} data-ac-unit={editable ? unit?.uid : undefined}
              onPointerDown={event => onUnitPointerDown?.(event, unit)} draggable={false} aria-describedby="ac-placement-help"
              disabled={!editable} aria-pressed={Boolean(unit && selectedUid === unit.uid)} aria-label={'아군 전장 ' + (y - 3) + '행 ' + (x + 1) + '열' + (unit ? ' · ' + STUDENT_BY_ID[unit.studentId].name : ' · 빈칸')}
              onClick={() => onCell(x, y - 4, unit?.uid)} />
          ) : <div key={index} className={'ac-cell' + (y >= 4 ? ' is-home' : ' is-away')} />;
        })}
      </div>
      <div className="ac-midline" aria-hidden="true"><span>FRONT LINE</span></div>
      {units.filter(a => a[5] > 0).map(a => {
        const student = STUDENT_BY_ID[a[1]], academy = ACADEMIES[student.academy];
        return (
          <div key={a[0]} className={'ac-fighter' + (a[2] === 1 ? ' is-enemy' : '') + (selectedUid === a[0] ? ' is-selected' : '') + (draggingUid === a[0] ? ' is-drag-source' : '')}
            style={{ left: (a[3] + .5) / BOARD.cols * 100 + '%', top: (a[4] + .5) / BOARD.rows * 100 + '%', '--academy-color': academy.color }}
            aria-label={student.name + ' ' + a[9] + '성 · 체력 ' + a[5] + '/' + a[6]}>
            <div className="ac-fighter-portrait"><OfficialStudentIcon id={a[1]} /></div>
            <div className="ac-stars">{'★'.repeat(a[9])}</div>
            <strong>{student.name}</strong>
            <div className="ac-fighter-hp"><i style={{ width: a[5] / a[6] * 100 + '%' }} /></div>
            <div className="ac-fighter-mana"><i style={{ width: a[7] + '%' }} /></div>
            {a[8] > 0 ? <span className="ac-shield-mark" title="보호막">◇</span> : null}
          </div>
        );
      })}
      {watch ? <svg className="ac-shots" viewBox="0 0 6 8" preserveAspectRatio="none" aria-hidden="true">
        {effects.map((fx, i) => {
          const from = units.find(a => a[0] === fx[0]), to = units.find(a => a[0] === fx[1]);
          if (!from || !to) return null;
          return <line key={i} x1={from[3] + .5} y1={from[4] + .5} x2={to[3] + .5} y2={to[4] + .5}
            stroke={fx[2] === 'heal' ? '#5ccba8' : fx[2] === 'shield' ? '#83adff' : fx[2] === 'skill' ? '#efb357' : '#a7bcc7'} strokeWidth={fx[2] === 'skill' ? '.055' : '.025'} opacity=".9" />;
        })}
      </svg> : null}
      <span className="ac-board-side is-away">{watch ? watch.right.name : opponent?.name || '상대 진영'}</span><span className="ac-board-side is-home">{watch ? watch.left.name : '아군 진영'}</span>
    </div>
  );
}
