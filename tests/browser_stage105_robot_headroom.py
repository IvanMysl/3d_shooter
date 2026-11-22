#!/usr/bin/env python3
"""Stage105 real Chromium Canvas: tall robots cannot stand under low decks."""
from playwright.sync_api import sync_playwright
from browser_smoke import load


def verify(browser, filename, mobile):
    context = browser.new_context(
        viewport={'width':390 if mobile else 1365,'height':844 if mobile else 768},
        is_mobile=mobile, has_touch=mobile)
    try:
        page=context.new_page(); errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        load(page,filename)
        records=page.evaluate('''() => {
          const result=[];
          for (const level of [8,14,35,70,99]){
            window.__neonMissionTest.selectStage(level);
            result.push(window.__neonTest.robotHeadroomAudit());
          }
          return result;
        }''')
        assert len(records)==5,records
        assert all(r and r['build'] in ('105','106','107','108','109','110','111','112','113','114','115') and r['allClear'] and r['checks']>=0 for r in records),records
        assert sum(r['decks'] for r in records)>50, records
        assert sum(r['blocked'] for r in records)>100,records
        assert sum(r['scoutOpen'] for r in records)>20,records
        assert all(r['heights'][2]>=3.30 and r['heights'][3]>4.59 for r in records),records
        assert not errors,errors
        print(f'Stage105 {filename} {"mobile" if mobile else "desktop"}: '
              f'{sum(r["checks"] for r in records)} true-volume checks on 5 real maps PASS')
    finally:
        context.close()

if __name__=='__main__':
    import os
    with sync_playwright() as p:
        opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):opts['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**opts)
        try:
            for f in ('index.html','dev.html'):
                for m in (False,True):verify(browser,f,m)
        finally: browser.close()
