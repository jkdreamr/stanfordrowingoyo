"""Fetch Wikidata (CC0) entity lists for Dive prompts into committed TSV snapshots.

Build-time only. Each prompt in `wikidata_prompts.py` names a SPARQL membership pattern
(class, occupation, taxon tree, ...). The main query returns only `?item ?n` (sitelink
count) so it stays cheap; English labels, aliases and types are then fetched in small
`VALUES` batches. Junk (disambiguation/list/category items, missing English labels,
QID labels, over-long or parenthetical labels, Latin-only taxa) is filtered here, and the
highest-sitelink rows are written to `scripts/dive/wikidata/<id>.tsv`:

    QID <tab> sitelinks <tab> label <tab> alias;alias

Raw responses are cached under the ignored `.cache/wikidata/`. Requests are sequential,
paced, honor Retry-After and send a descriptive User-Agent. Regeneration of Worker data
uses only the committed snapshots; this script is needed only to refresh them.
"""

import argparse
import hashlib
import http.client
import json
from pathlib import Path
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

ENDPOINT = 'https://query.wikidata.org/sparql'
AGENT = 'StanfordOYO-DiveBuilder/1.0 (https://github.com/jkdreamr/stanfordrowingoyo)'
HERE = Path(__file__).parent
CACHE = HERE / '.cache' / 'wikidata'
SNAPSHOT = HERE / 'wikidata'
PAUSE = 0.4
DETAIL_BATCH = 400
# Disambiguation, list, category, template, project and duplicate pages; never answers.
JUNK_TYPES = {'Q4167410', 'Q13406463', 'Q4167836', 'Q11266439', 'Q15407973', 'Q22808320',
              'Q17362920', 'Q14204246', 'Q17633526', 'Q15184295', 'Q19842659', 'Q20010800'}
# Fictional or hypothetical entities never count for real-world prompts.
FICTIONAL_TYPES = {'Q14897293', 'Q15632617', 'Q15773347', 'Q15773317', 'Q17624054',
                   'Q21070598', 'Q1964689', 'Q2659904'}
# Never offer these as game answers, whatever the class: adult content, and people notable
# for atrocities or crimes (matched against the English description).
UNSAFE = re.compile(r'pornograph|erotic|hentai|\bsex(ual)? (act|toy|worker)|adult (film|video|model|actress|actor)'
                    r'|nazi|hitler|\bss\b|holocaust|genocid|serial killer|murderer|mass shoot|terroris|war criminal'
                    r'|dictator|convicted|perpetrator|assassin of|white supremac|neo-nazi|concentration camp|extermination camp', re.I)
PARTICLES = {'da', 'de', 'del', 'della', 'der', 'di', 'du', 'la', 'le', 'van', 'von', 'dos', 'das', 'ten', 'ter'}
SUFFIXES = {'jr', 'sr', 'ii', 'iii', 'iv'}
TRANSLITERATE = str.maketrans({'ø': 'o', 'Ø': 'O', 'æ': 'ae', 'Æ': 'Ae', 'ß': 'ss', 'ł': 'l', 'Ł': 'L',
                               'đ': 'd', 'Đ': 'D', 'þ': 'th', 'Þ': 'Th', 'œ': 'oe', 'Œ': 'Oe', 'ı': 'i', 'ð': 'd'})
NEXT = 0.0


class QueryFailed(RuntimeError):
    pass


def sparql(query, attempts=8):
    """POST one query, sequentially and paced; cache the parsed JSON response."""
    global NEXT
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / (hashlib.sha256(query.encode()).hexdigest() + '.json')
    if path.exists():
        return json.loads(path.read_text())['results']['bindings']
    timeouts = 0
    for attempt in range(attempts):
        delay = NEXT - time.monotonic()
        if delay > 0:
            time.sleep(delay)
        request = urllib.request.Request(ENDPOINT, data=urllib.parse.urlencode(dict(query=query)).encode(), headers={
            'User-Agent': AGENT, 'Accept': 'application/sparql-results+json',
            'Content-Type': 'application/x-www-form-urlencoded'})
        started = time.monotonic()
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                body = response.read()
            data = json.loads(body)
            NEXT = time.monotonic() + PAUSE
            break
        except urllib.error.HTTPError as error:
            retry = error.headers.get('Retry-After')
            wait = int(retry) if retry and retry.isdigit() else 20 * (attempt + 1)
            if error.code not in (429, 500, 502, 503, 504):
                raise QueryFailed(f'HTTP {error.code}: {error.read()[:400]!r}') from error
            if error.code == 504 or (error.code == 500 and b'TimeoutException' in error.read()):
                timeouts += 1
                if timeouts >= 2:
                    raise QueryFailed('WDQS query timeout') from error
            print(f'  WDQS HTTP {error.code}; waiting {wait}s', file=sys.stderr, flush=True)
            NEXT = time.monotonic() + wait
        except (json.JSONDecodeError, http.client.HTTPException, ConnectionError, TimeoutError, urllib.error.URLError) as error:
            # A body cut off mid-stream is how WDQS reports its 60s timeout.
            timeouts += 1
            if time.monotonic() - started > 50 or timeouts >= 3:
                raise QueryFailed(f'WDQS query timeout ({type(error).__name__})') from error
            print(f'  WDQS incomplete response ({type(error).__name__}); retrying', file=sys.stderr, flush=True)
            NEXT = time.monotonic() + 30 * (attempt + 1)
    else:
        raise QueryFailed('WDQS retries exhausted')
    temporary = path.with_suffix('.part')
    temporary.write_text(json.dumps(data, ensure_ascii=False))
    temporary.replace(path)
    return data['results']['bindings']


def qid(binding, key='item'):
    return binding[key]['value'].rsplit('/', 1)[-1]


def members(spec):
    """Return {QID: sitelinks} for the prompt's membership pattern."""
    query = spec['query']
    if isinstance(query, tuple) and query[0] == 'taxon':
        return descend(query[1], query[2], spec['min'], query[3] if len(query) > 3 else ())
    if query.lstrip().upper().startswith('SELECT'):
        text = query
    else:
        text = ('SELECT DISTINCT ?item ?n WHERE { ' + query + ' ?item wikibase:sitelinks ?n . '
                f'FILTER(?n >= {spec["min"]}) }}')
    text = text.replace('__MIN__', str(spec['min']))
    result = {}
    for binding in sparql(text):
        result[qid(binding)] = max(result.get(qid(binding), 0), int(binding['n']['value']))
    return result


LOW_RANKS = {'Q34740', 'Q3238261', 'Q7432', 'Q68947', 'Q767728', 'Q279749', 'Q3181348'}  # genus and below


def descend(root, prune, minimum, stop=()):
    """Walk a parent-taxon (P171) tree level by level from `root`.

    Ranks above genus are always expanded (obscure intermediate clades have few sitelinks);
    genera and below are expanded only with at least `prune` sitelinks, so a 10^6-node tree
    is never enumerated. Familiar species live under familiar genera. `stop` QIDs (e.g. birds
    under dinosaurs) are neither kept nor expanded.
    """
    roots = [root] if isinstance(root, str) else list(root)
    found, frontier, seen = {}, roots, {*roots, *stop}
    while frontier:
        children = {}
        for start in range(0, len(frontier), 150):
            values = ' '.join('wd:' + q for q in frontier[start:start + 150])
            for binding in sparql('SELECT ?item ?n ?r WHERE { VALUES ?p { ' + values + ' } '
                                  '?item wdt:P171 ?p . ?item wikibase:sitelinks ?n . OPTIONAL { ?item wdt:P105 ?r } }'):
                row = children.setdefault(qid(binding), [int(binding['n']['value']), set()])
                if 'r' in binding:
                    row[1].add(qid(binding, 'r'))
        frontier = []
        for item, (n, ranks) in sorted(children.items()):
            if item in seen:
                continue
            seen.add(item)
            if n >= minimum:
                found[item] = n
            if n >= prune or not ranks & LOW_RANKS:
                frontier.append(item)
    return found


def details(qids):
    """English/mul labels, aliases and types for QIDs, in batches; cached per QID."""
    store_path = CACHE / 'details.json'
    store = json.loads(store_path.read_text()) if store_path.exists() else {}
    missing = [q for q in qids if q not in store]
    for start in range(0, len(missing), DETAIL_BATCH):
        batch = missing[start:start + DETAIL_BATCH]
        values = ' '.join('wd:' + q for q in batch)
        rows = {q: dict(en=None, mul=None, desc=None, alt=set(), types=set(), short=set(), nick=set(), common=set(), sci=set(), iata=set()) for q in batch}
        for pattern in [
            '{ ?item rdfs:label ?v . FILTER(LANG(?v) = "en" || LANG(?v) = "mul") BIND(LANG(?v) AS ?f) } '
            'UNION { ?item schema:description ?v . FILTER(LANG(?v) = "en") BIND("desc" AS ?f) } '
            'UNION { ?item skos:altLabel ?v . FILTER(LANG(?v) = "en" || LANG(?v) = "mul") BIND("alt" AS ?f) } '
            'UNION { ?item wdt:P31 ?v . BIND("types" AS ?f) } UNION { ?item wdt:P1813 ?v . FILTER(LANG(?v) = "en") BIND("short" AS ?f) } '
            'UNION { ?item wdt:P1449 ?v . FILTER(LANG(?v) = "en") BIND("nick" AS ?f) } '
            'UNION { ?item wdt:P1843 ?v . FILTER(LANG(?v) = "en") BIND("common" AS ?f) } '
            'UNION { ?item wdt:P225 ?v . BIND("sci" AS ?f) } UNION { ?item wdt:P238 ?v . BIND("iata" AS ?f) }',
        ]:
            for binding in sparql('SELECT ?item ?f ?v WHERE { VALUES ?item { ' + values + ' } ' + pattern + ' }'):
                row, kind = rows[qid(binding)], binding['f']['value']
                value = binding['v']['value'].rsplit('/', 1)[-1] if kind == 'types' else binding['v']['value']
                if kind in ('en', 'mul', 'desc'):
                    row[kind] = value
                else:
                    row[kind].add(value)
        for q, row in rows.items():
            store[q] = {key: sorted(value) if isinstance(value, set) else value for key, value in row.items()}
        if (start // DETAIL_BATCH) % 4 == 3 or start + DETAIL_BATCH >= len(missing):
            temporary = store_path.with_suffix('.part')
            temporary.write_text(json.dumps(store, ensure_ascii=False))
            temporary.replace(store_path)
            print(f'  details: {min(start + DETAIL_BATCH, len(missing))}/{len(missing)}', file=sys.stderr, flush=True)
    return {q: store[q] for q in qids}


def key(value):
    from generate import normalize
    return normalize(value)


def clean(label):
    if not label:
        return None
    label = unicodedata.normalize('NFC', label).strip()
    label = re.sub(r'\s+', ' ', label).rstrip('.') if not re.search(r'\b[A-Z]\.$', label) else re.sub(r'\s+', ' ', label)
    stripped = re.sub(r'\s*\([^()]*\)$', '', label).strip()
    if stripped != label and len(stripped) < 2:
        return None
    label = stripped
    if (not label or re.fullmatch(r'Q\d+', label) or len(label) > 40 or re.search(r'[|;\t\n\r]', label)
            or re.match(r'(?i)(list|lists|index|outline|category|template) of ', label) or label.startswith('Category:')):
        return None
    normalized = key(label)
    letters = sum(c.isalpha() for c in label)
    if not normalized or letters == 0 or sum(c.isascii() for c in label if c.isalpha()) < letters * .6:
        return None
    return label


def surname_aliases(label):
    if re.search(r'\b(of|the)\b', label):
        return []
    words = [w for w in label.replace(',', ' ').split() if w.strip('.').lower() not in SUFFIXES]
    if len(words) < 2:
        return []
    result = []
    for i, word in enumerate(words[1:-1], 1):
        if word.lower() in PARTICLES:
            result.append(' '.join(words[i:]))
            break
    last = words[-1]
    if len(last) >= 4 and last[0].isupper() and last.replace('-', '').replace("'", '').isalpha():
        result.append(last)
    return result


def candidate_aliases(spec, label, row):
    kind = spec['kind']
    ordered = []
    if kind == 'person':
        # Surnames and nicknames are what players type; Wikidata altLabels for people are
        # mostly birth names and transliterations, so only short reorderings are kept.
        ordered += surname_aliases(label) + row['nick'] + row['short']
        tokens = {t for t in re.findall(r"[^\W\d_]{3,}", label.lower())}
        ordered += [a for a in row['alt'] if len(a) < len(label) and not re.search(r'\d|\b\w{1,3}\.', a)
                    and a != a.lower() and len(a.split()) <= 2 and tokens >= set(re.findall(r"[^\W\d_]{3,}", a.lower()))]
    elif kind == 'taxon':
        ordered += row['common'] + row['short'] + row['alt'] + row['sci']
    else:
        ordered += row['short'] + row['iata'] + row['nick'] + row['alt']
    ascii_label = label.translate(TRANSLITERATE)
    result, keys = [], {key(label)}
    if key(ascii_label) not in keys:
        result.append(ascii_label)
        keys.add(key(ascii_label))
    for alias in ordered:
        alias = re.sub(r'\s+', ' ', unicodedata.normalize('NFC', alias)).strip()
        alias = re.sub(r'\s*\([^()]*\)$', '', alias).strip()
        minimum = 2 if alias in row['short'] or alias in row['iata'] else 3
        if (len(alias) < minimum or len(alias) > 40 or re.search(r'[|;\t\n\r,]', alias)
                or not any(c.isalpha() for c in alias) or re.fullmatch(r'Q\d+', alias)):
            continue
        k = key(alias)
        if not k or k in keys or sum(c.isascii() for c in alias if c.isalpha()) < sum(c.isalpha() for c in alias) * .8:
            continue
        keys.add(k)
        result.append(alias)
        if len(result) >= spec['aliases_max']:
            break
    return result


def rows_for(spec):
    counts = members(spec)
    ranked = sorted(counts, key=lambda q: (-counts[q], int(q[1:])))
    keep = spec['fetch']
    output, seen = [], set()
    for start in range(0, len(ranked), 600):
        chunk = ranked[start:start + 600]
        info = details(chunk)
        for q in chunk:
            row = info[q]
            types = set(row['types'])
            if types & JUNK_TYPES or (types & FICTIONAL_TYPES and not spec['fictional']):
                continue
            if spec['exclude_types'] & types:
                continue
            if UNSAFE.search(row['desc'] or ''):
                continue
            if spec['desc'] and not re.search(spec['desc'], row['desc'] or '', re.I) and q not in spec['keep']:
                continue
            label = row['en'] or row['mul']
            if spec['kind'] == 'taxon':
                sci = set(row['sci'])
                if label in sci or not label:
                    common = [c for c in row['common'] if clean(c)]
                    if common:
                        label = common[0]
                    elif not spec['latin_ok']:
                        continue
            label = clean(label)
            if not label or (spec['no_digits'] and re.search(r'\d', label)):
                continue
            if spec['kind'] == 'taxon' and not spec['latin_ok'] and re.fullmatch(r'[A-Z][a-z]+( [a-z]+){1,2}', label) and label in row['sci']:
                continue
            k = key(label)
            if k in seen:
                continue
            seen.add(k)
            output.append((q, counts[q], label, candidate_aliases(spec, label, row)))
            if len(output) >= keep:
                return output
    return output


def write(spec, rows):
    SNAPSHOT.mkdir(exist_ok=True)
    lines = [f'# Wikidata (CC0) snapshot for Dive prompt {spec["id"]}. Generated by scripts/dive/wikidata.py; do not edit.',
             '# qid\tsitelinks\tlabel\taliases']
    lines += ['\t'.join([q, str(n), label, ';'.join(aliases)]) for q, n, label, aliases in rows]
    (SNAPSHOT / f'{spec["id"]}.tsv').write_text('\n'.join(lines) + '\n')


def read(id):
    """Parse a committed snapshot: [(qid, sitelinks, label, [aliases])] in rank order."""
    rows = []
    for line in (SNAPSHOT / f'{id}.tsv').read_text().splitlines():
        if line.startswith('#') or not line:
            continue
        q, n, label, aliases = line.split('\t')
        rows.append((q, int(n), label, aliases.split(';') if aliases else []))
    return rows


def main():
    sys.path.insert(0, str(HERE))
    from wikidata_prompts import SPECS
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('ids', nargs='*', help='only refresh these prompt ids')
    parser.add_argument('--missing', action='store_true', help='only fetch prompts without a snapshot')
    args = parser.parse_args()
    specs = [s for s in SPECS if (not args.ids or s['id'] in args.ids)]
    # Extensions rescue undersized reviewed prompts first; slow taxon-tree walks go last.
    specs.sort(key=lambda s: (isinstance(s['query'], tuple), not s.get('extend')))
    if args.ids and len(specs) != len(set(args.ids)):
        raise SystemExit('Unknown prompt id')
    failed = []
    for spec in specs:
        if args.missing and (SNAPSHOT / f'{spec["id"]}.tsv').exists():
            continue
        print(f'{spec["id"]}: fetching', file=sys.stderr, flush=True)
        try:
            rows = rows_for(spec)
        except (QueryFailed, OSError, http.client.HTTPException) as error:
            print(f'{spec["id"]}: FAILED {error}', file=sys.stderr, flush=True)
            failed.append(spec['id'])
            continue
        write(spec, rows)
        print(f'{spec["id"]}: {len(rows)} rows; top: ' + ', '.join(r[2] for r in rows[:8]), file=sys.stderr, flush=True)
    if failed:
        raise SystemExit('Failed: ' + ' '.join(failed))


if __name__ == '__main__':
    main()
