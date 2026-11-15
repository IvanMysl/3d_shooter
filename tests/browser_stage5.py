#!/usr/bin/env python3
"""Stage 5 runtime smoke for live robots, silhouettes and projectile tracing.
These cases use the sandbox Canvas fallback; software/hardware WebGL not verified.
"""
from playwright.sync_api import sync_playwright
from browser_smoke import load

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    try:
        for file in ('index.html','dev.html'):
            for mobile in (False,True):
                context=browser.new_context(viewport={'width':390 if mobile else 1365,'height':844 if mobile else 768},is_mobile=mobile,has_touch=mobile)
                page=context.new_page()
                errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                load(page,file)
                result=page.evaluate('''() => {
                  const test=window.__neonTest;
                  test.debugStart();
                  const p=test.playerPos();
                  const drone=test.debugDrone();
                  const scale=Math.max(.76,Math.min(1.31,.48/.51));
                  const hit=test.traceRobot(p.x+2,drone.y+1.03*scale,p.z+4,1,0,0,8);
                  const miss=test.traceRobot(p.x+2,drone.y+12,p.z+4,1,0,0,8);
                  return {drone,hit,miss,state:test.getState(),count:test.weaponList().length};
                }''')
                assert result['state']['state']=='playing',result
                assert result['drone']['type']=='drone',result
                assert result['count']==10,result
                assert result['hit'] and result['hit']['type']=='drone',result
                assert result['hit']['part'] in ('torso','head','wing','thruster'),result
                assert result['miss'] is None,result
                page.wait_for_timeout(240)
                assert not errors,(file,mobile,errors)
                print(f'STAGE5 {file} / {"MOBILE" if mobile else "DESKTOP"}: live robot silhouette trace and off-body miss OK')
                context.close()
    finally:
        browser.close()
