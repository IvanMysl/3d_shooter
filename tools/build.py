#!/usr/bin/env python3
"""Offline deterministic bundler for NEON RIFT 3D.

No npm, network, build framework or third-party Python packages required.
The source files are consecutive slices of the original IIFE body.
Joining them produces the exact original JavaScript, preserving its closure.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'src'
DIST = ROOT / 'dist'
STYLES = ROOT / 'styles'
REFERENCE = ROOT / 'reference' / 'NEON_RIFT_3D_FPS_CONTROL_ORIGINAL.html'
MANIFEST = json.loads((SOURCE / 'manifest.json').read_text(encoding='utf-8'))
TEMPLATE = ROOT / 'tools' / 'index-template.html'


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def contents(path: Path) -> bytes:
    return path.read_bytes()


def fail(msg: str) -> None:
    raise RuntimeError(msg)


def validate_manifest() -> None:
    """Do not silently omit an added source or include one twice.

    Paths in the manifest must refer to files inside their designated folder.
    Keeping the inventory exhaustive is important as the game evolves.
    """
    for folder, key, pattern in ((SOURCE, 'moduleOrder', '*.js'),
                                 (STYLES, 'styleOrder', '*.css')):
        entries = MANIFEST[key]
        names = [e['file'] if isinstance(e, dict) else e for e in entries]
        if not names or len(names) != len(set(names)):
            fail(f'{key} is empty or contains duplicate files')
        for name in names:
            target = (folder / name).resolve()
            if not target.is_relative_to(folder.resolve()) or not target.is_file():
                fail(f'{key}: missing file or unsafe path: {name}')
        present = {p.relative_to(folder).as_posix() for p in folder.rglob(pattern)}
        if present != set(names):
            fail(f'{key}: source inventory mismatch; missing from manifest: '
                 f'{sorted(present-set(names))}; not on disk: {sorted(set(names)-present)}')
    for key in ('wrapperPrefix', 'wrapperSuffix'):
        target = (SOURCE / MANIFEST[key]).resolve()
        if not target.is_relative_to(SOURCE.resolve()) or not target.is_file():
            fail(f'Missing or unsafe {key}: {MANIFEST[key]}')


def assembled() -> bytes:
    validate_manifest()
    parts = [contents(SOURCE / MANIFEST['wrapperPrefix'])]
    for m in MANIFEST['moduleOrder']:
        parts.append(contents(SOURCE / m['file']))
    parts.append(contents(SOURCE / MANIFEST['wrapperSuffix']))
    return b''.join(parts)


def standalone_html(game_js: bytes) -> bytes:
    # Inline HTML must never be terminated by a token inside JS/CSS source.
    # Fail loudly rather than emitting a subtly broken index.html.
    if re.search(rb'</script\b', game_js + b'\n' + contents(DIST / 'legacy-notes.js'), re.I):
        fail('An embedded </script> token would break standalone HTML')
    css_names = MANIFEST['styleOrder']
    if re.search(rb'</style\b', b''.join(contents(STYLES / f) for f in css_names), re.I):
        fail('An embedded </style> token would break standalone HTML')
    inject = {
        b'__NR_SCRIPT_0_INJECT__': game_js,
        b'__NR_SCRIPT_1_INJECT__': contents(DIST / 'legacy-notes.js'),
        b'__NR_STYLE_0_INJECT__': b''.join(contents(STYLES / f) for f in css_names[:-1]),
        b'__NR_STYLE_1_INJECT__': contents(STYLES / css_names[-1]),
    }
    out = contents(TEMPLATE)
    for marker, asset in inject.items():
        if out.count(marker) != 1:
            fail(f'Expected exactly one placeholder {marker!r} in HTML template')
        out = out.replace(marker, asset)
    return out


def verify_original(output: bytes) -> None:
    old = contents(REFERENCE)
    if digest(old) != MANIFEST['baselineHtmlSha256']:
        fail('Original HTML backup has changed or is damaged.')

    js_list = re.findall(rb'<script\b[^>]*>(.*?)</script\s*>', old, flags=re.S | re.I)
    styles = re.findall(rb'<style\b[^>]*>(.*?)</style\s*>', old, flags=re.S | re.I)
    if len(js_list) != 2 or len(styles) != 2:
        fail('Unexpected baseline script/style count.')
    if output != js_list[0]:
        fail('Game JS differs from the original baseline! Do not claim equivalence.')
    if digest(output) != MANIFEST['baselineJsSha256']:
        fail('Game JS SHA-256 mismatch.')
    if contents(DIST / 'legacy-notes.js') != js_list[1]:
        fail('Secondary original script changed.')

    css_files = MANIFEST['styleOrder']
    joined_main_css = b''.join(contents(STYLES / file) for file in css_files[:-1])
    if joined_main_css != styles[0] or contents(STYLES / css_files[-1]) != styles[1]:
        fail('CSS is not identical to the original.')

    # Reverse the substitutions in index.html. This must reproduce the
    # original HTML byte-for-byte, except that runtime assets live on disk.
    index = contents(ROOT / 'dev.html')
    html = old
    first_style_tag = re.search(rb'<style\b[^>]*>.*?</style\s*>', html, re.I | re.S)
    assert first_style_tag
    style_tags = list(re.finditer(rb'<style\b[^>]*>.*?</style\s*>', html, re.I | re.S))
    script_tags = list(re.finditer(rb'<script\b[^>]*>.*?</script\s*>', html, re.I | re.S))
    expected = html.replace(style_tags[0].group(), '\n'.join(
        '<link rel="stylesheet" href="styles/%s">' % f for f in css_files[:-1]
    ).encode(), 1)
    expected = expected.replace(style_tags[1].group(),
        b'<link rel="stylesheet" id="directors-cut-style" href="styles/70-directors-cut.css">', 1)
    expected = expected.replace(script_tags[0].group(), b'<script src="dist/game.js"></script>', 1)
    expected = expected.replace(script_tags[1].group(), b'<script src="dist/legacy-notes.js"></script>', 1)
    if index != expected:
        fail('dev.html has changed relative to original markup or source references.')


def main() -> int:
    parser = argparse.ArgumentParser(description='NEON RIFT 3D offline build')
    parser.add_argument('--check', action='store_true', help='Verify dist/game.js matches sources; do not write files')
    parser.add_argument('--verify-original', action='store_true', help='Also verify byte-perfect original JS/CSS/HTML')
    args = parser.parse_args()

    out = assembled()
    page = standalone_html(out)
    if args.check:
        if not (DIST / 'game.js').exists() or contents(DIST / 'game.js') != out:
            fail('dist/game.js is outdated; run python tools/build.py')
        if not (ROOT / 'index.html').exists() or contents(ROOT / 'index.html') != page:
            fail('index.html is outdated; run python tools/build.py')
    else:
        DIST.mkdir(parents=True, exist_ok=True)
        (DIST / 'game.js').write_bytes(out)
        (ROOT / 'index.html').write_bytes(page)

    if args.verify_original:
        verify_original(out)
        if page != contents(REFERENCE):
            fail('Standalone index.html differs from original HTML baseline.')

    text = 'CHECK OK' if args.check else 'BUILD OK'
    print(f'{text}: {len(MANIFEST["moduleOrder"])} JS modules -> dist/game.js ({len(out):,} bytes) and standalone index.html ({len(page):,} bytes)')
    print(f'SHA-256: {digest(out)}')
    if args.verify_original:
        print('ORIGINAL MATCH: HTML, JS and CSS are byte-for-byte preserved.')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as err:
        print(f'ERROR: {err}', file=sys.stderr)
        sys.exit(1)
