#!/usr/bin/env python3
"""Optional real Chromium check: airborne adversaries in 4 offline launchers."""
from playwright.sync_api import sync_playwright
from browser_smoke import load

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True, executable_path='/usr/bin/chromium',
        args=['--no-sandbox', '--disable-dev-shm-usage'])
    try:
        for launcher in ('index.html', 'dev.html'):
            for mobile in (False, True):
                context = browser.new_context(
                    viewport={'width': 390 if mobile else 1365,
                              'height': 844 if mobile else 768},
                    is_mobile=mobile, has_touch=mobile)
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda exc: errors.append(str(exc)))
                load(page, launcher)
                # No ordinary-game test cheats: summon is gated behind DEV.
                assert page.evaluate("window.__neonTest.developerSummonFlyer('skyhunter')") is None
                page.locator('#devToggle').click()
                page.locator('#devPass').fill('tamu')
                page.locator('#devLogin').click()
                page.wait_for_function('window.__neonTest.developerFlightStatus().developerMode')
                report = page.evaluate("""() => {
                  const t=window.__neonTest;
                  t.debugSector(34); // 15-m ceiling, 3 aerial classes available.
                  const entered=t.developerFlightStatus();
                  const types=['drone','skyhunter','skyguard','stormray'];
                  const summoned=types.map(type=>t.developerSummonFlyer(type));
                  return {entered,summoned,air:t.airRobotStatus()};
                }""")
                assert report['entered']['ceilingHeight'] > 10, report
                assert all(item is not None for item in report['summoned']), report
                assert len(report['air']) == 4, report
                page.wait_for_timeout(750)
                airborne = page.evaluate('window.__neonTest.airRobotStatus()')
                assert len(airborne) == 4, airborne
                assert any(bot['altitude'] > old['altitude'] + .05
                           for bot, old in zip(airborne, report['air'])), (report, airborne)
                assert not errors, (launcher, mobile, errors)
                print('STAGE15', launcher, 'mobile' if mobile else 'desktop',
                      'DEV-gated spawns, four flying classes, real-time altitude, no JS errors')
                context.close()
    finally:
        browser.close()
