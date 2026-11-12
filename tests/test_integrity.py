#!/usr/bin/env python3
"""Future-proof assembly and launcher tests, even after gameplay changes.

The archived original is deliberately NOT used as a code baseline here. Use
`python tests/test_original_baseline.py` only to verify the untouched initial
modular conversion.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / 'src/manifest.json').read_text('utf-8'))


class AssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.styles = []
        self.css = []
        self.external = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'script':
            self.scripts.append(a)
        if tag == 'style':
            self.styles.append(a)
        if tag == 'link' and a.get('rel') == 'stylesheet':
            self.css.append(a)
        for key in ('src', 'href'):
            url = a.get(key, '')
            if url.lower().startswith(('http://', 'https://', '//')):
                self.external.append(url)


def css_balanced(css: str) -> bool:
    depth = 0
    in_comment = False
    quote = ''
    i = 0
    while i < len(css):
        ch = css[i]
        nx = css[i + 1] if i + 1 < len(css) else ''
        if in_comment:
            if ch == '*' and nx == '/':
                in_comment = False
                i += 2
                continue
        elif quote:
            if ch == '\\':
                i += 2
                continue
            if ch == quote:
                quote = ''
        elif ch == '/' and nx == '*':
            in_comment = True
            i += 2
            continue
        elif ch in "'\"":
            quote = ch
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth < 0:
                return False
        i += 1
    return depth == 0 and not in_comment and not quote


def game_js_at(root: Path = ROOT) -> bytes:
    prefix = (root / 'src' / MANIFEST['wrapperPrefix']).read_bytes()
    suffix = (root / 'src' / MANIFEST['wrapperSuffix']).read_bytes()
    return prefix + b''.join((root / 'src' / m['file']).read_bytes()
                             for m in MANIFEST['moduleOrder']) + suffix


def run_build(root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, str(root / 'tools/build.py'), *args],
                          cwd=root, capture_output=True, text=True, timeout=30)


class ModularIntegrity(unittest.TestCase):
    def test_every_module_is_in_manifest_once(self):
        js = [m['file'] for m in MANIFEST['moduleOrder']]
        css = MANIFEST['styleOrder']
        self.assertEqual(len(js), len(set(js)))
        self.assertEqual(len(css), len(set(css)))
        self.assertEqual(set(js), {p.name for p in (ROOT / 'src').glob('*.js')})
        self.assertEqual(set(css), {p.name for p in (ROOT / 'styles').glob('*.css')})
        self.assertTrue(all((ROOT / 'src' / s).stat().st_size > 0 for s in js))
        self.assertTrue(all((ROOT / 'styles' / s).stat().st_size > 0 for s in css))

    def test_javaScript_bundle_exactly_matches_parts(self):
        self.assertEqual(game_js_at(), (ROOT / 'dist/game.js').read_bytes())
        self.assertNotIn(b'</script', game_js_at().lower())
        self.assertEqual(run_build(ROOT, '--check').returncode, 0)

    def test_each_js_segment_parses_in_original_closure(self):
        # Every segment is also a syntactically complete group of declarations.
        # Node is an optional developer dependency, not required to run the game.
        node = shutil.which('node')
        if not node:
            self.skipTest('Node.js not installed')
        prefix = (ROOT / 'src' / MANIFEST['wrapperPrefix']).read_bytes()
        suffix = (ROOT / 'src' / MANIFEST['wrapperSuffix']).read_bytes()
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td) / 'segment.js'
            for name in (m['file'] for m in MANIFEST['moduleOrder']):
                with self.subTest(file=name):
                    tmp.write_bytes(prefix + (ROOT / 'src' / name).read_bytes() + suffix)
                    r = subprocess.run([node, '--check', str(tmp)], capture_output=True,
                                       text=True, timeout=15)
                    self.assertEqual(r.returncode, 0, r.stderr)

    def test_each_css_segment_balanced(self):
        for f in MANIFEST['styleOrder']:
            with self.subTest(file=f):
                self.assertTrue(css_balanced((ROOT / 'styles' / f).read_text('utf-8')))

    def test_dev_uses_all_local_assets_in_order(self):
        doc = AssetParser()
        doc.feed((ROOT / 'dev.html').read_text('utf-8'))
        self.assertEqual(doc.external, [])
        self.assertEqual([x.get('href') for x in doc.css],
                         ['styles/' + f for f in MANIFEST['styleOrder']])
        self.assertEqual([x.get('src') for x in doc.scripts],
                         ['dist/game.js', 'dist/legacy-notes.js'])
        self.assertTrue(all((ROOT / x['href']).is_file() for x in doc.css))
        self.assertTrue(all((ROOT / x['src']).is_file() for x in doc.scripts))

    def test_standalone_has_all_assets_inline(self):
        page = (ROOT / 'index.html').read_bytes()
        doc = AssetParser()
        doc.feed(page.decode('utf-8'))
        self.assertEqual(doc.external, [])
        self.assertEqual(doc.css, [])
        self.assertEqual(len(doc.scripts), 2)
        self.assertEqual(len(doc.styles), 2)
        self.assertTrue(all('src' not in t for t in doc.scripts))
        self.assertEqual(run_build(ROOT, '--check').returncode, 0)

    def test_changes_propagate_and_stale_build_is_detected(self):
        # Protect future changes: modifying any module must update index.html,
        # and --check must catch an index/game.js not rebuilt after edits.
        with tempfile.TemporaryDirectory() as td:
            copy = Path(td) / 'project'
            shutil.copytree(ROOT, copy, ignore=shutil.ignore_patterns('__pycache__'))
            original = (copy / 'index.html').read_bytes()
            js_file = copy / 'src' / MANIFEST['moduleOrder'][0]['file']
            css_file = copy / 'styles' / MANIFEST['styleOrder'][0]
            js_token = b'/*NEON_AUDIT_JS_MARKER*/'
            css_token = b'/*NEON_AUDIT_CSS_MARKER*/'
            js_file.write_bytes(js_file.read_bytes() + b'\n' + js_token + b'\n')
            css_file.write_bytes(css_file.read_bytes() + b'\n' + css_token + b'\n')
            r = run_build(copy, '--check')
            self.assertNotEqual(r.returncode, 0, 'Stale output was not detected')
            r = run_build(copy)
            self.assertEqual(r.returncode, 0, r.stderr)
            r = run_build(copy, '--check')
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn(js_token, (copy / 'dist/game.js').read_bytes())
            self.assertIn(js_token, (copy / 'index.html').read_bytes())
            self.assertIn(css_token, (copy / 'index.html').read_bytes())
            self.assertNotEqual(original, (copy / 'index.html').read_bytes())
            # The source archive always keeps the original intact separately.
            self.assertEqual((copy / 'reference/NEON_RIFT_3D_FPS_CONTROL_ORIGINAL.html').read_bytes(),
                             (ROOT / 'reference/NEON_RIFT_3D_FPS_CONTROL_ORIGINAL.html').read_bytes())

    def test_new_unlisted_modules_cannot_go_missing_silently(self):
        with tempfile.TemporaryDirectory() as td:
            copy = Path(td) / 'project'
            shutil.copytree(ROOT, copy, ignore=shutil.ignore_patterns('__pycache__'))
            (copy / 'src' / 'unlisted.js').write_text('const lost = true;\n', 'utf-8')
            r = run_build(copy, '--check')
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('inventory mismatch', r.stderr)

    def test_nested_script_closer_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            copy = Path(td) / 'project'
            shutil.copytree(ROOT, copy, ignore=shutil.ignore_patterns('__pycache__'))
            js_file = copy / 'src' / MANIFEST['moduleOrder'][0]['file']
            js_file.write_bytes(js_file.read_bytes() + b'\n/*</script>*/\n')
            r = run_build(copy, '--check')
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('embedded </script>', r.stderr)


if __name__ == '__main__':
    unittest.main(verbosity=2)
