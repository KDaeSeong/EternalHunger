import { BOARD, STUDENT_BY_ID } from './autochessData.js';

const COLORS = { blue: '#75d9ff', red: '#ff8fa8', skill: '#ffda79', heal: '#80f0b1', shield: '#a8c7ff', buff: '#e1aeff' };
const KINDS = new Set(['attack', 'skill', 'heal', 'shield', 'buff']);
const point = actor => ({ x: (actor[3] + .5) * 100, y: (actor[4] + .5) * 100 });

// Read the existing four-field replay events without changing combat or save data.
export function combatPresentation(frame, teams) {
  const units = frame?.[1] || [], rows = frame?.[2] || [];
  const actors = new Map(units.map(actor => [actor[0], actor]));
  const effects = [], actions = new Map(), casts = new Map(), stacks = new Map(), fallen = new Map();
  const describe = actor => {
    const student = STUDENT_BY_ID[actor[1]], team = teams[actor[2]];
    return { uid: actor[0], name: student.name, skill: student.skill, skillName: student.skillName,
      tone: team.tone, badge: team.badge, point: point(actor) };
  };
  for (const [index, row] of rows.slice(-12).entries()) {
    const [fromUid, toUid, kind, amount] = row;
    const fromActor = actors.get(fromUid), toActor = actors.get(toUid);
    if (!fromActor || !toActor || !KINDS.has(kind) || !Number.isFinite(amount)) continue;
    const from = describe(fromActor), to = describe(toActor), harmful = kind === 'attack' || kind === 'skill';
    const variant = kind === 'skill' ? from.skill : kind;
    const label = kind === 'attack' ? '기본 공격' : kind === 'shield' && from.skill !== 'shield' ? '이상 차폐' : from.skillName;
    const amountLabel = kind === 'buff' ? '강화' : kind === 'heal' ? '+' + amount : kind === 'shield' ? '◇' + amount : '−' + amount;
    const color = COLORS[kind === 'attack' ? from.tone : kind];
    const stack = stacks.get(to.uid) || 0;
    stacks.set(to.uid, stack + 1);
    const fx = { id: index, from, to, kind, variant, amount, amountLabel, label, color, harmful, stack,
      x: to.point.x / (BOARD.cols * 100) * 100, y: to.point.y / (BOARD.rows * 100) * 100 };
    const dx = to.point.x - from.point.x, dy = to.point.y - from.point.y, length = Math.hypot(dx, dy);
    if (length > 0) {
      const ux = dx / length, uy = dy / length, inset = Math.min(36, length * .25);
      const end = { x: to.point.x - ux * inset, y: to.point.y - uy * inset };
      fx.link = { x1: from.point.x + ux * inset, y1: from.point.y + uy * inset, x2: end.x, y2: end.y,
        arrow: [end.x + ',' + end.y, (end.x - ux * 18 - uy * 9) + ',' + (end.y - uy * 18 + ux * 9),
          (end.x - ux * 18 + uy * 9) + ',' + (end.y - uy * 18 - ux * 9)].join(' ') };
    }
    effects.push(fx);
    if (harmful && toActor[5] <= 0) fallen.set(to.uid, to);
    const actionKey = from.uid + ':' + kind;
    if (!actions.has(actionKey)) actions.set(actionKey, { id: actionKey, from, kind, label, targets: [] });
    actions.get(actionKey).targets.push({ ...to, amountLabel });
    if (kind !== 'attack' && (!casts.has(from.uid) || kind !== 'shield')) {
      casts.set(from.uid, { ...from, label, kind, color });
    }
  }
  return { effects, actions: [...actions.values()].reverse(), casts: [...casts.values()], fallen: [...fallen.values()] };
}
