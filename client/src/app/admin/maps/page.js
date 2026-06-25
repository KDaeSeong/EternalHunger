'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../utils/api';

const KIOSK_MAP_NAMES = new Set([
  '양궁장',
  '학교',
  '연구소',
  '경찰서',
  '소방서',
  '절',
  '병원',
  '창고',
  '바지선',
  '성당',
  '호텔',
]);

function looksLikeKioskMap(name) {
  const n = String(name || '').trim();
  if (!n) return false;
  if (KIOSK_MAP_NAMES.has(n)) return true;
  const t = n.toLowerCase();
  const keywords = [
    'archery',
    'school',
    'academy',
    'lab',
    'research',
    'police',
    'fire',
    'firestation',
    'temple',
    'hospital',
    'warehouse',
    'storage',
    'barge',
    'vessel',
    'ship',
    'cathedral',
    'church',
    'hotel',
  ];
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
        <h1>맵 지정</h1>
        <div className="admin-btn-row">
          <button className="admin-btn" onClick={load} disabled={busy}>새로고침</button>
          <button
            className="admin-btn"
            onClick={() => run(() => apiPost('/admin/maps/normalize-list', {}))}
            disabled={busy}
            title="운영 맵 목록을 기본값 기준으로 정리"
          >
            맵 목록 정리
          </button>
          <button
            className="admin-btn"
            onClick={() => {
              if (!confirm('현재 계정의 맵 구역/동선을 기본 루미아 연결표로 덮어쓸까요?')) return;
              run(() => apiPost('/admin/maps/apply-default-zones', { mode: 'force' }));
            }}
            disabled={busy}
            title="루미아 섬 구역 목록과 길 연결표를 현재 계정 맵에 강제 적용"
          >
            구역/동선 적용
          </button>
          <button
            className="admin-btn"
            onClick={() => run(() => apiPost('/admin/kiosks/generate', { mode: 'missing' }))}
            disabled={busy}
            title="키오스크 위치 맵에서 누락된 키오스크만 생성"
          >
            키오스크 자동 생성
          </button>
          <button
            className="admin-btn danger"
            onClick={() => {
              if (!confirm('정말로 덮어쓸까요?\n\n대상 지역의 키오스크를 모두 삭제 후 맵당 1개로 재생성합니다.')) return;
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
            title="기존 키오스크 데이터를 맵당 1개로 정리"
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
          zones는 게임 런타임에서 우선 사용되며, 없으면 기본 루미아 섬 데이터로 동작합니다.
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
