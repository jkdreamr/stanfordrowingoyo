import math
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import MagicMock, patch

from generate import display_name, familiarity_score, normalize
import pageviews
import sitelinks


class FamiliarityTest(unittest.TestCase):
    def test_common_display_names_keep_their_matching_keys(self):
        for raw, expected in [('tomato', 'Tomato'), ('cars', 'Car'), ('clothes', 'Clothes'),
                              ('glasses', 'Glasses'), ('ice cream stick', 'Ice Cream Stick'),
                              ("Buddha's hand", "Buddha's Hand"), ('iPod', 'iPod')]:
            result = display_name(raw, {'id': 'objects'})
            self.assertEqual(result, expected)
            self.assertEqual(normalize(result), normalize(raw))
        self.assertEqual(display_name('The Beatles', {'id': 'rock-hall'}), 'The Beatles')
        self.assertEqual(display_name('Los Angeles', {'id': 'cities-us'}), 'Los Angeles')
        self.assertEqual(display_name('', {'id': 'objects'}), '')

    def test_sitelinks_dominate_homograph_fallback(self):
        self.assertGreater(familiarity_score(None, 100, 1), familiarity_score(None, None, 9))

    def test_sitelinks_are_primary_without_pageviews(self):
        self.assertEqual(familiarity_score(None, 100, 2), (1, math.log1p(100), 2))

    def test_both_signals_and_zipf_tiebreak(self):
        expected = .6 * math.log1p(5000000 / 5000) + .4 * math.log1p(100)
        self.assertAlmostEqual(familiarity_score(5000000, 100, 2)[1], expected)
        self.assertGreater(familiarity_score(5000000, 100, 3), familiarity_score(5000000, 100, 2))
        self.assertGreater(familiarity_score(5000000, 100, 2), familiarity_score(1000, 100, 9))

    def test_fallback_empty_and_zero_observations(self):
        self.assertEqual(familiarity_score(None, None, 4), (0, 4, 0))
        self.assertEqual(familiarity_score(0, 0, 4), (1, 0, 4))

    def test_every_request_uses_descriptive_headers(self):
        self.assertEqual(pageviews.HEADERS['User-Agent'], pageviews.HEADERS['Api-User-Agent'])
        self.assertIn('StanfordOYO-DiveBuilder', pageviews.HEADERS['User-Agent'])
        self.assertIn('josdreamr@gmail.com', pageviews.HEADERS['User-Agent'])

    def test_network_request_transmits_both_headers(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"ok": true}'
        with TemporaryDirectory() as directory, patch.object(pageviews, 'CACHE', Path(directory)), patch.object(pageviews.urllib.request, 'urlopen', return_value=response) as request:
            self.assertEqual(pageviews.request('https://example.test/headers'), {'ok': True})
            headers = {key.lower(): value for key, value in request.call_args.args[0].header_items()}
            self.assertEqual(headers['user-agent'], pageviews.AGENT)
            self.assertEqual(headers['api-user-agent'], pageviews.AGENT)

    def test_qid_redirects_and_missing_pages(self):
        data = {'query': {'normalized': [{'from': 'new york', 'to': 'New york'}],
                         'redirects': [{'from': 'New york', 'to': 'New York City'}],
                         'pages': [{'title': 'New York City', 'pageprops': {'wikibase_item': 'Q60'}},
                                   {'title': 'missing', 'missing': True}]}}
        with patch.object(pageviews, 'request', return_value=data):
            self.assertEqual(sitelinks.resolve(['new york', 'missing']),
                             {'new york': {'title': 'New York City', 'qid': 'Q60'}})
        with patch.object(pageviews, 'request', return_value={}):
            self.assertEqual(sitelinks.resolve(['missing']), {})

    def test_batched_counts_aggregate_types_and_countries(self):
        def binding(kind):
            return {'item': {'value': 'http://www.wikidata.org/entity/Q60'}, 'n': {'value': '123'},
                    'kind': {'value': 'http://www.wikidata.org/entity/' + kind},
                    'country': {'value': 'http://www.wikidata.org/entity/Q30'}}
        data = {'results': {'bindings': [binding('Q515'), binding('Q5119')]}}
        with patch.object(pageviews, 'request', return_value=data):
            self.assertEqual(sitelinks.query_counts(['Q60']),
                             {'Q60': {'sitelinks': 123, 'kinds': {'Q515', 'Q5119'}, 'countries': {'Q30'}}})
        self.assertEqual([len(batch) for batch in sitelinks.chunks(list(range(601)), 300)], [300, 300, 1])

    def test_malformed_counts_fail_instead_of_silent_fallback(self):
        with patch.object(pageviews, 'request', return_value={}):
            with self.assertRaises(KeyError):
                sitelinks.query_counts(['Q60'])


if __name__ == '__main__':
    unittest.main()
