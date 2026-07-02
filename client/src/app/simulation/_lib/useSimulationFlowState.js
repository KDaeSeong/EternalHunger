import { useEffect, useRef, useState } from 'react';

export function normalizeAutoSpeed(value) {
  return Math.max(1, Math.min(32, Number(value) || 1));
}

export function useSimulationFlowState() {
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(1);
  const autoSpeedRef = useRef(1);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const isAdvancingRef = useRef(false);
  const isRefreshingMapsRef = useRef(false);
  const [isRefreshingMapSettings, setIsRefreshingMapSettings] = useState(false);
  const [mapRefreshToast, setMapRefreshToast] = useState(null);
  const mapRefreshToastTimerRef = useRef(null);
  const proceedPhaseGuardedRef = useRef(null);

  function updateAutoSpeed(value) {
    const next = normalizeAutoSpeed(value);
    autoSpeedRef.current = next;
    setAutoSpeed(next);
  }

  useEffect(() => {
    autoSpeedRef.current = normalizeAutoSpeed(autoSpeed);
  }, [autoSpeed]);

  function showMapRefreshToast(text, kind = 'info') {
    try {
      if (mapRefreshToastTimerRef.current) clearTimeout(mapRefreshToastTimerRef.current);
    } catch {
      // ignore timer cleanup errors
    }
    setMapRefreshToast({ text: String(text || ''), kind: String(kind || 'info') });
    mapRefreshToastTimerRef.current = setTimeout(() => {
      setMapRefreshToast(null);
      mapRefreshToastTimerRef.current = null;
    }, 1700);
  }

  useEffect(() => {
    return () => {
      try {
        if (mapRefreshToastTimerRef.current) clearTimeout(mapRefreshToastTimerRef.current);
      } catch {
        // ignore timer cleanup errors
      }
    };
  }, []);

  return {
    autoPlay,
    autoSpeed,
    autoSpeedRef,
    isAdvancing,
    isAdvancingRef,
    isRefreshingMapsRef,
    isRefreshingMapSettings,
    mapRefreshToast,
    normalizeAutoSpeed,
    proceedPhaseGuardedRef,
    setAutoPlay,
    setIsAdvancing,
    setIsRefreshingMapSettings,
    showMapRefreshToast,
    updateAutoSpeed,
  };
}
