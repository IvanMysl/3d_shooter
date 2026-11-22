#!/usr/bin/env python3
"""Stage104: actual Chromium Canvas index/dev × desktop/mobile, real scene contact."""
from playwright.sync_api import sync_playwright
from browser_smoke import load

def verify(browser, filename, mobile):
    context=browser.new_context(viewport={'width':390 if mobile else 1365,
                                          'height':844 if mobile else 768},
                                is_mobile=mobile,has_touch=mobile)
    try:
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        load(page,filename)
        records=page.evaluate('''() => {
            const out=[];
            for(const level of [1,8,14,35]){
                window.__neonMissionTest.selectStage(level);
                out.push(window.__neonTest.debrisPhysicalContacts());
            }
            return out;
        }''')
        assert len(records)==4,records
        for result in records:
            assert result and result['build'] in ('104','105','106','107','108','109','110','111','112','113','114','115'),result
            assert result['wall'] and result['equipment'] and result['restored'],result
            assert result['allClear'],result
        assert not errors,errors
        print(f'Stage104 {filename}/'+('mobile' if mobile else 'desktop')+
              ': 4 real maps, physical wall/steel/bridge fragments PASS')
    finally: context.close()

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
