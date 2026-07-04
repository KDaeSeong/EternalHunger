'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell from '../../_components/GamePlayShell';
import {
  CARDS,
  DEFAULT_RULES,
  GAME_SLUG,
  PRESET_DECKS,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  cardName,
  drawOpeningHand,
  getCard,
  getPreset,
  scoreDeck,
  summarizeDeck,
  validateDeck,
} from '../_lib/baVanguardCatalog';

function CardLine({ cardId, count }) {
  const card = getCard(cardId);
  if (!card) return null;
  return (
    <article className="game-save-row">
      <div>
        <span>G{card.grade} · {card.type}</span>
        <strong>{card.name}</strong>
      </div>
      <strong>{count}</strong>
    </article>
  );
}

function SmallStat({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function BaVanguardPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [presetId, setPresetId] = useState(PRESET_DECKS[0]?.id || '');
  const [seed, setSeed] = useState(2401);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const deck = getPreset(presetId);
  const validation = useMemo(() => validateDeck(deck), [deck]);
  const summary = useMemo(() => summarizeDeck(deck), [deck]);
  const openingHand = useMemo(() => drawOpeningHand(deck, seed, 5), [deck, seed]);
  const score = scoreDeck(deck);
  const visibleCards = CARDS.filter((card) => card.clan === deck.clan);
  const valid = validation.errors.length === 0;

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 BA Vanguard 덱 테스트 상태를 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `BA Vanguard ${deck.name}`,
        version: SAVE_VERSION,
        summary: {
          presetId,
          deckName: deck.name,
          clan: deck.clan,
          errors: validation.errors.length,
          warnings: validation.warnings.length,
          score,
        },
        payload: { presetId, seed },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('BA Vanguard 테스트 상태를 저장했습니다.');
      showToast({ tone: 'success', message: 'BA Vanguard 테스트 상태를 저장했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const loadRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 저장된 BA Vanguard 테스트 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 BA Vanguard 테스트 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const payload = detail?.save?.payload || {};
      setPresetId(getPreset(payload.presetId)?.id || PRESET_DECKS[0].id);
      setSeed(Number(payload.seed || 2401));
      setMessage('저장된 BA Vanguard 테스트 상태를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 BA Vanguard 테스트 상태를 불러왔습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '불러오기에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const recordRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 BA Vanguard 덱 테스트 결과를 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `BA Vanguard - ${deck.name}`,
        mode: 'deck-validation',
        result: valid ? 'valid' : 'invalid',
        score,
        playTimeSec: 0,
        summary: {
          deckName: deck.name,
          clan: deck.clan,
          mainCount: summary.mainCount,
          gCount: summary.gCount,
          errors: validation.errors.length,
          warnings: validation.warnings.length,
          openingHand: openingHand.map(cardName),
        },
        payload: { presetId, seed, deck, validation },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('BA Vanguard 덱 테스트 결과를 전적에 기록했습니다.');
      showToast({ tone: 'success', message: 'BA Vanguard 덱 테스트 결과를 전적에 기록했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const actions = (
    <>
      <button type="button" onClick={() => setSeed((current) => current + 1)}>다시 섞기</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '테스트 기록'}</button>
      <Link href="/games/ba-vanguard">상세</Link>
    </>
  );

  const metrics = [
    { label: '카드', value: CARDS.length },
    { label: '메인', value: `${summary.mainCount}/${DEFAULT_RULES.mainSize}` },
    { label: 'G존', value: `${summary.gCount}/${DEFAULT_RULES.gZoneMax}` },
    { label: '오류', value: validation.errors.length },
    { label: '경고', value: validation.warnings.length },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 테스트는 가능하지만, 저장/불러오기/전적 기록은 로그인해야 사용할 수 있습니다.' } : null,
    !valid ? { key: 'invalid', tone: 'error', text: '현재 덱에 규칙 오류가 있습니다. 오류 목록을 확인하세요.' } : null,
  ];

  return (
    <GamePlayShell
      kicker="BA Vanguard"
      title="BA Vanguard"
      description="업로드된 BA Vanguard의 카드 라이브러리, P-G 프리셋 덱, 덱 검증 규칙, 오프닝 핸드 테스트를 사이트형 slice로 이식했습니다."
      summaryLabel="BA Vanguard 요약"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>프리셋 덱</h2>
            <span>{deck.clan}</span>
          </div>
          <label className="game-save-json-field">
            <span>덱</span>
            <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
              {PRESET_DECKS.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}
            </select>
          </label>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>{deck.description}</p>
          <div className="games-rank-split">
            <SmallStat label="평균 파워" value={summary.averagePower.toLocaleString('ko-KR')} />
            <SmallStat label="실드 총합" value={summary.totalShield.toLocaleString('ko-KR')} />
            <SmallStat label="G3" value={summary.grade3Count} />
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>오프닝 핸드</h2>
            <span>Seed {seed}</span>
          </div>
          <div className="game-save-list">
            {openingHand.map((cardId, index) => (
              <article className="game-save-row" key={`${cardId}-${index}`}>
                <div>
                  <span>{index + 1}</span>
                  <strong>{cardName(cardId)}</strong>
                </div>
                <strong>G{getCard(cardId)?.grade ?? '-'}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>검증</h2>
            <span>{valid ? '통과' : '오류 있음'}</span>
          </div>
          <div className="games-activity-list">
            {validation.errors.length ? validation.errors.map((row) => (
              <div key={row}><strong>{row}</strong></div>
            )) : <div><strong>필수 규칙 오류가 없습니다.</strong></div>}
            {validation.warnings.map((row) => (
              <div key={row}><strong>{row}</strong></div>
            ))}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>메인 덱</h2>
            <span>{summary.mainCount}장</span>
          </div>
          <div className="game-save-list">
            {deck.main.map((entry) => <CardLine cardId={entry.cardId} count={entry.count} key={entry.cardId} />)}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>G존</h2>
            <span>{summary.gCount}장</span>
          </div>
          <div className="game-save-list">
            {deck.gzone.map((entry) => <CardLine cardId={entry.cardId} count={entry.count} key={entry.cardId} />)}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>카드 라이브러리</h2>
            <span>{visibleCards.length}장</span>
          </div>
          <div className="game-save-list">
            {visibleCards.map((card) => (
              <article className="game-save-row" key={card.id}>
                <div>
                  <span>G{card.grade} · {card.type}</span>
                  <strong>{card.name}</strong>
                  <small>{card.text}</small>
                </div>
                <strong>{Number(card.power || card.shield || 0).toLocaleString('ko-KR')}</strong>
              </article>
            ))}
          </div>
        </section>
      </section>
    </GamePlayShell>
  );
}
