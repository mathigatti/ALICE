import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('build_brain', ROOT / 'tools/build_brain.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class BuildBrainTests(unittest.TestCase):
    def test_spanish_normalization_in_patterns_context_and_topics(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'aiml/es').mkdir(parents=True)
            (root / 'site/bots/es').mkdir(parents=True)
            (root / 'site/bots/es/config.json').write_text(json.dumps({'stripAccents': True}))
            (root / 'aiml/es/test.aiml').write_text('''<aiml><topic name="año">
              <category><pattern>qué año</pattern><that>¿cómo estás?</that>
              <template>¡José!</template></category></topic>
              <category><pattern>ano</pattern><template>Otra palabra.</template></category>
              </aiml>''')
            old_root = build.ROOT
            try:
                build.ROOT = str(root)
                with contextlib.redirect_stdout(io.StringIO()):
                    build.main('es')
            finally:
                build.ROOT = old_root
            cats = json.loads((root / 'site/bots/es/brain.json').read_text())['c']
            self.assertEqual(cats[0][0], 'QUE AÑO')
            self.assertEqual(cats[0][2], 'AÑO')
            self.assertEqual(cats[0][3], ['¡José!'])
            self.assertEqual(cats[1][0], 'ANO')

    def test_english_rebuild_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'aiml').mkdir()
            (root / 'aiml/en').symlink_to(ROOT / 'aiml/en', target_is_directory=True)
            (root / 'site/bots/en').mkdir(parents=True)
            (root / 'site/bots/en/config.json').write_bytes((ROOT / 'site/bots/en/config.json').read_bytes())
            old_root = build.ROOT
            try:
                build.ROOT = str(root)
                with contextlib.redirect_stdout(io.StringIO()):
                    build.main('en')
            finally:
                build.ROOT = old_root
            self.assertEqual((root / 'site/bots/en/brain.json').read_bytes(),
                             (ROOT / 'site/bots/en/brain.json').read_bytes())


if __name__ == '__main__':
    unittest.main()
