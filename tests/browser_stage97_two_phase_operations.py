#!/usr/bin/env python3
"""Stage97: genuine browser engine two-phase missions and persisted coil objective."""
from playwright.sync_api import sync_playwright
from browser_smoke import load


def verify(browser, filename, mobile):
    ctx=browser.new_context(viewport={'width':390 if mobile else 1365,
                                      'height':844 if mobile else 768},
                            is_mobile=mobile,has_touch=mobile)
    try:
        page=ctx.new_page();errors=[]
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        load(page,filename)
        report=page.evaluate('''() => {
          const result=[];
          for(const sector of [12,16,42,46]){
            window.__neonMissionTest.selectStage(sector);
            const status=window.__neonMissionTest.stage97Exercise();
            if(!status)throw Error('Stage97 QA missing for '+sector);
            result.push({sector,...status});
          }
          window.__neonMissionTest.selectStage(16);
          const restored=window.__neonMissionTest.stage97SaveRoundtrip();
          return {result,restored};
        }''')
        assert len(report['result'])==4,report
        for item in report['result']:
            assert item['completed'] and item['physical'],item
            assert item['after']['portal'] is True,item
            if item['before']['type']=='containment':
                assert item['beforeDisable'] and item['beforeSiege'] and item['started'],item
            else:
                assert item['beforeCoils'] and item['afterCoils'] and all(item['contacts']),item
                assert item['before']['coilCount']>=1,item
        saved=report['restored']
        assert saved and saved['valid'] and saved['face'] and saved['done'],saved
        assert not errors,errors
        print(f'Stage97 {filename}/'+('mobile' if mobile else 'desktop')+
              ': 4 live two-phase missions, physical coil activation, '
              'early reactor kill, actual checkpoint roundtrip PASS')
    finally:
        ctx.close()

if __name__=='__main__':
    import os
    with sync_playwright() as p:
        kw={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):kw['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**kw)
        try:
            for name in ('index.html','dev.html'):
                for mobile in (False,True):verify(browser,name,mobile)
        finally:browser.close()
