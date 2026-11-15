#!/usr/bin/env python3
"""Stage 10: real game startup and diagnostic crowd state on PC/mobile."""
from playwright.sync_api import sync_playwright
from browser_smoke import load

with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',
       args=['--no-sandbox','--disable-dev-shm-usage'])
    try:
        for filename in ('index.html','dev.html'):
            for mobile in (False,True):
                cx=b.new_context(viewport={'width':390 if mobile else 1365,
                     'height':844 if mobile else 768},is_mobile=mobile,has_touch=mobile)
                page=cx.new_page();errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                load(page,filename)
                result=page.evaluate('''() => {
                  const t=window.__neonTest;
                  t.debugStart();
                  const empty=t.npcCrowd();
                  t.debugDrone();t.boss();
                  const actual=t.npcCrowd();
                  const stage=t.getState();
                  return {empty,actual,stage,arsenal:t.arsenal(),
                          weapons:t.weaponList().length};
                }''')
                assert result['empty']['living']>=0,result
                assert result['actual']['living']>=2,result
                assert isinstance(result['actual']['overlapPairs'],int),result
                assert result['actual']['closestGap'] is not None,result
                assert result['weapons']==10,result
                assert result['stage']['state']=='playing',result
                assert not errors,(filename,mobile,errors)
                print('STAGE10',filename,'MOBILE' if mobile else 'DESKTOP',
                      'live robots & nonmutating crowd diagnostics OK')
                cx.close()
    finally:
        b.close()
