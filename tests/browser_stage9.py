#!/usr/bin/env python3
"""Stage 9 live integration: navigation API and overpass pursuit on PC/mobile.
The built-in Chromium here uses Canvas fallback; real WebGL is covered by
separate Node tests of the actual world mesh, not by this browser test.
"""
from playwright.sync_api import sync_playwright
from browser_smoke import load

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',
        args=['--no-sandbox', '--disable-dev-shm-usage'])
    try:
        for filename in ('index.html','dev.html'):
            for mobile in (False,True):
                context=browser.new_context(viewport={'width':390 if mobile else 1365,
                        'height':844 if mobile else 768},is_mobile=mobile,has_touch=mobile)
                page=context.new_page(); errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                load(page,filename)
                result=page.evaluate('''() => {
                  const t=window.__neonTest;
                  t.debugStart();
                  const one=t.getState(),where=t.playerPos();
                  const spot=t.npcNav(where.x,where.z,t.debugLevelInfo().player.y,'scout',.55);
                  const loaded=t.debugSector(15);
                  const climb=t.debugEnemyClimb(360);
                  return {one,spot,loaded,climb,game:t.getState(),
                    weapons:t.weaponList().length};
                }''')
                assert result['one']['state']=='playing',result
                assert result['spot'] and result['spot']['bodyHeight']>1, result
                assert result['spot']['canOccupy'] is True,result
                assert result['loaded']['style']==14,result
                assert result['climb'] is not None,result
                assert len(result['climb']['samples'])>5,result
                assert all(-100<x<100 and -10<y<10 for _,x,y in result['climb']['samples']),result
                assert result['weapons']==10,result
                assert not errors,(filename,mobile,errors)
                print('STAGE9',filename,'MOBILE' if mobile else 'DESKTOP',
                      '3D navigation diagnostics / simulated overpass pursuit OK',
                      result['climb']['enemy'])
                context.close()
    finally:
        browser.close()
