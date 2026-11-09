"""Pinned build-time sources; raw responses are never committed."""

import csv
import hashlib
import io
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request

from bs4 import BeautifulSoup

CACHE = Path(__file__).parent / '.cache' / 'constrained'
AGENT = 'StanfordOYO-DiveBuilder/2.0 (https://github.com/jkdreamr/stanfordrowingoyo)'


def fetch(url):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.raw')
    if not path.exists():
        request = urllib.request.Request(url, headers={'User-Agent': AGENT})
        with urllib.request.urlopen(request, timeout=90) as response:
            data = response.read()
        path.write_bytes(data)
    return path.read_text()


def expect_count(values, expect, label):
    if not expect[0] <= len(values) <= expect[1]:
        raise ValueError(f'{label}: expected {expect}, got {len(values)}')
    return values


def list_page(title, revision):
    if not isinstance(revision, int) or revision <= 0:
        raise ValueError('Wikipedia requires a pinned positive revision')
    query = urllib.parse.urlencode(dict(action='parse', oldid=revision, prop='text', format='json'))
    parsed = json.loads(fetch('https://en.wikipedia.org/w/api.php?' + query))['parse']
    if parsed['title'].replace('_', ' ') != title.replace('_', ' ') or parsed['revid'] != revision:
        raise ValueError('Wikipedia revision/title mismatch')
    soup = BeautifulSoup(parsed['text']['*'], 'html.parser')
    for node in soup.select('sup, .sortkey, .mw-editsection'):
        node.decompose()
    return soup


def dataset(url, sha256, format):
    if not re.fullmatch(r'[a-f0-9]{64}', sha256):
        raise ValueError('Dataset requires a SHA-256 pin')
    data = fetch(url)
    if format in {'ala-annual-2010s', 'json-title', 'html-title'}:
        data = (CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.raw')).read_bytes().decode()
    if hashlib.sha256(data.encode()).hexdigest() != sha256:
        raise ValueError('Dataset checksum mismatch')
    if format == 'csv':
        return list(csv.DictReader(io.StringIO(data)))
    if format == 'json':
        return json.loads(data)
    if format == 'json-title':
        record = json.loads(data)
        title = record.get('title') if isinstance(record, dict) else None
        if not isinstance(title, str) or not title.strip():
            raise ValueError('Book JSON requires a nonempty title')
        return [title]
    if format == 'html-title':
        title = BeautifulSoup(data, 'html.parser').title
        if title is None or not title.get_text(strip=True):
            raise ValueError('Book HTML requires a nonempty title')
        return [title.get_text(' ', strip=True)]
    if format == 'lines':
        return [line.strip() for line in data.splitlines() if line.strip()]
    if format == 'ala-annual-2010s':
        soup = BeautifulSoup(data, 'html.parser')
        years, titles = set(), set()
        for heading in soup.find_all(['h2', 'h3', 'h4']):
            match = re.search(r'\b201[0-9]\b', heading.get_text())
            if not match:
                continue
            year = int(match.group())
            if year in years:
                raise ValueError('Duplicate ALA annual list')
            years.add(year)
            listing = heading.find_next('ol')
            entries = listing.find_all('li', recursive=False) if listing else []
            expect_count(entries, [11, 11] if year == 2018 else [10, 10], f'ALA {year}')
            for entry in entries:
                title = entry.find(['em', 'i'])
                if title is None:
                    raise ValueError(f'ALA {year}: missing book title')
                name = re.sub(r'\s+', ' ', title.get_text(' ', strip=True)).strip(' ,')
                titles.add(re.sub(r' series$', '', name))
        if years != set(range(2010, 2020)):
            raise ValueError('Missing ALA annual list')
        return sorted(titles)
    raise ValueError(f'Unsupported dataset format: {format}')


def list_values(spec):
    soup = list_page(spec['page'], spec['revision'])
    if 'header_table' in spec:
        nodes = soup.select('table.wikitable')[spec['header_table']].select('tr')[0].select('th a')
        values = [node['title'] for node in nodes if node.get('title') != 'Chemical element']
    elif 'members' in spec:
        text = soup.get_text(' ', strip=True)
        if any(name.casefold() not in text.casefold() for name in spec['members']):
            raise ValueError(f'{spec["page"]}: reviewed member missing from pinned page')
        values = spec['members']
    else:
        values = sorted({node.get_text(' ', strip=True) for node in soup.select(spec['selector'])})
    return expect_count(values, spec['expect'], spec['page'])


def acquire(spec):
    if 'dataset' in spec:
        values = dataset(spec['dataset'], spec['sha256'], spec['format'])
    elif 'tables' in spec:
        values = table_values(spec)
    else:
        values = list_values(spec)
    return expect_count(values, spec['expect'], spec.get('page', spec.get('dataset')))


def table_rows(table):
    """Expand HTML row/column spans before indexing a list's semantic columns."""
    pending = {}
    for tr in table.select('tr'):
        row, column = [], 0
        cells = iter(tr.find_all(['th', 'td'], recursive=False))
        while True:
            if column in pending:
                cell, remaining = pending.pop(column)
                row.append(cell)
                if remaining > 1:
                    pending[column] = (cell, remaining - 1)
                column += 1
                continue
            cell = next(cells, None)
            if cell is None:
                break
            def span(attribute):
                match = re.match(r'\d+', str(cell.get(attribute, 1)))
                return max(1, int(match[0])) if match else 1

            for _ in range(span('colspan')):
                row.append(cell)
                if span('rowspan') > 1:
                    pending[column] = (cell, span('rowspan') - 1)
                column += 1
        yield tr, row


def table_values(spec):
    soup = list_page(spec['page'], spec['revision'])
    tables = soup.select('table.wikitable')
    result = []
    for index in spec['tables']:
        for tr, row in table_rows(tables[index]):
            if len(row) <= spec['column'] or not tr.find('td', recursive=False):
                continue
            cell = row[spec['column']]
            if spec.get('exclude_row') and re.search(spec['exclude_row'], ' '.join(c.get_text(' ', strip=True) for c in row), re.I):
                continue
            winner_style = 'faeb86' if spec.get('winner') is True else spec.get('winner')
            if winner_style and not any(winner_style.lower() in str(node.get('style', '')).lower() for node in [tr, cell]):
                continue
            if 'where' in spec:
                col, pattern = spec['where']
                if len(row) <= col or not re.search(pattern, row[col].get_text(' ', strip=True)):
                    continue
            if 'where_not' in spec:
                col, pattern = spec['where_not']
                if len(row) > col and re.search(pattern, row[col].get_text(' ', strip=True)):
                    continue
            if spec.get('text'):
                result.append(cell.get_text(' ', strip=True))
                continue
            nodes = [node for node in cell.select(spec.get('select', 'a[href^="/wiki/"]:not(.image)'))
                     if node.get_text(' ', strip=True)]
            if spec.get('first', True):
                nodes = nodes[:1]
            for node in nodes:
                text = node.get_text(' ', strip=True)
                if text:
                    result.append(text)
    values = sorted(set(result))
    return expect_count(values, spec['expect'], spec['page'])
