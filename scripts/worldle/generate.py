#!/usr/bin/env python3
"""Public-domain Natural Earth silhouettes; stdlib only. See README.md."""
import argparse
import datetime as dt
import hashlib
import html
import json
import math
from pathlib import Path
import random
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
R = 6371
START = dt.date(2026, 11, 16)
# Google references the full sovereign extent or a different island group.
EXCEPTIONS = {
    'USA': 'Only the contiguous 48 are depicted; Google includes Alaska/Hawaii.',
    'KIR': 'Only the Gilbert Islands are depicted; Google references the full Pacific span.',
    'FRA': 'Metropolitan France only; Google includes overseas France.',
    'NOR': 'Mainland Norway only; Google includes Svalbard.',
    'SDS': 'Google table predates South Sudan independence and has no separate reference row.',
    'MYS': 'Google places its reference in peninsular Malaysia; the silhouette and centroid include Malaysian Borneo.',
}


def normalize(value):
    value = ''.join(c for c in unicodedata.normalize('NFKD', value) if not unicodedata.category(c).startswith('M')).lower()
    value = value.replace('&', 'and')
    value = re.sub(r'\bst\b\.?', 'saint ', value)
    value = re.sub(r"[.,'’\-()]", ' ', value)
    return re.sub(r'^the ', '', ' '.join(value.split()))


def distance(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 2*R*math.asin(min(1, math.sqrt(h)))


def project(point, center):
    lon, lat = map(math.radians, point[:2])
    lat0, lon0 = map(math.radians, center)
    d = (lon-lon0+math.pi) % (2*math.pi)-math.pi
    k = math.sqrt(2/max(1e-12, 1+math.sin(lat0)*math.sin(lat)+math.cos(lat0)*math.cos(lat)*math.cos(d)))
    return (R*k*math.cos(lat)*math.sin(d), R*k*(math.cos(lat0)*math.sin(lat)-math.sin(lat0)*math.cos(lat)*math.cos(d)))


def inverse(point, center):
    x, y = point
    lat0, lon0 = map(math.radians, center)
    rho = math.hypot(x, y)
    if rho < 1e-10:
        return center
    c = 2*math.asin(min(1, rho/(2*R)))
    lat = math.asin(math.cos(c)*math.sin(lat0)+y*math.sin(c)*math.cos(lat0)/rho)
    lon = lon0+math.atan2(x*math.sin(c), rho*math.cos(lat0)*math.cos(c)-y*math.sin(lat0)*math.sin(c))
    return math.degrees(lat), (math.degrees(lon)+180) % 360-180


def area_center(ring):
    crosses = [a[0]*b[1]-b[0]*a[1] for a, b in zip(ring, ring[1:]+ring[:1])]
    cross = sum(crosses)
    if abs(cross) < 1e-10:
        return 0, ring[0]
    return abs(cross)/2, tuple(sum((a[k]+b[k])*c for a, b, c in zip(ring, ring[1:]+ring[:1], crosses))/(3*cross) for k in (0, 1))


def polygons(feature):
    g = feature['geometry']
    return g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]


def local_area(poly):
    ring = poly[0]
    return area_center([project(p, (ring[0][1], ring[0][0])) for p in ring])[0]


def select(entry, features):
    parts = [p for code in entry['ne'] for p in polygons(features[code])]
    override = entry.get('parts', {})
    if 'bbox' in override:
        w, s, e, n = override['bbox']
        def inside(poly):
            ring = poly[0]
            lon = math.degrees(math.atan2(sum(math.sin(math.radians(q[0])) for q in ring), sum(math.cos(math.radians(q[0])) for q in ring)))
            lat = sum(q[1] for q in ring)/len(ring)
            longitude_inside = w <= lon <= e if w <= e else lon >= w or lon <= e
            return longitude_inside and s <= lat <= n
        parts = [p for p in parts if inside(p)]
    parts.sort(key=local_area, reverse=True)
    assert parts, entry['code']
    cutoff = max(0.005, local_area(parts[0])/100000)
    parts = [p for p in parts if local_area(p) >= cutoff]
    # Sparse boundary samples measure water gaps, not distances between island centres.
    samples = [[(p[1], p[0]) for p in poly[0][::max(1, len(poly[0])//40)]] for poly in parts]
    kept, pending, frontier = {0}, set(range(1, len(parts))), [0]
    gap = override.get('gapKm', 400)
    while frontier:
        i = frontier.pop()
        for j in list(pending):
            if any(distance(a, b) <= gap for a in samples[i] for b in samples[j]):
                pending.remove(j)
                kept.add(j)
                frontier.append(j)
    return [parts[i] for i in sorted(kept)]


def geometry(parts):
    ring = parts[0][0]
    # Circular longitude averaging prevents a dateline crossing from moving the origin to Greenwich.
    center = (sum(p[1] for p in ring)/len(ring), math.degrees(math.atan2(sum(math.sin(math.radians(p[0])) for p in ring), sum(math.cos(math.radians(p[0])) for p in ring))))
    for _ in range(2):
        weighted = []
        for poly in parts:
            for i, ring in enumerate(poly):
                area, c = area_center([project(p, center) for p in ring])
                weighted.append((area if i == 0 else -area, c))
        total = sum(a for a, _ in weighted)
        center = inverse(tuple(sum(a*c[k] for a, c in weighted)/total for k in (0, 1)), center)
    rings = [[project(p, center) for p in poly[0]] for poly in parts]
    xs, ys = [p[0] for r in rings for p in r], [p[1] for r in rings for p in r]
    return center, rings, (min(xs), min(ys), max(xs), max(ys))


def simplify(points, tolerance):
    if len(points) <= 2:
        return points
    a, b = points[0], points[-1]
    dx, dy = b[0]-a[0], b[1]-a[1]
    length = dx*dx+dy*dy
    best, index = -1, 0
    for i, p in enumerate(points[1:-1], 1):
        t = max(0, min(1, ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)) if length else 0
        d = (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2
        if d > best:
            best, index = d, i
    if best > tolerance*tolerance:
        return simplify(points[:index+1], tolerance)[:-1]+simplify(points[index:], tolerance)
    return [a, b]


def path(rings, tolerance, minimum_mark=0):
    paths = []
    current = (0, 0)

    def numbers(values):
        return ''.join((' ' if i and v >= 0 else '')+str(v) for i, v in enumerate(values))

    for ring in rings:
        pts = simplify(ring, tolerance)
        pts = list(dict.fromkeys((round(x), round(y)) for x, y in pts))
        extent = max(max(p[k] for p in pts)-min(p[k] for p in pts) for k in (0, 1))
        if minimum_mark and (len(pts) < 3 or extent < minimum_mark):
            center = [(min(p[k] for p in ring)+max(p[k] for p in ring))/2 for k in (0, 1)]
            start = tuple(round(c-minimum_mark/2) for c in center)
            commands = f'h{minimum_mark}v{minimum_mark}h-{minimum_mark}z'
        else:
            if len(pts) < 3:
                x, y = pts[0]
                pts = [(x-2, y-2), (x+2, y-2), (x+2, y+2), (x-2, y+2)]
            start = pts[0]
            commands = 'l'+numbers([v for a, b in zip(pts, pts[1:]) for v in (b[0]-a[0], b[1]-a[1])])+'z'
        move = min('M'+numbers(start), 'm'+numbers([start[k]-current[k] for k in (0, 1)]), key=len)
        paths.append(move+commands)
        current = start
    return ''.join(paths)


def silhouette(rings, bounds):
    x0, y0, x1, y1 = bounds
    scale = 920/max(x1-x0, y1-y0)
    w, h = round((x1-x0)*scale+80), round((y1-y0)*scale+80)
    normalized = [[((x-x0)*scale+40, (y1-y)*scale+40) for x, y in r] for r in rings]
    tolerance = 2
    while True:
        d = path(normalized, tolerance, minimum_mark=26)
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><path d="{d}" fill="#000" stroke="#000" stroke-width="7" stroke-linejoin="round"/></svg>\n'
        if len(svg) <= 6100:
            return svg
        tolerance *= 1.25
        assert tolerance < 30, 'Too many island parts'


def schedule(pool):
    rng = random.Random(20261116)
    n = len(pool)
    counts = {t: sum(p['tier'] == t for p in pool) for t in (1, 2, 3)}
    pattern = [1 if (i+1)*counts[1]//n > i*counts[1]//n else 2 for i in range(n)]
    available = [i for i in range(7, n) if pattern[i] == 2]
    for j, i in enumerate(available):
        if (j+1)*counts[3]//len(available) > j*counts[3]//len(available):
            pattern[i] = 3
    tiers = pattern*3
    full_weeks = len(tiers)//7

    def cost(week):
        if week >= full_weeks:
            return 0
        values = tiers[week*7:week*7+7]
        easy, hard = values.count(1), values.count(3)
        return max(0, easy-2)**2 + (max(0, 2-hard)**2 if week else 100*max(0, easy-2)) + 4*max(0, hard-2)**2

    # Anneal within cycles: preserve tier totals while attaining the arithmetic
    # lower bound on weekly violations (22 excess easy, 8 missing hard).
    score = sum(cost(w) for w in range(full_weeks))
    target = max(0, 3*counts[1]-2*full_weeks-1)+max(0, 2*(full_weeks-1)-3*counts[3])
    for attempt in range(300000):
        if score == target:
            break
        cycle = rng.randrange(3)
        a, b = [cycle*n+rng.randrange(n) for _ in range(2)]
        if tiers[a] == tiers[b] or (a < 7 and tiers[b] == 3) or (b < 7 and tiers[a] == 3):
            continue
        affected = {a//7, b//7}
        before = sum(cost(w) for w in affected)
        tiers[a], tiers[b] = tiers[b], tiers[a]
        delta = sum(cost(w) for w in affected)-before
        temperature = max(.02, 1-attempt/100000)
        if delta <= 0 or rng.random() < math.exp(-delta/temperature):
            score += delta
        else:
            tiers[a], tiers[b] = tiers[b], tiers[a]
    assert score == target, (score, target)
    groups = {t: [i for i, p in enumerate(pool) if p['tier'] == t] for t in (1, 2, 3)}
    for group in groups.values():
        rng.shuffle(group)
    cycles = []
    for cycle in range(3):
        ordered = {t: values.copy() for t, values in groups.items()}
        for values in ordered.values():
            for i in range(0, len(values)-1, 2):
                if rng.random() < .5:
                    values[i], values[i+1] = values[i+1], values[i]
        cursors = {t: 0 for t in groups}
        values = []
        for t in tiers[cycle*n:(cycle+1)*n]:
            values.append(ordered[t][cursors[t]])
            cursors[t] += 1
        cycles.append(values)
    result = sum(cycles, [])
    assert all(sorted(c) == list(range(n)) for c in cycles)
    gaps = []
    for i in range(n):
        positions = [j for j, v in enumerate(result) if v == i]
        gaps.extend(b-a for a, b in zip(positions, positions[1:]+[positions[0]+len(result)]))
    assert min(gaps) >= 150
    assert all(pool[i]['tier'] != 3 for i in result[:7])
    weeks = [result[i:i+7] for i in range(0, len(result)-6, 7)]
    assert max(sum(pool[i]['tier'] == 1 for i in week) for week in weeks) <= 3
    assert max(sum(pool[i]['tier'] == 3 for i in week) for week in weeks) <= 3
    assert all(sum(pool[i]['tier'] == 3 for i in week) >= 1 for week in weeks[1:])
    assert sum(pool[i]['tier'] == 1 for i in weeks[0]) <= 2
    return result, weeks, min(gaps)


def google_table(data):
    raw = (data/'google_countries.html').read_text()
    rows = re.findall(r'<tr[^>]*>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>', raw, re.S)
    result = {}
    for code, lat, lon, name in rows:
        clean = lambda s: html.unescape(re.sub('<[^>]+>', '', s)).strip()
        try:
            value = (float(clean(lat)), float(clean(lon)))
        except ValueError:
            continue
        result[clean(code)] = value
        result[normalize(clean(name))] = value
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    pool = json.loads((HERE/'countries.json').read_text())
    ids = json.loads((HERE/'shape-ids.json').read_text())
    assert set(ids) == {p['code'] for p in pool}
    assert len(set(ids.values())) == len(pool)
    assert all(re.fullmatch('[0-9a-f]{16}', v) for v in ids.values())
    names = {}
    for i, entry in enumerate(pool):
        for name in [entry['name'], *entry['aliases']]:
            key = normalize(name)
            assert key and (key not in names or names[key] == i), f'Ambiguous name: {name}'
            names[key] = i
    features = {f['properties']['ADM0_A3']: f for f in json.loads((args.data/'ne_10m_admin_0_countries.geojson').read_text())['features']}
    output = ROOT/'web/public/worldle'
    output.mkdir(parents=True, exist_ok=True)
    table = google_table(args.data) if args.verify else {}
    records, report, failures, sizes = [], [], [], []
    max_deviation, used_exceptions = 0, []
    for entry in pool:
        code = entry['code']
        center, rings, bounds = geometry(select(entry, features))
        svg = silhouette(rings, bounds)
        (output/f'{ids[code]}.svg').write_text(svg)
        sizes.append(len(svg.encode()))
        records.append([round(center[0], 2), round(center[1], 2), ids[code]])
        if args.verify:
            properties = features[entry['ne'][0]]['properties']
            iso = {'TWN':'TW','KOS':'XK','GUF':'GF','REU':'RE','MTQ':'MQ','GLP':'GP','CUW':'AN'}.get(code)
            keys = [iso, properties.get('ISO_A2'), properties.get('ISO_A2_EH'), normalize(entry['name'])]
            reference = next((table[k] for k in keys if k in table), None)
            if reference is None:
                reason = EXCEPTIONS.get(code)
                if reason:
                    used_exceptions.append(code)
                else:
                    failures.append(f'{code}: no Google match')
                report.append(f'| {entry["name"]} | MISSING | — | {reason or "NO MATCH"} |')
                continue
            deviation = distance(center, reference)
            extent = math.hypot(bounds[2]-bounds[0], bounds[3]-bounds[1])
            threshold = max(350, extent*.2)
            max_deviation = max(max_deviation, deviation)
            reason = EXCEPTIONS.get(code, '') if deviation > threshold else ''
            if reason:
                used_exceptions.append(code)
            elif deviation > threshold:
                failures.append(f'{code}: {deviation:.1f} km > {threshold:.1f} km')
            if code == 'CUW':
                reason = 'Google table predates Curaçao; matched predecessor Netherlands Antilles (AN), whose reference is on Curaçao.'
            report.append(f'| {entry["name"]} | {deviation:.1f} | {threshold:.1f} | {reason} |')
    world_rings = [poly[0] for f in json.loads((args.data/'ne_110m_land.geojson').read_text())['features'] for poly in polygons(f)]
    # Keep sub-degree detail without rounding the small world map to integer degrees.
    tolerance = 2
    while True:
        world_path = path([[(10*(p[0]+180), 10*(90-p[1])) for p in ring] for ring in world_rings], tolerance)
        world_path = re.sub(r'-?\d+', lambda m: f'{int(m[0])/10:g}', world_path)
        world = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 180"><path d="{world_path}" fill="#000"/></svg>\n'
        if len(world.encode()) <= 25000:
            break
        tolerance *= 1.2
    (output/'world.svg').write_text(world)
    packed, weeks, min_gap = schedule(pool)
    # One byte per index, serialized as base-36 pairs for an ASCII-only TS literal.
    alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
    packed = ''.join(alphabet[i//36]+alphabet[i%36] for i in packed)
    names_module = [{'name':p['name'], 'aliases':p['aliases']} for p in pool]
    (ROOT/'shared/games/worldleNames.ts').write_text('// Generated by scripts/worldle/generate.py; do not edit.\n// prettier-ignore\nexport const worldleNames = '+json.dumps(names_module, ensure_ascii=False, separators=(',', ':'))+' as const;\n')
    (ROOT/'worker/src/games/worldle/data.ts').write_text('// Generated by scripts/worldle/generate.py; do not edit.\nexport const WORLDLE_START = \'2026-11-16\';\n// prettier-ignore\nexport const worldleData: readonly (readonly [number, number, string])[] = '+json.dumps(records, separators=(',', ':'))+';\n// prettier-ignore\nexport const WORLDLE_SCHEDULE = \''+packed+'\';\n')
    if args.verify:
        (HERE/'verify-report.md').write_text('# Worldle centroid verification\n\nGoogle countries table vs. area-weighted kept-shape centroid. Distances and limits in km.\n\n<!-- prettier-ignore -->\n| Country | Deviation | Limit | Exception reason |\n| --- | ---: | ---: | --- |\n'+'\n'.join(report)+'\n')
    tier_counts = [[sum(pool[i]['tier'] == t for i in week) for t in (1, 2, 3)] for week in weeks]
    print(f'Pool: {len(pool)}; schedule: {len(packed)//2} days; minimum cyclic gap: {min_gap}')
    print(f'Full Mon–Sun weeks: tier-1 min/max {min(c[0] for c in tier_counts)}/{max(c[0] for c in tier_counts)}; tier-3 min/max {min(c[2] for c in tier_counts)}/{max(c[2] for c in tier_counts)}')
    print('Weekly targets are arithmetic limits, not absolute: 71 tier-1 and 60 tier-3 per 222 days cannot fit <=2 tier-1 and >=2 tier-3 every week.')
    print(f'Verification max deviation: {max_deviation:.1f} km; exceptions used: {", ".join(used_exceptions) or "none"}; failures: {len(failures)}')
    print(f'Shape bytes total/max: {sum(sizes)}/{max(sizes)}; world.svg bytes: {len(world.encode())}')
    print(f'Schedule SHA-256: {hashlib.sha256(packed.encode()).hexdigest()}')
    if failures:
        raise SystemExit('\n'.join(failures))


if __name__ == '__main__':
    main()
