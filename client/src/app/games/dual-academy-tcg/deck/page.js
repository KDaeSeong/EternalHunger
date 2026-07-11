'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../../../components/SiteHeader';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiGetCached, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameActionIcon from '../../_components/GameActionIcon';
import { GameControlButton } from '../../_components/GamePlayPrimitives';
import { useGameSfxEventHandlers } from '../../_lib/useGameSfx';
import {
  FALLBACK_DECK_CARD_IDS,
  FALLBACK_TCG_CARDS,
  TCG_DECK_RULES,
  analyzeDeck,
  keywordLabels,
  summarizeDeck,
} from '../_lib/tcgCatalog';

function KeywordBadges({ card }) {
  const labels = keywordLabels(card);
  if (!labels.length) return null;
  return (
    <div className="tcg-keywords">
      {labels.map((label) => <span key={label}>{label}</span>)}
    </div>
  );
}

function countCards(cardIds) {
  return cardIds.reduce((map, id) => {
    map.set(id, (map.get(id) || 0) + 1);
    return map;
  }, new Map());
}

function normalizeCards(value) {
  return Array.isArray(value) && value.length ? value : FALLBACK_TCG_CARDS;
}

function normalizeRules(value) {
  return {
    ...TCG_DECK_RULES,
    ...(value && typeof value === 'object' ? value : {}),
  };
}

export default function DualAcademyTcgDeckPage() {
  const mounted = useHydrated();
  const token = useAuthToken();
  const { showToast } = useToast();
  const [cards, setCards] = useState(FALLBACK_TCG_CARDS);
  const [rules, setRules] = useState(TCG_DECK_RULES);
  const [deckName, setDeckName] = useState('스타터 덱');
  const [deckKey, setDeckKey] = useState('main');
  const [cardIds, setCardIds] = useState(FALLBACK_DECK_CARD_IDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const {
    handleGameSfxChangeCapture,
    handleGameSfxPointerDownCapture,
    playGameSfx,
  } = useGameSfxEventHandlers();

  const counts = useMemo(() => countCards(cardIds), [cardIds]);
  const summary = useMemo(() => summarizeDeck(cardIds, cards), [cardIds, cards]);
  const deckReport = useMemo(() => analyzeDeck(cardIds, cards, rules), [cardIds, cards, rules]);
  const sortedCards = useMemo(() => [...cards].sort((a, b) => (
    Number(a.cost || 0) - Number(b.cost || 0) || String(a.name).localeCompare(String(b.name), 'ko')
  )), [cards]);

  const deckError = deckReport.errors[0] || '';

  const loadDeck = useCallback(async () => {
    if (!mounted) return;
    setLoading(true);
    setMessage('');
    try {
      const cardPayload = await apiGetCached('/tcg/cards', {
        ttlMs: 60000,
        timeoutMs: 12000,
        storage: 'session',
      });
      const nextCards = normalizeCards(cardPayload?.cards);
      const nextRules = normalizeRules(cardPayload?.rules);
      let nextCardIds = Array.isArray(cardPayload?.defaultDeckCardIds) && cardPayload.defaultDeckCardIds.length
        ? cardPayload.defaultDeckCardIds
        : FALLBACK_DECK_CARD_IDS;
      let nextDeckName = '스타터 덱';
      let nextDeckKey = 'main';

      if (token) {
        try {
          const deckPayload = await apiGet('/tcg/decks', { timeoutMs: 12000 });
          const activeDeck = deckPayload?.activeDeck || null;
          if (Array.isArray(activeDeck?.cardIds) && activeDeck.cardIds.length) {
            nextCardIds = activeDeck.cardIds;
            nextDeckName = activeDeck.name || nextDeckName;
            nextDeckKey = activeDeck.deckKey || nextDeckKey;
          }
        } catch (err) {
          setMessage(err?.message || '저장된 덱을 불러오지 못했습니다.');
        }
      } else {
        setMessage('로그인하면 덱을 저장할 수 있습니다.');
      }

      setCards(nextCards);
      setRules(nextRules);
      setCardIds(nextCardIds);
      setDeckName(nextDeckName);
      setDeckKey(nextDeckKey);
    } catch (err) {
      const text = err?.message || '카드 정보를 불러오지 못했습니다.';
      setMessage(text);
      showToast({ tone: 'warning', message: text });
      setCards(FALLBACK_TCG_CARDS);
      setRules(TCG_DECK_RULES);
      setCardIds(FALLBACK_DECK_CARD_IDS);
    } finally {
      setLoading(false);
    }
  }, [mounted, showToast, token]);

  useEffect(() => {
    void loadDeck();
  }, [loadDeck]);

  const addCard = (cardId) => {
    setCardIds((current) => {
      if (current.length >= rules.maxCards) return current;
      if ((countCards(current).get(cardId) || 0) >= rules.maxCopies) return current;
      return [...current, cardId];
    });
  };

  const removeCard = (cardId) => {
    setCardIds((current) => {
      const index = current.lastIndexOf(cardId);
      if (index < 0) return current;
      return current.filter((_, idx) => idx !== index);
    });
  };

  const resetDefault = () => {
    setCardIds(FALLBACK_DECK_CARD_IDS);
    setDeckName('스타터 덱');
  };

  const saveDeck = async () => {
    if (!token || deckError || saving) return;
    setSaving(true);
    try {
      const key = deckKey || 'main';
      const res = await apiPut(`/tcg/decks/${key}`, {
        name: deckName,
        cardIds,
      }, { timeoutMs: 12000 });
      await apiPost(`/tcg/decks/${key}/activate`, {}, { timeoutMs: 12000 });
      clearApiGetCache('/tcg');
      const text = res?.message || '덱을 저장했습니다.';
      setMessage(text);
      playGameSfx('tcgDeckSave');
      showToast({ tone: 'success', message: text });
      await loadDeck();
    } catch (err) {
      const text = err?.response?.data?.error || err.message || '덱 저장에 실패했습니다.';
      setMessage(text);
      playGameSfx('tcgInvalid');
      showToast({ tone: 'danger', message: text });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main
      className="tcg-page-shell"
      onChangeCapture={handleGameSfxChangeCapture}
      onPointerDownCapture={handleGameSfxPointerDownCapture}
    >
      <SiteHeader />
      <section className="tcg-arena">
        <header className="tcg-topbar">
          <div>
            <p>Dual Academy TCG</p>
            <h1>덱 편집</h1>
          </div>
          <nav>
            <Link className="game-control-button" data-game-sfx="nav" href="/myanime/dual-academy-tcg/play">
              <GameActionIcon action="duel" label="플레이" />
              <span className="game-action-button__label">플레이</span>
            </Link>
            <Link className="game-control-button" data-game-sfx="nav" href="/myanime/dual-academy-tcg">
              <GameActionIcon action="settings" label="상세" />
              <span className="game-action-button__label">상세</span>
            </Link>
            <GameControlButton action="reset" onClick={resetDefault}>기본 덱</GameControlButton>
          </nav>
        </header>

        {message ? <section className="tcg-result">{message}</section> : null}

        <section className="tcg-deck-editor">
          <aside className="tcg-panel">
            <h2>현재 덱</h2>
            <label className="tcg-deck-field">
              <span>덱 이름</span>
              <input
                value={deckName}
                onChange={(event) => setDeckName(event.target.value.slice(0, 80))}
                maxLength={80}
              />
            </label>
            <div className="tcg-deck-count">
              <strong>{cardIds.length}</strong>
              <span>{rules.minCards}-{rules.maxCards}장</span>
            </div>
            <section className={`tcg-deck-readiness ${deckError ? 'is-danger' : 'is-ready'}`}>
              <GameActionIcon action={deckError ? 'warning' : 'deck'} label="덱 검증" />
              <div>
                <span>덱 검증</span>
                <strong>{deckError || '저장 가능한 덱입니다.'}</strong>
              </div>
            </section>
            <dl className="tcg-small-stats">
              <div>
                <dt>유닛</dt>
                <dd>{summary.unitCount}</dd>
              </div>
              <div>
                <dt>전술</dt>
                <dd>{summary.tacticCount}</dd>
              </div>
              <div>
                <dt>평균 비용</dt>
                <dd>{summary.averageCost}</dd>
              </div>
            </dl>
            <dl className="tcg-small-stats" style={{ marginTop: 12 }}>
              {deckReport.costRows.map((row) => (
                <div key={row.label}>
                  <dt>비용 {row.label}</dt>
                  <dd>{row.count}</dd>
                </div>
              ))}
            </dl>
            <dl className="tcg-small-stats" style={{ marginTop: 12 }}>
              {deckReport.academyRows.slice(0, 4).map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.count}</dd>
                </div>
              ))}
            </dl>
            <div className="tcg-deck-message">
              {deckReport.recommendations.map((row) => (
                <span key={row}>{row}</span>
              ))}
              {deckReport.warnings.slice(0, 3).map((row) => (
                <span key={row}>주의: {row}</span>
              ))}
              {deckReport.keywordRows.length ? (
                <span>키워드: {deckReport.keywordRows.map((row) => `${row.label} ${row.count}`).join(' · ')}</span>
              ) : null}
            </div>
            {deckError ? <p className="tcg-deck-message is-danger">{deckError}</p> : null}
            <GameControlButton
              action="save"
              className="tcg-primary-action"
              onClick={saveDeck}
              disabled={!token || Boolean(deckError) || saving || loading}
            >
              {saving ? '저장 중...' : '저장하고 활성화'}
            </GameControlButton>
          </aside>

          <section className="tcg-panel">
            <div className="tcg-lane-title">
              <h2>카드 목록</h2>
              <span>최대 {rules.maxCopies}장</span>
            </div>
            <div className="tcg-card-library">
              {sortedCards.map((card) => {
                const count = counts.get(card.id) || 0;
                return (
                  <article className={`tcg-card is-${card.tone}`} key={card.id}>
                    <div className="tcg-card-head">
                      <span>{card.cost}</span>
                      <strong>{card.role}</strong>
                    </div>
                    <div className="tcg-card-art" />
                    <h3>{card.name}</h3>
                    <KeywordBadges card={card} />
                    <p>{card.text}</p>
                    {card.role === 'Unit' ? <span>ATK {card.attack} / HP {card.health}</span> : null}
                    <div className="tcg-card-controls">
                      <button
                        type="button"
                        aria-label={`${card.name} 1장 빼기`}
                        data-game-sfx="select"
                        title="1장 빼기"
                        onClick={() => removeCard(card.id)}
                        disabled={count <= 0}
                      >-</button>
                      <strong>{count}</strong>
                      <button
                        type="button"
                        aria-label={`${card.name} 1장 넣기`}
                        data-game-sfx="select"
                        title="1장 넣기"
                        onClick={() => addCard(card.id)}
                        disabled={count >= rules.maxCopies || cardIds.length >= rules.maxCards}
                      >+</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
