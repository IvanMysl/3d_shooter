#!/usr/bin/env python3
"""Stage 6: module-bundle smoke and gameplay after the new swept-sphere solver.

Uses Chromium Canvas fallback. Precise WebGL solid-mesh collision is tested
in tests/test_stage6_precision.cjs against the actual JS collision functions.
"""
from playwright.sync_api import sync_playwright
from browser_smoke import load

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',
        args=['--no-sandbox','--disable-dev-shm-usage'])
    try:
        for launcher in ('index.html','dev.html'):
            for mobile in (False,True):
                context=browser.new_context(viewport={'width':390 if mobile else 1365,
                    'height':844 if mobile else 768},is_mobile=mobile,has_touch=mobile)
                page=context.new_page()
                errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                load(page,launcher)
                result=page.evaluate('''() => {
                  window.__neonTest.debugStart();
                  const api=window.__neonTest;
                  const p=api.playerPos();
                  const floor=api.traceWorld(p.x,1.6,p.z,0,-1,0,4,.20);
                  const safe=api.traceWorld(p.x,2.3,p.z,0,1,0,2,.15);
                  const drone=api.debugDrone();
                  const hit=api.traceRobot(p.x+2,drone.y+1.03*.94,p.z+4,1,0,0,8);
                  return {state:api.getState().state,floor,safe,drone,hit,
                    weapons:api.weaponList().length,solids:api.worldSolids()};
                }''')
                assert result['state']=='playing',result
                assert result['floor'] and result['floor']['kind'] in ('floor','stairs','bridge'),result
                assert result['weapons']==10,result
                assert result['drone']['type']=='drone',result
                assert result['hit'] and result['hit']['type']=='drone',result
                assert result['solids']['webgl']==False,result
                page.wait_for_timeout(180)
                assert not errors,(launcher,mobile,errors)
                print(f'STAGE6 {launcher} / {"MOBILE" if mobile else "DESKTOP"}: '
                      'real bundle, rounded floor sweep, robot accessory, no page errors')
                context.close()
    finally:
        browser.close()
