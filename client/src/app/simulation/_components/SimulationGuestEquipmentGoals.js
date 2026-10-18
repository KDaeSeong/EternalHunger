'use client';

import { ER_WEAPON_TYPES_KO, normalizeErWeaponType } from '../../../utils/erMeta.js';
import { GUEST_GOAL_SLOTS, GUEST_GOAL_TIERS, getGuestEquipmentGoalErrors,
  getGuestEquipmentGoalOptions, normalizeGuestGoalLoadouts, resolveGuestEquipmentGoal } from '../_lib/guestEquipmentGoalRuntime.js';

const EMPTY_LOADOUTS = normalizeGuestGoalLoadouts({});
const itemId = (item) => String(item?._id || '').trim();

export default function SimulationGuestEquipmentGoals({ actor, draft, items = [], onChange }) {
  const catalogReady = Array.isArray(items) && items.length > 0;
  const rawLoadouts = draft?.goalLoadouts !== undefined ? draft.goalLoadouts : actor?.goalLoadouts;
  const normalizedLoadouts = normalizeGuestGoalLoadouts(rawLoadouts);
  const loadouts = normalizedLoadouts && normalizedLoadouts !== null ? normalizedLoadouts : EMPTY_LOADOUTS;
  const weaponType = normalizeErWeaponType(draft?.weaponType || actor?.weaponType || '');
  const hasValidWeapon = ER_WEAPON_TYPES_KO.includes(weaponType);
  const validationActor = { ...actor, ...draft, weaponType: hasValidWeapon ? weaponType : draft?.weaponType || actor?.weaponType || '',
    goalLoadouts: rawLoadouts };
  const invalidGoals = normalizedLoadouts === null;
  const errors = catalogReady || invalidGoals ? getGuestEquipmentGoalErrors(validationActor, items) : [];

  function updateGoal(tierKey, slotKey, value) {
    const next = { ...loadouts, [tierKey]: { ...loadouts[tierKey], [slotKey]: value } };
    onChange?.({ goalLoadouts: normalizeGuestGoalLoadouts(next) });
  }

  return (
    <details className="simulation-guest-equipment-goals">
      <summary>무기·장비 목표 (선택)</summary>
      <p>목표를 비워 두면 기존 자동 추천을 유지합니다. 설정한 목표는 실제 재료·제작비·장착 조건으로 진행합니다.</p>

      <label className="simulation-guest-equipment-goals__weapon" htmlFor="simulation-guest-equipment-weapon-type">
        시작 무기군
        <select id="simulation-guest-equipment-weapon-type" value={hasValidWeapon ? weaponType : '__invalid_weapon__'}
          onChange={(event) => {
            const value = normalizeErWeaponType(event.target.value);
            if (ER_WEAPON_TYPES_KO.includes(value)) onChange?.({ weaponType: value });
          }}>
          {!hasValidWeapon && <option value="__invalid_weapon__" disabled>{weaponType ? `현재 무기군을 확인할 수 없음: ${weaponType}` : '현재 무기군 미설정'}</option>}
          {ER_WEAPON_TYPES_KO.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>

      {!catalogReady ? <p className="simulation-guest-equipment-goals__waiting" role="status">
        아이템 목록이 준비되지 않아 목표 선택을 기다리고 있습니다. 자동 추천은 유지됩니다.
      </p> : null}

      <div className="simulation-guest-equipment-goals__tiers">
        {GUEST_GOAL_TIERS.map((tier) => (
          <details key={tier.key} className={`simulation-guest-equipment-goals__tier${tier.key === 'hero' ? ' is-hero' : ''}`}
            open={tier.key === 'hero'}>
            <summary>{tier.label} 장비 목표 · {tier.tier}티어</summary>
            <div className="simulation-guest-equipment-goals__slots">
              {GUEST_GOAL_SLOTS.map((slot) => {
                const currentKey = loadouts[tier.key]?.[slot.key] || '';
                const options = getGuestEquipmentGoalOptions(validationActor, items, tier.key, slot.slot);
                const resolvedGoal = currentKey
                  ? resolveGuestEquipmentGoal(validationActor, items, tier.key, slot.slot, currentKey) : null;
                const selected = resolvedGoal && options.some((item) => itemId(item) === itemId(resolvedGoal))
                  ? resolvedGoal : null;
                const value = selected ? itemId(selected) : currentKey ? `__unavailable_${tier.key}_${slot.key}__` : '';
                const unavailable = Boolean(currentKey && !selected);
                const selectId = `simulation-guest-goal-${tier.key}-${slot.key}`;
                return (
                  <label key={slot.key} htmlFor={selectId}>
                    {slot.label}
                    <select id={selectId} value={value} disabled={!catalogReady || invalidGoals}
                      onChange={(event) => updateGoal(tier.key, slot.key, event.target.value)}>
                      {unavailable
                        ? <option value={value} disabled>현재 목표 사용 불가 · {currentKey}</option>
                        : null}
                      <option value="">자동 추천</option>
                      {options.map((item) => <option key={itemId(item)} value={itemId(item)}>
                        {item.name || itemId(item)}{item.weaponType ? ` · ${item.weaponType}` : ''}
                      </option>)}
                    </select>
                  </label>
                );
              })}
            </div>
          </details>
        ))}
      </div>

      {errors.length > 0 ? <ul className="simulation-guest-equipment-goals__errors" role="status">
        {errors.map((error, index) => <li key={`${index}:${error}`}>{error}</li>)}
      </ul> : null}
      <p className="simulation-guest-equipment-goals__guard">저장 시 현재 아이템·부위·티어·무기 호환성을 다시 검사합니다. 사용할 수 없는 기존 목표는 자동으로 바꾸지 않습니다.</p>
      <button type="button" className="simulation-guest-equipment-goals__reset"
        onClick={() => onChange?.({ goalLoadouts: normalizeGuestGoalLoadouts({}) })}>
        모든 장비 목표 초기화
      </button>
    </details>
  );
}
