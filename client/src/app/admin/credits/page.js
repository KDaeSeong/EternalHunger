'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../utils/api';

export default function AdminCreditsPage() {
  const [myCredits, setMyCredits] = useState(null);
  const [form, setForm] = useState({ username: '', amount: 0 });
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const res = await apiGet('/credits/balance');
      setMyCredits(res?.credits ?? 0);
    } catch (e) {
      // 관리자여도 사용자 테이블에 credits 필드가 없다면 실패할 수 있어서 메시지로만
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const grant = async () => {
    try {
      const res = await apiPost('/credits/grant', { username: form.username, amount: Number(form.amount || 0) });
      setMessage(res?.message || '반영 완료');
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  return (
    <div>
      <div className="admin-topbar">
        <h1>크레딧</h1>
        <div className="admin-btn-row">
          <button className="admin-btn" onClick={load}>내 크레딧 조회</button>
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
          <h3 style={{ marginTop: 0 }}>지급/회수</h3>
          <div className="admin-muted">amount는 +면 지급, -면 회수입니다.</div>
          <div style={{ marginTop: 12 }}>
            <div className="admin-field">
              <label>유저 닉네임</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="username" />
            </div>
            <div className="admin-field">
              <label>amount</label>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="100" />
            </div>
            <button className="admin-btn primary" onClick={grant}>반영</button>
          </div>
        </div>

        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>내 크레딧</h3>
          <div className="admin-muted">/api/credits/balance</div>
          <div style={{ marginTop: 12, fontSize: 28, fontWeight: 800 }}>
            {myCredits === null ? '—' : myCredits}
          </div>
          <div className="admin-muted" style={{ marginTop: 8 }}>
            실제 게임 내 지급 규칙(페이즈 지급/처치 보상/판매 보상)은 서버 로직에서 확장하면 됩니다.
          </div>
        </div>
      </div>
    </div>
  );
}
