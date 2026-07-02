import { useEffect } from 'react';
import { bindReferenceErrorGuards, formatRuntimeReason } from '../../../utils/runtimeErrorGuard';

export function useSimulationRuntimeGuards({
  addLogRef,
  setAutoPlay,
  isAdvancingRef,
  setIsAdvancing,
}) {
  useEffect(() => {
    const reportReferenceError = (reason, sourceLabel) => {
      const msg = formatRuntimeReason(reason);
      const finalMsg = msg || 'ReferenceError';
      console.error(`[simulation:runtime:${sourceLabel}]`, reason);
      addLogRef.current(`🚨 런타임 참조 오류 감지(${sourceLabel}): ${finalMsg}`, 'death');
      addLogRef.current('🛟 시뮬 진행을 보호하기 위해 현재 페이즈를 중단했습니다. 다시 진행 버튼을 눌러주세요.', 'system');
      setAutoPlay(false);
      isAdvancingRef.current = false;
      setIsAdvancing(false);
    };

    return bindReferenceErrorGuards({
      onReferenceError: reportReferenceError,
      suppressDefault: false,
    });
  }, [addLogRef, setAutoPlay, isAdvancingRef, setIsAdvancing]);
}
