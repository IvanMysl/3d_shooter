#!/usr/bin/env python3
"""Interactive camera and armor tests with controlled localStorage and touches.

Uses Chromium Canvas fallback in this environment, not hardware WebGL.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent

def fresh_page(ctx,stored=None):
    page=ctx.new_page()
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    # The browser sandbox blocks even localhost navigation. Emulate only the
    # localStorage API in about:blank; this checks save logic, not site permissions.
    serialized=json.dumps(stored or {},ensure_ascii=False)
    fixture=f"""<script>(function(){{
      const store={serialized};
      const memory={{
        getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,
        setItem:(k,v)=>{{store[k]=String(v)}},removeItem:k=>{{delete store[k]}},
        clear:()=>{{for(const k in store)delete store[k]}}
      }};
      Object.defineProperty(window,'localStorage',{{configurable:true,value:memory}});
      Object.defineProperty(window,'sessionStorage',{{configurable:true,value:memory}});
    }})();</script>"""
    html=(ROOT/'index.html').read_text('utf8').replace('<head>','<head>'+fixture,1)
    page.set_content(html,wait_until='load',timeout=45000)
    page.locator('#hangar').wait_for()
    return page,errors

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',
                  args=['--no-sandbox','--disable-dev-shm-usage'])
    try:
        ctx=browser.new_context(viewport={'width':1365,'height':768})
        page,errors=fresh_page(ctx)
        assert page.locator('#viewTouch').get_attribute('aria-pressed')=='false'
        page.evaluate('window.__neonTest.debugStart()')
        page.keyboard.press('F5')
        page.wait_for_timeout(200)
        assert page.locator('#viewTouch').get_attribute('aria-pressed')=='true'
        assert page.locator('body').evaluate('el=>el.classList.contains("thirdPerson")')
        # Real rendering pass in software fallback; operator is visible and no JS exception.
        page.wait_for_timeout(500)
        assert page.evaluate('window.__neonTest.getState().state')=='playing'
        # Preferences survive a new document, unlike about:blank test environments.
        assert page.evaluate('JSON.parse(localStorage.getItem("neonrift3d-save")).settings.cameraMode')=='third'
        snapshot=page.evaluate('localStorage.getItem("neonrift3d-save")')
        page.close()
        page,more_errors=fresh_page(ctx,{'neonrift3d-save':snapshot,'neonrift3d-save-backup':snapshot})
        errors+=more_errors
        assert page.locator('body').evaluate('el=>el.classList.contains("thirdPerson")')
        assert page.locator('#viewTouch').get_attribute('aria-pressed')=='true'
        page.evaluate('window.__neonTest.debugStart()')
        page.locator('#pauseBtn').click()
        assert 'ТРЕТЬЕ ЛИЦО' in page.locator('#cameraToggle').inner_text()
        page.locator('#cameraToggle').click()
        assert 'ВТОРОЕ ЛИЦО' in page.locator('#cameraToggle').inner_text()
        assert page.locator('body').evaluate('el=>el.classList.contains("secondPerson")')
        page.locator('#cameraToggle').click()
        assert 'ПЕРВОЕ ЛИЦО' in page.locator('#cameraToggle').inner_text()
        page.locator('#toMenu').click()
        page.locator('#hangar').click()
        assert page.locator('#operatorCanvas').count()==1
        page.locator('[data-preview-armor="11"]').click()
        assert page.locator('#operatorPreviewName').inner_text().strip()!='БАЗОВАЯ ФОРМА'
        # A purchased item only changes equipment on explicit purchase/equip.
        assert page.evaluate('JSON.parse(localStorage.getItem("neonrift3d-save")).bodyArmor.equipped')==-1
        preview=page.locator('#operatorCanvas').evaluate('''el=>{
           const a=el.getContext('2d').getImageData(0,0,el.width,el.height).data;
           let opaque=0;for(let i=3;i<a.length;i+=4)if(a[i]>0)opaque++;
           return opaque/(el.width*el.height);
        }''')
        assert preview>.8,preview
        assert not errors,errors
        print('DESKTOP: 3 camera modes, persistent preference, pause UI, armor preview and save passed')
        ctx.close()
        ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        mobile,errors=fresh_page(ctx)
        mobile.evaluate('window.__neonTest.debugStart()')
        # Maintain the first touch on joystick and press camera mode with second finger.
        points=[]
        for selector,ident in [('#joystick',1),('#viewTouch',2)]:
            pt=mobile.locator(selector).evaluate('e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}}')
            points.append({'x':pt['x'],'y':pt['y'],'id':ident})
        cdp=ctx.new_cdp_session(mobile)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[points[0]]})
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':points})
        mobile.wait_for_timeout(90)
        assert mobile.locator('#viewTouch').get_attribute('aria-pressed')=='true'
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[points[0]]})
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        mobile.wait_for_timeout(150)
        assert not errors,errors
        print('MOBILE: simultaneous joystick + view toggle passed; fallback render has no exceptions')
        ctx.close()
    finally:
        browser.close()
