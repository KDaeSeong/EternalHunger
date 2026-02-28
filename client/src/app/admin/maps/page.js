'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../utils/api';

const KIOSK_MAP_NAMES = new Set([
  '병원', '양궁장', '호텔', '창고', '연구소', '절', '소방서', '경찰서', '성당', '학교',
]);

function looksLikeKioskMap(name) {
  const n = String(name || '').trim();
  if (!n) return false;
  if (KIOSK_MAP_NAMES.has(n)) return true;
  const t = n.toLowerCase();
  const keywords = ['hospital','archery','hotel','warehouse','storage','lab','research','temple','fire','firestation','police','cathedral','church','school','academy'];
  return keywords.some((k) => t.includes(k));
}

export default function AdminMapsPage() {
  const [maps, setMaps] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);

  const load = async () => {
    setMsg('');
    try {
      const res = await apiGet('/admin/maps');
      setMaps(Array.isArray(res) ? res : []);
    } catch (e) {
      setMsg(e?.response?.data?.error || e.message || '맵 로드 실패');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const kioskMapsCount = useMemo(() => maps.filter((m) => looksLikeKioskMap(m?.name)).length, [maps]);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fn();
      setLast(res || null);
      setMsg(res?.message || '완료');
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.error || e.message || '실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="admin-topbar">
        <h1>맵/지역</h1>
        <div className="admin-btn-row">
          <button className="admin-btn" onClick={load} disabled={busy}>새로고침</button>
          <button
            className="admin-btn"
            onClick={() => run(() => apiPost('/admin/maps/normalize-list', {}))}
            disabled={busy}
            title="공원 삭제 + 소방서/경찰서 자동 생성"
          >
            맵 목록 정리
          </button>
          <button
            className="admin-btn"
            onClick={() => run(() => apiPost('/admin/kiosks/generate', { mode: 'missing' }))}
            disabled={busy}
            title="키오스크 지역(병원/학교/연구소 등)에서 누락된 키오스크만 생성"
          >
            키오스크 자동 생성
          </button>
          <button
            className="admin-btn danger"
            onClick={() => {
              if (!confirm('정말로 덮어쓸까요?\n\n대상 지역의 키오스크를 전부 삭제 후, 맵당 1개로 재생성합니다.')) return;
              run(() => apiPost('/admin/kiosks/generate', { mode: 'force' }));
            }}
            disabled={busy}
          >
            강제 덮어쓰기
          </button>
          <button
            className="admin-btn"
            onClick={() => run(() => apiPost('/admin/kiosks/normalize', {}))}
            disabled={busy}
            title="기존 데이터(전부 병원/중복 등)를 맵당 1개로 정리"
          >
            키오스크 정규화
          </button>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 900 }}>현재 맵 상태</div>
        <div className="admin-muted" style={{ marginTop: 6 }}>
          총 {maps.length}개 / 키오스크 지역 {kioskMapsCount}개
        </div>
        <div className="admin-muted" style={{ marginTop: 6 }}>
          ※ zones(세부 존)은 운영에서 숨김 처리했습니다. 시뮬은 내부 기본값으로 동작합니다.
        </div>
      </div>

      {msg ? (
        <div className="admin-card" style={{ marginBottom: 14 }}>
          <div className="admin-muted">메시지</div>
          <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{msg}</div>
          {last ? (
            <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, Menlo, monospace', opacity: 0.9 }}>
              {JSON.stringify(last, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>맵 목록</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>id</th>
              <th>키오스크</th>
            </tr>
          </thead>
          <tbody>
            {maps.map((m) => (
              <tr key={m._id}>
                <td style={{ fontWeight: 800 }}>{m.name}</td>
                <td className="admin-muted" style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{m._id}</td>
                <td className="admin-muted">{looksLikeKioskMap(m?.name) ? '예' : '-'}</td>
              </tr>
            ))}
            {maps.length === 0 ? (
              <tr><td colSpan={3} className="admin-muted">맵이 없습니다.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
