'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { apiGet, apiPut, getToken } from '../../utils/api';
import { HUNGER_LIMITS, HUNGER_VERSION, normalizeHungerRoster } from './_lib/hungerGameContract.js';
import { defaultHungerConfig, refreshHungerPresets } from './_lib/hungerGamePresets.js';
import { advanceHungerRun, createHungerRun, hungerFinalDuelPressure } from './_lib/hungerGameRuntime.js';
import { createHungerPack, restoreHungerPackAsync, HUNGER_STORAGE_KEY } from './_lib/hungerGamePersistence.js';
import HungerRosterEditor from './_components/HungerRosterEditor';
import HungerEventEditor from './_components/HungerEventEditor';
import HungerRunViewer from './_components/HungerRunViewer';
import styles from './HungerGames.module.css';

export default function HungerGamesPage() {
  const [config, setConfig] = useState(defaultHungerConfig);
  const [run, setRun] = useState(null);
  const [tab, setTab] = useState('play');
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(false);
  const [saveStatus, setSaveStatus] = useState('저장 확인 중');
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewIndex, setViewIndex] = useState(-1);
  const [eventDraft, setEventDraft] = useState(null);
  const fileInput = useRef(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      try {
        const stored = window.localStorage.getItem(HUNGER_STORAGE_KEY);
        if (stored) {
          const restored = await restoreHungerPackAsync(stored);
          if (cancelled) return;
          setConfig(restored.config); setRun(restored.run); setEventDraft(null);
          if (restored.upgraded) setNotice('다음 경기용 기본 사건과 샘플 특성을 업데이트했습니다. 기존 경기의 진행과 승패는 유지됩니다.');
        }
      } catch (error) {
        if (cancelled) return;
        setNotice('저장 내용을 읽지 못했습니다: ' + error.message + ' 새 경기를 시작하거나 JSON을 가져와 복구할 수 있습니다.');
        setSaveBlocked(true); setSaveStatus('기존 저장 보존 중');
      }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || saveBlocked) return;
    const timer = window.setTimeout(() => {
      try {
        const data = JSON.stringify(createHungerPack(config, run));
        if (new TextEncoder().encode(data).length > HUNGER_LIMITS.packBytes) throw new Error('저장 용량이 큽니다. 참가자 사진을 줄여 주세요.');
        window.localStorage.setItem(HUNGER_STORAGE_KEY, data); setSaveStatus('이 브라우저에 저장됨');
      } catch (error) { setSaveStatus('저장되지 않음: ' + error.message); }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [config, run, ready, saveBlocked]);

  useEffect(() => {
    if (!playing || !run || run.finished) return;
    const timer = window.setInterval(() => setRun((previous) => advanceHungerRun(previous)), 1800);
    return () => window.clearInterval(timer);
  }, [playing, run]);

  const updateRoster = (value) => setConfig((previous) => ({ ...previous, roster: typeof value === 'function' ? value(previous.roster) : value }));
  const applyPack = (restored) => {
    setPlaying(false); setConfig(restored.config); setRun(restored.run); setViewIndex(-1); setEventDraft(null); setSaveBlocked(false); setTab('play');
  };
  const start = () => {
    try {
      if (run && !window.confirm('현재 경기를 끝내고 새 경기를 시작할까요?')) return;
      const next = createHungerRun(config); setRun(next); setPlaying(false); setViewIndex(-1); setSaveBlocked(false); setNotice('새 경기를 시작했습니다. 다음 페이즈를 눌러 진행합니다.');
    } catch (error) { setNotice(error.message); }
  };
  const resetPresets = () => {
    if (!window.confirm('기본 사건을 최신 구성으로 바꿀까요? 기본 사건과 같은 ID의 사건 및 저장 전 초안은 초기화됩니다. 나머지 추가 사건과 수정한 참가자는 보존하고, 변경은 다음 경기에 적용합니다.')) return false;
    try {
      const next = refreshHungerPresets(config);
      setConfig(next); setEventDraft(null); setPlaying(false);
      setNotice('기본 사건과 수정하지 않은 샘플 특성을 업데이트했습니다. 새 경기부터 적용됩니다.');
      return true;
    } catch (error) { setNotice(error.message); return false; }
  };
  const download = () => {
    try {
      const data = JSON.stringify(createHungerPack(config, run), null, 2);
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'hunger-games.json'; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setNotice(error.message); }
  };
  const importFile = async (file) => {
    if (!file) return;
    setBusy(true); setPlaying(false);
    try {
      if (file.size > HUNGER_LIMITS.packBytes) throw new Error('저장 파일은 6MB 이내여야 합니다.');
      const raw = await file.text();
      // Validate before asking to replace the current workspace.
      const restored = await restoreHungerPackAsync(raw);
      if (!window.confirm('현재 참가자·이벤트·경기를 가져온 파일로 바꿀까요?')) return;
      applyPack(restored); setNotice('참가자·이벤트·진행 기록을 가져왔습니다.');
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  };
  const accountAction = async (action) => {
    if (!getToken()) { setNotice('계정 저장과 내 캐릭터 불러오기는 로그인이 필요합니다.'); return; }
    setBusy(true); setPlaying(false);
    try {
      if (action === 'roster') {
        const actors = await apiGet('/characters?view=editor');
        const roster = normalizeHungerRoster(actors);
        if (!window.confirm('현재 참가자 목록을 내 캐릭터 ' + roster.length + '명으로 바꿀까요? 진행 중인 경기는 그대로 유지됩니다.')) return;
        updateRoster(roster); setNotice('내 캐릭터의 이름·사진·헝거게임 특성을 불러왔습니다. 다음 경기부터 적용됩니다.');
      } else if (action === 'save') {
        const pack = createHungerPack(config, run);
        await apiPut('/game-saves/hunger-games/workspace', { payload: pack, version: HUNGER_VERSION, saveName: '헝거게임 참가자·이벤트·경기', summary: { participants: config.roster.length, events: config.events.length, phases: run?.history.length || 0 } });
        setNotice('계정 저장 슬롯에 저장했습니다.');
      } else {
        const list = await apiGet('/game-saves?gameSlug=hunger-games');
        const slot = list.saves?.find((entry) => entry.slotKey === 'workspace');
        if (!slot) throw new Error('계정에 저장된 헝거게임이 없습니다.');
        const result = await apiGet('/game-saves/' + encodeURIComponent(slot.id));
        const restored = await restoreHungerPackAsync(result.save?.payload);
        if (!window.confirm('현재 참가자·이벤트·경기를 계정 저장 내용으로 바꿀까요?')) return;
        applyPack(restored); setNotice('계정 저장 내용을 불러왔습니다.');
      }
    } catch (error) { setNotice(error.message || '계정 데이터를 처리하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  const currentRunActive = playing && run && !run.finished;
  const hasUnsavedEvent = eventDraft && JSON.stringify(eventDraft) !== JSON.stringify(config.events.find((event) => event.id === eventDraft.id));
  return (
    <main className={styles.shell}>
      <SiteHeader />
      <div className={styles.page}>
        <header className={styles.hero}>
          <div><p className={styles.kicker}>HUNGER GAMES</p><h1>헝거게임 시뮬레이터</h1><p>좋아하는 캐릭터를 모으고, 뜻밖의 사건 속에서 누가 살아남는지 지켜보세요.</p></div>
          <div className={styles.actions}><Link href="/eternalhunger">이터널 헝거</Link><Link href="/games">게임 허브</Link></div>
        </header>
        <div className={styles.storage}>
          <span role="status">{saveStatus}</span>
          <div className={styles.actions}>
            <button type="button" disabled={!ready || busy} onClick={download}>JSON 내보내기</button>
            <button type="button" disabled={!ready || busy} onClick={() => fileInput.current?.click()}>JSON 가져오기</button>
            <button type="button" disabled={!ready || busy} onClick={() => void accountAction('save')}>계정에 저장</button>
            <button type="button" disabled={!ready || busy} onClick={() => void accountAction('load')}>계정 저장 불러오기</button>
            <input className={styles.hidden} type="file" ref={fileInput} accept="application/json,.json" aria-label="헝거게임 저장 파일" onChange={(event) => void importFile(event.target.files?.[0])} />
          </div>
        </div>
        {notice ? <div className={styles.notice} role="status"><span>{notice}</span><button type="button" aria-label="알림 닫기" onClick={() => setNotice('')}>×</button></div> : null}
        {hasUnsavedEvent ? <p className={styles.note}>저장하지 않은 이벤트 편집 내용이 있습니다. 이벤트 탭에서 이벤트 저장을 눌러 경기와 저장 파일에 반영하세요.</p> : null}
        <div className={styles.tabs} role="tablist" aria-label="헝거게임 기능">{[{ id: 'play', label: '경기' }, { id: 'roster', label: '참가자' }, { id: 'events', label: '이벤트' }].map((entry) => <button type="button" disabled={!ready || busy} key={entry.id} id={'hg-tab-' + entry.id} role="tab" aria-selected={tab === entry.id} aria-controls={'hg-panel-' + entry.id} onClick={() => { setPlaying(false); setTab(entry.id); }}>{entry.label}</button>)}</div>
        <section role="tabpanel" id={'hg-panel-' + tab} aria-labelledby={'hg-tab-' + tab}>
          {tab === 'play' ? <>
            <div className={styles.playControls}>
              <div className={styles.actions}>
                <button type="button" className={styles.primary} disabled={!ready || busy || config.roster.length < 2} onClick={start}>{run ? '새 경기' : '경기 시작'}</button>
                <button type="button" disabled={busy || !run || run.finished || currentRunActive} onClick={() => { setRun((previous) => advanceHungerRun(previous)); setViewIndex(-1); }}>다음 페이즈</button>
                <button type="button" disabled={busy || !run || run.finished} onClick={() => { setPlaying(!currentRunActive); setViewIndex(-1); }}>{currentRunActive ? '자동 진행 중지' : '자동 진행'}</button>
              </div>
              <div className={styles.fields}>
                <label className={styles.field}>경기 방식<select disabled={!ready || busy} value={config.matchMode || 'solo'} onChange={(event) => setConfig((previous) => ({ ...previous, matchMode: event.target.value }))}>
                  <option value="solo">개인전 · 최후의 1명</option><option value="team">팀전 · 최후의 1팀</option>
                </select></label>
                <label className={styles.field}>경기 시드<input disabled={!ready || busy} value={config.seed} maxLength={120} onChange={(event) => setConfig((previous) => ({ ...previous, seed: event.target.value }))} /></label>
                <label className={styles.field}>최대 페이즈 수<input disabled={!ready || busy} type="number" min="1" max="120" value={config.maxPhases} onChange={(event) => setConfig((previous) => ({ ...previous, maxPhases: event.target.value }))} /></label>
              </div>
            </div>
            <p className={styles.note}>설정 변경은 다음 경기에 적용됩니다. 개인전은 출신 구역·팀 표시와 관계없이 최후의 1명이 우승합니다. 팀전은 같은 팀끼리 기본 공격을 하지 않고 최후의 1팀이 우승하며, 팀을 비워 둔 참가자는 각자 별도 팀입니다. 진행 한도에서는 남은 참가자가 공동 생존합니다. {run ? '현재 경기: ' + (run.rulesVersion < 3 ? '이전 종료 규칙' : run.input.matchMode === 'team' ? '팀전' : '개인전') + ' · 시드 ' + run.input.seed : '같은 참가자·이벤트·시드·경기 방식으로 같은 경기를 다시 볼 수 있습니다.'}</p>
            {run && run.rulesVersion < 3 ? <p className={styles.note}>이 경기는 저장 당시 규칙으로 진행해 기록과 승패를 보존합니다. 개선된 종료 규칙과 사건 선택은 새 경기부터 적용됩니다.</p> : null}
            {run && !run.finished && hungerFinalDuelPressure(run) > 0 ? <p className={styles.note}>최종 2인 대치 {hungerFinalDuelPressure(run)}페이즈 경과 · 대치가 길어질수록 결전과 결정타의 비중이 높아집니다.</p> : null}
            <HungerRunViewer run={run} viewIndex={viewIndex} onViewIndex={(index) => { setPlaying(false); setViewIndex(index); }} />
          </> : tab === 'roster' ? <HungerRosterEditor roster={config.roster} matchMode={config.matchMode} onChange={updateRoster} busy={busy} onLoadAccount={() => void accountAction('roster')} onNotice={setNotice} />
            : <HungerEventEditor events={config.events} roster={config.roster} matchMode={config.matchMode} onChange={(events) => setConfig((previous) => ({ ...previous, events }))} onNotice={setNotice} draft={eventDraft} onDraftChange={setEventDraft} onPresetsReset={resetPresets} />}
        </section>
      </div>
    </main>
  );
}
