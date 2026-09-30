import { HUNGER_TRAITS, normalizeHungerTraits, hungerTraitLabel } from '../utils/hungerTraits.js';

export default function HungerTraitFields({ value, onChange, legend = '헝거게임 특성', disabled = false }) {
  const selected = normalizeHungerTraits(value);
  const extra = selected.filter((key) => !HUNGER_TRAITS.some((trait) => trait.id === key));
  return (
    <fieldset disabled={disabled} style={{ border: '1px solid #64748b55', borderRadius: 10, padding: 12, margin: '12px 0' }}>
      <legend>{legend}</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>
        {[...HUNGER_TRAITS, ...extra.map((id) => ({ id, label: hungerTraitLabel(id) }))].map((trait) => (
          <label key={trait.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={selected.includes(trait.id)} onChange={() => onChange(selected.includes(trait.id) ? selected.filter((key) => key !== trait.id) : normalizeHungerTraits([...selected, trait.id]))} />
            {trait.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
