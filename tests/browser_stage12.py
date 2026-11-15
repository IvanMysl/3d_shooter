#!/usr/bin/env python3
"""Stage 12: climb full overpass and descend with both built game launchers.

Chromium may use Canvas fallback. Exact rendered-mesh contact is covered by
test_stage12_stair_access.cjs; this also tests the assembled browser bundle.
"""
from playwright.sync_api import sync_playwright
from browser_smoke import load


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True, executable_path='/usr/bin/chromium',
        args=['--no-sandbox', '--disable-dev-shm-usage'])
    try:
        for filename in ('index.html', 'dev.html'):
            for mobile in (False, True):
                ctx = browser.new_context(
                    viewport={'width': 390 if mobile else 1365,
                              'height': 844 if mobile else 768},
                    is_mobile=mobile, has_touch=mobile)
                page = ctx.new_page()
                errors = []
                page.on('pageerror', lambda exc: errors.append(str(exc)))
                load(page, filename)
                result = page.evaluate('''() => {
                    const t=window.__neonTest;
                    t.debugStart();
                    const stage=t.debugSector(15);
                    const traverse=t.debugTraverse(220);
                    const descent=t.debugDrop(190);
                    return {stage,traverse,descent,
                      webgl:t.mapInfo().webgl,state:t.getState().state};
                }''')
                assert result['stage']['style'] == 14, result
                assert result['traverse']['y'] > 2.14, result
                assert result['traverse']['x'] < result['traverse']['samples'][0][1]-8, result
                assert result['descent']['z'] > result['descent']['samples'][0][1]+4, result
                assert result['descent']['y'] < 2.15, result
                assert result['state'] == 'playing', result
                assert not errors, (filename, mobile, errors)
                print('STAGE12', filename, 'MOBILE' if mobile else 'DESKTOP',
                      'full climb and safe descent OK',
                      'WebGL' if result['webgl'] else 'Canvas fallback')
                ctx.close()
    finally:
        browser.close()
