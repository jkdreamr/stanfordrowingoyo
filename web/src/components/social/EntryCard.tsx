import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, MessageCircle } from 'lucide-react';
import type { Config, EntryDetail } from '../../../../shared/types';
import { Avatar, Button, ZoneChip, useToast } from '../ui';
import { useKudos } from '../../lib/queries';
import { ModalityIcon } from '../shell/ModalityIcon';
import {
  formatDuration,
  formatEMeters,
  formatShortDate,
  formatMeters,
  formatNumber,
  formatSplit,
} from '../../lib/format';
import { relativeTime } from '../../lib/social';
import { KudosButton } from './KudosButton';
import { HighlightBadge } from './HighlightBadge';
import { PhotoCarousel } from './PhotoCarousel';
import { WithTeammates } from './WithTeammates';
import { useDoubleTap } from './useDoubleTap';

export function EntryCard({
  entry,
  config,
  full = false,
  onComment,
}: {
  entry: EntryDetail;
  config?: Config;
  full?: boolean;
  onComment?: () => void;
}) {
  const navigate = useNavigate();
  const mutation = useKudos();
  const toast = useToast();
  const card = useRef<HTMLElement>(null);
  const giving = useRef(false);
  const burstTimer = useRef<ReturnType<typeof setTimeout>>();
  const [burst, setBurst] = useState<{ x: number; y: number }>();
  useEffect(() => () => clearTimeout(burstTimer.current), []);
  const taps = useDoubleTap((x, y) => {
    if (entry.has_kudos || mutation.isPending || giving.current) return;
    giving.current = true;
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const bounds = card.current!.getBoundingClientRect();
      setBurst({ x: x - bounds.left, y: y - bounds.top });
      clearTimeout(burstTimer.current);
      burstTimer.current = setTimeout(() => setBurst(undefined), 850);
    }
    mutation.mutate(
      { id: entry.id, hasKudos: true },
      {
        onError: () => {
          setBurst(undefined);
          toast.show({ title: 'Kudos not saved. Try again', tone: 'error' });
        },
        onSettled: () => {
          giving.current = false;
        },
      },
    );
  });
  const [expanded, setExpanded] = useState(full);
  const [overflows, setOverflows] = useState(false);
  const notes = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const measure = () => {
      if (notes.current && !expanded)
        setOverflows(notes.current.scrollHeight > notes.current.clientHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (notes.current) observer.observe(notes.current);
    return () => observer.disconnect();
  }, [entry.notes, expanded]);
  const stats = [
    ['Distance', formatMeters(entry.distance_m)],
    ...(entry.duration_s !== null ? [['Time', formatDuration(entry.duration_s)]] : []),
    ...(entry.avg_split_s !== null ? [['Split /500m', formatSplit(entry.avg_split_s)]] : []),
    ...(entry.stroke_rate !== null ? [['Rate', `${formatNumber(entry.stroke_rate)} spm`]] : []),
    ...(entry.avg_hr !== null ? [['HR', `${formatNumber(entry.avg_hr)} bpm`]] : []),
  ];
  return (
    <article
      ref={card}
      className="ui-card social-entry social-double-tap"
      onPointerDown={taps.onPointerDown}
      onPointerMove={taps.onPointerMove}
      onPointerCancel={taps.onPointerCancel}
      onClick={(event) => {
        if (
          (event.target as Element).closest(
            'a, button, input, textarea, select, [contenteditable], dialog, [data-no-double-tap]',
          )
        ) {
          taps.cancel();
          return;
        }
        taps.click(event, () => {
          if (!full) navigate(`/entries/${entry.id}`);
        });
      }}
    >
      {burst && (
        <>
          <span className="drive-puddle" style={{ left: burst.x, top: burst.y }} />
          <span className="drive-puddle" style={{ left: burst.x, top: burst.y }} />
          <Heart
            aria-hidden="true"
            size={72}
            className="social-heart-burst"
            style={{ left: burst.x, top: burst.y }}
          />
        </>
      )}
      <div className="flex items-center gap-3" data-no-double-tap>
        <Avatar size="feed" name={entry.author.name} imageId={entry.author.avatar_image_id} />
        <div className="min-w-0">
          <Link
            className="social-text-link inline-flex min-h-11 items-center text-headline"
            to={`/users/${entry.user_id}`}
          >
            {entry.author.name}
          </Link>
          <p className="text-caption text-muted">
            {relativeTime(entry.created_at)}
            {entry.date !== config?.today && ` · ${formatShortDate(entry.date)}`}
          </p>
        </div>
      </div>
      <h2 className="mt-4 text-title3">
        <Link
          className="social-text-link inline-flex min-h-11 items-center"
          to={`/entries/${entry.id}`}
        >
          {entry.title}
        </Link>
      </h2>
      <div className="mt-2 mb-4 flex items-center gap-2 text-subhead">
        <ModalityIcon modality={entry.modality} />
        <span className="capitalize">{entry.modality}</span>
        <ZoneChip zone={entry.zone} />
      </div>
      <p className="text-title1 tabular-nums">{formatEMeters(entry.equiv_m)}</p>
      <HighlightBadge entry={entry} />
      <dl className="my-4 grid grid-cols-3 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-6">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="text-caption text-muted">{label}</dt>
            <dd className="text-callout tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {entry.images.length > 0 && (
        <PhotoCarousel
          images={entry.images}
          alt={entry.title}
          onPhotoClick={(event, open) => {
            event.stopPropagation();
            taps.click(event, open);
          }}
        />
      )}
      {entry.notes && (
        <div className="my-4">
          <p
            ref={notes}
            className={`whitespace-pre-wrap break-words text-callout ${expanded ? '' : 'line-clamp-3'}`}
          >
            {entry.notes}
          </p>
          {overflows && !expanded && (
            <Button variant="plain" onClick={() => setExpanded(true)}>
              More
            </Button>
          )}
        </div>
      )}
      <WithTeammates users={entry.tagged} />
      <footer className="entry-actions">
        <KudosButton entry={entry} />
        <button
          type="button"
          className="entry-action"
          aria-label={
            entry.comment_count
              ? `${entry.comment_count} ${entry.comment_count === 1 ? 'Comment' : 'Comments'}`
              : 'Comment'
          }
          onClick={onComment ?? (() => navigate(`/entries/${entry.id}#comments`))}
        >
          <span className="entry-action-icon" aria-hidden="true">
            <MessageCircle size={20} strokeWidth={1.75} />
          </span>
          <span className="entry-action-count" aria-hidden="true">
            {entry.comment_count || ''}
          </span>
        </button>
      </footer>
    </article>
  );
}
