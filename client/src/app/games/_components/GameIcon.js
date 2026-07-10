function IconBase({ children, label = '', tone = '' }) {
  const toneClass = String(tone || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((entry) => `is-${entry}`)
    .join(' ');
  return (
    <span className={`game-icon ${toneClass}`} aria-hidden={label ? undefined : 'true'} role={label ? 'img' : undefined} aria-label={label || undefined}>
      <svg viewBox="0 0 48 48" focusable="false" aria-hidden="true">
        {children}
      </svg>
    </span>
  );
}

function MapIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M8 13l10-4 12 5 10-4v25l-10 4-12-5-10 4z" />
      <path d="M18 9v25M30 14v25" />
      <circle cx="24" cy="24" r="5" />
      <path d="M12 27h7M29 19h8M12 18l5-2M31 31l6-2" />
    </IconBase>
  );
}

function MysteryIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="10" y="16" width="28" height="20" rx="4" />
      <path d="M14 16l10-7 10 7M18 25h12M18 31h7" />
      <circle cx="34" cy="28" r="2.5" />
    </IconBase>
  );
}

function CardIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="9" y="11" width="19" height="27" rx="3" />
      <rect x="20" y="8" width="19" height="27" rx="3" />
      <path d="M15 18h7M15 24h5M26 16h7M26 22h5M27 29h7" />
    </IconBase>
  );
}

function CrystalDeckIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 15h20a4 4 0 014 4v16H16a4 4 0 01-4-4z" />
      <path d="M16 11h20M16 7h16M24 19l7 6-7 9-7-9z" />
    </IconBase>
  );
}

function CampIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M9 35h30M14 31l10-17 10 17M19 31l5-9 5 9" />
      <path d="M24 15V9M18 39l12-9M30 39l-12-9" />
      <path d="M22 35c-2-4 2-6 2-9 3 3 6 5 2 9" />
    </IconBase>
  );
}

function KitchenIcon(props) {
  return (
    <IconBase {...props}>
      <ellipse cx="24" cy="31" rx="15" ry="7" />
      <path d="M16 28c4-9 12-9 16 0M16 19h16M18 15h12M12 34l24-6" />
      <circle cx="18" cy="30" r="1.8" />
      <circle cx="25" cy="29" r="1.8" />
      <circle cx="31" cy="31" r="1.8" />
    </IconBase>
  );
}

function TowerGearIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M16 38V15l8-6 8 6v23M13 38h22M19 20h10M19 26h10M19 32h10" />
      <circle cx="35" cy="16" r="5" />
      <path d="M35 10v12M29 16h12M31.5 12.5l7 7M38.5 12.5l-7 7" />
    </IconBase>
  );
}

function GridIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M9 12h30v24H9zM19 12v24M29 12v24M9 20h30M9 28h30" />
      <path d="M16 16l3 3-3 3-3-3zM32 26l3 3-3 3-3-3zM25 21l3 3-3 3-3-3z" />
    </IconBase>
  );
}

function TrophyIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M17 10h14v9c0 6-3 10-7 10s-7-4-7-10zM19 38h10M21 29v5h6v-5" />
      <path d="M17 14h-6c0 7 3 11 8 11M31 14h6c0 7-3 11-8 11" />
      <path d="M13 38h22M24 14v9" />
    </IconBase>
  );
}

function SchoolIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M8 37h32M12 37V20l12-7 12 7v17" />
      <path d="M18 37V24h12v13M16 24h16M21 29h6" />
      <path d="M24 13V7h10" />
    </IconBase>
  );
}

function CodeIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="8" y="11" width="32" height="26" rx="4" />
      <path d="M18 20l-5 4 5 4M30 20l5 4-5 4M27 17l-6 14" />
    </IconBase>
  );
}

function RailIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M11 37c5-17 21-17 26 0M16 37c4-10 12-10 16 0" />
      <path d="M15 28h18M18 23h12M21 18h6M24 13v24M12 37h24" />
      <circle cx="12" cy="37" r="2" />
      <circle cx="36" cy="37" r="2" />
    </IconBase>
  );
}

function LedgerIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M13 9h22v30H13zM18 9v30" />
      <path d="M22 17h9M22 23h9M22 29h6M15 14h3M15 20h3M15 26h3M15 32h3" />
    </IconBase>
  );
}

function RacingIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M10 34c2-11 8-18 16-18 6 0 10 4 10 9 0 8-10 10-17 7" />
      <path d="M33 9v20M33 10h8l-3 4 3 4h-8" />
      <circle cx="18" cy="34" r="3" />
      <circle cx="34" cy="34" r="3" />
    </IconBase>
  );
}

const ICONS = {
  'eternal-hunger': MapIcon,
  'twenty-questions': MysteryIcon,
  'dual-academy-tcg': CardIcon,
  'ba-vanguard': CrystalDeckIcon,
  'primitive-archive': CampIcon,
  'tonkatsu-teacher': KitchenIcon,
  'schale-idle-rpg': TowerGearIcon,
  'ba-srpg': GridIcon,
  myanimecraft: TrophyIcon,
  'school-simulator': SchoolIcon,
  'si-coding-sim': CodeIcon,
  'rail3d-sim': RailIcon,
  'company-report': LedgerIcon,
  'racing-logos-demo': RacingIcon,
};

export default function GameIcon({ slug, label, tone }) {
  const normalizedSlug = String(slug || '');
  const Icon = ICONS[normalizedSlug] || GridIcon;
  return <Icon label={label} tone={[tone, normalizedSlug].filter(Boolean).join(' ')} />;
}
