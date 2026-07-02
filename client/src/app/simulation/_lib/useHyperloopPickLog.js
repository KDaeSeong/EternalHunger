import { useEffect, useRef } from 'react';

export function useHyperloopPickLog({
  hyperloopCharId,
  survivors,
  addLog,
}) {
  const pickLogRef = useRef({ inited: false, last: '' });

  useEffect(() => {
    const whoId = String(hyperloopCharId || '').trim();
    if (!whoId) return;

    const ref = pickLogRef.current || { inited: false, last: '' };
    if (!ref.inited) {
      ref.inited = true;
      ref.last = whoId;
      pickLogRef.current = ref;
      return;
    }

    if (String(ref.last || '') === whoId) return;
    ref.last = whoId;
    pickLogRef.current = ref;

    const whoName = (Array.isArray(survivors) ? survivors : []).find((c) => String(c?._id) === whoId)?.name || '선택 캐릭터';
    addLog(`🎯 하이퍼루프 대상 선택: ${whoName}`, 'system');
  }, [hyperloopCharId, survivors, addLog]);
}
