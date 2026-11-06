import { Check } from 'lucide-react';
export function ChoiceRow({
  name,
  value,
  checked,
  onChange,
  title,
  subtitle,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  subtitle?: string;
}) {
  return (
    <label className="ui-row cursor-pointer">
      <input
        className="sr-only peer"
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span className="min-w-0 flex-1 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent-ink">
        <span className="block">{title}</span>
        {subtitle && <span className="block text-footnote text-muted">{subtitle}</span>}
      </span>
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center text-accent-ink"
        aria-hidden="true"
      >
        {checked && <Check size={22} strokeWidth={2} />}
      </span>
    </label>
  );
}
