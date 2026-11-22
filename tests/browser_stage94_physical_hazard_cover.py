#!/usr/bin/env python3
"""Stage94 real Chromium cover rays in actual offline campaign scenes."""
from playwright.sync_api import sync_playwright
from browser_smoke import load


def verify(browser, filename, mobile):
    context=browser.new_context(
        viewport={'width':390 if mobile else 1365,'height':844 if mobile else 768},
        is_mobile=mobile, has_touch=mobile)
    try:
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        load(page,filename)
        info=page.evaluate('''() => {
          const results=[];
          for (const level of [8,14,35]) {
            window.__neonMissionTest.selectStage(level);
            const r=window.__neonTest.physicalHazardCover();
            if(!r || r.level!==level)throw new Error('Stage94 audit is missing');
            results.push(r);
          }
          return results;
        }''')
        assert len(info)==3,info
        for r in info:
            assert r['fullWalls']>=1 and r['blockedWalls']==r['fullWalls'],r
            assert r['openAisles']>=1 and r['clearAisles']==r['openAisles'],r
            assert r['coils']==r['coilFaces'],r
        assert not errors,errors
        print(f'Stage94 {filename}/'+('MOBILE' if mobile else 'DESKTOP')+
              f': {sum(r["fullWalls"] for r in info)} real solid walls, '
              f'{sum(r["openAisles"] for r in info)} open routes, '
              f'{sum(r["coilFaces"] for r in info)} live coil faces PASS')
    finally:
        context.close()


if __name__=='__main__':
    import os
    with sync_playwright() as p:
        options={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):
            options['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**options)
        try:
            for filename in ('index.html','dev.html'):
                for mobile in (False,True):verify(browser,filename,mobile)
        finally:
            browser.close()
