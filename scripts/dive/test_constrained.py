import hashlib
import json
import math
from collections import Counter
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import patch

from bs4 import BeautifulSoup

import constrained
import schedule
import sources


class SourcesTest(unittest.TestCase):
    def test_malformed_spans_and_inherited_row_exclusions(self):
        soup = BeautifulSoup('<table class="wikitable"><tr><th>Year</th><th>Name</th></tr>'
                             '<tr><td rowspan="2,">2026</td><td><a href="/wiki/A">Alpha</a></td></tr>'
                             '<tr><td><a href="/wiki/B">Beta</a></td></tr>'
                             '<tr><td colspan="bad"><a href="/wiki/C">Gamma</a></td></tr></table>', 'html.parser')
        spec = dict(page='Fixture', revision=123, tables=[0], column=1, expect=[2, 2])
        with patch.object(sources, 'list_page', return_value=soup):
            self.assertEqual(sources.table_values(spec), ['Alpha', 'Beta'])
            self.assertEqual(sources.table_values({**spec, 'exclude_row': '2026', 'expect': [0, 0]}), [])
            self.assertEqual(sources.table_values({**spec, 'where_not': [1, 'Alpha'], 'expect': [1, 1]}), ['Beta'])

    def test_reviewed_members_ignore_case_but_not_missing_names(self):
        soup = BeautifulSoup('<p>alpha BETA</p>', 'html.parser')
        spec = dict(page='Fixture', revision=123, members=['Alpha', 'Beta'], expect=[2, 2])
        with patch.object(sources, 'list_page', return_value=soup):
            self.assertEqual(sources.list_values(spec), ['Alpha', 'Beta'])
            with self.assertRaisesRegex(ValueError, 'missing'):
                sources.list_values({**spec, 'members': ['Gamma']})

    def test_count_guards(self):
        self.assertEqual(sources.expect_count([1, 2], [2, 2], 'fixture'), [1, 2])
        for values in [[], [1], [1, 2, 3]]:
            with self.assertRaisesRegex(ValueError, 'expected'):
                sources.expect_count(values, [2, 2], 'fixture')

    def test_revision_and_title_are_pinned(self):
        with self.assertRaises(ValueError):
            sources.list_page('Fixture', 0)
        response = dict(parse=dict(title='Fixture', revid=123, text={'*': '<p>Hello<sup>1</sup></p>'}))
        with patch.object(sources, 'fetch', return_value=json.dumps(response)) as fetch:
            self.assertEqual(sources.list_page('Fixture', 123).get_text(), 'Hello')
            self.assertIn('oldid=123', fetch.call_args[0][0])
        for title, revision in [('Other', 123), ('Fixture', 124)]:
            with patch.object(sources, 'fetch', return_value=json.dumps(response)):
                with self.assertRaisesRegex(ValueError, 'mismatch'):
                    sources.list_page(title, revision)

    def test_dataset_checksum_formats_and_empty(self):
        for raw, format, expected in [('id,name\n1,Alpha\n', 'csv', [{'id': '1', 'name': 'Alpha'}]), ('[]', 'json', []),
                                      (' alpha \n\n beta\r\n', 'lines', ['alpha', 'beta']), ('\n  \n', 'lines', [])]:
            with patch.object(sources, 'fetch', return_value=raw):
                self.assertEqual(sources.dataset('https://example.test/pin', hashlib.sha256(raw.encode()).hexdigest(), format), expected)
                with self.assertRaisesRegex(ValueError, 'checksum'):
                    sources.dataset('https://example.test/pin', '0' * 64, format)
        with self.assertRaisesRegex(ValueError, 'SHA-256'):
            sources.dataset('https://example.test/unpinned', '', 'csv')

    def test_rowspan_winner_extraction_and_expected_count(self):
        soup = BeautifulSoup('<table class="wikitable"><tr><th>Year</th><th>Name</th></tr>'
                             '<tr><td rowspan="2">2026</td><td style="background:#faeb86"><a href="/wiki/A">Alpha</a></td></tr>'
                             '<tr><td><a href="/wiki/B">Beta</a></td></tr></table>', 'html.parser')
        spec = dict(page='Fixture', revision=123, tables=[0], column=1, expect=[2, 2])
        with patch.object(sources, 'list_page', return_value=soup):
            self.assertEqual(sources.table_values(spec), ['Alpha', 'Beta'])
            self.assertEqual(sources.table_values({**spec, 'winner': True, 'expect': [1, 1]}), ['Alpha'])
            with self.assertRaises(ValueError):
                sources.table_values({**spec, 'expect': [3, 3]})


class SpecsTest(unittest.TestCase):
    def test_short_natural_texts_and_retired_sets_remain_complete(self):
        prompts = constrained.read_specs()
        retired = {p['id'] for p in prompts if not p['active']}
        self.assertEqual(retired, {'disney-princesses', 'calendar-months', 'zodiac-signs', 'chinese-zodiac',
                                  'zodiac-constellations', 'santas-reindeer', 'cluedo-rooms',
                                  'us-food-allergens', 'lanthanides', 'synthetic-elements',
                                  'b-vitamins', 'period-4-elements', 'period-5-elements',
                                  'period-6-elements', 'period-7-elements',
                                  'astronaut-group-2', 'astronaut-group-3', 'astronaut-group-5',
                                  'iba-unforgettables', 'iba-contemporary', 'iba-new-era',
                                  'africa-countries', 'asia-countries', 'europe-countries',
                                  'south-america-countries', 'oceania-countries', 'africa-capitals',
                                  'asia-capitals', 'europe-capitals', 'americas-capitals',
                                  'canada-provinces', 'australia-states-territories',
                                  'landlocked-countries', 'greek-letters', 'nato-alphabet'} |
                         {p['id'] for p in prompts if re.search(
                             r'-(pre1980|1980-1999|2000-2026|early|middle|recent)$', p['id'])})
        self.assertEqual(sum(p['active'] for p in prompts), 320)
        for prompt in prompts:
            self.assertLessEqual(len(prompt['text']), 85, prompt['id'])
            self.assertRegex(prompt['text'], r'^Name [^.?!]+\.$')
            self.assertNotRegex(prompt['text'], r'[();]|through \d{4}|counts|pinned|IAU|IUCN')
            self.assertGreaterEqual(len(prompt['rows']), 8)

    def test_reviewed_bank_and_alias_predicates(self):
        prompts = constrained.read_specs()
        self.assertEqual(len(prompts), 385)
        for prompt in prompts:
            self.assertGreaterEqual(len(prompt['rows']), 8)
            self.assertIn(prompt['gem'], [row['name'] for row in prompt['rows']])
        rows = [dict(name='Czech Republic', names=['Czechia'], aliases=['CZ']), dict(name='France')]
        self.assertEqual(constrained.derive(rows, constrained.PREDICATES['countries-ia']), rows[:1])
        self.assertEqual(constrained.derive([], constrained.PREDICATES['countries-ia']), [])
        self.assertEqual(constrained.letters('São Tomé and Príncipe'), 'saotomeandprincipe')

    def test_third_batch_closed_scopes_and_named_upcoming_album(self):
        prompts = {p['id']: p for p in constrained.read_specs()}
        names = lambda id: {r['name'] for r in prompts[id]['rows']}
        self.assertEqual(len(names('original-care-bears')), 10)
        self.assertEqual(len(names('smash-64-fighters')), 12)
        self.assertEqual(len(names('eevee-evolutions')), 8)
        self.assertNotIn('Eevee', names('eevee-evolutions'))
        self.assertNotIn('Bowser', names('smash-64-fighters'))
        self.assertNotIn('Topic', names('celebrations-chocolates'))
        self.assertNotIn('Elsa', names('disney-princess-lineup'))
        self.assertNotIn('Vitruvian Man', names('leonardo-paintings'))
        self.assertIn('Salvator Mundi', names('leonardo-paintings'))
        self.assertIn('Ice', names('iba-singapore-sling-ingredients'))
        self.assertIn('Original Soundtracks 1', names('u2-studio-albums'))
        self.assertIn('Carnaval de Luz', names('u2-studio-albums'))
        self.assertNotIn('TBA', names('u2-studio-albums'))
        self.assertEqual(len(names('super-bowl-halftime-leads')), 124)
        self.assertIn('will.i.am', names('super-bowl-halftime-leads'))
        aliases = prompts['super-bowl-halftime-leads']['aliases']
        for name, variant in [('Mustard', 'djmustard'), ('H.E.R.', 'gabriellawilson'),
                              ('Justin Timberlake', 'timberlake')]:
            self.assertIn(variant, {a.lower().replace(' ', '') for a in aliases.get(name, [])})

    def test_plain_list_swaps_and_word_pattern_boundaries(self):
        document = json.loads((Path(__file__).parent / 'constrained.json').read_text())
        specs = {p['id']: p for p in document['prompts']}
        retired = ['africa-countries', 'asia-countries', 'europe-countries', 'south-america-countries',
                   'oceania-countries', 'africa-capitals', 'asia-capitals', 'europe-capitals',
                   'americas-capitals', 'canada-provinces', 'australia-states-territories',
                   'landlocked-countries', 'greek-letters', 'nato-alphabet']
        self.assertTrue(all(not specs[id]['active'] for id in retired))
        ids = ['borders-germany', 'borders-dr-congo', 'borders-austria', 'borders-zambia',
               'high-capitals', 'drive-left-countries', 'crescent-flags', 'multi-zone-countries',
               'countries-peaks-5000', 'moscow-1980-boycott', 'olympic-capitals',
               'english-eurovision-countries', 'enable-greek-hidden', 'enable-qwerty-top-row']
        self.assertEqual([specs[id]['theme'] for id in ids].count('geography'), 12)
        self.assertEqual([specs[id]['theme'] for id in ids].count('words'), 2)
        prompts = {p['id']: p for p in constrained.read_specs()}
        def names(id):
            return {r['name'] for r in prompts[id]['rows']}
        for id in ids:
            self.assertTrue(specs[id]['active'])
            self.assertEqual(specs[id]['expect'], [len(names(id))] * 2)
            self.assertLessEqual(len(names(id)), 430)
            self.assertTrue(specs[id]['sources'])
            self.assertTrue(all(s['revision'] and s['expect'] for s in specs[id]['sources']))
        self.assertEqual(len(names('high-capitals')), 9)
        self.assertIn('Sucre', names('high-capitals'))
        self.assertNotIn('Kabul', names('high-capitals'))
        self.assertEqual(len(names('drive-left-countries')), 54)
        self.assertNotIn('Hong Kong', names('drive-left-countries'))
        self.assertNotIn('United States', names('drive-left-countries'))
        self.assertEqual(len(names('crescent-flags')), 19)
        self.assertTrue({'Iran', 'Brunei', 'Nepal', 'Moldova'} <= names('crescent-flags'))
        self.assertNotIn('Western Sahara', names('crescent-flags'))
        self.assertEqual(len(names('multi-zone-countries')), 22)
        self.assertTrue({'South Africa', 'Denmark'} <= names('multi-zone-countries'))
        self.assertTrue({'China', 'Kazakhstan', 'Greenland'}.isdisjoint(names('multi-zone-countries')))
        self.assertEqual(len(names('countries-peaks-5000')), 27)
        self.assertTrue({'Indonesia', 'Venezuela'}.isdisjoint(names('countries-peaks-5000')))
        self.assertEqual(len(names('olympic-capitals')), 15)
        self.assertTrue({'Sarajevo', 'Stockholm'} <= names('olympic-capitals'))
        self.assertNotIn('Singapore', names('olympic-capitals'))
        self.assertEqual(len(names('moscow-1980-boycott')), 68)
        self.assertIn('West Germany', names('moscow-1980-boycott'))
        self.assertTrue({'East Germany', 'New Zealand'}.isdisjoint(names('moscow-1980-boycott')))
        self.assertEqual(len(names('english-eurovision-countries')), 19)
        self.assertIn('Ukraine', names('english-eurovision-countries'))
        self.assertTrue({'West Germany', 'Serbia'}.isdisjoint(names('english-eurovision-countries')))
        for id in ['enable-greek-hidden', 'enable-qwerty-top-row']:
            spec = specs[id]
            excluded = {constrained.normalize(w) for w in spec['editorial_exclusions']}
            for row in spec['answers']:
                self.assertTrue(4 <= len(row['name']) <= 12)
                self.assertNotIn(constrained.normalize(row['name']), excluded)
                if id == 'enable-greek-hidden':
                    for word in [row['name'], *row.get('aliases', [])]:
                        self.assertTrue(any(n in word for n in ['eta', 'rho', 'tau', 'phi', 'chi', 'psi']))
                else:
                    self.assertLessEqual(set(row['name']), set('qwertyuiop'))
                    self.assertTrue(all(constrained.normalize(a) == constrained.normalize(row['name'])
                                        for a in row.get('aliases', [])))

    def test_second_batch_word_patterns_and_editorial_boundaries(self):
        document = json.loads((Path(__file__).parent / 'constrained.json').read_text())
        prompts = {p['id']: p for p in document['prompts']}
        for id in ['enable-semordnilaps', 'enable-three-es', 'enable-five-vowels']:
            prompt = prompts[id]
            self.assertTrue(prompt['active'])
            self.assertLessEqual(len(prompt['answers']), 2000)
            self.assertEqual(prompt['sources'][0]['sha256'],
                             '3f16130220645692ed49c7134e24a18504c2ca55b3c012f7290e3e77c63b1a89')
            for row in prompt['answers']:
                for word in [row['name'], *row.get('aliases', [])]:
                    self.assertRegex(word, r'^[a-z]+$')
                    if id == 'enable-semordnilaps':
                        self.assertTrue(4 <= len(word) <= 9)
                        self.assertNotEqual(word, word[::-1])
                        self.assertNotIn(word, prompt['editorial_exclusions'])
                    elif id == 'enable-three-es':
                        self.assertTrue(6 <= len(word) <= 9)
                        self.assertGreaterEqual(word.count('e'), 3)
                    else:
                        self.assertLessEqual(set('aeiou'), set(word))
        self.assertEqual(prompts['enable-five-vowels']['dictionary_supplements'], ['cautioner'])
        self.assertIn('cautioner', {r['name'] for r in prompts['enable-five-vowels']['answers']})
        self.assertEqual(prompts['enable-five-vowels']['sources'][1]['revision'], '93683712')
        self.assertTrue({'Frank Lockhart', 'Johnnie Parsons', 'Buddy Rice'} <=
                        {r['name'] for r in prompts['indy-500-winners']['answers']})
        self.assertEqual(len(prompts['shuttle-final-crews']['answers']), 30)
        self.assertNotIn('Ingenuity', {r['name'] for r in prompts['moon-mars-rovers']['answers']})

    def test_reviewed_phase_two_boundaries(self):
        prompts = {p['id']: p for p in constrained.read_specs()}
        active = [p for p in prompts.values() if p['active']]
        clusters = Counter(p['cluster'] for p in active if p.get('cluster'))
        self.assertLessEqual(max(clusters.values()), math.ceil(len(active) / 10))
        def names(id):
            return {row['name'] for row in prompts[id]['rows']}
        self.assertTrue({'Pretoria', 'Mbabane', 'Malabo'} <= names('africa-capitals'))
        self.assertTrue({'Monaco', 'Vatican City', 'The Hague'} <= names('europe-capitals'))
        self.assertTrue({'French', 'Italian'}.isdisjoint(names('europe-capitals')))
        self.assertNotIn('TBA', names('bake-off-winners'))
        self.assertNotIn('William Rehnquist', names('supreme-court-since-1981'))
        self.assertTrue({'John Roberts', 'Antonin Scalia'} <= names('supreme-court-since-1981'))
        self.assertTrue({'Floyd Landis', 'Lance Armstrong'} <= names('tour-de-france'))
        self.assertTrue({'World War I', 'World War II'}.isdisjoint(names('tour-de-france')))
        for id in ['wimbledon-men', 'wimbledon-women']:
            self.assertNotIn('COVID-19 pandemic', names(id))
        self.assertEqual(len(names('human-vitamins')), 13)
        self.assertEqual(len(names('b-vitamins')), 8)

    def test_collapsed_families_and_distinct_replacements(self):
        prompts = {p['id']: p for p in constrained.read_specs()}
        awards = ['grammy-album', 'grammy-record', 'grammy-song', 'grammy-new-artist',
                  'booker-winners', 'hugo-novels', 'newbery-winners', 'pulitzer-fiction',
                  'emmy-drama', 'emmy-comedy']
        for id in awards:
            self.assertTrue(prompts[id]['active'], id)
            splits = [p for key, p in prompts.items() if key.startswith(id + '-')]
            self.assertEqual(len(splits), 3, id)
            self.assertTrue(all(not p['active'] for p in splits), id)
            accepted = {constrained.normalize(n) for row in prompts[id]['rows']
                        for n in [row['name'], *row.get('aliases', [])]}
            for split in splits:
                self.assertTrue({constrained.normalize(r['name']) for r in split['rows']} <= accepted, split['id'])
        def names(id):
            return {row['name'] for row in prompts[id]['rows']}
        self.assertEqual(len(names('iba-cocktails')), 102)
        self.assertEqual(names('iba-cocktails'), set().union(
            *(names(id) for id in ['iba-unforgettables', 'iba-contemporary', 'iba-new-era'])))
        self.assertTrue({'World War II', 'Saudi Arabia', 'Morocco'}.isdisjoint(names('world-cup-hosts')))
        self.assertEqual(len(names('world-cup-winners')), 8)
        self.assertEqual(len(names('super-bowl-winners')), 20)
        self.assertNotIn('Baltimore Colts', names('super-bowl-winners'))
        self.assertNotIn('St. Louis Rams', names('super-bowl-winners'))
        self.assertEqual(len(names('un-secretaries-general')), 10)
        self.assertNotIn('Congo Crisis', names('un-secretaries-general'))
        self.assertIn('Henry Dunant', names('nobel-peace'))
        self.assertEqual(len(names('nobel-peace')), 141)
        self.assertTrue({'Tinker Bell', 'Elsa'}.isdisjoint(names('disney-princesses')))
        self.assertNotIn('Avengers: Doomsday', names('mcu-films'))
        self.assertTrue({'Milan', "Cortina d'Ampezzo"} <= names('winter-olympic-hosts'))
        self.assertTrue({'Melbourne', 'Stockholm'} <= names('summer-olympic-hosts'))
        self.assertTrue({'Enterprise', 'galaxy'}.isdisjoint(names('star-trek-original-episodes')))
        self.assertTrue({'Southern Sotho', 'South African Sign Language'} <= names('south-africa-languages'))
        self.assertTrue({'Cardenio', "Love's Labour's Won", 'Sir Thomas More'} <= names('shakespeare-plays'))
        self.assertIn('Meet the Beatles!', names('beatles-albums'))
        self.assertIn('The Cosmos Rocks', names('queen-albums'))
        self.assertIn('Space Oddity', prompts['bowie-albums']['aliases']['David Bowie'])
        self.assertIn('More', prompts['pink-floyd-albums']['aliases']['Soundtrack From The Film More'])

    def test_surnames_use_matcher_normalization_and_skip_numeric_band_suffixes(self):
        document = json.loads((constrained.HERE / 'constrained.json').read_text())
        spec = document['prompts'][0]
        spec['answers'] = [dict(name=name) for name in ['Tiger Woods', 'Craig Wood', 'Maroon 5',
                            'Neil Armstrong', 'Buzz Aldrin', 'Pete Conrad', 'Jim Lovell', 'John Young']]
        spec.update(people=True, expect=[8, 8], surface=['Neil Armstrong'], pearl='Buzz Aldrin')
        document['prompts'] = [spec]
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / 'constrained.json').write_text(json.dumps(document))
            with patch.object(constrained, 'HERE', Path(directory)):
                aliases = constrained.read_specs()[0]['aliases']
        self.assertNotIn('Tiger Woods', aliases)
        self.assertNotIn('Craig Wood', aliases)
        self.assertNotIn('Maroon 5', aliases)
        self.assertEqual(aliases['Neil Armstrong'], ['armstrong'])

    def test_snapshot_count_and_source_drift_fail(self):
        document = json.loads((constrained.HERE / 'constrained.json').read_text())
        document['prompts'][0]['expect'] = [999, 999]
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / 'constrained.json').write_text(json.dumps(document))
            with patch.object(constrained, 'HERE', Path(directory)):
                with self.assertRaisesRegex(ValueError, 'expected'):
                    constrained.read_specs()
        with patch.object(constrained, 'acquire', return_value=['source drift']):
            with self.assertRaisesRegex(ValueError, 'differs'):
                constrained.read_specs(verify_sources=True)


class ScheduleTest(unittest.TestCase):
    def fixture(self):
        return [dict(id=f'p{i}', theme=f'theme{i % 5}', cluster=f'cluster{i % 5}',
                     constrained=i < 192, size=[12, 80, 200][i % 3]) for i in range(320)]

    def test_schedule_is_deterministic_complete_and_valid(self):
        prompts = self.fixture()
        days, status = schedule.build(prompts)
        self.assertEqual(len(days), 64, status)
        self.assertEqual(schedule.build(prompts)[0], days)
        self.assertEqual(len(set(id for day in days for id in day)), 320)
        schedule.validate(days, prompts)

    def test_insufficient_and_impossible_banks(self):
        for prompts in [[], self.fixture()[:191]]:
            days, status = schedule.build(prompts)
            self.assertEqual(days, [])
            self.assertIn('not enough constrained', status)
        prompts = self.fixture()
        for prompt in prompts:
            prompt['theme'] = 'same'
        self.assertEqual(schedule.build(prompts)[0], [])
        with self.assertRaisesRegex(ValueError, '64 days'):
            schedule.validate([], [])

    def test_fully_constrained_bank_keeps_a_difficulty_mix(self):
        prompts = self.fixture()
        for i, prompt in enumerate(prompts):
            prompt.update(constrained=True, size=12 if i < 160 else 80)
        days, status = schedule.build(prompts)
        self.assertEqual(len(days), 64, status)
        schedule.validate(days, prompts)

    def test_fully_constrained_homogeneous_days_retry_and_fail_cleanly(self):
        for size in [12, 200]:
            prompts = self.fixture()[:5]
            for prompt in prompts:
                prompt.update(constrained=True, size=size)
            with patch.object(schedule, 'MIN_DAYS', 1), \
                    patch.object(schedule.random, 'Random', wraps=schedule.random.Random) as random:
                days, status = schedule.build(prompts)
            self.assertEqual(days, [])
            self.assertIn('unable to satisfy', status)
            self.assertEqual(random.call_count, 200)


if __name__ == '__main__':
    unittest.main()
