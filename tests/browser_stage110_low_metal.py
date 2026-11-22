#!/usr/bin/env python3
"""Run the new physics through both actual browser bundles and profiles."""
from playwright.sync_api import sync_playwright
from browser_smoke import load
import os

with sync_playwright() as p:
    opts = {'headless': True, 'args': ['--no-sandbox','--disable-dev-shm-usage']}
    if os.path.isfile('/usr/bin/chromium'):
        opts['executable_path']='/usr/bin/chromium'
    browser=p.chromium.launch(**opts)
    try:
        for filename in ('index.html','dev.html'):
            for mobile in (False,True):
                context=browser.new_context(viewport={'width':390 if mobile else 1365,'height':844 if mobile else 768},is_mobile=mobile,has_touch=mobile)
                try:
                    page=context.new_page();errors=[]
                    page.on('pageerror',lambda e:errors.append(str(e)))
                    load(page,filename)
                    result=page.evaluate('''()=>{window.__neonTest.debugStart();return window.__neonTest.lowMetalContactAudit();}''')
                    assert result and result['build'] in ('110','111','112','113','114','115') and result['allClear'],result
                    assert result['checks']==31,result
                    page.wait_for_timeout(100)
                    assert not errors,errors
                    print(f'Stage110 {filename}/{"mobile" if mobile else "desktop"}: {result["checks"]} checks PASS ({result["render"]}; isolated static registry exercise)')
                finally:
                    context.close()
    finally:
        browser.close()
