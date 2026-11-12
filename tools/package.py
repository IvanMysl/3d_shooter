#!/usr/bin/env python3
"""Rebuild, run structural tests, refresh hashes and create one project ZIP.

Standard Python only. Playwright is optional, never required for packaging.
Run from any working directory:
  python tools/package.py --output ../NEON_RIFT_3D.zip
"""
from __future__ import annotations

import argparse
import hashlib
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INCLUDE_ROOT = (
    'index.html', 'dev.html', 'README_RU.md', 'ARCHITECTURE_RU.md',
    'SOURCE_NAVIGATION_RU.md', 'REBUILD.bat', 'PACKAGE.bat',
)
INCLUDE_DIRS = ('dist', 'src', 'styles', 'tools', 'tests', 'reference')


def command(*parts: str) -> None:
    subprocess.run([sys.executable, *parts], cwd=ROOT, check=True)


def included() -> list[Path]:
    files = [ROOT / name for name in INCLUDE_ROOT]
    for folder in INCLUDE_DIRS:
        files.extend(p for p in (ROOT / folder).rglob('*')
                     if p.is_file() and '__pycache__' not in p.parts
                     and not p.name.startswith('.'))
    for file in files:
        if not file.is_file():
            raise FileNotFoundError(file)
    return sorted(set(files), key=lambda p: p.relative_to(ROOT).as_posix())


def make_sums(files: list[Path]) -> None:
    data = ''.join(hashlib.sha256(p.read_bytes()).hexdigest() + '  ' +
                   p.relative_to(ROOT).as_posix() + '\n' for p in files)
    (ROOT / 'SHA256SUMS.txt').write_text(data, encoding='utf-8')


def make_zip(output: Path, files: list[Path]) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    all_files = [ROOT / 'index.html', *sorted(
        (p for p in [*files, ROOT / 'SHA256SUMS.txt'] if p.name != 'index.html'),
        key=lambda p: p.relative_to(ROOT).as_posix())]
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED,
                         compresslevel=9, strict_timestamps=False) as z:
        for file in all_files:
            z.write(file, arcname=file.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(output) as z:
        corrupt = z.testzip()
        if corrupt:
            raise RuntimeError('Broken archive member: ' + corrupt)
        names = z.namelist()
        if names[0] != 'index.html' or len(names) != len(set(names)):
            raise RuntimeError('Invalid ZIP launcher or duplicate paths')
        for path in files:
            rel = path.relative_to(ROOT).as_posix()
            if z.read(rel) != path.read_bytes():
                raise RuntimeError('ZIP content mismatch: ' + rel)
    print(f'ZIP OK: {output} ({len(all_files)} files, {output.stat().st_size:,} bytes)')


def main():
    ap = argparse.ArgumentParser(description='NEON RIFT: tested project ZIP')
    ap.add_argument('--output', type=Path,
                    default=ROOT.parent / 'NEON_RIFT_3D_MODULAR.zip')
    ap.add_argument('--browser-tests', action='store_true',
                    help='Optional: run Playwright Chromium smoke tests')
    args = ap.parse_args()
    command('tools/build.py')
    command('tools/build.py', '--check')
    command('tests/test_integrity.py')
    if args.browser_tests:
        command('tests/browser_smoke.py')
    files = included()
    make_sums(files)
    make_zip(args.output.resolve(), files)


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(f'PACKAGE ERROR: {exc}', file=sys.stderr)
        sys.exit(1)
