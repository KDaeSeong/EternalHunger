import { useEffect, useState } from 'react';

export function useSimulationUiModal() {
  const [uiModal, setUiModal] = useState(null);
  const closeUiModal = () => setUiModal(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeUiModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return {
    closeUiModal,
    setUiModal,
    uiModal,
  };
}
