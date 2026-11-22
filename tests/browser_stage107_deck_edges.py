#!/usr/bin/env python3
"""Browser-driven real geometry audit of the complete standalone/DEV builds."""
from playwright.sync_api import sync_playwright
from browser_smoke import load
import os


def verify(browser, filename, mobile):
    context=browser.new_context(viewport={'width':390 if mobile else 1365,
                                          'height':844 if mobile else 768},
                                is_mobile=mobile,has_touch=mobile)
    try:
        page=context.new_page();errors=[]
        page.on('pageerror', lambda error:errors.append(str(error)))
        load(page,filename)
        data=page.evaluate('''() => {
          const result=[];
          for(const level of [3,5,7,10,14,35,70,99]){
            window.__neonMissionTest.selectStage(level);
            result.push(window.__neonTest.deckEdgeAudit());
          }
          return result;
        }''')
        assert len(data)==8,data
        for d in data:
            assert d and d['build'] in ('107','108','109','110','111','112','113','114','115'),d
            assert d['allClear'] and d['failures']==0,d
        assert sum(d['edges'] for d in data)>30,data
        assert not errors,errors
        print(f'Stage107 {filename}/{"mobile" if mobile else "desktop"}: '
              f'{len(data)} maps / {sum(d["edges"] for d in data)} real plate edges / '
              f'{sum(d["checks"] for d in data)} bridge geometry checks PASS')
    finally:
        context.close()

if __name__=='__main__':
    with sync_playwright() as p:
        kw={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):kw['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**kw)
        try:
            for name in ('index.html','dev.html'):
                for mobile in (False,True):verify(browser,name,mobile)
        finally:browser.close()
