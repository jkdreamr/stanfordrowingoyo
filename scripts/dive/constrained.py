"""Reviewed complete sets. Kept separate from the deliberately broad legacy bank."""

import argparse
import json
from pathlib import Path
import re
import unicodedata

from sources import acquire, expect_count

HERE = Path(__file__).parent


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


def letters(value):
    value = unicodedata.normalize('NFKD', value).lower()
    return ''.join(c for c in value if 'a' <= c <= 'z')


PREDICATES = {
    'four-letter-countries': lambda n: len(letters(n)) == 4,
    'countries-no-a': lambda n: 'a' not in letters(n),
    'countries-with-z': lambda n: 'z' in letters(n),
    'countries-b': lambda n: letters(n).startswith('b'),
    'countries-s': lambda n: letters(n).startswith('s'),
    'countries-m': lambda n: letters(n).startswith('m'),
    'countries-ia': lambda n: letters(n).endswith('ia'),
    'countries-same-letter': lambda n: bool(letters(n)) and letters(n)[0] == letters(n)[-1],
    'countries-vowel': lambda n: letters(n).startswith(tuple('aeiou')),
    'states-two-words': lambda n: len(n.split()) == 2,
    'states-end-a': lambda n: n.lower().endswith('a'),
    'states-vowel': lambda n: n.lower().startswith(tuple('aeiou')),
    'states-m-n': lambda n: n.startswith(('M', 'N')),
}


def derive(rows, predicate):
    return [row for row in rows if any(predicate(n) for n in [row['name'], *row.get('names', [])])]


def read_specs(verify_sources=False):
    path = HERE / 'constrained.json'
    document = json.loads(path.read_text())
    for id, base in document['bases'].items():
        expect_count(base['answers'], base['expect'], id)
    sources = {}
    for container in [*document['bases'].values(), *document['prompts']]:
        for source in container['sources']:
            if not source.get('revision') or not source.get('expect'):
                raise ValueError('Missing pinned provenance or expected count')
            if 'dataset' not in source:
                expect_count(source['reviewed'], source['expect'], source['page'])
            sources[json.dumps(source, sort_keys=True)] = source
    if verify_sources:
        for source in sources.values():
            values = acquire(source)
            if 'reviewed' in source and values != source['reviewed']:
                raise ValueError(f'{source["page"]}: extraction differs from reviewed snapshot')
    specs = []
    for spec in document['prompts']:
        rows = spec.get('answers')
        if 'derive' in spec:
            rows = derive(document['bases'][spec['derive']]['answers'], PREDICATES[spec['id']])
        expect_count(rows, spec['expect'], spec['id'])
        if len({r['name'] for r in rows}) != len(rows) or len(rows) < 8:
            raise ValueError(f'{spec["id"]}: need >=8 unique canonical answers')
        if not spec['sources'] or any(not s.get('revision') or not s.get('expect') for s in spec['sources']):
            raise ValueError(f'{spec["id"]}: missing pinned provenance')
        names = {r['name'] for r in rows}
        if not set([*spec['surface'], *spec.get('too_clever', []), spec['pearl']]).issubset(names):
            raise ValueError(f'{spec["id"]}: picks must already be members')
        prompt = dict(id=spec['id'], text='Name ' + spec['text'] + '.', source='constrained:' + spec['id'],
                      constrained=True, theme=spec['theme'], cluster=spec.get('cluster'), active=spec.get('active', True),
                      surface=spec['surface'], gem=spec['pearl'], too_clever=spec.get('too_clever', []),
                      aliases={r['name']: r.get('aliases', []) for r in rows if r.get('aliases')},
                      wiki={}, common=False, cap=len(rows), rows=rows, expect=spec['expect'])
        if spec.get('people'):
            claims = {}
            for row in rows:
                surname = {'Bong Joon-ho': 'Bong', 'Gao Xingjian': 'Gao', 'Han Kang': 'Han', 'Mo Yan': 'Mo'}.get(row['name'])
                surname = surname or re.sub(r'\s+(Jr\.?|Sr\.?|I{1,3})$', '', row['name']).split()[-1]
                if letters(surname):
                    claims.setdefault(normalize(surname), []).append(row['name'])
            for surname, owners in claims.items():
                if len(owners) == 1 and surname not in {normalize(n) for n in names}:
                    aliases = prompt['aliases'].setdefault(owners[0], [])
                    if surname not in [normalize(a) for a in aliases]:
                        aliases.append(surname)
        specs.append(prompt)
    return specs


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-sources', action='store_true')
    args = parser.parse_args()
    prompts = read_specs(args.verify_sources)
    print(f'{len(prompts)} constrained prompts validated' + (' against pinned sources' if args.verify_sources else ''))
