import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from bs4 import BeautifulSoup

import constrained
import schedule
import sources


class SourcesTest(unittest.TestCase):
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
        for raw, format, expected in [('id,name\n1,Alpha\n', 'csv', [{'id': '1', 'name': 'Alpha'}]), ('[]', 'json', [])]:
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
    def test_reviewed_bank_and_alias_predicates(self):
        prompts = constrained.read_specs()
        self.assertEqual(len(prompts), 59)
        for prompt in prompts:
            self.assertGreaterEqual(len(prompt['rows']), 8)
            self.assertIn(prompt['gem'], [row['name'] for row in prompt['rows']])
        rows = [dict(name='Czech Republic', names=['Czechia'], aliases=['CZ']), dict(name='France')]
        self.assertEqual(constrained.derive(rows, constrained.PREDICATES['countries-ia']), rows[:1])
        self.assertEqual(constrained.derive([], constrained.PREDICATES['countries-ia']), [])
        self.assertEqual(constrained.letters('São Tomé and Príncipe'), 'saotomeandprincipe')

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


if __name__ == '__main__':
    unittest.main()
