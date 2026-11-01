import Image from 'next/image';
import { resolveArchivePortrait } from '../_lib/primitiveArchivePortraits';

export default function PrimitiveArchivePortrait({ member, size = 44, className = '', alt = '' }) {
  const portrait = resolveArchivePortrait(member);
  const crop = portrait.crop;
  const cropped = crop && Number.isFinite(crop.x) && Number.isFinite(crop.y)
    && Number.isFinite(crop.zoom) && crop.zoom > 0;
  const zoom = cropped ? crop.zoom : 1;
  const width = Number.isFinite(portrait.width) && portrait.width > 0 ? portrait.width : size;
  const height = Number.isFinite(portrait.height) && portrait.height > 0 ? portrait.height : size;
  const imageStyle = cropped ? {
    left: '50%', top: '50%', width: `${zoom * 100}%`, height: 'auto', maxWidth: 'none',
    transform: `translate(-${crop.x}%, -${crop.y}%)`, objectPosition: portrait.objectPosition,
  } : { inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: portrait.objectPosition };

  return (
    <span className={`primitive-archive-portrait ${className}`.trim()}
      title={portrait.label}
      style={{ width: `var(--archive-portrait-frame-size, ${size}px)`, height: `var(--archive-portrait-frame-size, ${size}px)` }}>
      <Image className="primitive-archive-portrait__image" src={portrait.src} alt={alt}
        width={width} height={height} sizes={`${Math.ceil(size * zoom)}px`} style={imageStyle} />
    </span>
  );
}
