import Image from 'next/image';

const GAME_KEY_ART = Object.freeze({
  'eternal-hunger': '/games/key-art/eternal-hunger.webp',
  'twenty-questions': '/games/key-art/twenty-questions.webp',
  'dual-academy-tcg': '/games/key-art/dual-academy-tcg.webp',
  'ba-vanguard': '/games/key-art/ba-vanguard.webp',
  'primitive-archive': '/games/key-art/primitive-archive.webp',
  'tonkatsu-teacher': '/games/key-art/tonkatsu-teacher.webp',
  'schale-idle-rpg': '/games/key-art/schale-idle-rpg.webp',
  'ba-srpg': '/games/key-art/ba-srpg.webp',
  myanimecraft: '/games/key-art/myanimecraft.webp',
  'school-simulator': '/games/key-art/school-simulator.webp',
  'si-coding-sim': '/games/key-art/si-coding-sim.webp',
  'rail3d-sim': '/games/key-art/rail3d-sim.webp',
  'company-report': '/games/key-art/company-report.webp',
  'racing-logos-demo': '/games/key-art/racing-logos-demo.webp',
});

export function gameKeyArtSrc(slug) {
  return GAME_KEY_ART[String(slug || '').trim()] || '';
}

export default function GameKeyArt({
  slug,
  title,
  className = '',
  preload = false,
  sizes = '(max-width: 920px) 100vw, 33vw',
}) {
  const src = gameKeyArtSrc(slug);
  if (!src) return null;

  return (
    <div className={`game-key-art is-${slug} ${className}`.trim()}>
      <Image
        src={src}
        alt={`${title || '게임'} 키아트`}
        fill
        sizes={sizes}
        preload={preload}
      />
    </div>
  );
}
