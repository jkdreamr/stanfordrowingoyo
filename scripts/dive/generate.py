"""Generate Worker-only curated Dive sets. Run with the pinned requirements in a venv.

Within EACH prompt, rank entity familiarity descending (Zipf/lexical tiebreak).
Rank percentiles: first 20% surface, next 35% school, next 25% rare, last 20% deep.
Then apply Surface anchors, explicit Too Clever picks, and exactly one hand-picked Pearl.
No absolute Zipf thresholds and no automatically generated Too Clever or Pearl picks.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import urllib.request

import geonamescache
import pycountry
from wordfreq import zipf_frequency

from overrides import PROMPTS, WD_SPECS
from constrained import normalize, read_specs
from themes import tag
import schedule
import pageviews
import wikidata

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).parent / '.cache'
OUTPUT = ROOT / 'worker/src/games/dive'
DIVE_SCHEDULE_CUTOVER = '2026-11-10'
CORPORA = 'https://raw.githubusercontent.com/dariusk/corpora/1109305242d08d851a50f929792a0e7caa7a655b/data/'
MOVIES = 'https://raw.githubusercontent.com/vega/vega-datasets/v2.9.0/data/movies.json'
CONSTELLATIONS = 'https://raw.githubusercontent.com/astropy/astropy/v7.1.0/astropy/coordinates/data/constellation_names.dat'
# Inputs the Worker matcher always rejects (worker/src/games/dive/matcher.ts); never aliases.
STOPWORDS = {'none', 'idk', 'unknown', 'pass', 'skip', 'dont know', 'i dont know', 'no idea', 'nothing', 'na'}
MIN_ACTIVE = 320  # five prompts a day for 64 days without a repeat
MIN_ACTIVE_SIZE = 200
# Bundle budget: every set keeps at most this many highest-ranked canonicals (plus reviewed picks).
MAX_SET = 430
CODE = {'surface': 's', 'tooclever': 't', 'school': 'm', 'rare': 'r', 'deep': 'd', 'gem': 'g'}
POINTS = {'s': 10, 't': 15, 'm': 30, 'r': 60, 'd': 85, 'g': 100}
COMMON_NOUN_PROMPTS = {'animals', 'birds', 'fruits', 'vegetables', 'objects', 'appliances',
    'instruments', 'spices', 'seafood', 'cheeses', 'elements', 'metals', 'colors', 'fabrics',
    'jobs', 'landforms', 'stones', 'gemstones', 'knots', 'flowers', 'tea', 'condiments',
    'sausages', 'beer', 'plants', 'clothing', 'rooms', 'monsters', 'winds', 'art',
    'meteorology', 'scents', 'sports', 'subjects', 'industries', 'fictional-materials',
    'toxic-plants', 'weather'}
PLURAL_DISPLAY_EXCEPTIONS = {'clothes', 'glasses', 'scissors', 'pants', 'trousers', 'shorts',
    'tights', 'pliers', 'tweezers', 'species', 'series', 'news', 'lens', 'molasses',
    'slacks', 'overalls', 'jeans', 'billiards', 'darts', 'bowls', 'athletics', 'gymnastics',
    'aerobics', 'physics', 'mathematics', 'economics', 'politics', 'games'}


def display_name(name, prompt):
    if prompt['id'] not in COMMON_NOUN_PROMPTS and not prompt.get('common'):
        return name
    match = re.search(r'([^\W\d_]+)$', name)
    if match and match.group().lower() not in PLURAL_DISPLAY_EXCEPTIONS:
        word = match.group()
        singular = normalize(word)
        candidate = name[:match.start()] + singular
        if word.islower() and normalize(candidate) == normalize(name):
            name = candidate
    name = re.sub(r"[^\W\d_]+(?:['’][^\W\d_]+)*", lambda m: m.group().capitalize() if m.group().islower() else m.group(), name)
    return {'Ipod': 'iPod', 'Ipod Charger': 'iPod Charger', 'Mp3 Player': 'MP3 Player'}.get(name, name)


def fetch(url):
    CACHE.mkdir(exist_ok=True)
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.raw')
    if not path.exists():
        request = urllib.request.Request(url, headers=pageviews.HEADERS)
        with urllib.request.urlopen(request, timeout=60) as response:
            path.write_bytes(response.read())
    return path.read_text()


def extract(value, path):
    if path == ['name'] and isinstance(value, str):
        return [value]
    if not path:
        if isinstance(value, list):
            return [item for part in value for item in extract(part, [])]
        if not isinstance(value, str):
            raise ValueError(f'Expected string, got {value!r}')
        return [value]
    if isinstance(value, list):
        return [item for part in value for item in extract(part, path)]
    if path[0] == '@':
        return extract(value, path[1:])
    return extract(value[path[0]], path[1:])


def source_values(source):
    if source.startswith('cities:'):
        country = source.split(':')[1]
        cities = sorted((c for c in geonamescache.GeonamesCache().get_cities().values() if c['countrycode'] == country), key=lambda c: (-c['population'], c['name']))
        return [c['name'] for c in cities[:500]]
    if source == 'languages':
        return [language.name for language in pycountry.languages if hasattr(language, 'alpha_2')]
    if source == 'states':
        return [s.name for s in pycountry.subdivisions.get(country_code='US')]
    if source.startswith('movies:'):
        genre = source.split(':')[1]
        movies = json.loads(fetch(MOVIES))
        selected = sorted((m for m in movies if genre == 'all' or m['Major Genre'] == genre), key=lambda m: -(m.get('IMDB Votes') or 0))
        return [str(m['Title']) for m in selected[:1000]]
    if source.startswith('wd:'):
        return []  # Wikidata snapshot rows are merged alias-aware in prepare().
    if source == 'constellations':
        return [line[4:].strip() for line in fetch(CONSTELLATIONS).splitlines() if line and not line.startswith('#')]
    path, field = source.split('#')
    return extract(json.loads(fetch(CORPORA + path + '.json')), field.split('.'))


def wikidata_rows(prompt):
    """Committed Wikidata snapshot rows for the prompt's `wd:` sources, highest-ranked first."""
    rows = []
    for source in prompt['source'].split('+'):
        if source.startswith('wd:'):
            spec = WD_SPECS[source[3:]]
            for qid, links, label, aliases in wikidata.read(spec['id'])[:spec['cap']]:
                if spec.get('extend') and spec['common'] and label.islower():
                    label = re.sub(r"[^\W\d_]+(?:['’][^\W\d_]+)*", lambda m: m.group().capitalize(), label)
                rows.append((qid, links, label, aliases))
    return rows


def valid_name(name):
    return len(name.encode('utf-16-le')) // 2 <= 40 and not re.search(r'[|;\n\r\t]', name)


def prepare(prompt):
    values = ([r['name'] for r in prompt['rows']] if prompt.get('constrained') else
              [v for source in prompt['source'].split('+') for v in source_values(source)])
    if 'allow' in prompt:
        allowed = {normalize(x) for x in prompt['allow']}
        values = [v for v in values if normalize(v) in allowed]
    forced = prompt['surface'] + prompt['too_clever'] + [prompt['gem']] + list(prompt['aliases'])
    # Keep curated spelling/capitalization when a source has an equivalent normalized key.
    names = {}
    excluded = {normalize(x) for x in prompt.get('exclude', [])}
    for name in values:
        name = name.strip()
        key = normalize(name)
        if key and key not in excluded and valid_name(name):
            names[key] = name
    # Wikidata rows never replace reviewed source spellings; a row whose label or alias is
    # already present is the same entity under another name and is skipped.
    for _, _, label, aliases in wikidata_rows(prompt):
        keys = {normalize(label)} | {normalize(alias) for alias in aliases}
        if normalize(label) and not keys & (set(names) | excluded) and valid_name(label):
            names[normalize(label)] = label
    for name in forced:
        name = name.strip()
        key = normalize(name)
        if key and key not in excluded and valid_name(name):
            names[key] = name
    for name in forced:
        if names.get(normalize(name)) != name:
            raise ValueError(f'{prompt["id"]}: invalid override {name}')
    # Explicit aliases merge synonymous source rows; ambiguity is never silently resolved.
    aliases = {}
    canonical_keys = {normalize(x) for x in prompt['aliases']}
    for canonical, variants in prompt['aliases'].items():
        for alias in variants:
            key = normalize(alias)
            if key == normalize(canonical):
                continue
            if key in aliases or key in canonical_keys or not key or re.search(r'[|;\n\r\t]', alias):
                raise ValueError(f'{prompt["id"]}: duplicate/invalid alias {alias}')
            names.pop(key, None)
            aliases[key] = canonical
    return names


def familiarity_score(views, sitelinks, zipf):
    sources = []
    if views is not None:
        sources.append((.6, math.log1p(views / 5000)))
    if sitelinks is not None:
        sources.append((.4, math.log1p(sitelinks)))
    if not sources:
        return (0, zipf, 0)
    return (1, sum(weight * value for weight, value in sources) / sum(weight for weight, _ in sources), zipf)


def automatic_aliases(prompt, names, rows):
    """Wikidata aliases for kept canonicals. Reviewed aliases win; an automatic alias equal
    to any canonical or claimed by two canonicals is ambiguous and dropped for all of them."""
    canonical_keys = set(names)
    reviewed = {normalize(alias) for variants in prompt['aliases'].values() for alias in variants}
    claims, spelling = {}, {}
    for _, _, label, aliases in rows:
        canonical = names.get(normalize(label))
        if canonical is None:
            # A row skipped as a duplicate lends its label and aliases to that one canonical.
            matches = {names[k] for k in map(normalize, aliases) if k in names}
            if len(matches) != 1:
                continue
            canonical = matches.pop()
        for alias in [label] + aliases:
            key = normalize(alias)
            # Keys must be normalization fixed points so stored keys never collide on re-normalizing.
            if (not key or normalize(key) != key or key in STOPWORDS or key in canonical_keys or key in reviewed
                    or not valid_name(alias)):
                continue
            claims.setdefault(key, set()).add(canonical)
            spelling.setdefault((key, canonical), alias)
    result = {}
    for key, owners in sorted(claims.items()):
        if len(owners) == 1:
            owner = next(iter(owners))
            result.setdefault(owner, []).append(spelling[key, owner])
    return result


def generate(prompt, familiarity, sitelinks):
    names = prepare(prompt)
    rows = wikidata_rows(prompt)
    wd_links = {}
    for _, count, label, _ in rows:
        wd_links.setdefault(normalize(label), count)
    views = familiarity.get(prompt['id'], {})
    links = sitelinks.get(prompt['id'], {})
    def signal(name):
        count = links.get(name, {}).get('sitelinks')
        if count is None:
            count = wd_links.get(normalize(name))
        return familiarity_score(views.get(name, {}).get('views'), count, zipf_frequency(name, 'en'))
    ranked = sorted(names.values(), key=lambda name: (*(-x for x in signal(name)), normalize(name)))
    anchors = {normalize(x) for x in prompt['surface']}
    clever = {normalize(x) for x in prompt['too_clever']}
    gem = normalize(prompt['gem'])
    if anchors & clever or gem in anchors | clever:
        raise ValueError(f'{prompt["id"]}: conflicting tiers')
    # Cap very large sets to their highest-ranked rows plus every reviewed pick (bundle size).
    forced = anchors | clever | {gem} | {normalize(x) for x in prompt['aliases']}
    cap = len(ranked) if prompt.get('constrained') else min(prompt.get('cap', MAX_SET), MAX_SET)
    if len(ranked) > cap:
        room = cap - sum(normalize(name) in forced for name in ranked)
        kept = []
        for name in ranked:
            if normalize(name) in forced or room > 0:
                room -= normalize(name) not in forced
                kept.append(name)
        ranked = kept
        names = {normalize(name): name for name in ranked}
    auto = automatic_aliases(prompt, names, rows)
    free = [normalize(n) for n in ranked if normalize(n) not in anchors | clever | {gem}]
    output, tiers = [], dict.fromkeys(CODE, 0)
    for rank, name in enumerate(ranked):
        percentile = rank / len(ranked)
        tier = 'surface' if percentile < .20 else 'school' if percentile < .55 else 'rare' if percentile < .80 else 'deep'
        key = normalize(name)
        if prompt.get('constrained') and key in free:
            percentile = free.index(key) / len(free)
            tier = 'school' if percentile < .45 else 'rare' if percentile < .75 else 'deep'
        if key in anchors:
            tier = 'surface'
        if key in clever:
            tier = 'tooclever'
        if key == gem:
            tier = 'gem'
        tier = prompt.get('forced_tiers', {}).get(name, tier)
        tiers[tier] += 1
        variants = [alias for alias in prompt['aliases'].get(name, []) + auto.get(name, []) if normalize(alias) != key]
        output.append('|'.join([display_name(name, prompt), CODE[tier], ';'.join(variants)]))
    if tiers['gem'] != 1 or not all(tiers[t] for t in ['surface', 'school', 'rare', 'deep']):
        raise ValueError(f'{prompt["id"]}: invalid tier counts {tiers}')
    if prompt.get('constrained') and len(output) != len(prompt['rows']):
        raise ValueError(f'{prompt["id"]}: complete constrained set lost members during normalization or encoding')
    return '\n'.join(output), dict(id=prompt['id'], text=prompt['text'], active=prompt['active'], size=len(output), tiers=tiers,
                                surface=[r.split('|')[0] for r in output if r.split('|')[1] == 's'][:8],
                                pageviews=sum(bool(views.get(name, {}).get('views')) for name in names.values()),
                                sitelinks=sum(name in links or normalize(name) in wd_links for name in names.values()),
                                wikidata=sum(normalize(name) in wd_links and name not in links for name in names.values()),
                                aliases=sum(len(r.split('|')[2].split(';')) for r in output if r.split('|')[2]),
                                too_clever=[display_name(name, prompt) for name in prompt['too_clever']], gem=display_name(prompt['gem'], prompt))


def encode_set(encoded):
    keys, gems, familiar, cuts = {}, [], [], []
    answers = ''
    def base36(value):
        digits = '0123456789abcdefghijklmnopqrstuvwxyz'
        return base36(value // 36) + digits[value % 36] if value >= 36 else digits[value]
    tiers = {code: tier for tier, code in CODE.items()}
    lines = encoded.splitlines()
    for line in lines:
        name, code, aliases = line.split('|')
        reference = base36(len(answers.encode('utf-16-le')) // 2)
        answers += f'{code}\t{name}\n'
        notable = dict(answer=name, tier=tiers[code], points=POINTS[code])
        if code == 'g': gems.append(notable)
        if code == 's': familiar.append(notable)
        if code == 'd': cuts.append(notable)
        for value in [name] + (aliases.split(';') if aliases else []):
            key = normalize(value)
            if not key or key in keys:
                raise ValueError(f'Duplicate encoded key {key}')
            keys[key] = f'{key}\t{reference}\n'
    if len(gems) != 1:
        raise ValueError('Exactly one Pearl required')
    buckets = {}
    for key in sorted(keys):
        buckets[len(key)] = buckets.get(len(key), '\n') + keys[key]
    return dict(buckets=buckets, answers=answers,
                gem=gems[0], notable=familiar[:3] + cuts[:2], size=len(lines))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='fail if regeneration differs from committed output')
    parser.add_argument('--verify-sources', action='store_true', help='re-extract pinned sources and compare with reviewed snapshots')
    parser.add_argument('--fetch-pageviews', action='store_true', help='fetch missing contextual Wikipedia signals for the 2025 snapshot')
    parser.add_argument('--fetch-only', action='store_true', help='only update the pageview checkpoint; never rewrite generated Worker data')
    args = parser.parse_args()
    if args.fetch_only and not args.fetch_pageviews:
        parser.error('--fetch-only requires --fetch-pageviews')
    constrained = read_specs(args.verify_sources)
    retired = {'movies', 'directors', 'pokemon', 'manga', 'anime', 'japanese-films',
               'oscar-actors', 'monarchs', 'nobel-laureates', 'first-names', 'objects'}
    prompts = [dict(p) for p in PROMPTS]
    for prompt in prompts:
        tag(prompt)
        prompt['constrained'] = False
        if prompt['id'] in retired:
            prompt['active'] = False
    prompts += constrained
    active = [p for p in prompts if p['active']]
    if len(active) < MIN_ACTIVE or len({p['id'] for p in prompts}) != len(prompts):
        raise ValueError(f'Need at least {MIN_ACTIVE} active prompts and unique prompt ids')
    if len({normalize(p['text']) for p in prompts}) != len(prompts):
        raise ValueError('Duplicate prompt text')
    OUTPUT.mkdir(exist_ok=True)
    (OUTPUT / 'data').mkdir(exist_ok=True)
    files, report = {}, []
    if args.fetch_pageviews:
        pageviews.refresh(PROMPTS, {p['id']: list(prepare(p).values()) for p in PROMPTS}, normalize, zipf_frequency)
        if args.fetch_only:
            return
    if not pageviews.OUTPUT.exists():
        raise ValueError('Missing familiarity.json; regenerate with --fetch-pageviews')
    familiarity = json.loads(pageviews.OUTPUT.read_text())
    links = json.loads((Path(__file__).parent / 'sitelinks.json').read_text())['prompts']
    # Reuse contextual entity signals from broad prompts in the same theme when available.
    pooled_views, pooled_links = {}, {}
    for prompt in prompts:
        if prompt['constrained']:
            continue
        for source, pool, field in [(familiarity, pooled_views, 'views'), (links, pooled_links, 'sitelinks')]:
            bucket = pool.setdefault(prompt['theme'], {})
            for name, value in source.get(prompt['id'], {}).items():
                if value.get(field) is not None and value[field] > (bucket.get(name, {}).get(field) or -1):
                    bucket[name] = value
    for prompt in constrained:
        familiarity[prompt['id']] = pooled_views.get(prompt['theme'], {})
        links[prompt['id']] = pooled_links.get(prompt['theme'], {})
    for prompt in prompts:
        encoded, stats = generate(prompt, familiarity, links)
        stats.update(theme=prompt['theme'], cluster=prompt.get('cluster'), constrained=prompt['constrained'])
        if prompt['active'] and not prompt['constrained'] and stats['size'] < MIN_ACTIVE_SIZE:
            raise ValueError(f'{prompt["id"]}: active prompts need at least {MIN_ACTIVE_SIZE} answers, got {stats["size"]}; mark it inactive')
        report.append(stats)
        files[OUTPUT / 'data' / f'{prompt["id"]}.ts'] = '// Generated by scripts/dive/generate.py. Do not edit.\nimport type { AnswerSet } from \'../matcher\';\nexport default ' + json.dumps(encode_set(encoded), ensure_ascii=False) + ' satisfies AnswerSet;\n'
    def catalog(rows):
        sizes = {p['id']: p['size'] for p in report}
        return ''.join(json.dumps(dict(id=p['id'], text=p['text'], theme=p['theme'], cluster=p.get('cluster'),
                                       constrained=p['constrained'], size=sizes[p['id']])) + ',\n' for p in rows)
    by_id = {p['id']: p for p in prompts}
    legacy_ids = json.loads((Path(__file__).parent / 'legacy.json').read_text())
    legacy = [by_id[id] for id in legacy_ids]
    scheduled, status = schedule.build([r for r in report if r['active']])
    if not scheduled:
        raise ValueError('Enabled Dive cutover requires a valid schedule: ' + status)
    runtime_ids = set(legacy_ids) | {id for day in scheduled for id in day}
    files = {path: content for path, content in files.items()
             if path.parent != OUTPUT / 'data' or path.stem in runtime_ids}
    files[OUTPUT / 'prompts.ts'] = ('// Generated by scripts/dive/generate.py. Do not edit.\n'
        'export interface DivePrompt { id: string; text: string; theme: string; cluster: string | null; constrained: boolean; size: number; }\n'
        '/** Scheduled bank; dates before the cutover use the frozen legacy order. */\n'
        'export const DIVE_PROMPTS: readonly DivePrompt[] = [\n' + catalog(active) + '];\n'
        '/** Retired candidate metadata; only legacy or scheduled IDs have runtime data. */\n'
        'export const DIVE_INACTIVE_PROMPTS: readonly DivePrompt[] = [\n' + catalog([p for p in prompts if not p['active']]) + '];\n'
        'const byId = new Map([...DIVE_PROMPTS, ...DIVE_INACTIVE_PROMPTS].map(p => [p.id, p]));\n'
        'export const DIVE_LEGACY_PROMPTS = ' + json.dumps(legacy_ids) + '.map(id => { const prompt = byId.get(id); if (!prompt) throw new Error(`Missing legacy Dive prompt: ${id}`); return prompt; });\n')
    files[OUTPUT / 'schedule.ts'] = ('// Generated by scripts/dive/generate.py. Do not edit.\n'
        '/** Earlier team-local dates retain the frozen legacy permutation. */\n'
        f"export const DIVE_SCHEDULE_CUTOVER: string | null = '{DIVE_SCHEDULE_CUTOVER}';\n"
        'export const DIVE_SCHEDULE_STATUS = ' + json.dumps(status) + ';\n'
        'export const DIVE_SCHEDULE: readonly (readonly string[])[] = ' + json.dumps(scheduled) + ';\n')
    files[OUTPUT / 'loaders.ts'] = '// Generated by scripts/dive/generate.py. Do not edit.\nimport type { AnswerSet } from \'./matcher\';\nexport const loaders: Record<string, () => Promise<{ default: AnswerSet }>> = {\n' + ''.join(
        '  ' + repr(p['id']) + ': () => import(\'./data/' + p['id'] + "'),\n" for p in prompts if p['id'] in runtime_ids) + '};\n'
    files[ROOT / 'scripts/dive/report.json'] = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    for path in (OUTPUT / 'data').glob('*.ts'):
        if path not in files:
            if args.check or not path.read_text().startswith('// Generated by scripts/dive/generate.py.'):
                raise ValueError(f'Unexpected data module: {path}')
            path.unlink()
    formatted = subprocess.run(
        ['node', '--input-type=module', '-e',
         "import prettier from 'prettier'; let input=''; for await (const c of process.stdin) input+=c; "
         "const files=JSON.parse(input); const output={}; for (const [filepath,source] of Object.entries(files)) "
         "output[filepath]=await prettier.format(source,{...await prettier.resolveConfig(filepath),filepath}); "
         "process.stdout.write(JSON.stringify(output));"],
        input=json.dumps({str(path): content for path, content in files.items()}), text=True,
        capture_output=True, cwd=ROOT, check=True,
    )
    files = {Path(path): content for path, content in json.loads(formatted.stdout).items()}
    changed = []
    for path, content in files.items():
        if args.check:
            if not path.exists() or path.read_text() != content:
                changed.append(str(path.relative_to(ROOT)))
        else:
            path.write_text(content)
    if changed:
        raise SystemExit('Generated output differs: ' + ', '.join(changed))
    sizes = sorted(p['size'] for p in report if p['active'])
    print(f'Schedule enabled from {DIVE_SCHEDULE_CUTOVER}; ' + status + f'; earlier legacy {len(legacy)} prompts / {len(legacy) // 5} days unchanged.')
    print(f'{len(runtime_ids)} runtime data modules; {len(prompts) - len(runtime_ids)} unreachable candidate sets omitted.')
    print(f'{len(sizes)} active + {len(report) - len(sizes)} inactive prompts; '
          f'{sum(p["size"] for p in report):,} canonical answers, {sum(p["aliases"] for p in report):,} aliases; '
          f'active sizes min {sizes[0]}, median {sizes[len(sizes) // 2]}, max {sizes[-1]}; '
          f'{sum(s >= 500 for s in sizes)} active sets >=500.')


if __name__ == '__main__':
    main()
