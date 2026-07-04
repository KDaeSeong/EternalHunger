const express = require('express');

const Character = require('../../models/Characters');
const DroneOffer = require('../../models/DroneOffer');
const Item = require('../../models/Item');
const Kiosk = require('../../models/Kiosk');
const MapModel = require('../../models/Map');
const { DEFAULT_ZONE_IDS, canonicalZoneId, normalizeZoneList } = require('../../utils/defaultZones');
const { requireUserId, ownedFilter } = require('../../utils/requestScope');

const router = express.Router();

const LOADOUT_SLOTS = ['weaponKey', 'headKey', 'clothesKey', 'armKey', 'shoesKey'];
const ACTIVE_SKILL_SLOTS = ['q', 'w', 'e', 'r'];
const VALID_ACTIVE_SKILL_TYPES = new Set(['attack_skill', 'heal_skill', 'shield_skill', 'basic_attack_enhance']);
const RECAST_TEXT_RE = /(재발동|다시\s*발동|두\s*번째|2차|추가\s*발동|second|recast)/i;

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value, fallback = 0) {
  return Math.floor(toNumber(value, fallback));
}

function idText(value) {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function issue(severity, title, body, options = {}) {
  return {
    id: options.id || `${severity}-${title}-${body}`.slice(0, 160),
    severity,
    title,
    body,
    href: options.href || '',
    meta: options.meta || [],
  };
}

function itemIdentity(item) {
  return safeText(item?.itemKey || item?.externalId || '');
}

function itemName(item) {
  return safeText(item?.name, '이름 없음');
}

function isGeneratedItem(item) {
  const source = String(item?.source || '').toLowerCase();
  const tags = Array.isArray(item?.tags) ? item.tags.map((tag) => String(tag || '').toLowerCase()) : [];
  return source === 'simulation' || tags.includes('simulation') || tags.includes('generated');
}

function isNamuItem(item) {
  const key = String(item?.itemKey || '');
  const externalId = String(item?.externalId || '');
  return key.startsWith('namu:') || externalId.startsWith('namu:');
}

function addGroupIssues(groups, out, { severity, title, href }) {
  for (const [key, list] of groups.entries()) {
    if (list.length <= 1) continue;
    out.push(issue(severity, title, `${key} 기준으로 ${list.length}개가 겹칩니다.`, {
      href,
      id: `${title}-${key}`,
      meta: list.slice(0, 5).map((item) => itemName(item)),
    }));
  }
}

function groupBy(items, getKey) {
  const groups = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const key = safeText(getKey(item), '');
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function hasPositiveArray(value) {
  return Array.isArray(value) && value.some((n) => Number(n) > 0);
}

function skillDamageTotal(skill) {
  return [
    'firstFlat',
    'secondFlat',
    'flatDamage',
    'maxHpPct',
    'currentHpPct',
    'secondMaxHpPct',
    'secondCurrentHpPct',
  ].reduce((sum, key) => sum + (Array.isArray(skill?.[key]) ? skill[key].reduce((acc, n) => acc + Math.max(0, Number(n) || 0), 0) : 0), 0);
}

function inspectItems(items) {
  const issues = [];
  const itemKeyGroups = groupBy(items, (item) => item.itemKey);
  const externalGroups = groupBy(items, (item) => item.externalId);
  const nameMetaGroups = groupBy(items, (item) => [
    safeText(item.name).toLowerCase(),
    safeText(item.type),
    toInt(item.tier, 1),
    safeText(item.equipSlot),
    safeText(item.weaponType),
  ].join('|'));

  addGroupIssues(itemKeyGroups, issues, { severity: 'critical', title: '중복 itemKey', href: '/admin/items' });
  addGroupIssues(externalGroups, issues, { severity: 'critical', title: '중복 externalId', href: '/admin/items' });
  addGroupIssues(nameMetaGroups, issues, { severity: 'warning', title: '동일 메타 아이템 중복 의심', href: '/admin/items' });

  const nonNamu = items.filter((item) => !isNamuItem(item));
  if (nonNamu.length) {
    issues.push(issue('warning', 'namu: 접두사 없는 아이템', `${nonNamu.length}개가 기본 데이터 규칙에서 벗어납니다.`, {
      href: '/admin/items',
      meta: nonNamu.slice(0, 5).map(itemName),
    }));
  }

  const generated = items.filter(isGeneratedItem);
  if (generated.length) {
    issues.push(issue('warning', '시뮬레이션 생성 아이템 흔적', `${generated.length}개가 운영 아이템 목록에 남아 있습니다.`, {
      href: '/admin/items',
      meta: generated.slice(0, 5).map(itemName),
    }));
  }

  for (const item of items) {
    const tier = toInt(item?.tier, 1);
    if (tier < 1 || tier > 6) {
      issues.push(issue('critical', '아이템 티어 범위 오류', `${itemName(item)}의 tier가 ${tier}입니다.`, {
        href: '/admin/items',
        id: `item-tier-${item._id}`,
      }));
    }
    if (!itemIdentity(item)) {
      issues.push(issue('warning', '아이템 식별자 누락', `${itemName(item)}에 itemKey/externalId가 없습니다.`, {
        href: '/admin/items',
        id: `item-identity-${item._id}`,
      }));
    }
    if (item?.type === '무기' && !safeText(item?.weaponType)) {
      issues.push(issue('info', '무기 타입 누락', `${itemName(item)}에 weaponType이 없습니다.`, {
        href: '/admin/items',
        id: `weapon-type-${item._id}`,
      }));
    }
    if ((item?.type === '무기' || item?.type === '방어구') && !safeText(item?.equipSlot)) {
      issues.push(issue('warning', '장비 슬롯 누락', `${itemName(item)}에 equipSlot이 없습니다.`, {
        href: '/admin/items',
        id: `equip-slot-${item._id}`,
      }));
    }
  }

  return issues;
}

function inspectItemReferences({ items, maps, kiosks }) {
  const issues = [];
  const itemIds = new Set(items.map((item) => idText(item._id)).filter(Boolean));

  for (const item of items) {
    const ingredients = Array.isArray(item?.recipe?.ingredients) ? item.recipe.ingredients : [];
    ingredients.forEach((ingredient, index) => {
      const ref = idText(ingredient?.itemId);
      if (ref && !itemIds.has(ref)) {
        issues.push(issue('critical', '레시피 재료 참조 끊김', `${itemName(item)}의 ${index + 1}번째 재료가 존재하지 않습니다.`, {
          href: '/admin/items',
          id: `recipe-missing-${item._id}-${index}`,
        }));
      }
      if (toNumber(ingredient?.qty, 1) <= 0) {
        issues.push(issue('warning', '레시피 수량 오류', `${itemName(item)}의 재료 수량이 0 이하입니다.`, {
          href: '/admin/items',
          id: `recipe-qty-${item._id}-${index}`,
        }));
      }
    });
  }

  for (const map of maps) {
    for (const crate of Array.isArray(map?.itemCrates) ? map.itemCrates : []) {
      for (const loot of Array.isArray(crate?.lootTable) ? crate.lootTable : []) {
        const ref = idText(loot?.itemId);
        if (ref && !itemIds.has(ref)) {
          issues.push(issue('critical', '상자 룻 테이블 참조 끊김', `${safeText(map.name, '맵')} / ${safeText(crate.zoneId, '구역')} 상자에 없는 아이템이 들어 있습니다.`, {
            href: '/admin/maps',
            id: `crate-missing-${map._id}-${crate.crateId}-${ref}`,
          }));
        }
        if (toNumber(loot?.weight, 1) <= 0) {
          issues.push(issue('warning', '상자 가중치 오류', `${safeText(map.name, '맵')} 상자의 아이템 가중치가 0 이하입니다.`, {
            href: '/admin/maps',
            id: `crate-weight-${map._id}-${crate.crateId}-${ref}`,
          }));
        }
      }
    }
  }

  for (const kiosk of kiosks) {
    for (const [index, row] of (Array.isArray(kiosk?.catalog) ? kiosk.catalog : []).entries()) {
      const itemId = idText(row?.itemId);
      if (itemId && !itemIds.has(itemId)) {
        issues.push(issue('critical', '키오스크 판매 아이템 참조 끊김', `${safeText(kiosk.name, kiosk.kioskId)}의 ${index + 1}번째 항목이 없는 아이템을 가리킵니다.`, {
          href: '/admin/kiosks',
          id: `kiosk-item-${kiosk._id}-${index}`,
        }));
      }
      if (row?.mode === 'exchange') {
        const giveId = idText(row?.exchange?.giveItemId);
        if (!giveId || !itemIds.has(giveId)) {
          issues.push(issue('critical', '키오스크 교환 재료 참조 끊김', `${safeText(kiosk.name, kiosk.kioskId)}의 교환 재료가 없습니다.`, {
            href: '/admin/kiosks',
            id: `kiosk-give-${kiosk._id}-${index}`,
          }));
        }
        if (toNumber(row?.exchange?.giveQty, 1) <= 0) {
          issues.push(issue('warning', '키오스크 교환 수량 오류', `${safeText(kiosk.name, kiosk.kioskId)}의 교환 수량이 0 이하입니다.`, {
            href: '/admin/kiosks',
            id: `kiosk-give-qty-${kiosk._id}-${index}`,
          }));
        }
      }
      if (toNumber(row?.priceCredits, 0) < 0) {
        issues.push(issue('warning', '키오스크 가격 오류', `${safeText(kiosk.name, kiosk.kioskId)}의 가격이 음수입니다.`, {
          href: '/admin/kiosks',
          id: `kiosk-price-${kiosk._id}-${index}`,
        }));
      }
    }
  }

  return issues;
}

function inspectDroneOffers(droneOffers) {
  const issues = [];
  const activeItemGroups = new Map();

  for (const offer of droneOffers) {
    const item = offer?.itemId && typeof offer.itemId === 'object' ? offer.itemId : null;
    const active = offer?.isActive !== false;
    const itemId = idText(offer?.itemId);
    if (!item) {
      issues.push(issue('critical', '드론 아이템 참조 끊김', `드론 제안 ${idText(offer._id)}이 없는 아이템을 가리킵니다.`, {
        href: '/admin/drone',
        id: `drone-missing-${offer._id}`,
      }));
      continue;
    }
    if (active) {
      if (!activeItemGroups.has(itemId)) activeItemGroups.set(itemId, []);
      activeItemGroups.get(itemId).push(offer);
    }
    const itemTier = toInt(item?.tier, 1);
    const maxTier = toInt(offer?.maxTier, 1);
    if (active && (itemTier >= 2 || maxTier >= 2)) {
      issues.push(issue('critical', 'T2 이상 드론 호출 후보', `${itemName(item)}(T${itemTier})가 활성 드론 목록에 있습니다. maxTier=${maxTier}`, {
        href: '/admin/drone',
        id: `drone-tier-${offer._id}`,
      }));
    }
    if (active && toNumber(offer?.priceCredits, 0) <= 0) {
      issues.push(issue('warning', '드론 가격 오류', `${itemName(item)}의 드론 가격이 0 이하입니다.`, {
        href: '/admin/drone',
        id: `drone-price-${offer._id}`,
      }));
    }
  }

  for (const [itemId, list] of activeItemGroups.entries()) {
    if (list.length > 1) {
      const item = list[0]?.itemId;
      issues.push(issue('warning', '활성 드론 항목 중복', `${itemName(item)} 드론 제안이 ${list.length}개 활성화되어 있습니다.`, {
        href: '/admin/drone',
        id: `drone-duplicate-${itemId}`,
      }));
    }
  }

  return issues;
}

function inspectCharacters(characters, items) {
  const issues = [];
  const itemKeys = new Set(items.map((item) => itemIdentity(item)).filter(Boolean));
  const itemByKey = new Map(items.map((item) => [itemIdentity(item), item]).filter(([key]) => Boolean(key)));

  for (const character of characters) {
    const name = safeText(character?.name, '이름 없는 캐릭터');
    if (toInt(character?.goalGearTier, 6) !== 6) {
      issues.push(issue('critical', '목표 장비 등급 불일치', `${name}의 goalGearTier가 초월(6)이 아닙니다.`, {
        href: '/characters',
        id: `char-tier-${character._id}`,
      }));
    }

    const trans = character?.goalLoadouts?.transcend && typeof character.goalLoadouts.transcend === 'object'
      ? character.goalLoadouts.transcend
      : {};
    const missingSlots = LOADOUT_SLOTS.filter((slot) => !safeText(trans?.[slot]));
    if (missingSlots.length === LOADOUT_SLOTS.length) {
      issues.push(issue('warning', '초월 목표 장비 전체 누락', `${name}의 초월 목표 장비가 비어 있습니다.`, {
        href: '/characters',
        id: `char-loadout-empty-${character._id}`,
      }));
    } else if (missingSlots.length) {
      issues.push(issue('info', '초월 목표 장비 일부 누락', `${name}의 ${missingSlots.join(', ')} 슬롯이 비어 있습니다.`, {
        href: '/characters',
        id: `char-loadout-partial-${character._id}`,
      }));
    }

    for (const slot of LOADOUT_SLOTS) {
      const key = safeText(trans?.[slot]);
      if (key && !itemKeys.has(key)) {
        issues.push(issue('critical', '초월 목표 아이템 참조 끊김', `${name}의 ${slot} 목표(${key})가 아이템 DB에 없습니다.`, {
          href: '/characters',
          id: `char-loadout-missing-${character._id}-${slot}`,
        }));
      } else if (key) {
        const item = itemByKey.get(key);
        if (item && toInt(item.tier, 1) < 6) {
          issues.push(issue('warning', '초월 목표에 낮은 티어 아이템 지정', `${name}의 ${slot} 목표 ${itemName(item)}이 T${toInt(item.tier, 1)}입니다.`, {
            href: '/characters',
            id: `char-loadout-low-tier-${character._id}-${slot}`,
          }));
        }
      }
    }

    const skills = character?.characterSkills && typeof character.characterSkills === 'object' ? character.characterSkills : {};
    for (const slot of ACTIVE_SKILL_SLOTS) {
      const skill = skills?.[slot] && typeof skills[slot] === 'object' ? skills[slot] : {};
      if (skill.enabled !== true) continue;
      const type = safeText(skill.type, 'attack_skill');
      if (!VALID_ACTIVE_SKILL_TYPES.has(type)) {
        issues.push(issue('warning', '스킬 타입 값 오류', `${name} ${slot.toUpperCase()} 타입(${type})이 허용 목록과 다릅니다.`, {
          href: '/characters',
          id: `char-skill-type-${character._id}-${slot}`,
        }));
      }
      if (type === 'attack_skill' && skillDamageTotal(skill) <= 0) {
        issues.push(issue('warning', '공격 스킬 피해값 없음', `${name} ${slot.toUpperCase()}가 공격 스킬인데 피해값이 없습니다.`, {
          href: '/characters',
          id: `char-skill-damage-${character._id}-${slot}`,
        }));
      }
      if (type === 'heal_skill' && !hasPositiveArray(skill.heal)) {
        issues.push(issue('warning', '회복 스킬 회복량 없음', `${name} ${slot.toUpperCase()}가 회복 스킬인데 회복량이 없습니다.`, {
          href: '/characters',
          id: `char-skill-heal-${character._id}-${slot}`,
        }));
      }
      if (type === 'shield_skill' && !hasPositiveArray(skill.shield)) {
        issues.push(issue('warning', '보호막 스킬 보호막 없음', `${name} ${slot.toUpperCase()}가 보호막 스킬인데 보호막 값이 없습니다.`, {
          href: '/characters',
          id: `char-skill-shield-${character._id}-${slot}`,
        }));
      }
      const hasSecondDamage = hasPositiveArray(skill.secondFlat) || hasPositiveArray(skill.secondCurrentHpPct) || hasPositiveArray(skill.secondMaxHpPct);
      if (hasSecondDamage && !RECAST_TEXT_RE.test(String(skill.sourceText || ''))) {
        issues.push(issue('warning', '재발동 피해 자동 생성 의심', `${name} ${slot.toUpperCase()}에 재발동 피해가 있지만 설명에는 재발동/2차 공격 표현이 없습니다.`, {
          href: '/characters',
          id: `char-skill-recast-${character._id}-${slot}`,
        }));
      }
      if (hasPositiveArray(skill.secondMaxHpPct) && !hasPositiveArray(skill.secondFlat) && !hasPositiveArray(skill.secondCurrentHpPct) && !RECAST_TEXT_RE.test(String(skill.sourceText || ''))) {
        issues.push(issue('critical', '재발동 최대 체력 피해 의심', `${name} ${slot.toUpperCase()}에 secondMaxHpPct만 들어가 있습니다. 자동 작성 결과를 확인해 주세요.`, {
          href: '/characters',
          id: `char-skill-second-maxhp-${character._id}-${slot}`,
        }));
      }
    }
  }

  return issues;
}

function inspectMapsAndKiosks({ maps, kiosks }) {
  const issues = [];
  const defaultZoneIdSet = new Set(DEFAULT_ZONE_IDS.map(String));
  const mapById = new Map(maps.map((map) => [idText(map._id), map]));

  if (!maps.length) {
    issues.push(issue('critical', '맵 데이터 없음', '시뮬레이션에서 사용할 맵이 없습니다.', { href: '/admin/maps' }));
  }

  for (const map of maps) {
    const zones = normalizeZoneList(map?.zones);
    const zoneIds = new Set(zones.map((zone) => canonicalZoneId(zone.zoneId)).filter(Boolean));
    const missingDefault = [...defaultZoneIdSet].filter((id) => !zoneIds.has(id));
    if (zones.length !== DEFAULT_ZONE_IDS.length) {
      issues.push(issue('warning', '기본 구역 수 불일치', `${safeText(map.name, '맵')}의 구역 수가 ${zones.length}개입니다. 기준은 ${DEFAULT_ZONE_IDS.length}개입니다.`, {
        href: '/admin/maps',
        id: `map-zone-count-${map._id}`,
      }));
    }
    if (missingDefault.length) {
      issues.push(issue('warning', '기본 구역 누락', `${safeText(map.name, '맵')}에 ${missingDefault.slice(0, 6).join(', ')} 구역이 없습니다.`, {
        href: '/admin/maps',
        id: `map-zone-missing-${map._id}`,
      }));
    }
    for (const conn of Array.isArray(map?.zoneConnections) ? map.zoneConnections : []) {
      const from = canonicalZoneId(conn?.fromZoneId);
      const to = canonicalZoneId(conn?.toZoneId);
      if ((from && !zoneIds.has(from)) || (to && !zoneIds.has(to))) {
        issues.push(issue('critical', '맵 동선 참조 끊김', `${safeText(map.name, '맵')} 동선 ${from || '?'} → ${to || '?'}가 없는 구역을 가리킵니다.`, {
          href: '/admin/maps',
          id: `map-connection-${map._id}-${from}-${to}`,
        }));
      }
    }
    for (const zoneId of Array.isArray(map?.coreSpawnZones) ? map.coreSpawnZones : []) {
      const canonical = canonicalZoneId(zoneId);
      if (canonical && !zoneIds.has(canonical)) {
        issues.push(issue('warning', '코어 스폰 구역 참조 끊김', `${safeText(map.name, '맵')}의 coreSpawnZones에 없는 구역(${canonical})이 있습니다.`, {
          href: '/admin/maps',
          id: `map-core-${map._id}-${canonical}`,
        }));
      }
    }
    if (map?.forbiddenZoneConfig?.enabled === false) {
      issues.push(issue('info', '금지구역 비활성화', `${safeText(map.name, '맵')}의 금지구역 설정이 꺼져 있습니다.`, {
        href: '/admin/maps',
        id: `map-forbidden-${map._id}`,
      }));
    }
  }

  if (kiosks.length < 8) {
    issues.push(issue('warning', '키오스크 수 부족 가능성', `현재 키오스크가 ${kiosks.length}개입니다. 기본 구역 대비 부족할 수 있습니다.`, {
      href: '/admin/kiosks',
    }));
  }

  for (const kiosk of kiosks) {
    const map = mapById.get(idText(kiosk.mapId));
    if (!map) {
      issues.push(issue('critical', '키오스크 맵 참조 끊김', `${safeText(kiosk.name, kiosk.kioskId)}가 없는 맵을 가리킵니다.`, {
        href: '/admin/kiosks',
        id: `kiosk-map-${kiosk._id}`,
      }));
      continue;
    }
    const zoneIds = new Set(normalizeZoneList(map.zones).map((zone) => canonicalZoneId(zone.zoneId)).filter(Boolean));
    const zoneId = canonicalZoneId(kiosk.zoneId);
    if (zoneId && !zoneIds.has(zoneId)) {
      issues.push(issue('critical', '키오스크 구역 참조 끊김', `${safeText(kiosk.name, kiosk.kioskId)}가 ${safeText(map.name, '맵')}에 없는 구역(${zoneId})을 가리킵니다.`, {
        href: '/admin/kiosks',
        id: `kiosk-zone-${kiosk._id}`,
      }));
    }
    if (!Array.isArray(kiosk.catalog) || kiosk.catalog.length === 0) {
      issues.push(issue('info', '키오스크 카탈로그 비어 있음', `${safeText(kiosk.name, kiosk.kioskId)}의 카탈로그가 비어 있습니다.`, {
        href: '/admin/kiosks',
        id: `kiosk-empty-${kiosk._id}`,
      }));
    }
  }

  return issues;
}

function summarize(categories, counts) {
  const flat = categories.flatMap((category) => category.issues);
  const criticalCount = flat.filter((row) => row.severity === 'critical').length;
  const warningCount = flat.filter((row) => row.severity === 'warning').length;
  const infoCount = flat.filter((row) => row.severity === 'info').length;
  const score = Math.max(0, 100 - (criticalCount * 8) - (warningCount * 3) - infoCount);
  return {
    score,
    totalIssues: flat.length,
    criticalCount,
    warningCount,
    infoCount,
    counts,
  };
}

router.get('/', async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const [items, characters, maps, kiosks, droneOffers] = await Promise.all([
      Item.find(ownedFilter(userId))
        .select('_id itemKey externalId name type tags rarity tier recipe stats equipSlot weaponType source lockedByAdmin spawnZones spawnCrateTypes droneCreditsCost createdAt')
        .lean(),
      Character.find({ userId })
        .select('_id name goalGearTier goalLoadouts characterSkills tacticalSkill erRole erTrait weaponType')
        .lean(),
      MapModel.find(ownedFilter(userId))
        .select('_id name zones zoneConnections coreSpawnZones forbiddenZoneConfig itemCrates')
        .lean(),
      Kiosk.find(ownedFilter(userId))
        .select('_id kioskId name mapId zoneId catalog')
        .lean(),
      DroneOffer.find(ownedFilter(userId))
        .populate('itemId', '_id itemKey externalId name tier rarity type')
        .lean(),
    ]);

    const categories = [
      {
        key: 'items',
        title: '아이템 기본 데이터',
        href: '/admin/items',
        description: '중복, 식별자, 티어, 장비 슬롯을 확인합니다.',
        issues: inspectItems(items).slice(0, 120),
      },
      {
        key: 'references',
        title: '아이템 참조',
        href: '/admin/items',
        description: '레시피, 상자, 키오스크가 없는 아이템을 가리키는지 확인합니다.',
        issues: inspectItemReferences({ items, maps, kiosks }).slice(0, 120),
      },
      {
        key: 'drone',
        title: '전송 드론',
        href: '/admin/drone',
        description: 'T2 이상 호출 후보와 중복/가격 문제를 확인합니다.',
        issues: inspectDroneOffers(droneOffers).slice(0, 120),
      },
      {
        key: 'characters',
        title: '캐릭터 설정',
        href: '/characters',
        description: '초월 목표 장비와 스킬 스크립트 이상 신호를 확인합니다.',
        issues: inspectCharacters(characters, items).slice(0, 160),
      },
      {
        key: 'world',
        title: '맵/키오스크',
        href: '/admin/maps',
        description: '기본 구역, 동선, 키오스크 위치를 확인합니다.',
        issues: inspectMapsAndKiosks({ maps, kiosks }).slice(0, 120),
      },
    ];

    res.json({
      generatedAt: new Date().toISOString(),
      summary: summarize(categories, {
        items: items.length,
        characters: characters.length,
        maps: maps.length,
        kiosks: kiosks.length,
        droneOffers: droneOffers.length,
      }),
      categories,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '데이터 검수 실패' });
  }
});

module.exports = router;
