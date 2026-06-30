'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../utils/api';

const LOAD_TIMEOUT_MS = 30000;
const REPAIR_TIMEOUT_MS = 60000;

function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.maps)) return payload.maps;
  if (Array.isArray(payload?.kiosks)) return payload.kiosks;
  if (Array.isArray(payload?.offers)) return payload.offers;
  if (Array.isArray(payload?.perks)) return payload.perks;
  return [];
}

function itemIdentity(item) {
  return String(item?.itemKey || item?.externalId || item?.id || '').trim();
}

function itemName(item) {
  return String(item?.name || item?.itemName || itemIdentity(item) || '이름 없음').trim();
}

function isNamuItem(item) {
  const key = String(item?.itemKey || '').trim();
  const externalId = String(item?.externalId || '').trim();
  return key.startsWith('namu:') || externalId.startsWith('namu:');
}

function isGeneratedItem(item) {
  const tags = Array.isArray(item?.tags) ? item.tags.map(String) : [];
  const source = String(item?.source || '').toLowerCase();
  return source === 'simulation' || tags.includes('simulation') || tags.includes('generated');
}

function zoneName(zone) {
  return String(zone?.name || zone?.zoneName || zone?.id || zone?.zoneId || '').trim();
}

function countDuplicateGroups(items) {
  const groups = new Map();
  for (const item of items) {
    const id = itemIdentity(item);
    if (!id) continue;
    groups.set(id, (groups.get(id) || 0) + 1);
  }
  return [...groups.entries()].filter(([, count]) => count > 1);
}

function summarizeMaps(maps) {
  const zoneCounts = maps.map((map) => (Array.isArray(map?.zones) ? map.zones.length : 0));
  const totalZones = zoneCounts.reduce((sum, count) => sum + count, 0);
  const missingZones = maps.filter((map) => !Array.isArray(map?.zones) || map.zones.length < 19);
  const nonStandardZoneMaps = maps.filter((map) => !Array.isArray(map?.zones) || map.zones.length !== 19);
  const legacyZones = [];

  for (const map of maps) {
    for (const zone of Array.isArray(map?.zones) ? map.zones : []) {
      const name = zoneName(zone);
      if (['공원', '아파트단지', '해수욕장'].includes(name)) {
        legacyZones.push(`${String(map?.name || '맵')}: ${name}`);
      }
    }
  }

  return { totalZones, missingZones, nonStandardZoneMaps, legacyZones };
}

export default function AdminDataHealthPanel() {
  const [data, setData] = useState({
    items: [],
    maps: [],
    kiosks: [],
    droneOffers: [],
    perks: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [items, maps, kiosks, droneOffers, perks] = await Promise.all([
        apiGet('/admin/items', { timeoutMs: LOAD_TIMEOUT_MS }).then(asArray),
        apiGet('/admin/maps', { timeoutMs: LOAD_TIMEOUT_MS }).then(asArray),
        apiGet('/admin/kiosks', { timeoutMs: LOAD_TIMEOUT_MS }).then(asArray),
        apiGet('/admin/drone-offers', { timeoutMs: LOAD_TIMEOUT_MS }).then(asArray),
        apiGet('/admin/perks', { timeoutMs: LOAD_TIMEOUT_MS }).then(asArray),
      ]);
      setData({ items, maps, kiosks, droneOffers, perks });
    } catch (err) {
      setMessage(err?.message || '관리자 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const health = useMemo(() => {
    const duplicateGroups = countDuplicateGroups(data.items);
    const nonNamuItems = data.items.filter((item) => !isNamuItem(item));
    const generatedItems = data.items.filter(isGeneratedItem);
    const lockedItems = data.items.filter((item) => item?.lockedByAdmin);
    const maps = summarizeMaps(data.maps);
    const kioskZones = new Set(
      data.kiosks
        .map((kiosk) => String(kiosk?.zoneId || kiosk?.zoneName || kiosk?.mapName || '').trim())
        .filter(Boolean)
    );

    const issues = [];
    if (duplicateGroups.length) {
      issues.push(`중복 아이템 키 ${duplicateGroups.length}그룹`);
    }
    if (nonNamuItems.length) {
      issues.push(`namu: 접두사가 없는 아이템 ${nonNamuItems.length}개`);
    }
    if (generatedItems.length) {
      issues.push(`시뮬레이션 생성 흔적 아이템 ${generatedItems.length}개`);
    }
    if (maps.nonStandardZoneMaps.length) {
      issues.push(`구역 수가 19개가 아닌 맵 ${maps.nonStandardZoneMaps.length}개`);
    }
    if (maps.legacyZones.length) {
      issues.push(`롤백 대상 구역명 ${maps.legacyZones.length}개`);
    }
    if (data.kiosks.length < 11 || kioskZones.size < 8) {
      issues.push(`키오스크 데이터가 부족할 수 있음 (${data.kiosks.length}개)`);
    }

    return {
      duplicateGroups,
      nonNamuItems,
      generatedItems,
      lockedItems,
      maps,
      kioskZones,
      issues,
    };
  }, [data]);

  const runRepair = useCallback(
    async (label, fn) => {
      setBusy(label);
      setMessage('');
      try {
        const result = await fn();
        const text = result?.message || result?.summary?.message || `${label} 완료`;
        setMessage(text);
        await load();
      } catch (err) {
        setMessage(err?.message || `${label} 실패`);
      } finally {
        setBusy('');
      }
    },
    [load]
  );

  const cards = [
    { label: '아이템', value: data.items.length, sub: `잠금 ${health.lockedItems.length} / 중복 ${health.duplicateGroups.length}` },
    { label: '맵/구역', value: data.maps.length, sub: `구역 합계 ${health.maps.totalZones} / 기준 ${data.maps.length * 19}` },
    { label: '키오스크', value: data.kiosks.length, sub: `구역 ${health.kioskZones.size}곳` },
    { label: '드론/특전', value: `${data.droneOffers.length}/${data.perks.length}`, sub: '드론 제안 / 특전' },
  ];

  return (
    <section className="admin-health-panel" aria-label="관리자 데이터 진단">
      <div className="admin-health-head">
        <div>
          <p>데이터 진단</p>
          <h2>운영 데이터 건강 상태</h2>
        </div>
        <button type="button" onClick={load} disabled={loading || Boolean(busy)}>
          {loading ? '확인 중...' : '새로고침'}
        </button>
      </div>

      <div className="admin-health-cards">
        {cards.map((card) => (
          <div key={card.label} className="admin-health-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.sub}</small>
          </div>
        ))}
      </div>

      <div className="admin-health-body">
        <div className="admin-health-issues">
          <strong>미리보기</strong>
          {health.issues.length ? (
            <ul>
              {health.issues.slice(0, 6).map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
              {health.nonNamuItems.slice(0, 3).map((item) => (
                <li key={`non-namu-${item?._id || itemIdentity(item)}`}>
                  비기본 아이템: {itemName(item)}
                </li>
              ))}
              {health.maps.nonStandardZoneMaps.slice(0, 3).map((map) => (
                <li key={`zones-${map?._id || map?.name}`}>
                  맵 구역 수 확인: {String(map?.name || '이름 없음')} ({Array.isArray(map?.zones) ? map.zones.length : 0}개)
                </li>
              ))}
              {health.maps.legacyZones.slice(0, 3).map((item) => (
                <li key={`legacy-${item}`}>구역명 정리 필요: {item}</li>
              ))}
            </ul>
          ) : (
            <div className="admin-health-ok">눈에 띄는 데이터 이상은 없습니다.</div>
          )}
        </div>

        <div className="admin-health-actions">
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              runRepair('기본 아이템 트리 생성', () =>
                apiPost('/admin/items/generate-default-tree', {}, { timeoutMs: REPAIR_TIMEOUT_MS })
              )
            }
          >
            기본 아이템 트리 생성
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              runRepair('아이템 중복 정리', () =>
                apiPost('/admin/items/dedupe', { prefix: 'namu:', limitGroups: 50 }, { timeoutMs: REPAIR_TIMEOUT_MS })
              )
            }
          >
            중복 아이템 정리
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              runRepair('비기본 아이템 삭제', () =>
                apiPost('/admin/items/delete-non-namu', { limit: 200 }, { timeoutMs: REPAIR_TIMEOUT_MS })
              )
            }
          >
            namu: 아닌 아이템 삭제
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              runRepair('맵 기본 구역 적용', () =>
                apiPost('/admin/maps/apply-default-zones', { mode: 'force' }, { timeoutMs: REPAIR_TIMEOUT_MS })
              )
            }
          >
            맵 구역 복구
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              runRepair('키오스크 자동 생성', () =>
                apiPost('/admin/kiosks/generate', { mode: 'missing' }, { timeoutMs: REPAIR_TIMEOUT_MS })
              )
            }
          >
            키오스크 자동 생성
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              runRepair('키오스크 정규화', () =>
                apiPost('/admin/kiosks/normalize', {}, { timeoutMs: REPAIR_TIMEOUT_MS })
              )
            }
          >
            키오스크 정규화
          </button>
        </div>
      </div>

      {(message || busy) && (
        <div className="admin-health-message">
          {busy ? `${busy} 진행 중...` : message}
        </div>
      )}
    </section>
  );
}
