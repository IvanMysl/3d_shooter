#!/usr/bin/env python3
"""Dynamic actor contacts, safe prefix and raised route, both launchers and viewport types."""
from playwright.sync_api import sync_playwright
from browser_smoke import load
import os

with sync_playwright() as p:
    opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
    if os.path.isfile('/usr/bin/chromium'): opts['executable_path']='/usr/bin/chromium'
    browser=p.chromium.launch(**opts)
    try:
        for filename in ('index.html','dev.html'):
            for mobile in (False, True):
                context=browser.new_context(viewport={'width':390 if mobile else 1365,'height':844 if mobile else 768},is_mobile=mobile,has_touch=mobile)
                try:
                    page=context.new_page();errors=[]
                    page.on('pageerror',lambda e: errors.append(str(e)))
                    load(page,filename)
                    report=page.evaluate('''() => {
                        window.__neonMissionTest.selectStage(3);
                        return window.__neonTest.dynamicGuidanceAudit();
                    }''')
                    assert report and report['build'] in ('113','114','115') and report['allClear'] and report['checks']>=10,report
                    assert not errors,errors
                    print(f"Stage113 {filename}/{'mobile' if mobile else 'desktop'}: {report['checks']} PASS ({report['renderer']})",flush=True)
                finally: context.close()
    finally: browser.close()
