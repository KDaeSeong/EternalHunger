'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

export function LogoPreview({ alt, fallbackLogo, localCandidates, preferLocalLogos, showDebug }) {
  const sources = useMemo(() => {
    const candidates = preferLocalLogos ? localCandidates : [];
    return [...candidates, fallbackLogo].filter(Boolean);
  }, [fallbackLogo, localCandidates, preferLocalLogos]);
  const [index, setIndex] = useState(0);

  const safeIndex = Math.min(index, Math.max(0, sources.length - 1));
  const src = sources[safeIndex] || fallbackLogo;
  return (
    <div
      className="games-logo-preview"
      title={showDebug ? src : alt}
      style={{
        width: 58,
        height: 58,
        borderRadius: 14,
        border: '1px solid rgba(26, 82, 118, 0.24)',
        background: '#f7fbff',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        flex: '0 0 auto',
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={48}
        height={48}
        unoptimized
        onError={() => setIndex((current) => current < sources.length - 1 ? current + 1 : current)}
      />
    </div>
  );
}

export function TrackCard({ track, filters }) {
  return (
    <article className="game-save-row">
      <LogoPreview
        key={`${track.logoKey}:${track.fallbackLogo}:${filters.preferLocalLogos ? 'local' : 'placeholder'}`}
        alt={track.name}
        fallbackLogo={track.fallbackLogo}
        localCandidates={track.localCandidates}
        preferLocalLogos={filters.preferLocalLogos}
        showDebug={filters.showDebug}
      />
      <div>
        <span>{track.regionLabel} / {track.surfaceName} / {track.directionName}</span>
        <strong>{track.name}</strong>
        <span>{track.distanceM.toLocaleString('ko-KR')}m / logoKey: {track.logoKey}</span>
      </div>
      <span className="game-save-chip">{track.hasLogoOverride ? '로컬키' : 'placeholder'}</span>
    </article>
  );
}

export function EventRow({ event, filters }) {
  return (
    <article className="game-save-row">
      <LogoPreview
        key={`${event.trackLogoKey}:${event.fallbackLogo}:${filters.preferLocalLogos ? 'local' : 'placeholder'}`}
        alt={event.trackName}
        fallbackLogo={event.fallbackLogo}
        localCandidates={event.localCandidates}
        preferLocalLogos={filters.preferLocalLogos}
        showDebug={filters.showDebug}
      />
      <div>
        <span>{event.trackName}</span>
        <strong>{event.raceName}</strong>
        <span>{event.regionLabel} / {event.surfaceName} / {event.directionName} / {event.distanceM.toLocaleString('ko-KR')}m</span>
      </div>
      <span className="game-save-chip">{event.hasLocalName ? '실명' : 'core id'}</span>
    </article>
  );
}
