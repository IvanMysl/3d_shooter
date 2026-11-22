#!/usr/bin/env python3
"""Real Chromium Canvas audit: robot spawn/cinematic HUD share solid world geometry."""
from playwright.sync_api import sync_playwright
from browser_smoke import load


def run(browser, filename, mobile):
    context=browser.new_context(viewport={'width':390 if mobile else 1365,
                                         'height':844 if mobile else 768},
                                is_mobile=mobile,has_touch=mobile)
    try:
        page=context.new_page()
        errors=[]
        page.on('pageerror', lambda err:errors.append(str(err)))
        load(page,filename)
        rows=page.evaluate('''() => {
          const results=[];
          for(const sector of [8,14,35]){
            window.__neonMissionTest.selectStage(sector);
            const data=window.__neonTest.physicalSpawnAndTarget();
            if(!data||data.level!==sector)throw new Error('Stage95 QA not registered');
            results.push(data);
          }
          return results;
        }''')
        assert len(rows)==3,rows
        for data in rows:
            assert data['hulls']>=6 and data['blockedHulls']==data['hulls'],data
            assert data['wallPairs']>=1 and data['shielded']==data['wallPairs'],data
            assert data['open']>=1 and data['openSeen']==data['open'],data
        assert not errors,errors
        print(f'Stage95 {filename}/{"mobile" if mobile else "desktop"}: '
              f'{sum(x["hulls"] for x in rows)} metal chassis blocked, '
              f'{sum(x["wallPairs"] for x in rows)} steel walls hide HUD targets, '
              f'{sum(x["open"] for x in rows)} open corridors show HUD targets PASS')
    finally:
        context.close()


if __name__=='__main__':
    import os
    with sync_playwright() as p:
        args={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):args['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**args)
        try:
            for file in ('index.html','dev.html'):
                for mobile in (False,True):run(browser,file,mobile)
        finally:
            browser.close()
