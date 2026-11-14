'use client';

import OfficialStudentIcon from '../../_components/OfficialStudentIcon';
import { ACADEMIES, BOARD, STUDENT_BY_ID } from '../_lib/autochessData.js';
import { battleTeam, compactFrame } from '../_lib/autochessCombat.js';
import { boardTeamsFor } from '../_lib/autochessBoardTeams.js';
import { combatPresentation } from '../_lib/autochessCombatEffects.js';
import AutochessCombatEffects, { AutochessCombatFeed } from './AutochessCombatEffects';

export default function AutochessBoard({ player, opponent, watch, frameIndex, selectedUid, onCell, editable, onUnitPointerDown, draggingUid, dropKey, effectDuration = 400 }) {
  const teams = boardTeamsFor(player, opponent, watch);
  const preview = watch ? null : compactFrame(0, [...battleTeam(player, 0), ...(opponent ? battleTeam(opponent, 1) : [])], []);
  const frame = watch ? watch.frames[Math.min(frameIndex, watch.frames.length - 1)] : preview;
  const units = frame?.[1] || [];
  const combat = watch ? combatPresentation(frame, teams) : null;
  const frameKey = watch ? watch.round + ':' + watch.left.id + ':' + watch.right.id + ':' + frameIndex : '';
  const ownedAt = (x, y) => player.units.find(u => u.position.kind === 'field' && u.position.x === x && u.position.y === y - 4);
  return (
    <div className="ac-arena">
      <div className="ac-team-legend" id="ac-team-legend" aria-label="진영 구분">
        {[1, 0].map(side => <div key={side} className={'is-' + teams[side].tone} data-ac-team={teams[side].relation}>
          <b aria-hidden="true">{side === 1 ? '↑' : '↓'}</b>
          <span><strong>{teams[side].caption}</strong><small title={teams[side].name}>{teams[side].name}</small></span>
        </div>)}
      </div>
      <div className="ac-board" aria-label="6열 8행 전장" aria-describedby="ac-team-legend">
      <div className="ac-grid">
        {Array.from({ length: 48 }, (_, index) => {
          const x = index % BOARD.cols, y = Math.floor(index / BOARD.cols), unit = y >= 4 ? ownedAt(x, y) : null;
          const targetKey = 'field:' + x + ':' + (y - 4);
          return y >= 4 && !watch ? (
            <button key={index} type="button" className={'ac-cell is-home is-' + teams[0].tone + (selectedUid && selectedUid === unit?.uid ? ' is-selected' : '') + (draggingUid && draggingUid === unit?.uid ? ' is-drag-source' : '') + (dropKey === targetKey ? ' is-drop-target' : '')}
              data-ac-drop={editable ? targetKey : undefined} data-ac-unit={editable ? unit?.uid : undefined}
              onPointerDown={event => onUnitPointerDown?.(event, unit)} draggable={false} aria-describedby="ac-placement-help"
              disabled={!editable} aria-pressed={Boolean(unit && selectedUid === unit.uid)} aria-label={'아군 전장 ' + (y - 3) + '행 ' + (x + 1) + '열' + (unit ? ' · ' + STUDENT_BY_ID[unit.studentId].name : ' · 빈칸')}
              onClick={() => onCell(x, y - 4, unit?.uid)} />
          ) : <div key={index} className={'ac-cell ' + (y >= 4 ? 'is-home is-' + teams[0].tone : 'is-away is-' + teams[1].tone)} />;
        })}
      </div>
      <div className="ac-midline" aria-hidden="true"><span>전선</span></div>
      {units.filter(a => a[5] > 0).map(a => {
        const student = STUDENT_BY_ID[a[1]], academy = ACADEMIES[student.academy], team = teams[a[2]];
        return (
          <div key={a[0]} className={'ac-fighter is-' + team.tone + (team.relation === 'enemy' ? ' is-enemy' : '') + (selectedUid === a[0] ? ' is-selected' : '') + (draggingUid === a[0] ? ' is-drag-source' : '')}
            style={{ left: (a[3] + .5) / BOARD.cols * 100 + '%', top: (a[4] + .5) / BOARD.rows * 100 + '%', '--academy-color': academy.color }}
            data-ac-team={team.relation} data-ac-side={a[2]}
            aria-label={team.badge + ' ' + student.name + ' ' + a[9] + '성 · 체력 ' + a[5] + '/' + a[6]}>
            <div className="ac-fighter-portrait"><OfficialStudentIcon id={a[1]} /></div>
            <div className="ac-stars">{'★'.repeat(a[9])}</div>
            <strong><span className="ac-team-badge" aria-hidden="true">{team.badge}</span>{student.name}</strong>
            <div className="ac-fighter-hp"><i style={{ width: a[5] / a[6] * 100 + '%' }} /></div>
            <div className="ac-fighter-mana"><i style={{ width: a[7] + '%' }} /></div>
            {a[8] > 0 ? <span className="ac-shield-mark" title="보호막">◇</span> : null}
          </div>
        );
      })}
      {combat ? <AutochessCombatEffects presentation={combat} frameKey={frameKey} duration={effectDuration} /> : null}
      <span className={'ac-board-side is-away is-' + teams[1].tone} aria-hidden="true">{teams[1].label}</span><span className={'ac-board-side is-home is-' + teams[0].tone} aria-hidden="true">{teams[0].label}</span>
      </div>
      {combat ? <AutochessCombatFeed presentation={combat} /> : null}
    </div>
  );
}
