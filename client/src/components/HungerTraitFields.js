import { HUNGER_TRAITS, normalizeHungerTraits, hungerTraitLabel } from '../utils/hungerTraits.js';

export default function HungerTraitFields({ value, onChange, legend = '헝거게임 특성', disabled = false }) {
  const selected = normalizeHungerTraits(value);
  const extra = selected.filter((key) => !HUNGER_TRAITS.some((trait) => trait.id === key));
  return (
    <fieldset disabled={disabled} style={{ minWidth: 0, border: '1px solid #64748b55', borderRadius: 10, padding: 12, margin: '12px 0' }}>
      <legend>{legend}</legend>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))', gap: '8px 14px' }}>
        {[...HUNGER_TRAITS, ...extra.map((id) => ({ id, label: hungerTraitLabel(id) }))].map((trait) => (
          <label key={trait.id} style={{ display: 'flex', minWidth: 0, minHeight: 30, alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" style={{ flex: '0 0 16px', width: 16, height: 16, minHeight: 16, padding: 0, margin: 0 }} checked={selected.includes(trait.id)} onChange={() => onChange(selected.includes(trait.id) ? selected.filter((key) => key !== trait.id) : normalizeHungerTraits([...selected, trait.id]))} />
            <span style={{ minWidth: 0, wordBreak: 'keep-all', overflowWrap: 'anywhere', lineHeight: 1.4 }}>{trait.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
