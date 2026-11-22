#!/usr/bin/env python3
"""Live Chromium Canvas: solid stair risers drawn up to contact and restored QA."""
from playwright.sync_api import sync_playwright
from browser_smoke import load

def verify(browser,filename,mobile):
    context=browser.new_context(viewport={'width':390 if mobile else 1365,
                                          'height':844 if mobile else 768},
                                is_mobile=mobile,has_touch=mobile)
    try:
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        load(page,filename)
        reports=page.evaluate('''() => {
          const out=[];
          for(const level of [1,8,14,35,70,99]){
           window.__neonMissionTest.selectStage(level);
           out.push(window.__neonTest.stairOpaqueAudit());
          }
          return out;
        }''')
        assert len(reports)==6,reports
        for r in reports:
            assert r and r['build'] in ('106','107','108','109','110','111','112','113','114','115'),r
            assert r['allClear'] and r['restored'],r
            assert r['physics']>=1 and r['painted']>=r['candidates']>=1,r
        assert not errors,errors
        print(f'Stage106 {filename}/{"mobile" if mobile else "desktop"}: '
              f'6 real stair maps, {sum(r["candidates"] for r in reports)} rendered close-up solid risers PASS')
    finally: context.close()

if __name__=='__main__':
    with sync_playwright() as p:
        kw={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        import os
        if os.path.isfile('/usr/bin/chromium'):kw['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**kw)
        try:
            for filename in ('index.html','dev.html'):
                for mobile in (False,True):verify(browser,filename,mobile)
        finally:browser.close()
