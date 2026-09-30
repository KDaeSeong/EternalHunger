import { normalizeHungerTraits } from '../../../utils/hungerTraits.js';

export const HUNGER_VERSION = 'hunger-games.v1';
export const HUNGER_LIMITS = Object.freeze({ actors: 64, events: 200, phases: 120, roles: 4, outcomes: 12, items: 12, packBytes: 6 * 1024 * 1024 });
export const HUNGER_PHASES = ['opening', 'day', 'night', 'feast'];
export const HUNGER_WEATHER = ['clear', 'rain', 'storm', 'cold'];
export const HUNGER_LOCATIONS = ['forest', 'river', 'camp', 'ruins'];
export const HUNGER_CAUSES = ['lightning', 'fire', 'drowning', 'poison', 'cold', 'combat', 'accident'];
export const HUNGER_EFFECTS = ['death', 'injure', 'heal', 'gain_item', 'lose_item', 'ally', 'enemy'];
export const HUNGER_RELATIONS = ['same_team', 'not_teammate', 'ally', 'enemy'];
export const HUNGER_LABELS = Object.freeze({
  opening: '시작', day: '낮', night: '밤', feast: '연회', clear: '맑음', rain: '비', storm: '뇌우', cold: '한파',
  forest: '숲', river: '강가', camp: '야영지', ruins: '폐허', lightning: '자연 번개', fire: '화재',
  drowning: '익사', poison: '독', combat: '전투', accident: '사고', death: '사망', injure: '부상', heal: '부상 회복',
  gain_item: '아이템 획득', lose_item: '아이템 소모', ally: '동맹', enemy: '적대', same_team: '같은 팀',
  not_teammate: '같은 팀 제외', any: '제한 없음', immune: '면역', resistant: '저항', normal: '면역·저항 없음',
});

function fail(message) { throw new Error(message); }
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ': 형식이 올바르지 않습니다.');
  return value;
}
function text(value, label, max = 120, required = true) {
  const result = typeof value === 'string' ? value.trim() : '';
  if ((required && !result) || result.length > max) fail(label + ': 1~' + max + '자로 입력해 주세요.');
  return result;
}
function number(value, fallback, min, max, label, integer = false) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(result) || result < min || result > max || (integer && !Number.isInteger(result))) fail(label + ': ' + min + '~' + max + ' 범위로 입력해 주세요.');
  return result;
}
function list(value, allowed, fallback, label) {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || !value.length || value.some((entry) => !allowed.includes(entry))) fail(label + ': 지원하지 않는 값입니다.');
  return [...new Set(value)];
}
function traits(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 32 || value.some((entry) => typeof entry !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(entry))) fail(label + ': 특성 키가 올바르지 않습니다.');
  return normalizeHungerTraits(value);
}
function roleKey(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_]{0,23}$/.test(value)) fail('역할 키는 영문 소문자로 시작하는 24자 이내 이름이어야 합니다.');
  return value;
}
function knownRole(value, keys) {
  if (!keys.includes(value)) fail('존재하지 않는 참가자 역할: ' + String(value));
  return value;
}
function template(value, keys) {
  const result = text(value, '결과 문구', 2000);
  const placeholders = [...result.matchAll(/\{([^{}]+)\}/g)].map((row) => row[1]);
  if (placeholders.some((key) => !keys.includes(key))) fail('결과 문구에는 등록한 역할의 {역할키}만 사용할 수 있습니다.');
  if (result.replace(/\{[a-z][a-z0-9_]*\}/g, '').match(/[{}]/)) fail('결과 문구의 중괄호를 확인해 주세요.');
  return result;
}

export function normalizeHungerEvent(value) {
  const input = object(value, '이벤트');
  const id = text(input.id, '이벤트 ID', 80);
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id) || ['constructor', 'prototype'].includes(id)) fail('이벤트 ID는 영문·숫자로 시작하는 키여야 합니다.');
  if (!Array.isArray(input.roles) || !input.roles.length || input.roles.length > HUNGER_LIMITS.roles) fail('참가자 역할은 1~4개여야 합니다.');
  const roles = input.roles.map((raw) => {
    const role = object(raw, '역할');
    const allTraits = traits(role.allTraits, '필수 특성');
    const noneTraits = traits(role.noneTraits, '제외 특성');
    if (allTraits.some((key) => noneTraits.includes(key))) fail('같은 특성을 필수와 제외에 동시에 넣을 수 없습니다.');
    const status = role.status ?? 'any';
    if (!['any', 'healthy', 'injured'].includes(status)) fail('역할 상태 조건을 확인해 주세요.');
    return { key: roleKey(role.key), label: text(role.label || role.key, '역할 이름', 40), allTraits, noneTraits,
      status, requiredItem: text(role.requiredItem, '필요 아이템', 60, false) };
  });
  const keys = roles.map((role) => role.key);
  if (new Set(keys).size !== keys.length) fail('참가자 역할 키가 중복됩니다.');
  const relations = input.relations ?? [];
  if (!Array.isArray(relations) || relations.length > 6) fail('관계 조건은 6개 이내로 입력해 주세요.');
  const normalizedRelations = relations.map((raw) => {
    const relation = object(raw, '관계 조건');
    if (!HUNGER_RELATIONS.includes(relation.kind)) fail('지원하지 않는 관계 조건입니다.');
    const left = knownRole(relation.left, keys); const right = knownRole(relation.right, keys);
    if (left === right) fail('관계 조건에는 서로 다른 역할을 지정해 주세요.');
    return { left, right, kind: relation.kind };
  });
  if (!Array.isArray(input.outcomes) || !input.outcomes.length || input.outcomes.length > HUNGER_LIMITS.outcomes) fail('결과 분기는 1~12개여야 합니다.');
  const outcomes = input.outcomes.map((raw) => {
    const outcome = object(raw, '결과');
    let when = null;
    if (outcome.when != null) {
      const condition = object(outcome.when, '분기 조건');
      if (!HUNGER_CAUSES.includes(condition.cause) || !['immune', 'resistant', 'normal'].includes(condition.protection)) fail('분기 원인과 면역 조건을 확인해 주세요.');
      when = { role: knownRole(condition.role, keys), cause: condition.cause, protection: condition.protection };
    }
    const rawEffects = outcome.effects ?? [];
    if (!Array.isArray(rawEffects) || rawEffects.length > 12) fail('결과 효과는 12개 이내로 입력해 주세요.');
    const healthRoles = new Set();
    const effects = rawEffects.map((rawEffect) => {
      const effect = object(rawEffect, '효과');
      if (!HUNGER_EFFECTS.includes(effect.type)) fail('지원하지 않는 결과 효과입니다.');
      const target = knownRole(effect.target, keys);
      if (['death', 'injure', 'heal'].includes(effect.type)) {
        if (healthRoles.has(target)) fail('한 분기에서 같은 참가자의 사망·부상·회복 효과를 겹칠 수 없습니다.');
        healthRoles.add(target);
      }
      const result = { type: effect.type, target };
      if (['death', 'injure'].includes(effect.type)) {
        if (!HUNGER_CAUSES.includes(effect.cause)) fail('사망·부상에는 지원하는 원인을 지정해야 합니다.');
        result.cause = effect.cause;
      }
      if (effect.type === 'death' && effect.source) {
        result.source = knownRole(effect.source, keys);
        if (result.source === target) fail('처치자는 피해자와 다른 역할이어야 합니다.');
      }
      if (['gain_item', 'lose_item'].includes(effect.type)) result.item = text(effect.item, '아이템 이름', 60);
      if (['ally', 'enemy'].includes(effect.type)) {
        result.other = knownRole(effect.other, keys);
        if (result.other === target) fail('자기 자신과 동맹·적대 관계를 만들 수 없습니다.');
      }
      return result;
    });
    return { label: text(outcome.label || '결과', '분기 이름', 60), weight: number(outcome.weight, 1, 0.01, 1000, '분기 빈도'),
      when, effects, text: template(outcome.text, keys) };
  });
  const minDay = number(input.minDay, 0, 0, 60, '시작 일차', true);
  const maxDay = number(input.maxDay, 60, minDay, 60, '마지막 일차', true);
  return { id, title: text(input.title, '이벤트 이름'), enabled: input.enabled !== false,
    weight: number(input.weight, 1, 0.01, 1000, '이벤트 빈도'),
    phases: list(input.phases, HUNGER_PHASES, HUNGER_PHASES, '발생 시점'),
    weather: list(input.weather, HUNGER_WEATHER, HUNGER_WEATHER, '날씨'),
    locations: list(input.locations, HUNGER_LOCATIONS, HUNGER_LOCATIONS, '장소'),
    minDay, maxDay, cooldownPhases: number(input.cooldownPhases, 0, 0, 120, '재등장 간격', true),
    maxUses: number(input.maxUses, 0, 0, 1000, '최대 등장 횟수', true), roles, relations: normalizedRelations, outcomes };
}

export function normalizeHungerRoster(value) {
  if (!Array.isArray(value) || !value.length || value.length > HUNGER_LIMITS.actors) fail('참가자는 1~64명이어야 합니다.');
  const roster = value.map((raw, index) => {
    const actor = object(raw, '참가자');
    const image = typeof actor.previewImage === 'string' ? actor.previewImage : '';
    if (image.length > 60000 || (image && !/^(https?:\/\/|data:image\/(png|jpeg|webp|gif);base64,|\/[^/])/.test(image))) fail('참가자 이미지 주소가 올바르지 않습니다.');
    const items = actor.items ?? [];
    if (!Array.isArray(items) || items.length > HUNGER_LIMITS.items) fail('시작 아이템은 12개 이내로 입력해 주세요.');
    return { id: text(String(actor.id ?? actor._id ?? ('actor-' + index)), '참가자 ID', 100),
      name: text(actor.name, '참가자 이름', 120), previewImage: image,
      teamId: text(String(actor.teamId || ''), '팀', 40, false),
      hungerTraits: traits(actor.hungerTraits, '참가자 특성'), items: [...new Set(items.map((item) => text(item, '아이템', 60)))] };
  });
  if (new Set(roster.map((actor) => actor.id)).size !== roster.length) fail('참가자 ID가 중복됩니다.');
  return roster;
}

export function normalizeHungerConfig(raw) {
  const input = object(raw, '설정');
  if (!Array.isArray(input.events) || input.events.length > HUNGER_LIMITS.events) fail('이벤트는 200개 이내로 등록해 주세요.');
  const events = input.events.map(normalizeHungerEvent);
  if (new Set(events.map((event) => event.id)).size !== events.length) fail('이벤트 ID가 중복됩니다.');
  return { roster: normalizeHungerRoster(input.roster), events, seed: text(String(input.seed ?? 'hunger'), '시드', 120),
    maxPhases: number(input.maxPhases, 60, 1, HUNGER_LIMITS.phases, '최대 진행 수', true) };
}
