import { isValidElement } from 'react';
import {
  BadgePlus,
  BookOpen,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CirclePlay,
  Coins,
  CookingPot,
  Crosshair,
  Download,
  Dumbbell,
  FastForward,
  FileText,
  Flame,
  FlaskConical,
  FolderOpen,
  Gauge,
  Gavel,
  Grid3X3,
  Hammer,
  Layers3,
  Map,
  MoonStar,
  PackageOpen,
  Pickaxe,
  RefreshCw,
  RotateCcw,
  Save,
  School,
  Search,
  Settings2,
  Shield,
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
  calendar: CalendarDays,
  cards: Layers3,
  close: X,
  code: Terminal,
  combat: Swords,
  consume: Utensils,
  craft: Hammer,
  defend: Shield,
  dispatch: TrainFront,
  download: Download,
  event: Zap,
  execute: CirclePlay,
  finance: ChartNoAxesColumnIncreasing,
  fuel: Flame,
  gather: Pickaxe,
  guide: BookOpen,
  inventory: PackageOpen,
  judge: Gavel,
  kitchen: CookingPot,
  load: FolderOpen,
  map: Map,
  new: Sparkles,
  recruit: BadgePlus,
  research: FlaskConical,
  reset: RotateCcw,
  rest: MoonStar,
  save: Save,
  school: School,
  search: Search,
  settings: Settings2,
  survival: TentTree,
  sync: RefreshCw,
  tactics: Grid3X3,
  target: Target,
  trade: Coins,
  training: Dumbbell,
  trophy: Trophy,
  upgrade: Wrench,
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
