'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import {
  apiGet,
  apiPost,
  captureAuthSession,
  clearApiGetCache,
  clearAuth,
  isCurrentAuthSession,
  updateStoredUser,
} from '../../utils/api';
import { useAuthUser } from '../../utils/client-auth';
import {
  GAMEPLAY_GAME_LABELS,
  GAMEPLAY_PERK_LIMIT,
  getGameplayPerkProduct,
  normalizeGameplayPerkLoadouts,
} from '../../utils/gameplayPerks';

const CATEGORY_LABELS = {
  title: '칭호',
  portrait_frame: '초상화 프레임',
  badge: '배지',
  log_style: '로그 연출',
  victory_effect: '승리 연출',
  cosmetic: '치장',
  buff: '플레이 특전',
  other: '기타',
};

const CATEGORY_ICONS = {
  title: 'T',
  portrait_frame: 'F',
  badge: 'B',
  log_style: 'L',
  victory_effect: 'V',
  cosmetic: 'C',
  buff: '+',
  other: '*',
};

function normalizePerksPayload(payload) {
  if (Array.isArray(payload)) return { perks: payload, user: null };
  return {
    perks: Array.isArray(payload?.perks) ? payload.perks : [],
    user: payload?.user || null,
  };
}

function userIdentity(user) {
  const value = user?.id || user?._id || user?.username;
  return value === undefined || value === null ? '' : String(value).trim();
}

function authContextKey(identity, session) {
  if (!identity) return '';
  return [identity, session?.scope || '', session?.revision ?? '', session?.csrfToken || ''].join('|');
}

function getCategory(perk) {
  return String(perk?.category || 'cosmetic').trim() || 'cosmetic';
}

function isCosmeticPerk(perk) {
  return Boolean(perk?.isCosmetic) || (getCategory(perk) !== 'buff' && perk?.effects?.balanceAffecting !== true);
}

function getCosmeticSummary(perk) {
  const fx = perk?.effects && typeof perk.effects === 'object' ? perk.effects : {};
  if (fx.title) return `칭호: ${fx.title}`;
  if (fx.frame) return `프레임: ${fx.frame}`;
  if (fx.badge) return `배지: ${fx.badge}`;
  if (fx.color) return `색상: ${fx.color}`;
  if (fx.effect) return `연출: ${fx.effect}`;
  return isCosmeticPerk(perk) ? '게임 밸런스 영향 없음' : '게임 내 효과 특전';
}

function currentUserView(shop, contextKey, authUser) {
  if (shop.contextKey === contextKey) return shop;
  return {
    contextKey,
    user: authUser || null,
    perks: [],
    loading: Boolean(authUser),
    message: '',
    busyKey: '',
  };
}

export default function PerkShopPage() {
  const authUser = useAuthUser();
  const { showToast: toast } = useToast();
  const authIdentity = userIdentity(authUser);
  const authSession = captureAuthSession();
  const contextKey = authContextKey(authIdentity, authSession);
  const authUserRef = useRef(authUser);
  authUserRef.current = authUser;
  const [shop, setShop] = useState({
    contextKey: '', user: null, perks: [], loading: true, message: '', busyKey: '',
  });
  const [activeCategory, setActiveCategory] = useState('all');
  const contextRef = useRef(contextKey);
  const identityRef = useRef(authIdentity);
  const loadRequestRef = useRef(0);
  const actionRequestRef = useRef(0);
  const actionLockRef = useRef(null);
  const mutationEpochRef = useRef(0);
  const view = currentUserView(shop, contextKey, authUser);

  // Invalidate old-account requests during render so a late promise cannot win
  // the interval before the next effect runs.
  if (contextRef.current !== contextKey) {
    contextRef.current = contextKey;
    identityRef.current = authIdentity;
    loadRequestRef.current += 1;
    actionRequestRef.current += 1;
    actionLockRef.current = null;
    mutationEpochRef.current += 1;
  } else {
    identityRef.current = authIdentity;
  }

  const ownedCodes = useMemo(() => new Set(
    (Array.isArray(view.user?.perks) ? view.user.perks : [])
      .map((value) => String(value || '').trim()).filter(Boolean),
  ), [view.user?.perks]);
  const gameplayLoadouts = useMemo(
    () => normalizeGameplayPerkLoadouts(view.user?.perkLoadouts, [...ownedCodes]),
    [view.user?.perkLoadouts, ownedCodes],
  );
  const categories = useMemo(() => {
    const set = new Set((Array.isArray(view.perks) ? view.perks : []).map(getCategory));
    return ['all', ...[...set].sort((a, b) => (CATEGORY_LABELS[a] || a).localeCompare(CATEGORY_LABELS[b] || b))];
  }, [view.perks]);
  const filteredPerks = useMemo(() => {
    const list = Array.isArray(view.perks) ? view.perks : [];
    if (activeCategory === 'all') return list;
    return list.filter((perk) => getCategory(perk) === activeCategory);
  }, [activeCategory, view.perks]);

  useEffect(() => {
    const requestId = ++loadRequestRef.current;
    const session = captureAuthSession();
    const owner = authIdentity;
    const key = authContextKey(owner, session);
    const mutationEpoch = mutationEpochRef.current;
    let cancelled = false;
    setShop({
      contextKey: key,
      user: authUserRef.current || null,
      perks: [],
      loading: Boolean(owner),
      message: '',
      busyKey: '',
    });
    actionLockRef.current = null;

    if (!owner) return () => { cancelled = true; };

    const isCurrent = () => !cancelled
      && loadRequestRef.current === requestId
      && contextRef.current === key
      && identityRef.current === owner
      && isCurrentAuthSession(session);

    const load = async () => {
      clearApiGetCache('/perks/available');
      try {
        const payload = await apiGet('/perks/available');
        let next = normalizePerksPayload(payload);
        if (!next.user) next.user = await apiGet('/user/me');
        if (!isCurrent()) return;
        if (mutationEpochRef.current !== mutationEpoch) {
          setShop((previous) => previous.contextKey === key ? { ...previous, loading: false } : previous);
          return;
        }
        setShop({ contextKey: key, user: next.user, perks: next.perks, loading: false, message: '', busyKey: '' });
        updateStoredUser(next.user, { session });
      } catch (error) {
        if (!isCurrent()) return;
        if ([401, 403].includes(Number(error?.status || 0))) {
          setShop({ contextKey: key, user: null, perks: [], loading: false, message: '로그인 상태를 확인할 수 없습니다.', busyKey: '' });
          clearAuth({ reason: 'perk-shop-load' });
          return;
        }
        setShop((previous) => previous.contextKey === key
          ? { ...previous, loading: false, message: error?.message || '특전 상점을 불러오지 못했습니다.' }
          : previous);
        toast({ tone: 'warning', message: error?.message || '특전 상점을 불러오지 못했습니다.' });
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [authIdentity, contextKey, toast]);

  useEffect(() => {
    if (!authUser || userIdentity(authUser) !== authIdentity) return;
    setShop((previous) => {
      if (previous.contextKey !== contextKey || !previous.user) return previous;
      return { ...previous, user: { ...previous.user, ...authUser } };
    });
  }, [authUser, authIdentity, contextKey]);

  const runAccountAction = async (busyKey, request, onSuccess, failureFallback) => {
    const owner = authIdentity;
    const key = contextKey;
    if (!owner || !view.user || view.loading || actionLockRef.current) return;
    const session = captureAuthSession();
    if (!isCurrentAuthSession(session) || authContextKey(owner, session) !== key) return;
    const requestId = ++actionRequestRef.current;
    actionLockRef.current = { key, requestId };
    mutationEpochRef.current += 1;
    setShop((previous) => previous.contextKey === key
      ? { ...previous, busyKey, message: '' }
      : previous);

    const isCurrent = () => contextRef.current === key
      && identityRef.current === owner
      && actionRequestRef.current === requestId
      && isCurrentAuthSession(session);

    try {
      const response = await request();
      if (!isCurrent()) return;
      const nextUser = response?.user || null;
      if (nextUser) updateStoredUser(nextUser, { session });
      clearApiGetCache('/perks/available');
      const nextMessage = response?.message || failureFallback;
      setShop((previous) => onSuccess(previous, {
        contextKey: key,
        response,
        nextUser,
        message: nextMessage,
      }));
      toast({ tone: 'success', message: nextMessage });
    } catch (error) {
      if (!isCurrent()) return;
      if ([401, 403].includes(Number(error?.status || 0))) {
        clearAuth({ reason: 'perk-shop-action' });
        setShop({ contextKey: key, user: null, perks: [], loading: false, message: '로그인 상태를 확인할 수 없습니다.', busyKey: '' });
        return;
      }
      const nextMessage = error?.message || failureFallback;
      setShop((previous) => previous.contextKey === key ? { ...previous, message: nextMessage } : previous);
      toast({ tone: 'danger', message: nextMessage });
    } finally {
      if (actionLockRef.current?.requestId === requestId) actionLockRef.current = null;
      if (isCurrent()) {
        setShop((previous) => previous.contextKey === key ? { ...previous, busyKey: '' } : previous);
      }
    }
  };

  const purchase = (perk) => {
    const code = String(perk?.code || '').trim();
    if (!code) return;
    void runAccountAction(`purchase:${code}`, () => apiPost('/perks/purchase', { code }), (previous, context) => {
      if (previous.contextKey !== context.contextKey) return previous;
      const nextUser = context.nextUser || {
        ...(previous.user || {}),
        lp: Number(context.response?.lp ?? previous.user?.lp ?? 0),
        perks: Array.isArray(context.response?.perks) ? context.response.perks : (previous.user?.perks || []),
      };
      return {
        ...previous,
        user: nextUser,
        perks: previous.perks.map((row) => String(row?.code || '') === code ? { ...row, isOwned: true } : row),
        message: context.message,
      };
    }, '특전을 구매했습니다.');
  };

  const toggleGameplayPerk = (perk) => {
    const product = getGameplayPerkProduct(String(perk?.code || ''));
    if (!product || !ownedCodes.has(product.code)) return;
    const current = gameplayLoadouts[product.gameSlug] || [];
    const equipped = current.includes(product.code);
    if (!equipped && current.length >= GAMEPLAY_PERK_LIMIT) return;
    const codes = equipped ? current.filter((code) => code !== product.code) : [...current, product.code];
    const busyKey = `loadout:${product.code}`;
    void runAccountAction(busyKey, () => apiPost('/perks/loadout', {
      gameSlug: product.gameSlug,
      codes,
    }), (previous, context) => previous.contextKey === context.contextKey
      ? {
        ...previous,
        user: context.nextUser || previous.user,
        message: context.message,
      }
      : previous,
    equipped ? '게임 특전 장착을 해제했습니다.' : '게임 특전을 장착했습니다. 다음 새 런 또는 경기부터 적용됩니다.');
  };

  const lp = Math.max(0, Number(view.user?.lp || 0));
  const showLogin = !authIdentity;
  const contextLoading = Boolean(authIdentity) && (view.contextKey !== contextKey || view.loading);

  return (
    <main className="perk-shop-page">
      <SiteHeader />

      <section className="perk-shop-hero">
        <div>
          <p className="perk-shop-eyebrow">LP Perk Shop</p>
          <h1>특전 상점</h1>
          <p>치장 특전은 계정에 영구 보유하고, 플레이 특전은 게임별로 장착해 다음 새 런 또는 경기부터 적용할 수 있습니다.</p>
        </div>
        <div className="perk-wallet">
          <span>보유 LP</span>
          <strong>{lp.toLocaleString('ko-KR')}</strong>
          <small>{view.user?.username ? `${view.user.username} 계정` : '로그인이 필요합니다.'}</small>
        </div>
      </section>

      {view.message ? <div className="perk-shop-message" role="status">{view.message}</div> : null}

      {showLogin ? (
        <section className="perk-empty-panel">
          <h2>로그인이 필요합니다.</h2>
          <p>LP와 보유 특전은 계정 단위로 저장됩니다.</p>
          <Link href="/login" className="perk-primary-link">로그인하기</Link>
        </section>
      ) : (
        <>
          {authIdentity ? (
            <section className="perk-loadouts" aria-label="게임별 장착 특전">
              {Object.entries(GAMEPLAY_GAME_LABELS).map(([gameSlug, gameName]) => {
                const codes = gameplayLoadouts[gameSlug] || [];
                const names = codes.map((code) => getGameplayPerkProduct(code)?.name).filter(Boolean);
                return (
                  <article className="perk-loadout-card" key={gameSlug}>
                    <div className="perk-loadout-header">
                      <div>
                        <span className="perk-loadout-eyebrow">게임별 장착</span>
                        <h2>{gameName}</h2>
                      </div>
                      <strong className="perk-loadout-count">{codes.length}/{GAMEPLAY_PERK_LIMIT}</strong>
                    </div>
                    {names.length ? (
                      <ul>{names.map((name) => <li key={name}>{name}</li>)}</ul>
                    ) : <p className="perk-loadout-empty">장착한 플레이 특전이 없습니다.</p>}
                    <p className="perk-loadout-note">장착 내용은 다음 새 런 또는 경기부터 적용됩니다.</p>
                  </article>
                );
              })}
            </section>
          ) : null}

          <div className="perk-filter-row" aria-label="특전 종류 필터">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={activeCategory === category ? 'active' : ''}
                aria-pressed={activeCategory === category}
                onClick={() => setActiveCategory(category)}
              >
                {category === 'all' ? '전체' : CATEGORY_LABELS[category] || category}
              </button>
            ))}
          </div>

          {contextLoading ? (
            <section className="perk-empty-panel">특전 목록을 불러오는 중입니다.</section>
          ) : (
            <section className="perk-grid">
              {filteredPerks.map((perk) => {
                const code = String(perk?.code || '');
                const category = getCategory(perk);
                const owned = Boolean(perk?.isOwned) || ownedCodes.has(code);
                const cost = Math.max(0, Number(perk?.lpCost || 0));
                const canBuy = Boolean(authIdentity) && !owned && lp >= cost && !view.busyKey && !contextLoading;
                const cosmetic = isCosmeticPerk(perk);
                const product = getGameplayPerkProduct(code);
                const isEquipped = Boolean(product && gameplayLoadouts[product.gameSlug]?.includes(code));
                const gameFull = Boolean(product && !isEquipped && (gameplayLoadouts[product.gameSlug]?.length || 0) >= GAMEPLAY_PERK_LIMIT);
                const canToggle = Boolean(product && owned && !view.busyKey && !contextLoading && (isEquipped || !gameFull));
                const busy = view.busyKey === `purchase:${code}` || view.busyKey === `loadout:${code}`;
                return (
                  <article key={perk?._id || code} className={`perk-card ${owned ? 'owned' : ''} ${cosmetic ? 'cosmetic' : 'balance'} ${product ? 'gameplay' : ''}`}>
                    <div className="perk-card-top">
                      <div className="perk-icon">{CATEGORY_ICONS[category] || 'P'}</div>
                      <div>
                        <span className="perk-category">{product ? `${GAMEPLAY_GAME_LABELS[product.gameSlug]} · 플레이 특전` : CATEGORY_LABELS[category] || category}</span>
                        <h2>{perk?.name || code}</h2>
                      </div>
                    </div>
                    <p>{product?.description || perk?.description || '특전 설명이 없습니다.'}</p>
                    <div className="perk-meta">
                      {product ? (
                        <>
                          <span className="safe">영구 보유</span>
                          <span className="perk-resource">구매 재화: LP</span>
                          {product.gameSlug === 'eternal-hunger' ? <span className="perk-resource">경기 효과: 경기 크레딧</span> : <span className="perk-resource">적용 단위: 게임 내 자원·연구 점수</span>}
                          {product.gameSlug === 'primitive-archive' && product.effects.maxUses ? <span>런당 최대 {product.effects.maxUses}회 적용</span> : null}
                          {product.effects.gameplayKind === 'start_sponsor' ? <span>경기 효과: 대원별 경기 크레딧 +{product.effects.amount}</span> : null}
                          {product.effects.gameplayKind === 'procurement_partner' ? <span>경기 재화: 키오스크·드론 구매 {Math.round(product.effects.discountPct * 100)}% 할인</span> : null}
                          {product.gameSlug === 'eternal-hunger' ? <span>경기 전에 지정한 후원 팀에 적용</span> : null}
                        </>
                      ) : (
                        <>
                          <span>{getCosmeticSummary(perk)}</span>
                          <span className={cosmetic ? 'safe' : 'perk-resource'}>{cosmetic ? '밸런스 영향 없음' : '플레이 효과'}</span>
                          {owned ? <span className="safe">영구 보유</span> : null}
                        </>
                      )}
                    </div>
                    <div className="perk-card-bottom">
                      <strong>{cost.toLocaleString('ko-KR')} LP</strong>
                      <div className="perk-card-actions">
                        {product && owned ? (
                          <button
                            type="button"
                            className={isEquipped ? 'perk-equip-button equipped' : 'perk-equip-button'}
                            disabled={!canToggle || busy}
                            onClick={() => toggleGameplayPerk(perk)}
                          >
                            {busy ? '저장 중...' : isEquipped ? '장착 해제' : gameFull ? '장착 슬롯 가득 참' : '장착'}
                          </button>
                        ) : null}
                        <button type="button" disabled={!canBuy || busy} onClick={() => purchase(perk)}>
                          {owned ? '보유 중' : busy ? '구매 중...' : lp < cost ? 'LP 부족' : '구매'}
                        </button>
                      </div>
                    </div>
                    {product && owned ? <div className="perk-equipped-status">{isEquipped ? '장착 중 · 다음 새 런 또는 경기부터 적용' : '미장착 · 장착해야 효과가 적용됩니다.'}</div> : null}
                  </article>
                );
              })}

              {filteredPerks.length === 0 ? (
                <div className="perk-empty-panel">표시할 특전이 없습니다.</div>
              ) : null}
            </section>
          )}
        </>
      )}
    </main>
  );
}
