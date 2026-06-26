'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, clearAuth, getUser, updateStoredUser } from '../../utils/api';

const CATEGORY_LABELS = {
  title: '칭호',
  portrait_frame: '초상화 프레임',
  badge: '배지',
  log_style: '로그 연출',
  victory_effect: '승리 연출',
  cosmetic: '치장',
  buff: '버프',
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
  return isCosmeticPerk(perk) ? '게임 밸런스 영향 없음' : '향후 밸런스형 특전';
}

export default function PerkShopPage() {
  const [user, setUser] = useState(null);
  const [perks, setPerks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [busyCode, setBusyCode] = useState('');

  const ownedCodes = useMemo(() => {
    return new Set((Array.isArray(user?.perks) ? user.perks : []).map((x) => String(x || '').trim()).filter(Boolean));
  }, [user]);

  const categories = useMemo(() => {
    const set = new Set((Array.isArray(perks) ? perks : []).map(getCategory));
    return ['all', ...[...set].sort((a, b) => (CATEGORY_LABELS[a] || a).localeCompare(CATEGORY_LABELS[b] || b))];
  }, [perks]);

  const filteredPerks = useMemo(() => {
    const list = Array.isArray(perks) ? perks : [];
    if (activeCategory === 'all') return list;
    return list.filter((perk) => getCategory(perk) === activeCategory);
  }, [activeCategory, perks]);

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const payload = await apiGet('/perks/available');
      const next = normalizePerksPayload(payload);
      setPerks(next.perks);
      const nextUser = next.user || await apiGet('/user/me');
      setUser(nextUser);
      updateStoredUser(nextUser);
    } catch (err) {
      if (Number(err?.status || 0) === 401 || Number(err?.status || 0) === 403) {
        clearAuth();
        setUser(null);
      }
      setMessage(err.message || '특전 상점을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setUser(getUser());
    void load();
  }, []);

  const purchase = async (perk) => {
    const code = String(perk?.code || '').trim();
    if (!code || busyCode) return;
    setBusyCode(code);
    setMessage('');
    try {
      const res = await apiPost('/perks/purchase', { code });
      if (res?.user) {
        setUser(res.user);
        updateStoredUser(res.user);
      } else {
        setUser((prev) => ({
          ...(prev || {}),
          lp: Number(res?.lp ?? prev?.lp ?? 0),
          perks: Array.isArray(res?.perks) ? res.perks : (prev?.perks || []),
        }));
      }
      setPerks((prev) => (Array.isArray(prev) ? prev.map((row) => (
        String(row?.code || '') === code ? { ...row, isOwned: true } : row
      )) : []));
      setMessage(res?.message || '특전을 구매했습니다.');
    } catch (err) {
      setMessage(err.message || '특전 구매에 실패했습니다.');
    } finally {
      setBusyCode('');
    }
  };

  const lp = Math.max(0, Number(user?.lp || 0));

  return (
    <main className="perk-shop-page">
      <header className="perk-shop-header">
        <Link href="/" className="perk-shop-logo" aria-label="메인으로">
          <span>ETERNAL</span>
          <strong>HUNGER</strong>
        </Link>
        <nav className="perk-shop-nav">
          <Link href="/">메인</Link>
          <Link href="/simulation">게임 시작</Link>
          <Link href="/characters">캐릭터 설정</Link>
        </nav>
      </header>

      <section className="perk-shop-hero">
        <div>
          <p className="perk-shop-eyebrow">LP Perk Shop</p>
          <h1>특전 상점</h1>
          <p>먼저 칭호, 배지, 초상화 프레임처럼 게임 밸런스에 영향을 주지 않는 치장 특전부터 사용할 수 있습니다.</p>
        </div>
        <div className="perk-wallet">
          <span>보유 LP</span>
          <strong>{lp.toLocaleString()}</strong>
          <small>{user?.username ? `${user.username} 계정` : '로그인이 필요합니다'}</small>
        </div>
      </section>

      {message ? <div className="perk-shop-message">{message}</div> : null}

      {!user && !loading ? (
        <section className="perk-empty-panel">
          <h2>로그인이 필요합니다</h2>
          <p>LP와 보유 특전은 계정 단위로 저장됩니다.</p>
          <Link href="/login" className="perk-primary-link">로그인하기</Link>
        </section>
      ) : (
        <>
          <div className="perk-filter-row">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={activeCategory === category ? 'active' : ''}
                onClick={() => setActiveCategory(category)}
              >
                {category === 'all' ? '전체' : CATEGORY_LABELS[category] || category}
              </button>
            ))}
          </div>

          {loading ? (
            <section className="perk-empty-panel">특전 목록을 불러오는 중입니다...</section>
          ) : (
            <section className="perk-grid">
              {filteredPerks.map((perk) => {
                const code = String(perk?.code || '');
                const category = getCategory(perk);
                const owned = Boolean(perk?.isOwned) || ownedCodes.has(code);
                const cost = Math.max(0, Number(perk?.lpCost || 0));
                const canBuy = !owned && lp >= cost && !busyCode;
                const cosmetic = isCosmeticPerk(perk);
                return (
                  <article key={perk?._id || code} className={`perk-card ${owned ? 'owned' : ''} ${cosmetic ? 'cosmetic' : 'balance'}`}>
                    <div className="perk-card-top">
                      <div className="perk-icon">{CATEGORY_ICONS[category] || 'P'}</div>
                      <div>
                        <span className="perk-category">{CATEGORY_LABELS[category] || category}</span>
                        <h2>{perk?.name || code}</h2>
                      </div>
                    </div>
                    <p>{perk?.description || '특전 설명이 없습니다.'}</p>
                    <div className="perk-meta">
                      <span>{getCosmeticSummary(perk)}</span>
                      <span className={cosmetic ? 'safe' : 'future'}>{cosmetic ? '밸런스 영향 없음' : '밸런스형'}</span>
                    </div>
                    <div className="perk-card-bottom">
                      <strong>{cost.toLocaleString()} LP</strong>
                      <button type="button" disabled={!canBuy} onClick={() => purchase(perk)}>
                        {owned ? '보유 중' : busyCode === code ? '구매 중...' : lp < cost ? 'LP 부족' : '구매'}
                      </button>
                    </div>
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
