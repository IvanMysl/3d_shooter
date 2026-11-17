#!/usr/bin/env python3
"""Offline asset integrity, preserved original snapshot, and launcher checks.

The first-edition reference is intentionally immutable, while Stage25 code
and styles are SUPPOSED to differ from it. Verify both invariants separately.
"""
from __future__ import annotations

import hashlib
import json
import re
import unittest
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / 'src' / 'manifest.json').read_text('utf-8'))


class AssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.css = []
        self.external = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'script':
            self.scripts.append(a)
        if tag == 'link' and a.get('rel') == 'stylesheet':
            self.css.append(a)
        for k in ('src', 'href'):
            u = a.get(k, '')
            if u.lower().startswith(('http://', 'https://', '//')):
                self.external.append(u)


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def css_balanced(css: str):
    # Tests that no media query/rule was divided across different CSS files.
    depth = 0
    in_comment = False
    quote = ''
    i = 0
    while i < len(css):
        ch = css[i]
        nx = css[i+1] if i+1 < len(css) else ''
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


class ModularGameIntegrity(unittest.TestCase):
    def test_original_sha(self):
        p = ROOT / 'reference' / 'NEON_RIFT_3D_FPS_CONTROL_ORIGINAL.html'
        self.assertEqual(sha(p.read_bytes()), MANIFEST['baselineHtmlSha256'])

    def test_modules_join_to_current_js_and_original_is_preserved(self):
        prefix = (ROOT / 'src' / MANIFEST['wrapperPrefix']).read_bytes()
        suffix = (ROOT / 'src' / MANIFEST['wrapperSuffix']).read_bytes()
        modules = [ROOT / 'src' / m['file'] for m in MANIFEST['moduleOrder']]
        self.assertGreaterEqual(len(modules), 28)
        self.assertEqual(len(set(modules)), len(modules))
        for m in modules:
            self.assertTrue(m.is_file(), m)
            self.assertGreater(m.stat().st_size, 0, m)
        js = prefix + b''.join(m.read_bytes() for m in modules) + suffix
        self.assertEqual(js, (ROOT / 'dist/game.js').read_bytes())
        original = (ROOT / 'reference/NEON_RIFT_3D_FPS_CONTROL_ORIGINAL.html').read_bytes()
        snippets = re.findall(rb'<script\b[^>]*>(.*?)</script\s*>', original, flags=re.I | re.S)
        self.assertEqual(len(snippets), 2)
        self.assertEqual(sha(snippets[0]), MANIFEST['baselineJsSha256'])
        self.assertNotEqual(js, snippets[0])  # game has deliberately evolved
        self.assertEqual((ROOT / 'dist/legacy-notes.js').read_bytes(), snippets[1])

    def test_current_styles_are_balanced_and_original_is_preserved(self):
        original = (ROOT / 'reference/NEON_RIFT_3D_FPS_CONTROL_ORIGINAL.html').read_bytes()
        original_css = re.findall(rb'<style\b[^>]*>(.*?)</style\s*>', original, flags=re.I | re.S)
        self.assertEqual(len(original_css), 2)
        fns = MANIFEST['styleOrder']
        self.assertGreaterEqual(len(fns), 8)  # New features may add stylesheets.
        self.assertEqual(len(set(fns)), len(fns))
        for fn in fns:
            css = (ROOT / 'styles' / fn).read_text(encoding='utf-8')
            self.assertTrue(css_balanced(css), f'CSS nesting crosses module boundary: {fn}')
        self.assertGreater(len(original_css[0]), 0)
        self.assertGreater(len(original_css[1]), 0)
        self.assertNotEqual(b''.join((ROOT / 'styles' / f).read_bytes() for f in fns[:-1]), original_css[0])

    def test_index_launcher_paths(self):
        p = AssetParser()
        p.feed((ROOT / 'dev.html').read_text('utf-8'))
        self.assertEqual(p.external, [])
        self.assertEqual([x.get('src') for x in p.scripts], ['dist/game.js','dist/legacy-notes.js'])
        self.assertEqual([x.get('href') for x in p.css], ['styles/'+name for name in MANIFEST['styleOrder']])
        for pth in [x['src'] for x in p.scripts] + [x['href'] for x in p.css]:
            self.assertTrue((ROOT / pth).is_file(), pth)

    def test_index_is_standalone_after_modifications(self):
        # Critical for Android file managers: no relative-resource lookups.
        game = (ROOT / 'index.html').read_bytes()
        original = (ROOT / 'reference/NEON_RIFT_3D_FPS_CONTROL_ORIGINAL.html').read_bytes()
        self.assertNotEqual(game, original)
        parser = AssetParser()
        parser.feed(game.decode('utf-8'))
        self.assertEqual(parser.external, [])
        self.assertEqual(parser.css, [])
        self.assertEqual(len(parser.scripts), 2)
        self.assertTrue(all('src' not in tag for tag in parser.scripts))

    def test_current_html_and_js_match_deterministic_build(self):
        from subprocess import run
        p = run([sys.executable, str(ROOT/'tools/build.py'), '--check'],
                capture_output=True,text=True)
        self.assertEqual(p.returncode, 0, p.stderr)


if __name__ == '__main__':
    unittest.main(verbosity=2)
