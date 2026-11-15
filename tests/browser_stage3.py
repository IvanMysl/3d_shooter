#!/usr/bin/env python3
"""Stage 3: exercise shared projectile traces in both browser launchers.

Uses Canvas fallback in this sandbox; actual WebGL solid geometry is covered
in tests/test_world_scenes.cjs with the real procedural scene builder.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_smoke import load

ROOT=Path(__file__).resolve().parent.parent
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',
             args=['--no-sandbox','--disable-dev-shm-usage'])
    try:
        for launcher in ('index.html','dev.html'):
            for mobile in (False,True):
                ctx=browser.new_context(viewport={'width':390 if mobile else 1365,
                    'height':844 if mobile else 768},is_mobile=mobile,has_touch=mobile)
                page=ctx.new_page()
                errors=[]
                page.on('pageerror',lambda err:errors.append(str(err)))
                load(page,launcher)
                page.evaluate('window.__neonTest.debugStart()')
                result=page.evaluate('''() => {
                  const st=window.__neonTest.getState();
                  const p=window.__neonTest.playerPos();
                  const down=window.__neonTest.traceWorld(p.x,1.7,p.z,0,-1,0,4,.20);
                  const up=window.__neonTest.traceWorld(p.x,1.7,p.z,0,1,0,6,.20);
                  const solids=window.__neonTest.worldSolids();
                  return {state:st.state,down,up,solids};
                }''')
                assert result['state']=='playing',result
                assert result['down'] and result['down']['kind'] in ('floor','stairs','bridge'),result
                assert result['up'] and result['up']['kind']=='ceiling',result
                assert result['solids']['boxes']==0 and not result['solids']['webgl'],result
                page.wait_for_timeout(200)
                assert not errors,errors
                print(f'STAGE3 {launcher} / {"MOBILE" if mobile else "DESKTOP"}: '
                      f'finite-radius floor/roof traces and fallback scene OK')
                ctx.close()
    finally:
        browser.close()
