#!/usr/bin/env python3
"""Optional real-browser UI flow: developer login, virtual purchases, flight."""
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
                status=lambda:page.evaluate('window.__neonTest.developerFlightStatus()')
                assert not status()['developerMode']
                page.locator('#devToggle').click()
                page.locator('#devPass').fill('tamu')
                page.locator('#devLogin').click()
                page.wait_for_function('window.__neonTest.developerFlightStatus().developerMode')
                assert status()['creditsShown']=='∞'
                assert status()['armorOwnedCount']==0
                page.locator('#hangar').click()
                assert page.locator('[data-buy-armor]').count()==12
                page.locator('[data-buy-armor="0"]').click()
                for i in range(10):
                    page.locator('[data-armor-up="0"]').click()
                assert status()['equippedArmorLevel']==10,status()
                page.locator('#back').click()
                page.locator('#campaignMap').click()
                page.locator('#devStageNumber').fill('35')
                page.locator('#devStageGo').click()
                assert page.evaluate('window.__neonTest.getState().sector')==35
                assert status()['flightUnlocked'] and status()['ceilingHeight']>10
                if mobile:
                    page.locator('#flightToggle').tap()
                else:
                    page.keyboard.press('v')
                assert status()['flying'],(launcher,mobile,status())
                page.locator('#pauseBtn').click()
                page.locator('#toMenu').click()
                page.locator('#devToggle').click()
                assert not status()['developerMode']
                assert status()['armorOwnedCount']==0
                assert not errors,(launcher,mobile,errors)
                print('STAGE14',launcher,'MOBILE' if mobile else 'DESKTOP',
                    'developer password, 10 armor purchases, all levels, flight, isolation OK')
                context.close()
    finally:
        browser.close()
