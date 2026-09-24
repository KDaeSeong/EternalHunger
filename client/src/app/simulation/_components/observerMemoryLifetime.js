const OWNER_LIMIT = 12;
const TARGET_LIMIT = 8;

// Diagnostic only: no strong target references, timers, persistence, user names
// or game data in the output. Never use collection timing to control gameplay.
export function createObserverMemoryRegistry({ WeakRefType = globalThis.WeakRef } = {}) {
  let sequence = 0;
  let evicted = 0;
  const rows = [];
  const supported = typeof WeakRefType === 'function';
  return {
    open(kind) {
      if (!supported) return { watch() {}, close() {} };
      const row = { id: ++sequence, kind: String(kind).slice(0, 40), closed: false, targets: new Map() };
      rows.push(row);
      if (rows.length > OWNER_LIMIT) { rows.shift(); evicted += 1; }
      return {
        watch(targets) {
          if (row.closed) return;
          for (const [key, target] of Object.entries(targets).slice(0, TARGET_LIMIT)) {
            if (!target || (typeof target !== 'object' && typeof target !== 'function')) continue;
            if (!row.targets.has(key) && row.targets.size >= TARGET_LIMIT) continue;
            // Keep the latest representative root, not every render's array.
            if (row.targets.get(key)?.deref() !== target) row.targets.set(key, new WeakRefType(target));
          }
        },
        close() { row.closed = true; },
      };
    },
    snapshot() {
      return {
        schema: 'eh-observer-memory-lifetime.v1', supported,
        scope: 'selected_object_roots_not_entire_heap', ownerLimit: OWNER_LIMIT, targetLimit: TARGET_LIMIT,
        evictedOwners: evicted,
        owners: rows.map((row) => ({ id: row.id, kind: row.kind, closed: row.closed,
          targets: [...row.targets].map(([name, ref]) => ({ name, state: ref.deref() === undefined ? 'collected' : 'reachable_or_not_yet_collected' })),
        })),
      };
    },
  };
}

export const observerMemoryRegistry = createObserverMemoryRegistry();

export function observerMemoryEnabled() {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('perfProbe') === '1';
}
