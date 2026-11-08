"""Generate Worker-only curated Dive sets. Run with the pinned requirements in a venv.

Within EACH prompt, rank zipf_frequency(name, 'en') descending (lexical tiebreak).
Rank percentiles: first 20% surface, next 35% school, next 25% rare, last 20% deep.
Then apply Surface anchors, explicit Too Clever picks, and exactly one hand-picked Pearl.
No absolute Zipf thresholds and no automatically generated Too Clever or Pearl picks.
"""

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import unicodedata
import urllib.request

import geonamescache
import pycountry
from wordfreq import zipf_frequency

from overrides import PROMPTS

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).parent / '.cache'
OUTPUT = ROOT / 'worker/src/games/dive'
CORPORA = 'https://raw.githubusercontent.com/dariusk/corpora/1109305242d08d851a50f929792a0e7caa7a655b/data/'
MOVIES = 'https://raw.githubusercontent.com/vega/vega-datasets/v2.9.0/data/movies.json'
CONSTELLATIONS = 'https://raw.githubusercontent.com/astropy/astropy/v7.1.0/astropy/coordinates/data/constellation_names.dat'
CODE = {'surface': 's', 'tooclever': 't', 'school': 'm', 'rare': 'r', 'deep': 'd', 'gem': 'g'}


def normalize(value):
    value = ''.join(c for c in unicodedata.normalize('NFKD', value) if not unicodedata.category(c).startswith('M'))
    value = re.sub(r'[-_/]', ' ', value.lower().replace('&', 'and'))
    value = re.sub(r'[^a-z0-9 ]', '', value)
    value = re.sub(r' +', ' ', value).strip()
    value = re.sub(r'^(the|an|a) ', '', value)
    words = value.split(' ')
    last = words[-1]
    if len(last) > 3:
        if last.endswith('ies'):
            words[-1] = last[:-3] + 'y'
        elif re.search(r'(ses|xes|zes|ches|shes)$', last):
            words[-1] = last[:-2]
        elif last.endswith('s') and not re.search(r'(ss|us|is)$', last):
            words[-1] = last[:-1]
    return ' '.join(words)


def fetch(url):
    CACHE.mkdir(exist_ok=True)
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.raw')
    if not path.exists():
        request = urllib.request.Request(url, headers={'User-Agent': 'OYO-Dive-data-generation/2'})
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
        return [c['name'] for c in geonamescache.GeonamesCache().get_cities().values() if c['countrycode'] == country]
    if source == 'languages':
        return [language.name for language in pycountry.languages]
    if source == 'states':
        return [s.name for s in pycountry.subdivisions.get(country_code='US')]
    if source.startswith('movies:'):
        genre = source.split(':')[1]
        movies = json.loads(fetch(MOVIES))
        return [str(m['Title']) for m in movies if genre == 'all' or m['Major Genre'] == genre]
    if source == 'constellations':
        return [line[4:].strip() for line in fetch(CONSTELLATIONS).splitlines() if line and not line.startswith('#')]
    path, field = source.split('#')
    return extract(json.loads(fetch(CORPORA + path + '.json')), field.split('.'))


def generate(prompt):
    values = [v for source in prompt['source'].split('+') for v in source_values(source)]
    if 'allow' in prompt:
        allowed = {normalize(x) for x in prompt['allow']}
        values = [v for v in values if normalize(v) in allowed]
    forced = prompt['surface'] + prompt['too_clever'] + [prompt['gem']] + list(prompt['aliases'])
    # Keep curated spelling/capitalization when a source has an equivalent normalized key.
    names = {}
    excluded = {normalize(x) for x in prompt.get('exclude', [])}
    for name in values + forced:
        name = name.strip()
        key = normalize(name)
        if key and key not in excluded and len(name.encode('utf-16-le')) // 2 <= 40 and not re.search(r'[|;\n\r\t]', name):
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
    ranked = sorted(names.values(), key=lambda name: (-zipf_frequency(name, 'en'), normalize(name)))
    anchors = {normalize(x) for x in prompt['surface']}
    clever = {normalize(x) for x in prompt['too_clever']}
    gem = normalize(prompt['gem'])
    if anchors & clever or gem in anchors | clever:
        raise ValueError(f'{prompt["id"]}: conflicting tiers')
    rows, tiers = [], dict.fromkeys(CODE, 0)
    for rank, name in enumerate(ranked):
        percentile = rank / len(ranked)
        tier = 'surface' if percentile < .20 else 'school' if percentile < .55 else 'rare' if percentile < .80 else 'deep'
        key = normalize(name)
        if key in anchors:
            tier = 'surface'
        if key in clever:
            tier = 'tooclever'
        if key == gem:
            tier = 'gem'
        tiers[tier] += 1
        variants = [alias for alias in prompt['aliases'].get(name, []) if normalize(alias) != key]
        rows.append('|'.join([name, CODE[tier], ';'.join(variants)]))
    if tiers['gem'] != 1 or not all(tiers[t] for t in ['surface', 'school', 'rare', 'deep']):
        raise ValueError(f'{prompt["id"]}: invalid tier counts {tiers}')
    return '\n'.join(rows), dict(id=prompt['id'], text=prompt['text'], size=len(rows), tiers=tiers,
                                surface=[r.split('|')[0] for r in rows if r.split('|')[1] == 's'][:5],
                                too_clever=prompt['too_clever'], gem=prompt['gem'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='fail if regeneration differs from committed output')
    args = parser.parse_args()
    if len(PROMPTS) < 120 or len({p['id'] for p in PROMPTS}) != len(PROMPTS):
        raise ValueError('Need at least 120 unique prompt ids')
    if len({normalize(p['text']) for p in PROMPTS}) != len(PROMPTS):
        raise ValueError('Duplicate prompt text')
    OUTPUT.mkdir(exist_ok=True)
    (OUTPUT / 'data').mkdir(exist_ok=True)
    files, report = {}, []
    for prompt in PROMPTS:
        encoded, stats = generate(prompt)
        report.append(stats)
        files[OUTPUT / 'data' / f'{prompt["id"]}.ts'] = '// Generated by scripts/dive/generate.py. Do not edit.\nexport default ' + json.dumps(encoded, ensure_ascii=False) + ';\n'
    files[OUTPUT / 'prompts.ts'] = '// Generated by scripts/dive/generate.py. Do not edit.\nexport const DIVE_PROMPTS = [\n' + ''.join(
        '  { id: ' + repr(p['id']) + ', text: ' + json.dumps(p['text']) + ' },\n' for p in PROMPTS) + '] as const;\n'
    files[OUTPUT / 'loaders.ts'] = '// Generated by scripts/dive/generate.py. Do not edit.\nexport const loaders: Record<string, () => Promise<{ default: string }>> = {\n' + ''.join(
        '  ' + repr(p['id']) + ': () => import(\'./data/' + p['id'] + "'),\n" for p in PROMPTS) + '};\n'
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
    print(f'{len(report)} prompts; {sum(p["size"] for p in report):,} canonical answers; '
          f'{sum(p["size"] >= 100 for p in report)} sets >=100; '
          f'{sum(p["size"] >= 200 for p in report)} sets >=200; '
          f'range {min(p["size"] for p in report)}–{max(p["size"] for p in report)}.')
    print('Stopped at 120 curated prompts: further expansion needs reviewed, distinct sources, not artificial letter/category slices.')


if __name__ == '__main__':
    main()
