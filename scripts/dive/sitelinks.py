"""Batch English article -> QID resolution, then 300-QID Wikidata sitelink queries."""

from concurrent.futures import ThreadPoolExecutor
import argparse
import json
from pathlib import Path
import urllib.parse

import pageviews

OUTPUT = Path(__file__).parent / 'sitelinks.json'
MOVIE_TYPES = {'Q11424', 'Q24862', 'Q24869', 'Q202866', 'Q229390', 'Q226730'}


def chunks(values, size):
    return [values[i:i + size] for i in range(0, len(values), size)]


def resolve(titles):
    query = urllib.parse.urlencode(dict(action='query', prop='pageprops', ppprop='wikibase_item',
        titles='|'.join(titles), redirects=1, format='json', formatversion=2))
    data = pageviews.request('https://en.wikipedia.org/w/api.php?' + query).get('query', {})
    aliases = {row['from']: row['to'] for key in ['normalized', 'redirects'] for row in data.get(key, [])}
    pages = {row['title']: row.get('pageprops', {}).get('wikibase_item') for row in data.get('pages', [])}
    result = {}
    for title in titles:
        canonical, seen = title, set()
        while canonical in aliases and canonical not in seen:
            seen.add(canonical)
            canonical = aliases[canonical]
        qid = pages.get(canonical)
        if qid:
            result[title] = dict(qid=qid, title=canonical)
    return result


def query_counts(qids):
    query = ('SELECT ?item ?n ?country ?kind WHERE { VALUES ?item { ' +
             ' '.join('wd:' + qid for qid in qids) +
             ' } ?item wikibase:sitelinks ?n . OPTIONAL { ?item wdt:P17 ?country } '
             'OPTIONAL { ?item wdt:P31 ?kind } }')
    url = 'https://query.wikidata.org/sparql?' + urllib.parse.urlencode(dict(query=query, format='json'))
    result = {}
    for binding in pageviews.request(url)['results']['bindings']:
        qid = binding['item']['value'].rsplit('/', 1)[-1]
        row = result.setdefault(qid, dict(sitelinks=int(binding['n']['value']), countries=set(), kinds=set()))
        for key, field in [('country', 'countries'), ('kind', 'kinds')]:
            if key in binding:
                row[field].add(binding[key]['value'].rsplit('/', 1)[-1])
    return result


def titles_for(prompt, name, views):
    explicit = prompt.get('wiki', {}).get(name) or views.get(name, {}).get('title')
    if explicit:
        return [explicit]
    id = prompt['id']
    if 'movies' in id:
        return [name + ' (film)', name]
    suffixes = {'cats': 'cat', 'dogs': 'dog', 'horses': 'horse', 'rabbits': 'rabbit',
                'languages': 'language', 'fruits': '(fruit)', 'apples': '(apple)',
                'companies': '(company)', 'tube': 'tube station'}
    if id in suffixes:
        return [name + ' ' + suffixes[id], name]
    return [name]


def refresh(only=None):
    from generate import normalize, prepare
    from overrides import PROMPTS, CITY_PICKS
    from wordfreq import zipf_frequency

    prompts = [prompt for prompt in PROMPTS if only is None or prompt['id'] in only]
    if only is not None and {prompt['id'] for prompt in prompts} != set(only):
        raise ValueError('Unknown prompt ID')

    pageviews.CACHE.mkdir(parents=True, exist_ok=True)
    views = json.loads(pageviews.OUTPUT.read_text())
    selections, titles = {}, set()
    for prompt in prompts:
        choices = {}
        names = list(prepare(prompt).values())
        for name in pageviews.candidates(prompt, names, normalize, zipf_frequency):
            options = titles_for(prompt, name, views.get(prompt['id'], {}))
            choices[name] = options
            titles.update(options)
        selections[prompt['id']] = choices
    countries = {f'cities-{code.lower()}': country.removeprefix('the ') for code, country, *_ in CITY_PICKS if only is None or f'cities-{code.lower()}' in only}
    titles.update(countries.values())
    batches = chunks(sorted(titles), 50)
    print(f'Wikidata: resolving {len(titles)} article titles in {len(batches)} batches of <=50.', flush=True)
    resolved = {}
    with ThreadPoolExecutor(max_workers=4) as executor:
        for i, result in enumerate(executor.map(resolve, batches), 1):
            resolved.update(result)
            if i % 25 == 0:
                print(f'QID resolution: {i}/{len(batches)} batches', flush=True)
    qids = sorted({row['qid'] for row in resolved.values()})
    batches = chunks(qids, 300)
    counts = {}
    print(f'Wikidata: {len(qids)} unique QIDs; {len(batches)} SPARQL batches of <=300.', flush=True)
    for i, batch in enumerate(batches, 1):
        counts.update(query_counts(batch))
        print(f'Sitelinks: {i}/{len(batches)} batches', flush=True)
    output = {}
    for prompt in prompts:
        id = prompt['id']
        output[id] = {}
        country = resolved.get(countries.get(id), {}).get('qid')
        for name, options in selections[id].items():
            for title in options:
                identity = resolved.get(title)
                row = counts.get(identity['qid']) if identity else None
                if not row or 'Q4167410' in row['kinds']:
                    continue
                if id.startswith('cities-') and (not country or country not in row['countries']):
                    continue
                explicit = prompt.get('wiki', {}).get(name) or views.get(id, {}).get(name, {}).get('title')
                if 'movies' in id and not explicit and not row['kinds'].intersection(MOVIE_TYPES):
                    continue
                output[id][name] = dict(**identity, sitelinks=row['sitelinks'])
                break
    previous = json.loads(OUTPUT.read_text()) if only is not None and OUTPUT.exists() else {}
    snapshot = dict(source='Wikidata wikibase:sitelinks (Wikimedia-site breadth, predominantly Wikipedia editions)',
                    qids=len(qids), query_batches=len(batches), prompts={**previous.get('prompts', {}), **output})
    if only is not None:
        snapshot['initial_full_fetch'] = previous.get('initial_full_fetch', {'qids': previous.get('qids', 0), 'query_batches': previous.get('query_batches', 0)})
    OUTPUT.write_text(json.dumps(snapshot, ensure_ascii=False, sort_keys=True, indent=2) + '\n')
    print(f'Sitelinks ready: {sum(len(rows) for rows in output.values())} contextual names across {len(output)} prompts.', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prompts', nargs='+', help='refresh only these prompts, preserving other snapshot entries')
    refresh(parser.parse_args().prompts)
