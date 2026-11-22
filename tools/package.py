#!/usr/bin/env python3
"""Rebuild, run structural tests, refresh hashes and create one project ZIP.

Standard Python only. Playwright is optional, never required for packaging.
Run from any working directory:
  python tools/package.py --output ../NEON_RIFT_3D.zip
"""
from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INCLUDE_ROOT = (
    'QUALITY_STAGE130_HOST_LAUNCH_RU.md',
    'QUALITY_STAGE129_CHAT_KEYBOARD_RESTORE_RU.md',
    'QUALITY_STAGE128_SHARED_CHAT_SCROLL_RU.md',
    'QUALITY_STAGE127_CHAT_TOUCH_HISTORY_RU.md',
    'QUALITY_STAGE126_CHAT_IME_COMPOSER_RU.md',
    'QUALITY_STAGE125_MOBILE_CHAT_INPUT_RU.md',
    'QUALITY_STAGE122_ROOM_CHAT_RU.md',
    'QUALITY_STAGE121_SHARED_EFFECT_LIFECYCLE_RU.md',
    'QUALITY_STAGE120_PVP_EFFECT_PARITY_RU.md',
    'QUALITY_STAGE119_SHARED_EMI_EFFECT_RU.md',
    'QUALITY_STAGE118_PVP_PRACTICE_RU.md',
    'QUALITY_STAGE117_MAP_PREVIEW_RU.md',
    'QUALITY_STAGE116_MAP_FAMILIES_RU.md',
    'QUALITY_STAGE115_MENU_ESC_AND_100_MAPS_RU.md',
    'MAP_CATALOG_RU.md',
    'QUALITY_STAGE114_TEST_READY_AUDIT_RU.md',
    'QUALITY_STAGE113_PHYSICAL_CONTACT_AND_GUIDANCE_RU.md',
    'QUALITY_STAGE112_CONTINUOUS_CIRCULAR_SWEEPS_RU.md',
    'QUALITY_STAGE111_PHYSICAL_NAVIGATION_INTERVALS_RU.md',
    'QUALITY_STAGE110_EXACT_LOW_METAL_CONTACTS_RU.md',
    'QUALITY_STAGE109_FULL_BODY_TERRAIN_CONTACTS_RU.md',
    'QUALITY_STAGE108_BRIDGE_STAIR_TRANSITIONS_RU.md',
    'QUALITY_STAGE107_FULL_BODY_DECK_EDGES_RU.md',
    'QUALITY_STAGE106_SOLID_STAIR_OCCLUSION_RU.md',
    'QUALITY_STAGE105_TRUE_ROBOT_HEADROOM_RU.md',
    'QUALITY_STAGE104_PHYSICAL_ROBOT_DEBRIS_RU.md',
    'QUALITY_STAGE103_PHYSICAL_GROUND_NAVIGATION_RU.md',
    'QUALITY_STAGE102_CHASSIS_AWARE_UPPER_ROUTES_RU.md',
    'QUALITY_STAGE101_PHYSICAL_UPPER_NAVIGATION_RU.md',
    'QUALITY_STAGE100_PHYSICAL_EXTRACTION_BOUNDARIES_RU.md',
    'QUALITY_STAGE99_PHYSICAL_LOOT_EQUIPMENT_RU.md',
    'QUALITY_STAGE98_SIGNAL_RESONANCE_MISSIONS_RU.md',
    'QUALITY_STAGE97_TWO_PHASE_PHYSICAL_OPERATIONS_RU.md',
    'QUALITY_STAGE96_CHECKPOINT_PHYSICAL_ACTOR_RECOVERY_RU.md',
    'QUALITY_STAGE95_PHYSICAL_ROBOT_SPAWNS_RU.md',
    'QUALITY_STAGE94_PHYSICAL_HAZARD_COVER_RU.md',
    'QUALITY_STAGE93_PHYSICAL_MISSION_CONTACTS_RU.md',
    'QUALITY_STAGE92_PHYSICAL_EXTRACTION_ROUTES_RU.md',
    'QUALITY_STAGE91_REACTOR_NAV_CACHE_COHERENCE_RU.md',
    'QUALITY_STAGE90_PHYSICAL_TERRAIN_SHORTCUTS_RU.md',
    'QUALITY_STAGE89_PHYSICAL_ENEMY_DIRECT_ROUTES_RU.md',
    'QUALITY_STAGE88_CANVAS_EQUIPMENT_VERTICAL_PHYSICS_RU.md',
    'QUALITY_STAGE87_PHYSICAL_ARCHIVE_PLINTHS_RU.md',
    'QUALITY_STAGE86_PHYSICAL_EQUIPMENT_HULLS_RU.md',
    'QUALITY_STAGE85_SEQUENCED_TACTICAL_OPERATIONS_RU.md',
    'QUALITY_STAGE84_TACTICAL_MISSION_ROUTES_RU.md',
    'QUALITY_STAGE83_PHYSICAL_EXTRACTION_DEFENCES_RU.md',
    'QUALITY_STAGE82_PHYSICAL_RELAY_FORTS_RU.md',
    'QUALITY_STAGE81_PHYSICAL_ORDINARY_COURTS_RU.md',
    'QUALITY_STAGE80_PHYSICAL_BOSS_COURTS_RU.md',
    'QUALITY_STAGE79_TRUE_CIRCULAR_WALL_CONTACT_RU.md',
    'QUALITY_STAGE78_MULTIPLAYER_PROJECTILE_COLLISION_RU.md',
    'QUALITY_STAGE77_WALL_CELL_ROCKET_PHYSICS_RU.md',
    'QUALITY_STAGE76_HUNDRED_REAL_ARMOURED_GUNPORTS_RU.md',
    'QUALITY_STAGE75_HUNDRED_WALL_ANCHORED_PHYSICAL_CANTILEVERS_RU.md',
    'QUALITY_STAGE74_HUNDRED_REAL_GROUND_COMBAT_BASTIONS_RU.md',
    'QUALITY_STAGE73_HUNDRED_PHYSICAL_TACTICAL_SENTINELS_RU.md',
    'QUALITY_STAGE72_EIGHTY_PHYSICAL_YARD_GATEHOUSES_RU.md',
    'QUALITY_STAGE71_TWENTY_PHYSICAL_BOSS_SIEGE_FORTS_RU.md',
    'QUALITY_STAGE70_EIGHTY_PHYSICAL_SKY_TRUSSES_RU.md',
    'QUALITY_STAGE69_TWENTY_BOSS_GROUND_APPROACHES_RU.md',
    'QUALITY_STAGE68_EIGHTY_SECONDARY_COMBAT_YARDS_RU.md',
    'QUALITY_STAGE67_MONUMENTAL_BOSS_FLIGHT_ARENAS_RU.md',
    'QUALITY_STAGE66_ELEVATED_TACTICAL_ROUTES_RU.md',
    'QUALITY_STAGE65_EIGHT_TACTICAL_GROUNDS_RU.md',
    'QUALITY_STAGE64_PHYSICAL_BALCONY_IDENTITIES_RU.md',
    'QUALITY_STAGE63_DISTINCT_INDUSTRIAL_WORLD_ROUTES_RU.md',
    'QUALITY_STAGE62_WALKABLE_WORLD_FAMILIES_RU.md',
    'QUALITY_STAGE61_ARCHITECTURE_REBUILD_I_RU.md',
    'QUALITY_STAGE60_WORLD_PHYSICS_AUDIT_RU.md',
    'QUALITY_STAGE59_PHYSICAL_PASSAGE_GATES_RU.md',
    'QUALITY_STAGE58_PHYSICAL_ROOF_BATTLEMENTS_RU.md',
    'QUALITY_STAGE57_AUTONOMOUS_ROOF_NAV_RU.md',
    'index.html', 'dev.html', 'README_RU.md', 'ARCHITECTURE_RU.md', 'QUALITY_STAGE36_MP4_RU.md', 'QUALITY_STAGE37_MP5_RU.md', 'QUALITY_STAGE38_MP6_RU.md', 'QUALITY_STAGE39_MP7_RU.md', 'QUALITY_STAGE40_MP8_RU.md', 'QUALITY_STAGE41_MP9_RU.md', 'QUALITY_STAGE42_METERED_RU.md', 'QUALITY_STAGE43_MP10_RU.md', 'QUALITY_STAGE44_REPAIR_BARRIER_RU.md', 'QUALITY_STAGE45_MUZZLE_FX_RU.md', 'QUALITY_STAGE46_FPS_MOBILE_RU.md', 'QUALITY_STAGE47_MP_HIT_FX_RU.md', 'QUALITY_STAGE48_ALL_MODES_HIT_FX_RU.md', 'QUALITY_STAGE49_FLIGHT_HUD_RU.md', 'QUALITY_STAGE50_BALCONY_WORLDS_RU.md', 'QUALITY_STAGE51_CONNECTED_GALLERIES_RU.md', 'QUALITY_STAGE52_SHAPED_UPPER_ARENAS_RU.md', 'QUALITY_STAGE53_ALTERNATIVE_STAIRS_RU.md', 'QUALITY_STAGE54_PHYSICAL_MIDLEVEL_TERRACES_RU.md', 'QUALITY_STAGE55_ROOFED_GUARDHOUSES_RU.md', 'QUALITY_STAGE56_WALKABLE_ROOF_ESCAPES_RU.md',
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
        subprocess.run(['node', 'tests/test_stage121_shared_effect_lifecycle.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage120_pvp_effect_parity.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage119_pulse_fx.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage117_preview_worlds.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage115_network_catalog.cjs'], cwd=ROOT, check=True)
        for first in range(1, 101, 25):
            subprocess.run(['node', 'tests/test_stage115_catalog_spawns.cjs'], cwd=ROOT, check=True, env={**os.environ, 'LEVELS': ','.join(map(str, range(first, first+25)))})
        subprocess.run(['node', 'tests/test_stage114_vertical_actors.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage113_dynamic_contacts_guidance.cjs'], cwd=ROOT, check=True)
        for a,b in ((1,20),(21,40),(41,60),(61,80),(81,100)):
            subprocess.run(['node','tests/test_stage113_real_guidance.cjs'], cwd=ROOT, check=True,
                           env={**__import__('os').environ,'LEVELS':','.join(map(str,range(a,b+1)))})
        subprocess.run(['node', 'tests/test_stage112_continuous_contacts.cjs'], cwd=ROOT, check=True)
        for a,b in ((1,20),(21,40),(41,60),(61,80),(81,100)):
            subprocess.run(['node','tests/test_stage112_real_continuous_contacts.cjs'], cwd=ROOT, check=True,
                           env={**__import__('os').environ,'LEVELS':','.join(map(str,range(a,b+1)))})
        subprocess.run(['node', 'tests/test_stage111_physical_navigation_intervals.cjs'], cwd=ROOT, check=True)
        for a,b in ((1,20),(21,40),(41,60),(61,80),(81,100)):
            subprocess.run(['node','tests/test_stage111_real_navigation_intervals.cjs'], cwd=ROOT, check=True,
                           env={**__import__('os').environ,'LEVELS':','.join(map(str,range(a,b+1)))})
        subprocess.run(['node', 'tests/test_stage110_low_metal_contacts.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage109_terrain_body.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage108_bridge_stair_entry.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage107_deck_edge_vertical.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage106_opaque_stair_faces.cjs'], cwd=ROOT, check=True)
        for a,b in ((1,10),(11,20),(21,30),(31,40),(41,50),
                    (51,60),(61,70),(71,80),(81,90),(91,100)):
            subprocess.run(['node','tests/test_stage106_real_stair_seals.cjs'],
                           cwd=ROOT,check=True,
                           env={**__import__('os').environ,'FIRST':str(a),'LAST':str(b)})
        subprocess.run(['node', 'tests/test_stage105_robot_headroom.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage105_render_mesh_bounds.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage104_debris_world_collisions.cjs'], cwd=ROOT, check=True)
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
        subprocess.run(['node', 'tests/test_stage50_balcony_worlds.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage51_connected_galleries.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage52_shaped_upper_arenas.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage53_alternative_stairs.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage54_physical_midlevel_terraces.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage55_roofed_guardhouses.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage56_walkable_roof_escapes.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage57_autonomous_roof_navigation.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage58_physical_roof_battlements.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage59_physical_passage_gates.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage60_full_world_physics_audit.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage61_distinct_landmarks_boss_scale.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage62_six_unique_walking_worlds.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage63_four_distinct_industrial_arena_routes.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage64_physical_balcony_identities.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage65_eight_tactical_ground_routes.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage66_elevated_tactical_routes.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage67_monumental_boss_flight_arena.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage68_eighty_secondary_combat_yards.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage69_twenty_boss_ground_approaches.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage70_eighty_physical_canopy_silhouettes.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage71_twenty_physical_boss_siege_forts.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage71_medium_quality_physical_siege.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage72_eighty_real_defensive_gatehouses.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage73_one_hundred_physical_sentinels.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage74_one_hundred_real_ground_bastions.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage75_one_hundred_real_wall_suspended_gantries.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage76_one_hundred_real_armoured_firing_ports.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage77_wall_cell_sphere_collisions.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage77_world_sweep_regression.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage78_multiplayer_projectile_volumes.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage79_true_circular_wall_collision.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage80_physical_boss_courts.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage81_physical_ordinary_courts.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage82_physical_relay_forts.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage83_extraction_courts.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage83_baseline_preservation.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage84_mission_geography.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage85_mission_operations.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage86_equipment_physics.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage87_physical_archive_plinths.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage88_canvas_vertical_equipment.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage88_world_equipment_vertical.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage89_canvas_enemy_equipment_routes.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage90_canvas_steep_shortcut.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage90_actual_terrain_routes.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage101_upper_physics.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage101_real_upper_routes.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage100_physical_portal_contact.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage100_precision_loot_contact.cjs'], cwd=ROOT, check=True)
        for a,b in ((1,20),(21,40),(41,60),(61,80),(81,100)):
            levels=','.join(map(str,range(a,b+1)))
            subprocess.run(['node','tests/test_stage100_real_physical_extraction.cjs'],
                           cwd=ROOT,check=True,env={**__import__('os').environ,'LEVELS':levels})
        subprocess.run(['node', 'tests/test_stage99_loot_world_physics.cjs'], cwd=ROOT, check=True)
        for a,b in ((1,20),(21,40),(41,60),(61,80),(81,100)):
            levels=','.join(map(str,range(a,b+1)))
            subprocess.run(['node','tests/test_stage99_actual_loot_world.cjs'],
                           cwd=ROOT,check=True,env={**__import__('os').environ,'LEVELS':levels})
        subprocess.run(['node', 'tests/test_stage98_signal_surge_operations.cjs'], cwd=ROOT, check=True)
        for levels in ('13,17,23,27','33,37,43,47','53,57,63,67',
                       '73,77,83,87','93,97'):
            subprocess.run(['node','tests/test_stage98_actual_signal_surge.cjs'],
                           cwd=ROOT,check=True,env={**__import__('os').environ,'LEVELS':levels})
        subprocess.run(['node', 'tests/test_stage97_two_phase_operations.cjs'], cwd=ROOT, check=True)
        for levels in ('12,16,22','26,32,36','42,46,52','56,62,66','72,76,82','86,92,96'):
            subprocess.run(['node','tests/test_stage97_actual_two_phase_missions.cjs'],
                           cwd=ROOT, check=True, env={**__import__('os').environ,'LEVELS':levels})
        subprocess.run(['node', 'tests/test_stage96_checkpoint_actor_recovery.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage95_spawn_hulls_and_intel.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage95_actual_spawn_safety.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage94_physical_hazard_cover.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage94_real_hazard_cover.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage93_physical_interaction_and_targets.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage93_real_mission_interactions.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_stage89_actual_npc_equipment_routes.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tools/continuous_campaign_audit.cjs'], cwd=ROOT, check=True)
        subprocess.run(['node', 'tests/test_world_scenes.cjs'], cwd=ROOT, check=True)
    if args.browser_tests:
        command('tests/test_stage129_chat_keyboard_restore.py')
        command('tests/test_stage128_shared_chat_scroll.py')
        command('tests/test_stage127_chat_touch_scroll.py')
        command('tests/test_stage126_chat_composer_keyboard.py')
        command('tests/test_stage125_chat_keyboard_layout.py')
        command('tests/test_stage122_chat_browser.py')
        command('tests/browser_stage103_ground_chassis.py')
        command('tests/browser_stage110_low_metal.py')
        command('tests/browser_stage109_terrain_edges.py')
        command('tests/browser_stage108_bridge_stair_transitions.py')
        command('tests/browser_stage107_deck_edges.py')
        command('tests/browser_stage106_stair_occlusion.py')
        command('tests/browser_stage105_robot_headroom.py')
        command('tests/browser_stage101_upper_navigation.py')
        command('tests/browser_smoke.py')
        command('tests/browser_stage117_map_preview.py')
        command('tests/browser_stage116_map_families.py')
        command('tests/browser_stage115_menus_catalog.py')
        command('tests/browser_stage115_all_menu_actions.py')
        command('tests/browser_stage114_save_recovery.py')
        command('tests/browser_stage113_dynamic_guidance.py')
        command('tests/browser_stage112_continuous_contacts.py')
        command('tests/browser_stage85_mission_routes.py')
        command('tests/browser_stage87_archive_plinths.py')
        command('tests/browser_stage88_canvas_vertical_equipment.py')
        command('tests/browser_stage89_canvas_robot_routes.py')
        command('tests/browser_stage92_physical_guidance.py')
        command('tests/browser_stage93_physical_mission_contacts.py')
        command('tests/browser_stage96_checkpoint_physics.py')
        command('tests/browser_stage100_physical_extraction.py')
        command('tests/browser_stage99_physical_loot.py')
        command('tests/browser_stage98_signal_surge.py')
        command('tests/browser_stage97_two_phase_operations.py')
        command('tests/browser_stage95_physical_spawn_target.py')
        command('tests/browser_stage94_physical_hazard_cover.py')
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
