import { useRef } from 'react';
import { apiPost } from '../../../utils/api';
import {
  getSimEquipExternalId,
  isSimGeneratedEquipment,
} from './inventoryRules';

export function useSimEquipmentPersistence() {
  const savedIdsRef = useRef(new Set());
  const busyRef = useRef(false);

  return async function persistSimEquipmentsFromChars(chars, reason = 'phase') {
    if (busyRef.current) return;

    try {
      const arr = Array.isArray(chars) ? chars : [];
      const picked = [];
      const seen = new Set();

      for (const c of arr) {
        const inv = Array.isArray(c?.inventory) ? c.inventory : [];
        for (const it of inv) {
          if (!isSimGeneratedEquipment(it)) continue;
          const extId = getSimEquipExternalId(it);
          if (!extId) continue;
          if (savedIdsRef.current.has(extId)) continue;
          if (seen.has(extId)) continue;
          seen.add(extId);
          picked.push(it);
        }
      }

      if (!picked.length) return;

      busyRef.current = true;
      const res = await apiPost('/items/ingest-sim-equipments', {
        items: picked,
        reason,
      }).catch(() => null);

      if (res && (res.message === 'ok' || Number(res.savedCount || 0) > 0)) {
        for (const it of picked) {
          const extId = getSimEquipExternalId(it);
          if (extId) savedIdsRef.current.add(extId);
        }
      }
    } finally {
      busyRef.current = false;
    }
  };
}
