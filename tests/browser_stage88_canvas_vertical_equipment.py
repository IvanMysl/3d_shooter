#!/usr/bin/env python3
"""Actual Chromium Canvas: visible equipment hulls stop descending bodies.

Tests both deployable HTMLs and desktop/mobile viewports. Uses the game's
real map, equipment index and updateVertical rather than a mock renderer.
"""
from playwright.sync_api import sync_playwright
from browser_smoke import load


def verify(browser, filename, mobile):
    context = browser.new_context(
        viewport={'width': 390 if mobile else 1365, 'height': 844 if mobile else 768},
        is_mobile=mobile, has_touch=mobile,
    )
    try:
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda error: errors.append(str(error)))
        load(page,filename)
        result=page.evaluate('''() => {
          window.__neonMissionTest.selectStage(8);
          return window.__neonMissionTest.verticalEquipmentPhysics();
        }''')
        assert result['render']=='Canvas',result
        assert len(result['results'])==3,result
        for item in result['results']:
            roof=item['roof']
            assert roof-1e-8 <= item['fall']['feet'] <= roof+.03 and item['fall']['grounded'],item
            assert roof-1e-8 <= item['flight']['feet'] <= roof+.03,item
        assert not errors,errors
        print(f'Stage88 {filename} / {"MOBILE" if mobile else "DESKTOP"}: '
              f'Canvas node+station+archive flight/gravity PASS')
    finally:
        context.close()


if __name__=='__main__':
    import os
    with sync_playwright() as p:
        opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):
            opts['executable_path']='/usr/bin/chromium'
        b=p.chromium.launch(**opts)
        try:
            for file in ('index.html','dev.html'):
                for mobile in (False,True):verify(b,file,mobile)
        finally:
            b.close()
