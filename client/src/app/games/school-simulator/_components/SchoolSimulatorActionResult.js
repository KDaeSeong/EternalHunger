import { RecentActionResult } from '../../_components/GamePlayPrimitives';

export default function SchoolSimulatorActionResult({ fallbackLabel, resultPresentation, text }) {
  return (
    <RecentActionResult
      action={resultPresentation?.action || ''}
      label={resultPresentation?.label || fallbackLabel}
      text={text}
      tone={resultPresentation?.tone || ''}
    />
  );
}
