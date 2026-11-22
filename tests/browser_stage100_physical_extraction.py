#!/usr/bin/env python3
"""Stage100: physical entry, gameplay update trigger, no phantom portals."""
from playwright.sync_api import sync_playwright
from browser_smoke import load


def verify(browser,filename,mobile):
    ctx=browser.new_context(viewport={'width':390 if mobile else 1365,
                                      'height':844 if mobile else 768},
                            is_mobile=mobile,has_touch=mobile)
    try:
        page=ctx.new_page();errors=[]
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        load(page,filename)
        data=page.evaluate('''() => {
          let result=[];
          for(const stage of [1,8,14,35]){
            window.__neonMissionTest.selectStage(stage);
            result.push({stage,physical:window.__neonTest.physicalExtractionAudit(),
                         gameplay:window.__neonTest.physicalExtractionGameplay()});
          }
          return result;
        }''')
        assert len(data)==4,data
        for item in data:
            a=item['physical'];g=item['gameplay']
            assert a and g,(item,errors)
            assert a['build'] in ('100','101','102','103','104','105','106','107','108','109','110','111','112','113','114','115'),item
            assert a['legitimate'] and a['restored'] and a['physicalEntryClear'],item
            assert not a['upper'] and not a['tooFar'] and not a['insideSteel'],item
            assert g['success'] and g['blocked']['count']==0 and g['free']['count']==1,item
        assert not errors,errors
        print(f'Stage100 {filename}/'+('mobile' if mobile else 'desktop')+
              ': 4 actual stages × physical portal, steel blocked, real update completion PASS')
    finally:ctx.close()

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
