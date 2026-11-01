'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useAuthToken, useAuthUser, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell from '../../_components/GamePlayShell';
import { GameControlButton } from '../../_components/GamePlayPrimitives';
import DefenseBoard from '../_components/DefenseBoard';
import useInfiniteDefenseSession from '../_hooks/useInfiniteDefenseSession';
import { ENEMY_TYPES, STAT_DEFS, STUDENTS } from '../_lib/infiniteDefenseData';
import {
  assignStudent, mineCost, miningRate, powerCost, repairBase, setPaused, startWave, studentStats,
  trainingCost, trainStudent, upgradeMine, upgradePower, wavePlan,
} from '../_lib/infiniteDefenseEngine';
import '../../../../styles/InfiniteDefense.css';

const fmt = value => Number.isFinite(value) ? Math.floor(value).toLocaleString('ko-KR') : '최대';
const phaseLabels = { build: '배치 준비', wave: '방어 진행', intermission: '재정비', victory: '20웨이브 완수', defeat: '작전 종료' };

export default function InfiniteDefensePlayPage() {
  const hydrated = useHydrated(), token = useAuthToken(), user = useAuthUser();
  const userId = user?.id || user?._id;
  const owner = token ? (userId ? 'account:' + userId : '') : 'guest';
  const [selectedId, setSelectedId] = useState('shiroko');
  const [tab, setTab] = useState('students');
  const [speed, setSpeed] = useState(1);
  const [autoWave, setAutoWave] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const inputRef = useRef(null);
  const session = useInfiniteDefenseSession({ owner, hydrated, token, speed, autoWave, startWave });
  const { state, ready, message, busy, recorded, act, newRun, recover, exportRun, importRun, serverAction } = session;
  const selected = studentStats(state, selectedId);
  const assignment = state.assignments[selectedId];
  const disabled = !ready || Boolean(busy);
  const ended = state.phase === 'defeat';
  const defenseCount = STUDENTS.filter(s => state.assignments[s.id].mode === 'defend').length;
  const workers = STUDENTS.filter(s => state.assignments[s.id].mode === 'mine');
  const nextWave = wavePlan(state.wave + 1);
  const waveKinds = [...new Set(nextWave.map(e => e.type))];
  const placeCost = assignment.paid ? 0 : selected.cost;
  const onPad = (padId, occupantId) => {
    if (occupantId) { setSelectedId(occupantId); return; }
    act(current => assignStudent(current, selectedId, 'defend', padId));
  };
  const primary = (
    <div className="defense-top-actions">
      <Link href="/games">게임 목록</Link>
      <GameControlButton action="save" disabled={disabled} onClick={() => void serverAction('save')}>계정 저장</GameControlButton>
      <GameControlButton action="load" disabled={disabled} onClick={() => void serverAction('load')}>계정 불러오기</GameControlButton>
    </div>
  );
  return (
    <GamePlayShell className="defense-page" kicker="SCHALE · MINING DEFENSE" title="무한 디펜스"
      description="광산을 돌리고, 학생을 배치하고, 몰려오는 적으로부터 거점을 지키세요."
      actions={primary} heroLayout="compact" viewport={false}
      metrics={[
        { label: '웨이브', value: state.wave + (state.wave > 20 ? ' · 무한' : ' / 20') },
        { label: '거점 내구도', value: state.baseHp + ' / ' + state.maxBaseHp },
        { label: '크레딧', value: fmt(state.coins) },
        { label: '채굴 생산', value: miningRate(state).toFixed(1) + ' /초' },
        { label: '처치', value: fmt(state.kills) },
      ]}>
      <div className="defense-layout">
        <section className="defense-battle-card" aria-label="전투와 배치">
          <div className="defense-section-heading">
            <div><span className="defense-eyebrow">SECTOR 01 · 채굴 전초기지</span><h2>전선을 설계하세요</h2></div>
            <span className={'defense-status' + (state.phase === 'wave' && !state.paused ? ' is-live' : '')}>
              {state.paused ? '일시정지' : phaseLabels[state.phase]}
            </span>
          </div>
          <div className="defense-objective">
            <span>01 채굴 배치</span><b aria-hidden="true">→</b><span>02 방어·훈련</span><b aria-hidden="true">→</b><span>03 보스 격파</span>
          </div>
          <div className="defense-board-wrap">
            <DefenseBoard state={state} selectedId={selectedId} onPad={onPad} disabled={disabled || ended} />
            {!ready ? <div className="defense-overlay"><h2>작전을 준비하고 있습니다</h2><p>저장된 진행을 확인하는 중입니다.</p></div> : null}
            {state.phase === 'victory' ? (
              <div className="defense-overlay is-victory">
                <span className="defense-eyebrow">MISSION COMPLETE</span>
                <h2>20웨이브 완수</h2><p>거점 파괴자를 격파했습니다. 더 강한 적이 기다리는 무한 모드에 도전하세요.</p>
                <button type="button" className="defense-primary" onClick={() => act(current => startWave(setPaused(current, false)))} disabled={disabled}>무한 모드 진입</button>
              </div>
            ) : null}
            {ended ? (
              <div className="defense-overlay is-defeat">
                <span className="defense-eyebrow">DEFENSE ENDED</span>
                <h2>{state.clearedWave}웨이브 방어 완료</h2><p>거점이 함락되었습니다. 생산 투자와 학생의 위치를 바꿔 다시 도전해 보세요.</p>
                <button type="button" className="defense-primary" disabled={disabled} onClick={newRun}>새 작전 시작</button>
              </div>
            ) : null}
          </div>
          <div className="defense-battle-controls">
            <button type="button" className="defense-primary"
              disabled={disabled || ended || state.paused || state.phase === 'wave' || !defenseCount}
              onClick={() => act(startWave)}>
              {state.phase === 'wave' ? state.wave + '웨이브 방어 중' : state.wave >= 20 ? '다음 무한 웨이브' : (state.wave + 1) + '웨이브 시작'}
            </button>
            <button type="button" className="defense-button" disabled={disabled || ended}
              onClick={() => act(current => setPaused(current, !current.paused))}>
              {state.paused ? '진행 재개' : '일시정지'}
            </button>
            <div className="defense-speed" role="group" aria-label="진행 배속">
              {[1, 2, 3].map(value => <button key={value} type="button" aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}배</button>)}
            </div>
            <label className="defense-auto"><input type="checkbox" checked={autoWave} onChange={event => setAutoWave(event.target.checked)} />자동 웨이브</label>
          </div>
          <div className="defense-hint" role="status">
            {state.phase === 'wave' ? '남은 적 ' + (state.enemies.length + wavePlan(state.wave).length - state.spawnIndex) + ' · 전투 중에도 재배치와 훈련이 가능합니다.'
              : !defenseCount ? '오른쪽에서 학생을 고르고 지도 위 + 거점에 배치하면 웨이브를 시작할 수 있습니다.'
              : state.paused ? '진행 재개를 누르면 채굴과 전투를 이어갑니다.'
              : '재정비 중에도 채굴이 진행됩니다. 자동 웨이브는 방어 성공 후 4초 뒤 시작합니다.'}
          </div>
          <div className="defense-wave-preview">
            <div><span className="defense-eyebrow">NEXT WAVE</span><strong>{state.wave + 1}웨이브 · {nextWave.length}기</strong></div>
            <div className="defense-enemy-tags">{waveKinds.map(type => <span key={type}><i style={{ background: ENEMY_TYPES[type].color }} />{ENEMY_TYPES[type].name}</span>)}</div>
          </div>
          <div className="defense-message" role="status" aria-live="polite">{message}</div>
        </section>

        <section className="defense-management" aria-label="학생과 채굴 관리">
          <div className="defense-tabs" role="tablist" aria-label="관리 화면">
            {[['students', '학생 배치'], ['growth', '성장·채굴'], ['records', '기록·저장']].map(([id, label]) => (
              <button key={id} type="button" id={'defense-tab-' + id} role="tab" aria-selected={tab === id}
                aria-controls={'defense-panel-' + id} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
          <div role="tabpanel" id={'defense-panel-' + tab} aria-labelledby={'defense-tab-' + tab}>
            {tab !== 'records' ? (
              <>
                <div className="defense-roster" role="group" aria-label="학생 선택">
                  {STUDENTS.map(student => {
                    const row = state.assignments[student.id];
                    return <button type="button" key={student.id} className={'defense-student' + (selectedId === student.id ? ' is-selected' : '')}
                      style={{ '--unit-color': student.color }} aria-label={student.name + ' 선택'} aria-pressed={selectedId === student.id}
                      onClick={() => setSelectedId(student.id)}>
                      <span className="defense-student-initial" aria-hidden="true">{student.name.slice(0, 1)}</span>
                      <span><strong>{student.name}</strong><small>{row.mode === 'defend' ? row.padId.slice(1) + '번 거점' : row.mode === 'mine' ? '채굴 중' : '대기 중'}</small></span>
                    </button>;
                  })}
                </div>
                <div className="defense-selected" style={{ '--unit-color': selected.color }}>
                  <div className="defense-selected-title"><h3>{selected.name}</h3><span>{selected.role}</span></div>
                  <p>{selected.note}</p>
                  <div className="defense-stat-strip"><span>화력 <b>{selected.damage}</b></span><span>사거리 <b>{selected.range.toFixed(2)}</b></span><span>간격 <b>{selected.interval.toFixed(2)}초</b></span></div>
                  {tab === 'students' ? <>
                    <div className="defense-assignment">
                      <button type="button" className="defense-button" disabled={disabled || ended || assignment.mode === 'mine'} onClick={() => act(current => assignStudent(current, selectedId, 'mine'))}>채굴 배치 · {selected.miningRate.toFixed(1)}/초</button>
                      <button type="button" className="defense-button" disabled={disabled || ended || assignment.mode === 'reserve'} onClick={() => act(current => assignStudent(current, selectedId, 'reserve'))}>대기 전환</button>
                    </div>
                    <p className="defense-placement-note">지도 위 +를 누르면 방어 배치 · {fmt(placeCost)} 크레딧<br />첫 방어 배치만 비용이 들며, 이후 재배치는 무료입니다.</p>
                    <button type="button" className="defense-button defense-wide" disabled={disabled || ended || state.coins < powerCost(state, selectedId)}
                      onClick={() => act(current => upgradePower(current, selectedId))}>화력 강화 +{assignment.power + 1} · {fmt(powerCost(state, selectedId))}</button>
                  </> : (
                    <div className="defense-training">
                      {STAT_DEFS.map(stat => {
                        const cost = trainingCost(state, selectedId, stat.id);
                        return <div key={stat.id}><div><strong>{stat.name} {selected[stat.id]}</strong><small>{stat.effect}</small></div>
                          <button type="button" className="defense-button" disabled={disabled || ended || state.coins < cost} onClick={() => act(current => trainStudent(current, selectedId, stat.id))}>훈련 +1 · {fmt(cost)}</button></div>;
                      })}
                    </div>
                  )}
                </div>
                <div className="defense-mine">
                  <div className="defense-selected-title"><h3>채굴장 <small>Lv.{state.mineLevel}</small></h3><strong>{miningRate(state).toFixed(1)}<small> /초</small></strong></div>
                  <p>{workers.length ? workers.map(s => s.name).join(' · ') + ' 채굴 중' : '채굴 학생을 배치하면 생산량이 증가합니다.'}</p>
                  <button type="button" className="defense-button defense-wide" disabled={disabled || ended || state.coins < mineCost(state)}
                    onClick={() => act(upgradeMine)}>채굴 설비 강화 · {fmt(mineCost(state))}</button>
                  <small className="defense-muted">기본 생산 0.6/초 · 복귀 시 최대 8시간 채굴 정산<br />화면을 벗어나면 전투는 멈추고, 돌아온 뒤 직접 재개합니다.</small>
                </div>
                <button type="button" className="defense-button defense-wide" disabled={disabled || ended || state.phase === 'wave' || state.baseHp >= state.maxBaseHp || state.coins < 55} onClick={() => act(repairBase)}>거점 수리 +5 · 55 크레딧</button>
              </>
            ) : <>
              <div className="defense-save-info"><strong>{token ? '계정별 기기 자동 저장' : '손님 기기 자동 저장'}</strong><p>5초마다 현재 기기에 보관합니다. 계정 저장은 로그인 후 사용할 수 있습니다.</p></div>
              <div className="defense-storage-actions">
                <button type="button" className="defense-button" disabled={disabled} onClick={exportRun}>JSON 내보내기</button>
                <button type="button" className="defense-button" disabled={disabled} onClick={() => inputRef.current?.click()}>JSON 가져오기</button>
                <button type="button" className="defense-button" disabled={disabled} onClick={recover}>이전 작전 복구</button>
                <button type="button" className="defense-button" disabled={disabled || recorded || (!state.firstClear && !ended)} onClick={() => void serverAction('record')}>{recorded ? '전적 기록 완료' : '전적 기록'}</button>
                <button type="button" className="defense-button" disabled={disabled} onClick={() => setConfirmNew(true)}>새 작전</button>
              </div>
              <input type="file" ref={inputRef} className="defense-file-input" aria-label="작전 JSON 파일" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void importRun(file); }} />
              {confirmNew ? <div className="defense-confirm" role="alert"><p>새 작전을 시작할까요? 현재 작전은 이전 작전 복구에 보관합니다.</p><button type="button" className="defense-button" onClick={() => { newRun(); setConfirmNew(false); }}>새 작전 시작</button><button type="button" className="defense-button" onClick={() => setConfirmNew(false)}>취소</button></div> : null}
              <h3 className="defense-log-title">작전 기록</h3>
              <ol className="defense-log">{state.log.map(row => <li key={row.id}>{row.text}</li>)}</ol>
            </>}
          </div>
        </section>
      </div>
      <p className="defense-footer">20웨이브 보스 격파 후 무한 모드로 계속 도전할 수 있습니다. 학생은 한 번에 방어·채굴·대기 중 한 역할만 맡습니다.</p>
    </GamePlayShell>
  );
}
