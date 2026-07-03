import Link from 'next/link';
import { TACTICAL_SKILL_OPTIONS_KO } from '../../simulation/tacticalSkillTable';
import {
  GOAL_GEAR_TIERS,
  LOADOUT_SLOTS,
  LOADOUT_TIERS,
  getLoadoutOptionsForSlot,
} from '../_lib/detailsPageRuntime';

function DetailsGoalConfigModal({
  character,
  editGoalGearTier,
  editGoalLoadouts,
  editTacticalSkill,
  equipList,
  onBackdropPointerDown,
  onBackdropPointerUp,
  onClose,
  onSave,
  onSetGoalGearTier,
  onSetTacticalSkill,
  onUpdateLoadout,
}) {
  if (!character) return null;
  const name = character?.name || '캐릭터';

  return (
    <div
      role="dialog"
      aria-modal="true"
      onPointerDown={onBackdropPointerDown}
      onPointerUp={(event) => onBackdropPointerUp(event, onClose)}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 9999,
      }}
    >
      <div style={{ width: 'min(560px, 100%)', background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>⚙️ {name} 목표 세팅</h2>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#333', display: 'flex', alignItems: 'center', gap: 6 }}>
              목표 장비 등급
              <Link href="/help" className="inline-help-link" title="목표 장비 등급 설명 보기">?</Link>
            </span>
            <select value={String(editGoalGearTier)} onChange={(event) => onSetGoalGearTier(Number(event.target.value))}>
              {GOAL_GEAR_TIERS.map((tier) => (
                <option key={tier.value} value={String(tier.value)}>{tier.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#333', display: 'flex', alignItems: 'center', gap: 6 }}>
              전술 스킬 (시즌 11 일반)
              <Link href="/help" className="inline-help-link" title="전술 스킬 설명 보기">?</Link>
            </span>
            <select value={String(editTacticalSkill)} onChange={(event) => onSetTacticalSkill(event.target.value)}>
              {TACTICAL_SKILL_OPTIONS_KO.map((skill) => (
                <option key={skill} value={skill}>{skill}</option>
              ))}
            </select>
          </label>

          <div style={{ borderTop: '1px solid #eee', paddingTop: 10, display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 13, color: '#333' }}>목표 장비 세팅 (등급별)</div>
            {LOADOUT_TIERS.map((tier) => (
              <div key={tier.key} style={{ border: '1px solid #f0f0f0', borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{tier.label}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {LOADOUT_SLOTS.map((slot) => {
                    const options = getLoadoutOptionsForSlot(character, slot.slot, equipList);
                    const val = String(editGoalLoadouts?.[tier.key]?.[slot.key] || '');
                    return (
                      <label key={slot.key} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#444' }}>{slot.label}</span>
                        <select value={val} onChange={(event) => onUpdateLoadout(tier.key, slot.key, event.target.value)}>
                          <option value="">(미지정)</option>
                          {options.map((item) => (
                            <option key={item.itemKey} value={item.itemKey}>
                              {item.name}{item.tier ? ` (T${item.tier})` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>취소</button>
          <button type="button" onClick={onSave} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #0288d1', background: '#0288d1', color: '#fff', cursor: 'pointer' }}>적용</button>
        </div>
      </div>
    </div>
  );
}

export default DetailsGoalConfigModal;
