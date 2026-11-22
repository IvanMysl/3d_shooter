#!/usr/bin/env python3
"""Actual Chromium builds: six authored real stair/deck transition sites."""
from playwright.sync_api import sync_playwright
from browser_smoke import load
import os

LEVELS = (10,28,46,64,82,100)

def verify(browser,filename,mobile):
    context=browser.new_context(viewport={'width':390 if mobile else 1365,
                                          'height':844 if mobile else 768},
                                is_mobile=mobile,has_touch=mobile)
    try:
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        load(page,filename)
        results=page.evaluate('''(levels) => {
          return levels.map(level=>{
            window.__neonMissionTest.selectStage(level);
            return window.__neonTest.bridgeStairTransitionAudit();
          });
        }''',LEVELS)
        assert len(results)==len(LEVELS),results
        for d in results:
            assert d and d['build'] in ('108','109','110','111','112','113','114','115') and d['allClear'],d
        checked=sum(d['checked'] for d in results)
        assert checked>0,results
        assert not errors,errors
        print(f'Stage108 {filename}/{"mobile" if mobile else "desktop"}: '
              f'{len(LEVELS)} real maps / {checked} completed bridge entry/exit pairs PASS')
    finally:context.close()

if __name__=='__main__':
    with sync_playwright() as p:
        kw={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):kw['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**kw)
        try:
            for name in ('index.html','dev.html'):
                for mobile in (False,True):verify(browser,name,mobile)
        finally:browser.close()
