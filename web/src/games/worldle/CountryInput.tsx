import { useEffect, useId, useRef, useState } from 'react';
import { normalizeCountry, resolveCountry } from '../../../../shared/games/worldle';
import { worldleNames } from '../../../../shared/games/worldleNames';
import { Button } from '../../components/ui';

const SEARCH = worldleNames.map((country) => ({
  ...country,
  terms: [country.name, ...country.aliases].map(normalizeCountry),
}));

function matchRank(terms: readonly string[], query: string) {
  if (terms.includes(query)) return 0;
  if (terms[0].startsWith(query)) return 1;
  if (terms.slice(1).some((value) => value.startsWith(query))) return 2;
  if (terms.some((value) => value.split(' ').some((word) => word.startsWith(query)))) return 3;
  return terms.some((value) => value.includes(query)) ? 4 : Infinity;
}

export function CountryInput({
  guessed,
  busy,
  submit,
}: {
  guessed: string[];
  busy: boolean;
  submit: (name: string) => Promise<void>;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [message, setMessage] = useState('');
  const term = normalizeCountry(text);
  const suggestions = term
    ? SEARCH.filter((country) => !guessed.includes(country.name))
        .map((country) => ({ country, rank: matchRank(country.terms, term) }))
        .filter(({ rank }) => Number.isFinite(rank))
        .sort((a, b) => a.rank - b.rank || a.country.name.localeCompare(b.country.name, 'en'))
        .slice(0, 6)
        .map(({ country }) => country)
    : [];
  const expanded = open && suggestions.length > 0;

  useEffect(() => {
    if (expanded && active >= 0)
      document.getElementById(`${id}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [expanded, active, id]);

  function select(name: string) {
    input.current?.focus();
    setText(name);
    setOpen(false);
    setActive(-1);
    setMessage('');
  }
  async function send() {
    const index = resolveCountry(text);
    if (index === null) {
      setMessage('Choose a country from the suggestions.');
      return;
    }
    const name = worldleNames[index].name;
    if (guessed.includes(name)) {
      setMessage('Already guessed. Choose another country.');
      return;
    }
    setMessage('');
    setOpen(false);
    try {
      await submit(name);
      setText('');
      setActive(-1);
    } catch {
      /* The play surface announces API errors. */
    }
  }
  return (
    <form
      className="worldle-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) void send();
      }}
    >
      <label htmlFor={id}>Guess a country or territory</label>
      <div className="worldle-entry">
        {expanded && (
          <ul
            className="worldle-suggestions"
            id={`${id}-list`}
            role="listbox"
            aria-label="Countries"
          >
            {suggestions.map((country, i) => (
              <li
                key={country.name}
                id={`${id}-${i}`}
                role="option"
                aria-selected={active === i}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => select(country.name)}
                className={active === i ? 'worldle-option-active' : ''}
              >
                {country.name}
              </li>
            ))}
          </ul>
        )}
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? `${id}-list` : undefined}
          aria-activedescendant={expanded && active >= 0 ? `${id}-${active}` : undefined}
          aria-describedby={message ? `${id}-message` : undefined}
          value={text}
          disabled={busy}
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          enterKeyHint="go"
          placeholder="Country name"
          onFocus={() => {
            setOpen(true);
            input.current?.scrollIntoView?.({ block: 'nearest' });
          }}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setActive(-1);
            setMessage('');
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length) {
              event.preventDefault();
              setOpen(true);
              setActive((value) =>
                value < 0
                  ? event.key === 'ArrowDown'
                    ? 0
                    : suggestions.length - 1
                  : (value + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) %
                    suggestions.length,
              );
            } else if (event.key === 'Escape') {
              setOpen(false);
              setActive(-1);
            } else if (event.key === 'Enter' && expanded && active >= 0) {
              event.preventDefault();
              select(suggestions[active].name);
            }
          }}
        />
        <Button type="submit" loading={busy} disabled={!text.trim() || busy}>
          Guess
        </Button>
      </div>
      <p id={`${id}-message`} className="worldle-input-message" role="status">
        {message}
      </p>
    </form>
  );
}
