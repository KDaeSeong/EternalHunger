import { isAtOrAfterWorldTime } from './worldTime';
import { LUMIA_KIOSK_ZONE_IDS } from './simulationConstants';

const LUMIA_KIOSK_ZONE_ID_SET = new Set(LUMIA_KIOSK_ZONE_IDS);

function countInventoryUnits(inventory) {
  return (Array.isArray(inventory) ? inventory : []).reduce((sum, x) => sum + Math.max(0, Number(x?.qty ?? 1)), 0);
}

function kioskLegendaryPrice(key, priceByKey) {
  const table = priceByKey && typeof priceByKey === 'object' ? priceByKey : {};
  const v = Number(table?.[key]);
  if (Number.isFinite(v) && v > 0) return v;

  if (key === 'force_core') return 350;
  if (key === 'mithril') return 250;
  return 200;
}

function zoneNameHasKiosk(name) {
  const nm = String(name || '').toLowerCase();
  const keywords = [
    '바지선', 'barge', 'vessel', 'ship',
    '병원', 'hospital',
    '성당', 'cathedral', 'church',
    '경찰서', 'police',
    '소방서', 'fire station', 'firestation', 'fire',
    '양궁장', '양궁', 'archery',
    '절', 'temple',
    '창고', 'warehouse', 'storage',
    '연구소', 'lab', 'research',
    '호텔', 'hotel',
    '학교', 'school', 'academy',
  ];
  return keywords.some((k) => nm.includes(String(k).toLowerCase()));
}

function hasKioskAtZone(kiosks, mapObj, zoneId) {
  const zId = String(zoneId || '');
  if (!zId) return false;
  if (LUMIA_KIOSK_ZONE_ID_SET.has(zId)) return true;

  if (Array.isArray(kiosks) && kiosks.length) {
    const mapId = String(mapObj?._id || mapObj?.id || '');
    const hit = kiosks.some((k) => {
      const km = String(k?.mapId?._id || k?.mapId || '');
      const kz = String(k?.zoneId || '');
      return mapId && km === mapId && kz === zId;
    });
    if (hit) return true;
  }

  const zonesArr = Array.isArray(mapObj?.zones) ? mapObj.zones : [];
  const zone = zonesArr.find((z) => String(z?.zoneId || '') === zId) || null;
  if (zone?.hasKiosk === true) return true;
  return zoneNameHasKiosk(zone?.name || '') || zoneNameHasKiosk(zone?.zoneId || '');
}

function canUseKioskAtWorldTime(day, phase) {
  return isAtOrAfterWorldTime(day, phase, 2, 'day');
}

export {
  canUseKioskAtWorldTime,
  countInventoryUnits,
  hasKioskAtZone,
  kioskLegendaryPrice,
  zoneNameHasKiosk,
};
