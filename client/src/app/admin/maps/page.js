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

const KIOSK_ZONE_IDS = new Set([
  'archery',
  'school',
  'lab',
  'police',
  'firestation',
  'temple',
  'hospital',
  'warehouse',
  'barge',
  'cathedral',
  'hotel',
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

function looksLikeKioskZone(zone) {
  const zoneId = String(zone?.zoneId || '').trim();
  if (zoneId && KIOSK_ZONE_IDS.has(zoneId)) return true;
  if (zone?.hasKiosk === true) return true;
  return looksLikeKioskMap(zone?.name);
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

  const zoneRows = useMemo(() => {
    const out = [];
    for (const m of Array.isArray(maps) ? maps : []) {
      const zones = Array.isArray(m?.zones) ? m.zones : [];
      if (zones.length) {
        zones.forEach((z, idx) => {
          out.push({
            key: `${m._id}:${z?.zoneId || idx}`,
            mapId: m._id,
            mapName: m.name,
            zoneNo: Number(z?.zoneNo || idx + 1),
            zoneId: String(z?.zoneId || ''),
            name: String(z?.name || ''),
            hasKiosk: looksLikeKioskZone(z),
            coreSpawn: z?.coreSpawn === true,
          });
        });
      } else {
        out.push({
          key: `${m._id}:map`,
          mapId: m._id,
          mapName: m.name,
          zoneNo: 0,
          zoneId: '',
          name: m.name,
          hasKiosk: looksLikeKioskMap(m?.name),
          coreSpawn: false,
        });
      }
    }
    return out.sort((a, b) => String(a.mapName).localeCompare(String(b.mapName), 'ko') || a.zoneNo - b.zoneNo);
  }, [maps]);

  const kioskZoneCount = useMemo(() => zoneRows.filter((z) => z.hasKiosk).length, [zoneRows]);

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
        <h1>맵/구역 지정</h1>
        <div className="admin-btn-row">
          <button className="admin-btn" onClick={load} disabled={busy}>새로고침</button>
          <button
            className="admin-btn"
            onClick={() => run(() => apiPost('/admin/maps/normalize-list', {}))}
            disabled={busy}
            title="현재 계정의 기본 맵을 루미아 섬 1개와 22개 구역 구조로 정리"
          >
            루미아 맵 정리
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
            title="키오스크 구역에서 누락된 키오스크만 생성"
          >
            키오스크 자동 생성
          </button>
          <button
            className="admin-btn danger"
            onClick={() => {
              if (!confirm('정말로 덮어쓸까요?\n\n대상 키오스크를 모두 삭제 후 구역당 1개로 재생성합니다.')) return;
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
            title="기존 키오스크 데이터를 구역당 1개로 정리"
          >
            키오스크 정규화
          </button>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 900 }}>현재 맵 상태</div>
        <div className="admin-muted" style={{ marginTop: 6 }}>
          맵 {maps.length}개 / 구역 {zoneRows.length}개 / 키오스크 구역 {kioskZoneCount}개
        </div>
        <div className="admin-muted" style={{ marginTop: 6 }}>
          화면에는 Map 문서 안의 zones를 펼쳐 보여줍니다. 정상 구조는 루미아 섬 1개 맵에 22개 구역, 키오스크 구역 11개입니다.
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

      <div className="admin-card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>맵 목록</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>맵</th>
              <th>id</th>
              <th>구역</th>
            </tr>
          </thead>
          <tbody>
            {maps.map((m) => (
              <tr key={m._id}>
                <td style={{ fontWeight: 800 }}>{m.name}</td>
                <td className="admin-muted" style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{m._id}</td>
                <td className="admin-muted">{Array.isArray(m?.zones) ? m.zones.length : 0}개</td>
              </tr>
            ))}
            {maps.length === 0 ? (
              <tr><td colSpan={3} className="admin-muted">맵이 없습니다.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>구역 목록</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>맵</th>
              <th>구역</th>
              <th>zoneId</th>
              <th>키오스크</th>
              <th>자연 코어</th>
            </tr>
          </thead>
          <tbody>
            {zoneRows.map((z) => (
              <tr key={z.key}>
                <td className="admin-muted">{z.mapName}</td>
                <td style={{ fontWeight: 800 }}>{z.name}</td>
                <td className="admin-muted" style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{z.zoneId || '-'}</td>
                <td className="admin-muted">{z.hasKiosk ? '예' : '-'}</td>
                <td className="admin-muted">{z.coreSpawn ? '예' : '-'}</td>
              </tr>
            ))}
            {zoneRows.length === 0 ? (
              <tr><td colSpan={5} className="admin-muted">구역이 없습니다.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
