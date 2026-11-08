import { useCountUp } from './useCountUp';

export function Ticker({
  value,
  format = String,
}: {
  value: number;
  format?: (value: number) => string;
}) {
  const current = useCountUp(value);
  return (
    <span className="tabular-nums">
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden="true">{format(current)}</span>
    </span>
  );
}
