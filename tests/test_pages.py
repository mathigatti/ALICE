from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parent.parent / 'site'


class Head(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.meta = {}; self.links = []; self.html = {}
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'html': self.html = attrs
        if tag == 'meta': self.meta[attrs.get('name', attrs.get('property'))] = attrs.get('content')
        if tag == 'link': self.links.append(attrs)


class PagesTests(unittest.TestCase):
    def test_localized_static_metadata_and_assets(self):
        for path, lang, canonical, locale in [('index.html', 'es', '/', 'es_AR'),
                                             ('es/index.html', 'es', '/', 'es_AR'),
                                             ('en/index.html', 'en', '/en/', 'en_US')]:
            with self.subTest(path=path):
                text = (ROOT / path).read_text()
                head = Head(text)
                cfg = json.loads((ROOT / f'bots/{lang}/config.json').read_text())['ui']
                self.assertEqual(head.html['lang'], lang)
                self.assertEqual(head.html['data-bot-language'], lang)
                self.assertEqual(head.meta['description'], cfg['description'])
                self.assertEqual(head.meta['og:description'], cfg['description'])
                self.assertEqual(head.meta['twitter:description'], cfg['description'])
                self.assertEqual(head.meta['og:title'], cfg['title'])
                self.assertEqual(head.meta['og:locale'], locale)
                self.assertEqual(head.meta['og:url'], 'https://alice.labsensacional.com' + canonical)
                self.assertIn({'rel': 'canonical', 'href': head.meta['og:url']}, head.links)
                alts = {x.get('hreflang'): x['href'] for x in head.links if x.get('rel') == 'alternate'}
                self.assertEqual(alts, {'es': 'https://alice.labsensacional.com/',
                                       'en': 'https://alice.labsensacional.com/en/',
                                       'x-default': 'https://alice.labsensacional.com/'})
                ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', text, re.S)[1])
                self.assertEqual(ld['inLanguage'], lang)
                self.assertEqual(ld['url'], head.meta['og:url'])
                self.assertIn('src="/app.js"', text)
                self.assertIn('href="/style.css"', text)


if __name__ == '__main__':
    unittest.main()
