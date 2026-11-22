#!/usr/bin/env python3
"""Stage102: real Chromium Canvas, physical gallery per-NPC profile QA."""
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
        result=page.evaluate('''() => {
          const out=[];
          for(const level of [3,5,7,10,21,35]){
            window.__neonMissionTest.selectStage(level);
            out.push(window.__neonTest.upperDeckChassis());
          }
          return out;
        }''')
        assert len(result)==6,result
        assert all(r and r['build'] in ('102','103','104','105','106','107','108','109','110','111','112','113','114','115') and r['allClear'] for r in result),result
        assert all(r['galleries']>0 and r['profiles']==r['galleries']*3
                   for r in result[:5]),result
        assert result[-1]['profiles']==0,result
        assert sum(r['profiles'] for r in result)>=24,result
        assert all(c['radius']>=.22 and c['height']>=1.68 for r in result for c in r['cases']),result
        assert not errors,errors
        print(f'Stage102 {filename}/'+('mobile' if mobile else 'desktop')+
              f': {sum(r["profiles"] for r in result)} physical 3D upper-deck chassis routes PASS')
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
