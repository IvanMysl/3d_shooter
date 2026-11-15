#!/usr/bin/env python3
"""Stage 7: real Chromium desktop/mobile input after continuous motion update.
Canvas fallback only: device-specific WebGL and Android remain untested.
"""
from playwright.sync_api import sync_playwright
from browser_smoke import load


def center(page, selector):
    return page.locator(selector).evaluate('''el => {
        const r=el.getBoundingClientRect();
        return {x:r.x+r.width/2,y:r.y+r.height/2};
    }''')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',
                               args=['--no-sandbox','--disable-dev-shm-usage'])
    try:
        for filename in ('index.html','dev.html'):
            for mobile in (False,True):
                context=browser.new_context(viewport={'width':390 if mobile else 1365,
                                     'height':844 if mobile else 768},
                                     has_touch=mobile,is_mobile=mobile)
                page=context.new_page(); errors=[]
                page.on('pageerror',lambda err:errors.append(str(err)))
                load(page,filename)
                page.evaluate('window.__neonTest.debugStart()')
                assert page.evaluate('window.__neonTest.getState().state')=='playing'
                if mobile:
                    joy=center(page,'#joystick')
                    cdp=context.new_cdp_session(page)
                    a={'x':joy['x'],'y':joy['y']-24,'id':1}
                    b={'x':joy['x']+12,'y':joy['y']+7,'id':2}
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[a]})
                    first=page.locator('#stick').evaluate('el=>el.style.transform')
                    assert first and first!='translate(0, 0)',first
                    # Another finger accidentally landing on the joystick must
                    # not steal the first pointer's joystick capture.
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[a,b]})
                    second=page.locator('#stick').evaluate('el=>el.style.transform')
                    assert second==first,(first,second)
                    # Backgrounding the game releases movement and pauses play.
                    page.evaluate("window.dispatchEvent(new Event('blur'))")
                    assert page.evaluate('window.__neonTest.getState().state')=='paused'
                    assert page.locator('#stick').evaluate('el=>el.style.transform') in ('translate(0, 0)', 'translate(0,0)', 'translate(0px, 0px)'),repr(page.locator('#stick').evaluate('el=>el.style.transform'))
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
                else:
                    page.keyboard.press('F5')
                    assert page.locator('#viewTouch').get_attribute('aria-pressed')=='true'
                    page.keyboard.press('F5')
                    assert page.locator('body').evaluate('el=>el.classList.contains("secondPerson")')
                    page.keyboard.press('F5')
                    assert page.locator('#viewTouch').get_attribute('aria-pressed')=='false'
                    # A quick W before switching back to menu must not survive
                    # a lost-focus event and force the next run to sprint.
                    page.keyboard.down('w')
                    page.evaluate("window.dispatchEvent(new Event('blur'))")
                    assert page.evaluate('window.__neonTest.getState().state')=='paused'
                    page.keyboard.up('w')
                assert not errors,errors
                print(f'STAGE7 {filename} / {"MOBILE" if mobile else "DESKTOP"}: '
                      'menu, gameplay, control recovery and no uncaught JS errors')
                context.close()
    finally:
        browser.close()
