import { useEffect, useRef, useState } from 'react';
import { Target } from 'lucide-react';
import type { EntryDetail } from '../../../../shared/types';
import { useWeekStats } from '../../lib/queries';
import { hitsTarget } from '../../lib/social';

export function useTargetHit(entry: EntryDetail) {
  const ref = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([item]) => {
        if (item.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const { data } = useWeekStats({ week: entry.week_start, user: entry.user_id }, near);
  return { ref, hit: !!data && hitsTarget(entry, data) };
}
export function HighlightBadge({ entry }: { entry: EntryDetail }) {
  const { ref, hit } = useTargetHit(entry);
  return (
    <span ref={ref}>
      {hit && (
        <span className="inline-flex items-center gap-1 text-footnote text-highlight-ink">
          <Target size={20} strokeWidth={1.75} aria-hidden="true" />
          Hit Weekly Target
        </span>
      )}
    </span>
  );
}
