import { HUNGER_LABELS } from './hungerGameContract.js';

const PAIRS = [
  ['은', '는'], ['이', '가'], ['을', '를'], ['과', '와'],
  ['으로', '로'], ['이랑', '랑'], ['아', '야'],
];
const pairByForm = new Map();
const explicit = [];
for (const pair of PAIRS) {
  const [closed, open] = pair;
  const forms = [closed, open, `${closed}(${open})`, `${open}(${closed})`, `${closed}/${open}`, `${open}/${closed}`];
  forms.forEach((form) => pairByForm.set(form, pair));
  explicit.push(...forms.slice(2));
}
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const boundary = '(?=$|[\\s\\p{P}\\p{S}]|(?:은|는|도|만|부터|까지|서|써)(?=$|[\\s\\p{P}\\p{S}]))';
const forms = explicit.sort((a, b) => b.length - a.length).map(escape).join('|');
const bare = PAIRS.flat().sort((a, b) => b.length - a.length).map(escape).join('|');
// Match the template once. Inserted names are never parsed as templates, and
// ordinary words such as "이름" or "가방" are not mistaken for particles.
const PLACEHOLDER = new RegExp(`\\{([a-z][a-z0-9_]*)\\}(["'”’»」』〉》)\\]]*)((?:${forms})|(?:${bare})${boundary})?`, 'gu');

function finalSound(name) {
  const spoken = String(name ?? '').normalize('NFC').replace(/[\p{P}\p{S}\p{Z}\p{Cf}\p{M}\s]+$/gu, '');
  const last = [...spoken].at(-1);
  if (!last) return null;
  const code = last.codePointAt(0);
  if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28;
  if (code >= 0x11A8 && code <= 0x11C2) return code - 0x11A7;
  if (code >= 0x3131 && code <= 0x314E) return last === 'ㄹ' ? 8 : 1;
  if (code >= 0x314F && code <= 0x3163) return 0;
  if (/^[0-9]$/.test(last)) return [1, 8, 0, 1, 0, 0, 1, 8, 8, 0][Number(last)];
  // A foreign spelling does not reveal its Korean pronunciation.
  return null;
}

export function koreanParticle(name, form) {
  const pair = pairByForm.get(form);
  if (!pair) return form;
  const sound = finalSound(name);
  if (sound === null) return `${pair[0]}(${pair[1]})`;
  const closed = sound !== 0 && !(pair[0] === '으로' && sound === 8);
  return pair[closed ? 0 : 1];
}

export function renderHungerText(template, cast) {
  return String(template).replace(PLACEHOLDER, (whole, key, closing, particle = '') => {
    if (!Object.hasOwn(cast, key)) return whole;
    const name = typeof cast[key] === 'string' ? cast[key] : cast[key].name;
    return name + closing + koreanParticle(name, particle);
  });
}

export function hungerEffectLabel(actor, type) {
  const traits = actor?.hungerTraits || [];
  const labels = traits.includes('mechanical') ? { death: '작동 정지', injure: '손상', heal: '정비 완료' }
    : traits.includes('elemental_body') ? { death: '소멸', injure: '형태 손상', heal: '형태 회복' } : {};
  return labels[type] || HUNGER_LABELS[type] || type;
}
