"""Deterministic future rotation. Never changes the frozen legacy rotation."""

from collections import Counter
import math
import random

PER_DAY = 5
MIN_DAYS = 64


def size_band(size):
    return 'tiny' if size <= 24 else 'medium' if size <= 120 else 'large'


def validate(schedule, prompts):
    by_id = {p['id']: p for p in prompts}
    if len(schedule) < MIN_DAYS:
        raise ValueError('Schedule needs at least 64 days')
    seen = set()
    for day in schedule:
        if len(day) != PER_DAY or any(id not in by_id or id in seen for id in day):
            raise ValueError('Every day needs five unique, loadable ids without cycle repeats')
        seen.update(day)
        rows = [by_id[id] for id in day]
        if len({p['theme'] for p in rows}) != PER_DAY:
            raise ValueError('Repeated daily theme')
        clusters = [p['cluster'] for p in rows if p.get('cluster')]
        if len(set(clusters)) != len(clusters):
            raise ValueError('Repeated daily cluster')
        if sum(p.get('constrained', False) for p in rows) < 3:
            raise ValueError('Every day needs at least three constrained prompts')
        bands = {size_band(p['size']) for p in rows}
        if bands in [{'tiny'}, {'large'}]:
            raise ValueError('Every day needs a difficulty mix')
    if not {p['id'] for p in prompts if p.get('constrained')} <= seen:
        raise ValueError('Schedule omitted constrained prompts')


def build(prompts):
    constrained = [p for p in prompts if p.get('constrained')]
    days = max(MIN_DAYS, math.ceil(len(constrained) / PER_DAY))
    if len(constrained) < days * 3:
        return [], f'not enough constrained prompts yet: {len(constrained)}/{days * 3}'
    if any(n > days for n in Counter(p['theme'] for p in constrained).values()):
        return [], 'constrained theme exceeds available days'
    if any(n > days for n in Counter(p['cluster'] for p in constrained if p.get('cluster')).values()):
        return [], 'constrained cluster exceeds available days'
    broad = [p for p in prompts if not p.get('constrained')]
    needed = days * PER_DAY - len(constrained)
    if len(broad) < needed:
        return [], 'not enough total prompts'
    for attempt in range(200):
        rng = random.Random(0x6f796f + attempt)
        remaining = list(constrained)
        rng.shuffle(remaining)
        theme_counts = Counter(p['theme'] for p in remaining)
        cluster_counts = Counter(p.get('cluster') for p in remaining if p.get('cluster'))
        remaining.sort(key=lambda p: (-theme_counts[p['theme']], -cluster_counts[p.get('cluster')]))
        result = [[] for _ in range(days)]

        def compatible(day, prompt):
            return len(day) < PER_DAY and all(
                other['theme'] != prompt['theme'] and
                (not prompt.get('cluster') or other.get('cluster') != prompt['cluster']) for other in day)

        failed = False
        for prompt in remaining:
            options = [i for i, day in enumerate(result) if compatible(day, prompt)]
            if not options:
                failed = True
                break
            least = min(len(result[i]) for i in options)
            i = rng.choice([i for i in options if len(result[i]) == least])
            result[i].append(prompt)
        if failed or any(len(day) < 3 for day in result):
            continue
        available = list(broad)
        for day in sorted(result, key=len, reverse=True):
            while len(day) < PER_DAY:
                candidates = [p for p in available if compatible(day, p) and
                              (len(day) < PER_DAY - 1 or
                               {size_band(r['size']) for r in [*day, p]} not in [{'tiny'}, {'large'}])]
                if not candidates:
                    failed = True
                    break
                # Earlier broad prompts are the reviewed preference order.
                picked = candidates[0]
                day.append(picked)
                available.remove(picked)
            if failed:
                break
        if failed:
            continue
        ids = [[p['id'] for p in day] for day in result]
        validate(ids, prompts)
        return ids, f'{days} days, {len(constrained)} constrained, {needed} broad'
    return [], 'unable to satisfy theme/cluster/difficulty constraints; review catalog balance'
