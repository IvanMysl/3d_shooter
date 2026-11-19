#!/usr/bin/env python3
"""Rebuild, run structural tests, refresh hashes and create one project ZIP.

Standard Python only. Playwright is optional, never required for packaging.
Run from any working directory:
  python tools/package.py --output ../NEON_RIFT_3D.zip
"""
from __future__ import annotations

import argparse
import hashlib
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INCLUDE_ROOT = (
    'index.html', 'dev.html', 'README_RU.md', 'ARCHITECTURE_RU.md', 'QUALITY_STAGE36_MP4_RU.md', 'QUALITY_STAGE37_MP5_RU.md', 'QUALITY_STAGE38_MP6_RU.md', 'QUALITY_STAGE39_MP7_RU.md', 'QUALITY_STAGE40_MP8_RU.md', 'QUALITY_STAGE41_MP9_RU.md', 'QUALITY_STAGE42_METERED_RU.md', 'QUALITY_STAGE43_MP10_RU.md', 'QUALITY_STAGE44_REPAIR_BARRIER_RU.md', 'QUALITY_STAGE45_MUZZLE_FX_RU.md', 'QUALITY_STAGE46_FPS_MOBILE_RU.md', 'QUALITY_STAGE47_MP_HIT_FX_RU.md', 'QUALITY_STAGE48_ALL_MODES_HIT_FX_RU.md', 'QUALITY_STAGE49_FLIGHT_HUD_RU.md',
    'SOURCE_NAVIGATION_RU.md', 'FINAL_TEST_GUIDE_RU.md', 'GITHUB_PAGES_UPDATE_RU.md', 'BALANCE_LEVEL_BY_LEVEL_RU.md', 'WEAPON_VALUE_AUDIT_RU.md', 'QUALITY_STAGE3_RU.md', 'QUALITY_STAGE4_RU.md', 'QUALITY_STAGE5_RU.md', 'QUALITY_STAGE6_RU.md', 'QUALITY_STAGE7_RU.md', 'QUALITY_STAGE8_RU.md', 'QUALITY_STAGE9_RU.md', 'QUALITY_STAGE10_RU.md', 'QUALITY_STAGE11_RU.md', 'QUALITY_STAGE12_RU.md', 'QUALITY_STAGE13_RU.md', 'QUALITY_STAGE14_RU.md', 'QUALITY_STAGE15_RU.md', 'QUALITY_STAGE16_RU.md', 'QUALITY_STAGE17_RU.md', 'QUALITY_STAGE18_RU.md', 'QUALITY_STAGE19_RU.md', 'QUALITY_STAGE20_RU.md', 'QUALITY_STAGE21_RU.md', 'QUALITY_STAGE22_RU.md', 'QUALITY_STAGE23_RU.md', 'QUALITY_STAGE24_RU.md', 'QUALITY_STAGE25_RU.md', 'QUALITY_STAGE26_RU.md', 'QUALITY_STAGE27_RU.md', 'QUALITY_STAGE28_RU.md', 'QUALITY_STAGE29_RU.md', 'QUALITY_STAGE30_RU.md', 'QUALITY_STAGE31_RU.md', 'QUALITY_STAGE32_RU.md', 'QUALITY_STAGE33_MP1_RU.md', 'QUALITY_STAGE34_MP2_RU.md', 'QUALITY_STAGE35_MP3_RU.md', 'MULTIPLAYER_SETUP_RU.md', 'ROADMAP_EXPANSION_RU.md', 'REBUILD.bat', 'PACKAGE.bat',
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


def refresh_combat_reports() -> None:
    """Keep delivered 100-level / weapon tables synchronized with real code."""
    if not shutil.which('node'):
        return
    for script, destination in (
        ('balance_audit.cjs', 'BALANCE_LEVEL_BY_LEVEL_RU.md'),
        ('weapon_value_audit.cjs', 'WEAPON_VALUE_AUDIT_RU.md'),
    ):
        result = subprocess.run(['node', f'tools/{script}', '--markdown'],
                                cwd=ROOT, check=True, capture_output=True,
                                text=True, encoding='utf-8')
        (ROOT / destination).write_text(result.stdout, encoding='utf-8')


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
                    help='Optional: run Playwright Chromium smoke and stage regression tests')
    args = ap.parse_args()
    command('tools/build.py')
    command('tools/build.py', '--check')
    command('tests/test_integrity.py')
    command('-m','unittest','discover','-s','tests','-p','test_*.py')
    if shutil.which('node'):
        subprocess.run(['node', 'tests/test_combat_physics.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_area_damage.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_robot_hit_geometry.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_third_person.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_world_solids.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage6_precision.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage7_contact_motion.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage8_enemy_cover.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage9_enemy_navigation.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage9_world_navigation.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage10_enemy_crowds.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage11_spawn_safety.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage12_stair_access.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage13_controls_upgrades.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage14_developer_flight.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage15_flying_robots.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage16_smooth_models.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage17_visual_effects.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage18_dash_distance.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage19_operator_pause_armor.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage20_keybindings_flight.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage21_support_balance.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage22_economy_balance.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tools/balance_audit.cjs', '--check'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage23_deep_balance.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tools/weapon_value_audit.cjs', '--check'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage24_end_to_end_balance.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage25_priority_flight_idle.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage25_mobile_controls.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage26_emp_barrier_keymap.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage27_growth_save_migration.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage28_repair_shield_hangar.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage29_hangar_categories.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage30_mobile_pause_settings.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage31_pending_reward_navigation.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage32_update_save_guard.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage33_mp1_lobby.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage34_mp2_peer.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage35_mp3_movement.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage36_mp4_combat.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage37_mp5_rounds.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage38_mp6_abilities.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage39_mp7_smoothing.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage40_mp8_recovery.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage41_mp9_signal_mobile.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage42_metered_config.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage43_mp10_traffic_repair.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage44_atomic_repair_barrier.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage45_muzzle_fx.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage46_fps_muzzle_mobile.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage47_pvp_hit_fx.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage48_all_modes_hit_reaction.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage49_mobile_flight_arsenal.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tools/continuous_campaign_audit.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_world_scenes.cjs'], cwd=ROOT, check=True)
    if args.browser_tests:
        command('tests/browser_smoke.py')
        command('tests/browser_stage1.py')
        command('tests/browser_stage2.py')
        command('tests/browser_stage3.py')
        command('tests/browser_stage4.py')
        command('tests/browser_stage5.py')
        command('tests/browser_stage6.py')
        command('tests/browser_stage7.py')
        command('tests/browser_stage8.py')
        command('tests/browser_stage9.py')
        command('tests/browser_stage10.py')
        command('tests/browser_stage11.py')
        command('tests/browser_stage12.py')
        command('tests/browser_stage13.py')
        command('tests/browser_stage14.py')
        command('tests/browser_stage15.py')
        command('tests/browser_stage48.py')
    refresh_combat_reports()
    files = included()
    make_sums(files)
    make_zip(args.output.resolve(), files)


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(f'PACKAGE ERROR: {exc}', file=sys.stderr)
        sys.exit(1)
