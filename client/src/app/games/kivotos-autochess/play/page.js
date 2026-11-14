'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuthToken, useAuthUser, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell from '../../_components/GamePlayShell';
import { GameControlButton } from '../../_components/GamePlayPrimitives';
import { CHARACTER_ORIGINS } from '../../_lib/crossoverCharacters.js';
import OfficialStudentIcon from '../../_components/OfficialStudentIcon';
import AutochessBoard from '../_components/AutochessBoard';
import useAutochessSession from '../_hooks/useAutochessSession';
import useAutochessDrag from '../_hooks/useAutochessDrag';
import { moveDraggedUnit, samePosition } from '../_lib/autochessDrag.js';
import { ACADEMIES, ROLES, STUDENTS, STUDENT_BY_ID, XP_THRESHOLDS } from '../_lib/autochessData';
import { getPlayer, fieldUnits, benchUnits, oddsFor, nextInterest, trainingPrice, synergiesFor, copiesOf } from '../_lib/autochessMarket';
import {
  buyUnit, rerollShop, toggleShopLock, buyExperience, trainCommander, moveUnit, autoFormation, sellUnit,
  beginCombat, finishBattle, setPaused, finishSpectating, standings, nextOpponent, setPreferredAcademy,
} from '../_lib/autochessEngine';
import '../../../../styles/KivotosAutochess.css';

const phaseNames = { planning: '편성 준비', battle: '자동 전투', spectate: '관전', finished: '최종 순위' };
const fmt = value => Number.isFinite(value) ? value.toLocaleString('ko-KR') : '최대';

export default function KivotosAutochessPlayPage() {
  const hydrated = useHydrated(), token = useAuthToken(), user = useAuthUser();
  const userId = user?.id || user?._id, owner = token ? userId ? 'account:' + userId : '' : 'guest';
  const [speed, setSpeed] = useState(2), [selectedUid, setSelectedUid] = useState(''), [scoutId, setScoutId] = useState('');
  const [replay, setReplay] = useState(false), [replayIndex, setReplayIndex] = useState(0), [tab, setTab] = useState('command'), [confirmNew, setConfirmNew] = useState(false);
  const [rosterOrigin, setRosterOrigin] = useState('nte');
  const fileRef = useRef(null), placementRef = useRef(null);
  const session = useAutochessSession({ owner, hydrated, token, speed });
  const { state, ready, message, busy, halted, recorded, act, newMatch, recover, exportRun, importRun, serverAction } = session;
  const human = getPlayer(state), opponent = nextOpponent(state);
  const chosenScout = getPlayer(state, scoutId);
  const scouted = (chosenScout?.hp > 0 ? chosenScout : null) || opponent?.player || state.players.find(p => p.id !== 'p0' && p.hp > 0);
  const roster = standings(state), traits = synergiesFor(human), selected = human.units.find(u => u.uid === selectedUid);
  const student = selected ? STUDENT_BY_ID[selected.studentId] : null;
  const planning = state.phase === 'planning' && !replay;
  const disabled = !ready || Boolean(busy) || halted, fileDisabled = !ready || Boolean(busy);
  const editable = planning && !disabled && !replay;
  const watch = state.phase === 'battle' ? state.pending?.watch : replay ? state.lastBattle : null;
  const frameIndex = state.phase === 'battle' ? state.frameIndex : replayIndex;
  const watchedFrame = watch?.frames[Math.min(frameIndex, watch.frames.length - 1)];
  const costTrainInt = trainingPrice(human, 'intelligence'), costTrainLuck = trainingPrice(human, 'luck');
  const moveSelectedTo = target => {
    if (!editable || !selected) return;
    const before = selected.position;
    const next = act(current => moveUnit(current, selected.uid, target));
    const after = next && getPlayer(next).units.find(unit => unit.uid === selected.uid)?.position;
    if (after && (after.kind !== before.kind || after.x !== before.x || after.y !== before.y || after.slot !== before.slot)) {
      setSelectedUid('');
    }
  };
  const place = (x, y, occupiedUid) => {
    if (!editable) return;
    if (selected?.uid === occupiedUid) setSelectedUid('');
    else if (selected) moveSelectedTo({ kind: 'field', x, y });
    else if (occupiedUid) setSelectedUid(occupiedUid);
  };
  const benchClick = (slot, unit) => {
    if (!editable) return;
    if (unit && selected?.uid === unit.uid) setSelectedUid('');
    else if (selected && (selected.position.kind === 'field' || !unit)) moveSelectedTo({ kind: 'bench', slot });
    else if (unit) setSelectedUid(unit.uid);
  };
  const drag = useAutochessDrag({
    enabled: editable, owner, runId: state.runId, round: state.round, scopeRef: placementRef,
    onStart: setSelectedUid, onCancel: () => setSelectedUid(''),
    onDrop: (record, target) => {
      const next = act(current => moveDraggedUnit(current, record, target, owner));
      const unit = next && getPlayer(next).units.find(candidate => candidate.uid === record.uid);
      setSelectedUid(unit && !samePosition(unit.position, target) ? record.uid : '');
    },
  });
  const draggingStudent = drag.view ? STUDENT_BY_ID[drag.view.studentId] : null;
  return (
    <GamePlayShell className="autochess-page" kicker="KIVOTOS · AUTO CHESS" title="키보토스 오토체스"
      description="캐릭터를 모으고, 세력 시너지를 완성하고, 마지막 한 팀으로 살아남으세요."
      viewport={false} heroLayout="compact"
      actions={<><Link href="/games">게임 목록</Link><GameControlButton action="save" disabled={fileDisabled} onClick={() => void serverAction('save')}>계정 저장</GameControlButton><GameControlButton action="load" disabled={fileDisabled} onClick={() => void serverAction('load')}>계정 불러오기</GameControlButton></>}
      >
      <div className="ac-layout" ref={placementRef}
        onPointerDownCapture={drag.onPointerDownCapture} onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp} onPointerCancel={drag.onPointerCancel}
        onLostPointerCapture={drag.onLostPointerCapture} onClickCapture={drag.onClickCapture}
        onKeyDown={event => { if (event.key === 'Escape') { drag.cancel(); setSelectedUid(''); } }}>
        <section className="ac-play-column" aria-label="전장과 상점">
          <div className="ac-battle-card">
            <div className="ac-section-heading"><div><span className="ac-eyebrow">1인 대전 · AI 7명</span><h2>{watch ? watch.left.name + ' vs ' + watch.right.name : state.phase === 'finished' ? '대전 종료' : '편성이 승부를 결정합니다'}</h2></div><span className="ac-phase">{state.paused && state.phase === 'battle' ? '일시정지' : replay ? '전투 다시보기' : phaseNames[state.phase]}</span></div>
            <dl className="ac-board-metrics" aria-label="전장 현황">
              <div><dt>라운드</dt><dd>{state.round}</dd></div>
              <div><dt>체력</dt><dd>{human.hp}<small> / 40</small></dd></div>
              <div className="is-gold"><dt>골드</dt><dd>{fmt(human.gold)}<small> G</small></dd></div>
              <div><dt>레벨</dt><dd>{human.level}<small> · 편성 {fieldUnits(human).length}/{human.level}</small></dd></div>
              <div><dt>생존</dt><dd>{state.players.filter(p => p.hp > 0).length}<small> / 8</small></dd></div>
            </dl>
            <div className="ac-round-info"><span>{watch ? '전투 ' + watchedFrame?.[0].toFixed(1) + ' / ' + watch.duration.toFixed(1) + '초' : scouted ? '정찰 · ' + scouted.name + (opponent?.ghost && scouted.id === opponent.player.id ? '의 고스트' : '') : '최종 순위를 확인하세요'}</span><span>{planning ? '다음 대진 · ' + (opponent ? opponent.player.name + (opponent.ghost ? '의 고스트' : '') : '대진 없음') : watch ? '체력과 마나에 따라 자동으로 공격·스킬 사용' : '체력 0이면 탈락'}</span></div>
            <p className="ac-placement-help" id="ac-placement-help" aria-live="polite">{draggingStudent ? draggingStudent.name + ' 이동 중 · 아군 칸이나 대기석에 놓으세요.' : '캐릭터를 드래그해 배치하거나, 클릭해서 선택 후 원하는 칸을 누르세요.'}</p>
            <div className="ac-board-wrap">
              <AutochessBoard player={human} opponent={scouted} watch={watch} frameIndex={frameIndex} effectDuration={replay ? 400 : 400 / speed} selectedUid={selectedUid} onCell={place} editable={editable} onUnitPointerDown={drag.onPointerDown} draggingUid={drag.view?.uid} dropKey={drag.view?.dropKey} />
              {!ready ? <div className="ac-overlay"><h2>대전을 준비하고 있습니다</h2><p>저장된 진행을 확인하는 중입니다.</p></div> : null}
              {state.phase === 'finished' && !replay ? <div className="ac-overlay">
                <span className="ac-eyebrow">FINAL RESULT</span><h2>{human.rank === 1 ? '최후의 승자!' : '최종 ' + human.rank + '위'}</h2>
                <p>우승 · {state.players.find(p => p.rank === 1)?.name}<br />{state.round}라운드에 최종 순위가 확정되었습니다.</p>
                <button className="ac-primary" type="button" disabled={fileDisabled} onClick={newMatch}>새 대전 시작</button>
              </div> : null}
            </div>
            <div className="ac-combat-controls">
              {state.phase === 'battle' ? <>
                <button type="button" className="ac-primary" disabled={disabled} onClick={() => act(finishBattle)}>결과 바로 보기</button>
                <button type="button" className="ac-button" disabled={disabled} onClick={() => act(s => setPaused(s, !s.paused))}>{state.paused ? '전투 재개' : '일시정지'}</button>
                <div className="ac-speed" role="group" aria-label="전투 재생 속도">{[1, 2, 4].map(n => <button key={n} type="button" aria-pressed={speed === n} onClick={() => setSpeed(n)}>{n}배</button>)}</div>
              </> : <>
                <button type="button" className="ac-primary" disabled={disabled || !['planning', 'spectate'].includes(state.phase) || planning && !fieldUnits(human).length || replay} onClick={() => { setReplay(false); act(beginCombat); }}>{state.phase === 'spectate' ? '다음 전투 관전' : state.round + '라운드 전투 시작'}</button>
                <button type="button" className="ac-button" disabled={!editable || !human.units.length} onClick={() => { act(autoFormation); setSelectedUid(''); }}>자동 편성</button>
                <button type="button" className="ac-button" disabled={disabled || !state.lastBattle} onClick={() => { setReplay(!replay); setReplayIndex(0); }}>{replay ? '다시보기 닫기' : '최근 전투 다시보기'}</button>
                {state.phase === 'spectate' ? <button type="button" className="ac-button" disabled={disabled || replay} onClick={() => act(finishSpectating)}>남은 대전 결과 보기</button> : null}
              </>}
            </div>
            {replay && watch ? <div className="ac-replay-controls"><label>전투 장면<input type="range" aria-label="전투 다시보기 위치" min="0" max={watch.frames.length - 1} value={replayIndex} onChange={event => setReplayIndex(Number(event.target.value))} /></label><span>{replayIndex + 1} / {watch.frames.length}</span></div> : null}
            <div className="ac-message" role="status" aria-live="polite">{message}</div>
          </div>

          <div className="ac-bench-panel">
            <div className="ac-small-heading"><h3>대기석 <small>{benchUnits(human).length} / 9</small></h3><span>같은 1성 3명 → 2성 · 같은 2성 3명 → 3성</span></div>
            <div className="ac-bench" role="group" aria-label="대기석">
              {Array.from({ length: 9 }, (_, slot) => {
                const unit = human.units.find(u => u.position.kind === 'bench' && u.position.slot === slot), s = unit ? STUDENT_BY_ID[unit.studentId] : null;
                return <button key={slot} type="button" disabled={!editable} className={'ac-bench-slot' + (unit?.uid === selectedUid ? ' is-selected' : '') + (drag.view?.uid === unit?.uid && unit ? ' is-drag-source' : '') + (drag.view?.dropKey === 'bench:' + slot ? ' is-drop-target' : '')}
                  data-ac-drop={editable ? 'bench:' + slot : undefined} data-ac-unit={editable ? unit?.uid : undefined}
                  onPointerDown={event => drag.onPointerDown(event, unit)} draggable={false} aria-describedby="ac-placement-help"
                  aria-pressed={Boolean(unit && unit.uid === selectedUid)} aria-label={'대기석 ' + (slot + 1) + '번' + (s ? ' · ' + s.name + ' ' + unit.star + '성' : ' · 빈칸')} onClick={() => benchClick(slot, unit)}>
                  {s ? <><div className="ac-bench-portrait"><OfficialStudentIcon id={s.id} /></div><strong>{s.name}</strong><span>{'★'.repeat(unit.star)}</span></> : <span>{slot + 1}</span>}
                </button>;
              })}
            </div>
            {selected && student ? <div className="ac-selected-detail"><div><strong>{student.name} {'★'.repeat(selected.star)}</strong><span>{ACADEMIES[student.academy].name} · {ROLES[student.role].name} · {student.skillName}</span></div><div className="ac-selection-actions"><button type="button" className="ac-button" onClick={() => setSelectedUid('')}>선택 해제</button><button type="button" className="ac-button ac-sell" disabled={!editable} onClick={() => { act(s => sellUnit(s, selected.uid)); setSelectedUid(''); }}>판매 · {student.cost * copiesOf(selected)}골드</button></div></div> : <p className="ac-muted">캐릭터를 드래그해 아군 칸이나 대기석에 놓으면 배치·교환됩니다. 클릭 배치도 가능하며, 배치 후에는 선택이 해제됩니다. Esc로 이동·선택을 취소할 수 있습니다.</p>}
          </div>

          <div className="ac-shop-panel">
            <div className="ac-shop-heading"><div><span className="ac-eyebrow">STUDENT SHOP</span><h3>캐릭터 모집</h3></div><div><button type="button" className="ac-button" aria-pressed={human.locked} disabled={!planning || disabled} onClick={() => act(toggleShopLock)}>{human.locked ? '상점 잠금 해제' : '상점 잠금'}</button><button type="button" className="ac-button" disabled={!planning || disabled || human.gold < 2} onClick={() => act(rerollShop)}>리롤 · 2골드</button></div></div>
            <div className="ac-shop" role="group" aria-label="캐릭터 상점">
              {human.shop.map((id, index) => {
                const s = STUDENT_BY_ID[id], owned = id ? human.units.filter(u => u.studentId === id && u.star === 1).length : 0;
                return s ? <button key={index} type="button" className={'ac-offer is-cost-' + s.cost} style={{ '--academy-color': ACADEMIES[s.academy].color }}
                  disabled={!planning || disabled || human.gold < s.cost} aria-label={(index + 1) + '번 상점 ' + s.name + ' 구매 · ' + s.cost + '골드'} onClick={() => act(current => buyUnit(current, index))}>
                  <div className="ac-offer-top"><span>{ACADEMIES[s.academy].name}</span><b>{s.cost} G</b></div><div className="ac-offer-avatar" aria-hidden="true"><OfficialStudentIcon id={s.id} /></div>
                  <strong>{s.name}</strong><small>{ROLES[s.role].name} · 사거리 {s.range}</small><span className={'ac-copy-count' + (owned >= 2 ? ' is-ready' : '')}>{owned >= 2 ? '구매 시 2성 합성' : owned ? '같은 1성 ' + owned + '명 보유' : s.skillName}</span>
                </button> : <div className="ac-offer is-empty" key={index}><span>구매 완료</span></div>;
              })}
            </div>
            <div className="ac-odds" aria-label="행운 반영 상점 확률">{oddsFor(human).map((value, i) => <span key={i}><i className={'is-tier-' + (i + 1)} />{i + 1}등급 <b>{value}%</b></span>)}</div>
            <p className="ac-muted">기물은 8팀이 공용으로 사용합니다. 소진된 등급은 남은 등급에 확률을 재분배합니다. 잠근 상점은 다음 라운드에도 유지됩니다.</p>
          </div>

          <div className="ac-synergy-panel"><div className="ac-small-heading"><h3>아군 시너지</h3><span>같은 캐릭터의 중복 배치는 1명으로 계산</span></div><div className="ac-traits">{traits.academy.map(trait => <div key={trait.id} className={trait.tier ? 'is-active' : ''} style={{ '--academy-color': trait.color }} title={trait.description}><span>{trait.name}</span><strong>{trait.count}<small> / 2·4</small></strong><p>{trait.label}</p></div>)}</div><div className="ac-role-traits">{traits.roles.map(trait => <span key={trait.id} className={trait.tier ? 'is-active' : ''} title={trait.description}>{trait.name} {trait.count} / 2·4</span>)}</div></div>
        </section>

        {drag.view && draggingStudent ? createPortal(
          <div className={'ac-drag-preview' + (!drag.view.dropKey ? ' is-invalid' : '')}
            style={{ left: drag.view.x, top: drag.view.y, '--academy-color': ACADEMIES[draggingStudent.academy].color }} aria-hidden="true">
            <div className="ac-drag-portrait"><OfficialStudentIcon id={draggingStudent.id} /></div>
            <strong>{draggingStudent.name}</strong><span>{drag.view.dropKey ? '여기에 배치' : '아군 칸 · 대기석'}</span>
          </div>, document.body
        ) : null}
        <aside className="ac-sidebar" aria-label="순위와 대전 관리">
          <div className="ac-standings"><div className="ac-small-heading"><h3>대전 현황</h3><span>체력 0 → 탈락</span></div>{roster.map(p => <button key={p.id} type="button" className={'ac-player-row' + (p.id === 'p0' ? ' is-human' : '') + (!p.hp ? ' is-out' : '')}
            aria-label={p.name + ' 정찰'} aria-pressed={scouted?.id === p.id} disabled={p.id === 'p0' || !p.hp || state.phase === 'battle'} onClick={() => { setScoutId(p.id); setReplay(false); }}>
            <span className="ac-player-mark">{p.rank || '·'}</span><div><strong>{p.name}</strong><span className="ac-player-hp"><i style={{ width: p.hp / 40 * 100 + '%' }} /></span></div><b>{p.hp || p.rank + '위'}</b>
          </button>)}<p className="ac-muted">상대를 누르면 현재 편성을 정찰합니다. 전투는 전장 위의 다음 대진을 따릅니다.</p></div>
          <div className="ac-side-tabs" role="tablist" aria-label="대전 관리 화면">{[['command', '지휘 성장'], ['history', '전투 기록'], ['roster', '도감'], ['save', '저장·복구']].map(([id, label]) => <button type="button" role="tab" key={id} aria-selected={tab === id} aria-controls={'ac-panel-' + id} id={'ac-tab-' + id} onClick={() => setTab(id)}>{label}</button>)}</div>
          <section className="ac-side-panel" role="tabpanel" id={'ac-panel-' + tab} aria-labelledby={'ac-tab-' + tab}>
            {tab === 'command' ? <>
              <div className="ac-level"><div className="ac-small-heading"><h3>레벨 {human.level}</h3><span>{human.level < 8 ? human.xp + ' / ' + XP_THRESHOLDS[human.level] + ' XP' : '최고 레벨'}</span></div><progress max={human.level < 8 ? XP_THRESHOLDS[human.level] : 1} value={human.level < 8 ? human.xp : 1} /><button type="button" className="ac-button ac-wide" disabled={!planning || disabled || human.gold < 4 || human.level >= 8} onClick={() => act(buyExperience)}>경험치 +4 · 4골드</button><p className="ac-muted">레벨만큼 편성할 수 있으며 라운드 종료마다 경험치 +2를 얻습니다.</p></div>
              <div className="ac-command-stat"><div><strong>지능 {human.commander.intelligence}</strong><small>이자 상한 {5 + Math.floor(human.commander.intelligence / 2)} · 리롤 환급 {human.commander.intelligence * 4}%</small></div><button type="button" className="ac-button" disabled={!planning || disabled || human.gold < costTrainInt} onClick={() => act(s => trainCommander(s, 'intelligence'))}>훈련 · {fmt(costTrainInt)}</button></div>
              <div className="ac-command-stat"><div><strong>행운 {human.commander.luck}</strong><small>상점의 상위 등급 확률 증가</small></div><button type="button" className="ac-button" disabled={!planning || disabled || human.gold < costTrainLuck} onClick={() => act(s => trainCommander(s, 'luck'))}>훈련 · {fmt(costTrainLuck)}</button></div>
              <div className="ac-income"><span>현재 골드 기준 예상 이자</span><strong>+{nextInterest(human)} G</strong><p>보유 골드 10당 이자 +1<br />기본 수입 +5 · 승리 +1 · 연승/연패 최대 +3</p>{state.lastIncome ? <small>직전 라운드 총수입 +{state.lastIncome.total} G</small> : null}</div>
              <label className="ac-focus">자동 편성 선호<select value={human.focus} disabled={!editable} onChange={event => act(s => setPreferredAcademy(s, event.target.value))}><option value="balanced">균형</option>{Object.entries(ACADEMIES).map(([id, a]) => <option key={id} value={id}>{a.name}</option>)}</select></label>
            </> : tab === 'history' ? <>
              <h3>최근 라운드</h3>{state.resultHistory.length ? <div className="ac-history">{state.resultHistory.map(row => <div key={row.round}><strong>{row.round}R · {row.won === null ? '관전' : row.won ? '승리' : '패배'}</strong><span>수입 +{row.gold}</span>{row.eliminated.length ? <small>탈락 · {row.eliminated.join(', ')}</small> : null}</div>)}</div> : <p className="ac-muted">첫 전투가 끝나면 라운드 결과가 표시됩니다.</p>}
              <ol className="ac-log">{state.log.map(row => <li key={row.id}>{row.text}</li>)}</ol>
            </> : tab === 'roster' ? <>
              <h3>캐릭터 도감 <small>{STUDENTS.length}명</small></h3>
              <div className="ac-origin-tabs" role="group" aria-label="도감 작품 선택">
                {Object.entries(CHARACTER_ORIGINS).map(([id, origin]) => <button key={id} type="button" aria-pressed={rosterOrigin === id}
                  onClick={() => setRosterOrigin(id)}>{origin.name}</button>)}
              </div>
              <div className="ac-collection" aria-label={CHARACTER_ORIGINS[rosterOrigin].name + ' 도감'}>
                {STUDENTS.filter(character => character.origin === rosterOrigin).map(character => <article className="ac-collection-card" key={character.id}>
                  <div className="ac-collection-portrait"><OfficialStudentIcon id={character.id} /></div>
                  <div><strong>{character.name}</strong><span>{character.cost}골드 · {ROLES[character.role].name}</span></div>
                  <p>{character.skillName}<br />체력 {character.hp} · 공격 {character.atk}<br />사거리 {character.range} · 간격 {character.interval}초</p>
                </article>)}
              </div>
              <p className="ac-muted">1성 기준의 기본 수치입니다. 전투에서는 성급과 시너지가 반영됩니다.</p>
            </> : <>
              <h3>{token ? '계정별 기기 자동 저장' : '손님 기기 자동 저장'}</h3><p className="ac-muted">변경된 대전을 5초마다 보관합니다. 전투 중 저장은 같은 결과와 장면으로 복원됩니다. 오프라인 골드 보상은 없습니다.</p>
              <div className="ac-save-buttons"><button type="button" className="ac-button" disabled={fileDisabled} onClick={exportRun}>JSON 내보내기</button><button type="button" className="ac-button" disabled={fileDisabled} onClick={() => fileRef.current?.click()}>JSON 가져오기</button><button type="button" className="ac-button" disabled={fileDisabled} onClick={recover}>이전 대전 복구</button><button type="button" className="ac-button" disabled={fileDisabled || recorded || state.phase !== 'finished'} onClick={() => void serverAction('record')}>{recorded ? '전적 기록 완료' : '최종 순위 기록'}</button><button type="button" className="ac-button" disabled={fileDisabled} onClick={() => setConfirmNew(true)}>새 대전</button></div>
              <input type="file" ref={fileRef} className="ac-file-input" aria-label="오토체스 대전 JSON" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; setReplay(false); void importRun(file); }} />
              {confirmNew ? <div className="ac-confirm"><p>현재 대전을 복구본으로 보관하고 새 대전을 시작할까요?</p><button type="button" className="ac-button" onClick={() => { newMatch(); setReplay(false); setConfirmNew(false); }}>새 대전 시작</button><button type="button" className="ac-button" onClick={() => setConfirmNew(false)}>취소</button></div> : null}
            </>}
          </section>
        </aside>
      </div>
      <p className="ac-footer">캐릭터 {STUDENTS.length}명 · 세력 {Object.keys(ACADEMIES).length}종 · 플레이어 1명과 AI 7명의 대전 · 같은 캐릭터 3명 합성 · 최후의 1팀이 우승합니다.</p>
      <p className="ac-art-credit">일러스트 © 각 권리자 · <a href="/games/shared/blue-archive/sources.json" target="_blank" rel="noreferrer">블루 아카이브 출처</a> · <a href="/games/shared/crossover/sources.json" target="_blank" rel="noreferrer">이환·원신 출처</a></p>
    </GamePlayShell>
  );
}
