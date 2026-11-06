import { Bike, Footprints, Waves } from 'lucide-react';
import type { Modality } from '../../../../shared/types';
export function ModalityIcon({ modality }: { modality: Modality }) {
  const Icon = modality === 'erg' ? Waves : modality === 'bike' ? Bike : Footprints;
  return <Icon size={20} strokeWidth={1.75} aria-hidden="true" />;
}
