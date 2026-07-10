import { isValidElement } from 'react';
import {
  BadgePlus,
  BookOpen,
  Building2,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronsUp,
  CirclePlay,
  Coins,
  CookingPot,
  Crosshair,
  Download,
  Dumbbell,
  FastForward,
  FileText,
  Flag,
  Flame,
  FlaskConical,
  FolderOpen,
  Gauge,
  GalleryVerticalEnd,
  Gavel,
  Gift,
  Grid3X3,
  Hammer,
  Hourglass,
  Layers3,
  Link2,
  Map,
  MoonStar,
  Move,
  PackageOpen,
  PackageCheck,
  Pickaxe,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  School,
  Search,
  ScrollText,
  Settings2,
  Shield,
  ShieldCheck,
  Shuffle,
  ShoppingCart,
  SkipForward,
  Sparkles,
  Swords,
  Target,
  TentTree,
  Terminal,
  TrainFront,
  Trophy,
  Utensils,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { inferGameActionSemantic } from '../_lib/gameActionSemantics';

const ACTION_ICONS = {
  action: CirclePlay,
  advance: FastForward,
  analysis: Gauge,
  archive: FileText,
  auto: FastForward,
  calendar: CalendarDays,
  cards: Layers3,
  close: X,
  claim: Gift,
  code: Terminal,
  combat: Swords,
  consume: Utensils,
  craft: Hammer,
  defend: Shield,
  dispatch: TrainFront,
  download: Download,
  deploy: Flag,
  edict: ScrollText,
  equip: PackageCheck,
  event: Zap,
  execute: CirclePlay,
  finance: ChartNoAxesColumnIncreasing,
  fuel: Flame,
  gather: Pickaxe,
  guide: BookOpen,
  guard: ShieldCheck,
  inventory: PackageOpen,
  judge: Gavel,
  kitchen: CookingPot,
  load: FolderOpen,
  map: Map,
  move: Move,
  new: Sparkles,
  pass: SkipForward,
  property: Building2,
  recruit: BadgePlus,
  research: FlaskConical,
  reset: RotateCcw,
  rest: MoonStar,
  replay: FileText,
  ride: ChevronsUp,
  save: Save,
  school: School,
  search: Search,
  settings: Settings2,
  shop: ShoppingCart,
  shuffle: Shuffle,
  skill: Zap,
  summon: GalleryVerticalEnd,
  survival: TentTree,
  sync: RefreshCw,
  tactics: Grid3X3,
  target: Target,
  trade: Coins,
  training: Dumbbell,
  turn: RotateCw,
  trophy: Trophy,
  upgrade: Wrench,
  zone: Layers3,
  chain: Link2,
  formation: Grid3X3,
  wait: Hourglass,
};

export function gameActionText(children) {
  if (children === null || children === undefined || typeof children === 'boolean') return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map((child) => gameActionText(child)).join(' ');
  if (isValidElement(children)) return gameActionText(children.props.children);
  return '';
}

export function resolveGameAction(action, ...labels) {
  const explicit = String(action || '').trim();
  if (explicit && ACTION_ICONS[explicit]) {
    const inferred = inferGameActionSemantic(explicit, labels);
    return { kind: explicit, cue: inferred.cue };
  }
  return inferGameActionSemantic(explicit, labels);
}

export default function GameActionIcon({ action, label = '', className = '' }) {
  const semantic = resolveGameAction(action, label);
  const Icon = ACTION_ICONS[semantic.kind] || CirclePlay;
  return (
    <span className={`game-action-icon${className ? ` ${className}` : ''}`} aria-hidden="true">
      <Icon size={18} strokeWidth={2.2} />
    </span>
  );
}
