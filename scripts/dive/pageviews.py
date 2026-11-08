"""Resolve contextual English Wikipedia entities and cache 2025 human pageviews."""

from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

CACHE = Path(__file__).parent / '.cache' / 'wikipedia'
OUTPUT = Path(__file__).parent / 'familiarity.json'
AGENT = 'StanfordOYO-DiveBuilder/1.0 (josdreamr@gmail.com)'
HEADERS = {'User-Agent': AGENT, 'Api-User-Agent': AGENT, 'Accept': 'application/json'}
LOCK = threading.Lock()
NEXT_REQUEST = 0
RESOLVER_VERSION = 2


def request(url, attempts=3):
    global NEXT_REQUEST
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.json')
    if path.exists():
        return json.loads(path.read_text())
    with LOCK:
        delay = max(0, NEXT_REQUEST - time.monotonic())
        NEXT_REQUEST = max(NEXT_REQUEST, time.monotonic()) + .25
    if delay:
        time.sleep(delay)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        if error.code in (429, 503) and attempts > 1:
            time.sleep(max(1, int(error.headers.get('Retry-After', '30'))))
            return request(url, attempts - 1)
        if error.code != 404:
            raise
        result = {'missing': True}
    temporary = path.with_suffix(f'.{threading.get_ident()}.part')
    temporary.write_text(json.dumps(result, ensure_ascii=False))
    temporary.replace(path)
    return result


def article(prompt, name, normalize):
    override = prompt.get('wiki', {}).get(name)
    if override is not None:
        return override
    context = prompt.get('wiki_context', prompt['text'].removeprefix('Name ').rstrip('.'))
    query = urllib.parse.urlencode(dict(action='query', list='search',
        srsearch=f'intitle:"{name}" {context}', srlimit=3, format='json'))
    results = request('https://en.wikipedia.org/w/api.php?' + query).get('query', {}).get('search', [])
    for result in results:
        title = result['title']
        base = title.split(' (')[0].split(',')[0]
        suffixes = [' language', ' cat', ' dog', ' rabbit', ' horse', ' sheep', ' apple',
                    ' cheese', ' beer', ' tea', ' tube station', ' railway station', ' station']
        keys = [base] + [base.removesuffix(suffix) for suffix in suffixes]
        if normalize(name) in [normalize(key) for key in keys] and not title.startswith('List of '):
            return title
    return None


def measure(prompt, name, normalize):
    title = article(prompt, name, normalize)
    if not title:
        return dict(title=None, views=None, resolver_version=RESOLVER_VERSION)
    url = ('https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/'
           'en.wikipedia.org/all-access/user/' + urllib.parse.quote(title.replace(' ', '_'), safe='') +
           '/monthly/2025010100/2025123100')
    data = request(url)
    return dict(title=title, views=sum(row['views'] for row in data['items']) if 'items' in data else None, resolver_version=RESOLVER_VERSION)


def candidates(prompt, names, normalize, zipf_frequency):
    ranked = sorted(names, key=lambda name: (-zipf_frequency(name, 'en'), normalize(name)))
    pool = set(ranked[:max(100, int(len(names) * .4))])
    pool.update(prompt['surface'] + prompt['too_clever'] + [prompt['gem']])
    pool.update(prompt.get('wiki', {}))
    return sorted(pool.intersection(names))


def save(records):
    temporary = OUTPUT.with_suffix('.checkpoint')
    temporary.write_text(json.dumps(records, ensure_ascii=False, sort_keys=True, indent=2) + '\n')
    temporary.replace(OUTPUT)


def refresh(prompts, prepared, normalize, zipf_frequency):
    CACHE.mkdir(parents=True, exist_ok=True)
    records = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    work = []
    for prompt in prompts:
        names = prepared[prompt['id']]
        # Twice the prospective Surface population, plus all reviewed anchors/picks.
        # Long-tail candidates use the conservative secondary signal, not unbounded fetches.
        pool = candidates(prompt, names, normalize, zipf_frequency)
        current = records.setdefault(prompt['id'], {})
        for name in sorted(pool):
            if name in current and not current[name]['title'] and current[name].get('resolver_version') != RESOLVER_VERSION:
                del current[name]
            if name in current and name in prompt.get('wiki', {}) and current[name]['title'] != prompt['wiki'][name]:
                del current[name]
            if name in names and name not in current:
                work.append((prompt, name))
    print(f'Wikipedia familiarity: {len(work)} contextual entities to resolve; 8 workers, <=4 HTTP requests/s.', flush=True)
    started = time.monotonic()
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(measure, prompt, name, normalize): (prompt['id'], name) for prompt, name in work}
        for count, future in enumerate(as_completed(futures), 1):
            id, name = futures[future]
            try:
                records[id][name] = future.result()
            except Exception as error:
                print(f'Wikipedia request failed for {id}/{name}: {error!r}', flush=True)
                save(records)
                for pending in futures:
                    pending.cancel()
                raise
            if count % 100 == 0:
                save(records)
                rate = count / max(.001, time.monotonic() - started)
                print(f'Wikipedia familiarity: {count}/{len(work)}; {rate:.2f} entities/s; ETA {(len(work) - count) / rate / 60:.1f} min', flush=True)
    save(records)
    return records
