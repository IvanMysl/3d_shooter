#!/usr/bin/env python3
"""Stage103: Chromium real-game ground hull routes; index/dev x PC/mobile."""
from playwright.sync_api import sync_playwright
from browser_smoke import load

def verify(browser,filename,mobile):
    context=browser.new_context(viewport={'width':390 if mobile else 1365,
                                          'height':844 if mobile else 768},
                                is_mobile=mobile,has_touch=mobile)
    try:
        page=context.new_page();errors=[]
        page.on('pageerror',lambda error: errors.append(str(error)))
        load(page,filename)
        results=page.evaluate('''() => {
            const reports=[];
            for(const level of [3,8,14,35,70,99]){
                window.__neonMissionTest.selectStage(level);
                reports.push(window.__neonTest.groundChassisPhysics());
            }
            return reports;
        }''')
        assert len(results)==6,results
        assert all(r and r['build'] in ('103','104','105','106','107','108','109','110','111','112','113','114','115') and r['allClear']
                   and r['profiles']==3 for r in results),results
        assert sum(r['physicalEdges'] for r in results)>100,results
        assert not errors,errors
        print(f'Stage103 {filename}/'+('mobile' if mobile else 'desktop')+
              f': {sum(r["physicalEdges"] for r in results)} real physical ground transitions PASS')
    finally:
        context.close()

if __name__=='__main__':
    import os
    with sync_playwright() as p:
        opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):opts['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**opts)
        try:
            for filename in ('index.html','dev.html'):
                for mobile in (False,True):verify(browser,filename,mobile)
        finally:browser.close()
