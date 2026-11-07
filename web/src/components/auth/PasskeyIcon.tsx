import { Fingerprint, KeyRound, ScanFace } from 'lucide-react';
export function PasskeyIcon({ label, size = 20 }: { label: string; size?: number }) {
  const Icon =
    label === 'Face ID' ? ScanFace : /Touch ID|Fingerprint/.test(label) ? Fingerprint : KeyRound;
  return <Icon aria-hidden="true" size={size} strokeWidth={1.75} />;
}
