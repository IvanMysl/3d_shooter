#!/usr/bin/env python3
"""Chromium runtime: NPC direct paths never ignore real mission equipment."""
from playwright.sync_api import sync_playwright
from browser_smoke import load

def verify(browser, filename, mobile):
    context=browser.new_context(viewport={'width':390 if mobile else 1365,
                                         'height':844 if mobile else 768},
                                is_mobile=mobile,has_touch=mobile)
    try:
        page=context.new_page();errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        load(page,filename)
        data=page.evaluate('''() => {
          window.__neonMissionTest.selectStage(8);
          const qa=window.__neonTest.equipmentDirectRoutes();
          return {...qa,render:document.body.classList.contains('webgl')?'WebGL':'Canvas'};
        }''')
        assert data['bodies']>=6,data
        assert data['probes']>=3,data
        assert data['blocked']==data['probes'] and not data['clearThroughSolid'],data
        assert not errors,errors
        print(f'Stage89 {filename} / {"MOBILE" if mobile else "DESKTOP"} / '
              f'{data["render"]}: {data["blocked"]}/{data["probes"]} real equipment '
              'shortcuts rejected: PASS')
    finally:context.close()

if __name__=='__main__':
    import os
    with sync_playwright() as p:
        kw={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):kw['executable_path']='/usr/bin/chromium'
        b=p.chromium.launch(**kw)
        try:
            for filename in ('index.html','dev.html'):
                for mobile in (False,True):verify(b,filename,mobile)
        finally:b.close()
