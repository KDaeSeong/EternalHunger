import { useRef, useState } from 'react';

const DEV_TOOLS_WARNING = [
  '개발자 도구를 활성화하면 수동 조작이 가능합니다.',
  '',
  '아이템 지급, 장비 변경, 소모품 강제 사용 등으로 조작된 실행은 명예의 전당에 기록되지 않고 보상도 지급되지 않습니다.',
  '',
  '계속할까요?',
].join('\n');

export function useSimulationDevRunGuard({
  addLog = () => {},
  setShowMarketPanel = () => {},
  showMarketPanel = false,
} = {}) {
  const [devRunTainted, setDevRunTainted] = useState(false);
  const devRunTaintedRef = useRef(false);

  function handleDevToolsToggle() {
    if (showMarketPanel) {
      setShowMarketPanel(false);
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm(DEV_TOOLS_WARNING)) return;
    setShowMarketPanel(true);
  }

  function markDevRunTainted() {
    if (devRunTaintedRef.current) return;
    devRunTaintedRef.current = true;
    setDevRunTainted(true);
    addLog('개발자 도구 조작이 감지되었습니다. 이 실행은 명예의 전당 기록과 보상 지급에서 제외됩니다.', 'system');
  }

  return {
    devRunTainted,
    devRunTaintedRef,
    handleDevToolsToggle,
    markDevRunTainted,
  };
}
