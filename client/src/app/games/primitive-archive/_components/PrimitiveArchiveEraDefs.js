'use client';

import { useEffect } from 'react';
import { primitiveArchiveEraFontHref } from '../_lib/primitiveArchiveEraTheme';

function ensureHeadLink(id, attributes) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  Object.entries(attributes).forEach(([name, value]) => link.setAttribute(name, value));
  document.head.appendChild(link);
}

// Era title fonts are decorative, so they load after the page is interactive and
// only for the era on screen. Until a font arrives, titles use the site font.
export default function PrimitiveArchiveEraDefs({ theme }) {
  useEffect(() => {
    if (typeof document === 'undefined' || !theme) return;
    ensureHeadLink('primitive-era-font-preconnect', {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossorigin: 'anonymous',
    });
    ensureHeadLink(`primitive-era-font-${theme.key}`, {
      rel: 'stylesheet',
      href: primitiveArchiveEraFontHref(theme),
    });
  }, [theme]);

  return (
    <svg className="primitive-era-defs" aria-hidden="true" focusable="false" width="0" height="0">
      <filter id="primitive-era-rough" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.7" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
