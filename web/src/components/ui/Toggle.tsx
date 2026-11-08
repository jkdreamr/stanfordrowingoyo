import { useId } from 'react';
import { GlassSwitch } from './ThemeSwitch';
export function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id}>{label}</label>
      <GlassSwitch id={id} checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}
