import { useEffect, useRef } from 'react';
import { observerMemoryEnabled, observerMemoryRegistry } from './observerMemoryLifetime';

export function useObserverMemoryLifetime(kind, targets, active = true) {
  const ownerRef = useRef(null);
  useEffect(() => {
    if (!active || !observerMemoryEnabled()) return undefined;
    const owner = observerMemoryRegistry.open(kind);
    ownerRef.current = owner;
    return () => { owner.close(); ownerRef.current = null; };
  }, [kind, active]);
  useEffect(() => { ownerRef.current?.watch(targets); });
}
