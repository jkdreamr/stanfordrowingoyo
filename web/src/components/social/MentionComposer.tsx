import { useId, useRef, useState } from 'react';
import type { PublicUser } from '../../../../shared/types';
import { useUsers } from '../../lib/queries';
import { mentionQuery, normalizeName } from '../../lib/social';
import { Avatar, TextArea } from '../ui';

export function MentionComposer({
  body,
  onChange,
  selected,
  onSelect,
  self,
  error,
  onPost,
  id = 'comment-body',
  autoFocus = false,
}: {
  body: string;
  onChange: (value: string) => void;
  selected: PublicUser[];
  onSelect: (users: PublicUser[]) => void;
  self?: string;
  error: string;
  onPost: () => void;
  id?: string;
  autoFocus?: boolean;
}) {
  const users = useUsers();
  const container = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const query = mentionQuery(body, caret);
  const words = normalizeName(query?.query ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const matches = (users.data ?? [])
    .filter(
      (u) =>
        u.active &&
        u.id !== self &&
        words.every((word) =>
          normalizeName(u.name)
            .split(/\s+/)
            .some((name) => name.startsWith(word)),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 6);
  const open = !!query && !dismissed && !!matches.length;
  function choose(user: PublicUser) {
    if (!query) return;
    const replacement = `@${user.name} `;
    onChange(body.slice(0, query.start) + replacement + body.slice(query.end));
    onSelect([...selected.filter((u) => u.id !== user.id), user]);
    setDismissed(true);
    requestAnimationFrame(() => {
      const input = container.current?.querySelector('textarea');
      input?.focus();
      input?.setSelectionRange(query.start + replacement.length, query.start + replacement.length);
    });
  }
  return (
    <div ref={container} className="relative">
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Mention Teammates"
          className="absolute bottom-full z-20 mb-2 max-h-72 w-full overflow-y-auto rounded-xl border border-divider bg-surface shadow-lg"
        >
          {matches.map((u, index) => (
            <li key={u.id} id={`${listId}-${index}`} role="option" aria-selected={active === index}>
              <button
                type="button"
                tabIndex={-1}
                className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-callout hover:bg-surface-2 ${active === index ? 'bg-surface-2' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(u)}
              >
                <span aria-hidden="true" className="shrink-0">
                  <Avatar name={u.name} imageId={u.avatar_image_id} />
                </span>
                <span className="min-w-0 break-words">{u.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <TextArea
        id={id}
        autoFocus={autoFocus}
        label="Comment"
        value={body}
        maxLength={1000}
        error={error}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={
          open ? `${listId}-${Math.min(active, matches.length - 1)}` : undefined
        }
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
          setActive(0);
          setDismissed(false);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onBlur={(e) => {
          if (!container.current?.contains(e.relatedTarget)) setDismissed(true);
        }}
        onKeyDown={(e) => {
          if (open && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
            e.preventDefault();
            if (e.key === 'Escape') setDismissed(true);
            else if (e.key === 'Enter') choose(matches[Math.min(active, matches.length - 1)]);
            else
              setActive(
                (index) =>
                  (index + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length,
              );
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onPost();
          }
        }}
      />
    </div>
  );
}
