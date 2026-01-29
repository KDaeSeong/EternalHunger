'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '../../utils/api';

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ items: 0, maps: 0, kiosks: 0, drone: 0, perks: 0 });
  const [lpGift, setLpGift] = useState({ username: '', amount: 0 });
  const [creditGrant, setCreditGrant] = useState({ username: '', amount: 0 });
  const [message, setMessage] = useState('');

  const loadCounts = async () => {
    try {
      const [items, maps, kiosks, drone, perks] = await Promise.all([
        apiGet('/admin/items'),
        apiGet('/admin/maps'),
        apiGet('/admin/kiosks'),
        apiGet('/admin/drone-offers'),
        apiGet('/admin/perks'),
      ]);
      setCounts({
        items: items?.length || 0,
        maps: maps?.length || 0,
        kiosks: kiosks?.length || 0,
        drone: drone?.length || 0,
        perks: perks?.length || 0,
      });
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  useEffect(() => {
    loadCounts();
  }, []);

  const resetLp = async () => {
    if (!confirm('정말 모든 유저의 LP를 0으로 초기화할까요?')) return;
    try {
      const res = await apiPost('/admin/reset-lp', {});
      setMessage(res?.message || '초기화 완료');
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  const giveLp = async () => {
    try {
      const res = await apiPost('/admin/give-lp', { username: lpGift.username, amount: Number(lpGift.amount || 0) });
      setMessage(res?.message || '지급 완료');
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  const grantCredits = async () => {
    try {
      const res = await apiPost('/credits/grant', { username: creditGrant.username, amount: Number(creditGrant.amount || 0) });
      setMessage(res?.message || '지급 완료');
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  return (
    <div>
      <div className="admin-topbar">
        <h1>대시보드</h1>
        <div className="admin-btn-row">
          <Link className="admin-btn" href="/admin/items">아이템 관리</Link>
          <Link className="admin-btn" href="/admin/maps">맵/구역 관리</Link>
          <Link className="admin-btn" href="/admin/kiosks">키오스크 관리</Link>
        </div>
      </div>

      {message ? (
        <div className="admin-card" style={{ marginBottom: 14 }}>
          <div className="admin-muted">메시지</div>
          <div style={{ marginTop: 6 }}>{message}</div>
        </div>
      ) : null}

      <div className="admin-grid">
        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>시즌 / LP</h3>
          <div className="admin-muted">로드맵 외 운영툴(초기화/지급)</div>
          <div className="admin-btn-row" style={{ marginTop: 12 }}>
            <button className="admin-btn danger" onClick={resetLp}>LP 전체 초기화</button>
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="admin-field">
              <label>LP 선물: 유저 닉네임</label>
              <input value={lpGift.username} onChange={(e) => setLpGift({ ...lpGift, username: e.target.value })} placeholder="username" />
            </div>
            <div className="admin-field">
              <label>LP 선물: 지급량</label>
              <input type="number" value={lpGift.amount} onChange={(e) => setLpGift({ ...lpGift, amount: e.target.value })} placeholder="10" />
            </div>
            <button className="admin-btn primary" onClick={giveLp}>LP 지급</button>
          </div>
        </div>

        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>크레딧 지급</h3>
          <div className="admin-muted">로드맵 5번(크레딧 시스템) 운영툴</div>
          <div style={{ marginTop: 14 }}>
            <div className="admin-field">
              <label>유저 닉네임</label>
              <input value={creditGrant.username} onChange={(e) => setCreditGrant({ ...creditGrant, username: e.target.value })} placeholder="username" />
            </div>
            <div className="admin-field">
              <label>지급량(+) / 회수량(-)</label>
              <input type="number" value={creditGrant.amount} onChange={(e) => setCreditGrant({ ...creditGrant, amount: e.target.value })} placeholder="100" />
            </div>
            <button className="admin-btn primary" onClick={grantCredits}>크레딧 반영</button>
          </div>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>콘텐츠 현황</h3>
        <div className="admin-muted">(DB 기준) 아이템/맵/키오스크/드론/특전 개수</div>
        <div style={{ marginTop: 10 }}>
          아이템 {counts.items}개 · 맵 {counts.maps}개 · 키오스크 {counts.kiosks}개 · 드론 판매 {counts.drone}개 · 특전 {counts.perks}개
        </div>
        <div className="admin-btn-row" style={{ marginTop: 10 }}>
          <button className="admin-btn" onClick={loadCounts}>새로고침</button>
          <Link className="admin-btn" href="/admin/drone">드론 판매 편집</Link>
          <Link className="admin-btn" href="/admin/perks">특전 편집</Link>
        </div>
      </div>
    </div>
  );
}
