#!/usr/bin/env python3
"""Stage92: real browser HUD mission/extraction paths obey physical edges."""
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
        results=page.evaluate('''() => {
          const data=[];
          for(const level of [8,14]){
            window.__neonMissionTest.selectStage(level);
            const initial=window.__neonTest.physicalGuidance();
            if(!initial||initial.mode!=='mission')throw new Error('Expected a mission route at level '+level);
            window.__neonTest.debugPortalReady();
            const extraction=window.__neonTest.physicalGuidance();
            // Physically destroying a real node must not leave a ghost HUD
            // route or stale cached navigation field.
            window.__neonTest.damageNode(0,1e9);
            const cleared=window.__neonTest.physicalGuidance();
            data.push({level,initial,extraction,cleared});
          }
          return data;
        }''')
        for item in results:
            for stage in ('initial','extraction','cleared'):
                qa=item[stage]
                assert qa['physical'] and qa['broken']==0 and qa['wallCrossings']==0,(item,stage)
                assert qa['length']>1 and qa['distance'] is not None and qa['distance']<32767,(item,stage)
                assert qa['edges']==qa['length']-1,(item,stage)
            assert item['extraction']['mode']==item['cleared']['mode']=='extraction',item
        assert not errors,errors
        print(f'Stage92 {filename} / {"MOBILE" if mobile else "DESKTOP"}: '
              f'{len(results)} mission maps × mission/extract/after-reactor physical routes PASS')
    finally:
        context.close()


if __name__=='__main__':
    import os
    with sync_playwright() as p:
        kw={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):kw['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**kw)
        try:
            for filename in ('index.html','dev.html'):
                for mobile in (False,True):verify(browser,filename,mobile)
        finally:browser.close()
