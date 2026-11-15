#!/usr/bin/env python3
"""Stage 8 live geometry-cover checks with the actual assembled engine.

Chromium here uses Canvas fallback; GPU WebGL and Android device not covered.
"""
from playwright.sync_api import sync_playwright
from browser_smoke import load

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True,
        executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    try:
        for file in ('index.html','dev.html'):
            for mobile in (False,True):
                context=browser.new_context(
                    viewport={'width':390 if mobile else 1365,'height':844 if mobile else 768},
                    is_mobile=mobile,has_touch=mobile)
                page=context.new_page()
                errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                load(page,file)
                result=page.evaluate('''() => {
                  const test=window.__neonTest;
                  test.debugStart();
                  const world=test.mapInfo(),rows=world.mapCells;
                  let blocked=null,clear=null;
                  // Use a REAL generated cell grid; no hand-authored map fixture.
                  for(let z=2;z<rows.length-2;z++)for(let x=2;x<rows[z].length-2;x++){
                    if(!blocked && rows[z][x]===0 && rows[z][x+1]===1 && rows[z][x+2]===0)
                      blocked=[x+.5,z+.5,x+2.5,z+.5];
                    if(!clear && rows[z][x]===0 && rows[z][x+1]===0 && rows[z][x+2]===0)
                      clear=[x+.5,z+.5,x+2.5,z+.5];
                  }
                  const chk=(a)=>a&&test.coverBetween(a[0],0,a[1],a[2],0,a[3]);
                  return {game:test.getState(),blocked:chk(blocked),clear:chk(clear),
                    haveBlocked:!!blocked,haveClear:!!clear,ammo:test.weaponList().length};
                }''')
                assert result['game']['state']=='playing',result
                assert result['haveBlocked'] and result['haveClear'],result
                assert result['blocked'] is False,result
                assert result['clear'] is True,result
                assert result['ammo']==10,result
                assert not errors,(file,mobile,errors)
                print(f'STAGE8 {file} / {"MOBILE" if mobile else "DESKTOP"}: '
                      'real generated wall cover + clear line + 10 weapons OK')
                context.close()
    finally:
        browser.close()
