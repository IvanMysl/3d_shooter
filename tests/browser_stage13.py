#!/usr/bin/env python3
"""Stage 13: three camera positions, persisted UI and expanded hangar.

Requires Chromium/Playwright locally. Not a substitute for hardware WebGL.
"""
from playwright.sync_api import sync_playwright
from browser_smoke import load

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',
        args=['--no-sandbox','--disable-dev-shm-usage'])
    try:
        for launcher in ('index.html','dev.html'):
            for mobile in (False,True):
                context=browser.new_context(viewport={'width':390 if mobile else 1365,
                    'height':844 if mobile else 768},is_mobile=mobile,has_touch=mobile)
                page=context.new_page();errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                load(page,launcher)
                page.evaluate('window.__neonTest.debugStart()')
                get=lambda:page.evaluate('window.__neonTest.expansionStatus()')
                assert get()['camera']=='first'
                assert get()['perkMaximum']==40 and len(get()['perkLevels'])==6
                for mode in ('third','second','first'):
                    if mobile:
                        page.locator('#viewTouch').tap()
                    else:
                        page.keyboard.press('F5')
                    assert get()['camera']==mode,(launcher,mobile,mode,get())
                page.locator('#pauseBtn').click()
                page.locator('#toMenu').click()
                page.locator('#hangar').click()
                assert page.locator('[data-up]').count()==6
                text=page.locator('#panel').inner_text()
                assert 'ФАЗОВЫЙ РАДИУС' in text and 'ЁМКОСТЬ ЭНЕРГО-ЯДРА' in text
                assert text.count('/40')>=6
                assert not errors,(launcher,mobile,errors)
                print('STAGE13',launcher,'MOBILE' if mobile else 'DESKTOP',
                      '3 camera modes and 6 x 40 upgrade rows OK')
                context.close()
    finally:
        browser.close()
