#!/usr/bin/env python3
"""Actual Chromium game checkpoint-loader recovery across Canvas launchers."""
from playwright.sync_api import sync_playwright
from browser_smoke import load


def run(browser, filename, mobile):
    ctx=browser.new_context(viewport={'width':390 if mobile else 1365,
                                      'height':844 if mobile else 768},
                            is_mobile=mobile,has_touch=mobile)
    try:
        page=ctx.new_page()
        errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        load(page,filename)
        reports=page.evaluate('''() => {
          const output=[];
          for(const sector of [8,14,35]){
            window.__neonMissionTest.selectStage(sector);
            output.push(window.__neonTest.checkpointPhysicalRecovery());
          }
          return output;
        }''')
        assert len(reports)==3,reports
        for r in reports:
            assert r['restored']==r['expected']==2,r
            assert all(r[k] for k in ('physical','crowd','health','boss','playerSafe','playerMoved')),r
        hud=page.evaluate('''() => window.__neonTest.checkpointBossHudResume()''')
        assert hud and hud['sector']==35 and hud['restored'] and hud['health'] and hud['visible'] and hud['title'],hud
        old=page.evaluate('''() => {
          window.__neonMissionTest.selectStage(8);
          return window.__neonTest.checkpointLegacyPlayerResume();
        }''')
        assert old and old['sector']==8 and old['safe'] and old['grounded'] and old['relocated'] and old['wallReset'],old
        assert not errors,errors
        print(f'Stage96 {filename}/{"mobile" if mobile else "desktop"}: '
              f'{sum(r["restored"] for r in reports)} real saved actors, '
              f'3 embedded operators, 1 boss, 3 physical worlds PASS')
    finally:
        ctx.close()

if __name__=='__main__':
    import os
    with sync_playwright() as p:
        kwargs={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):
            kwargs['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**kwargs)
        try:
            for filename in ('index.html','dev.html'):
                for mobile in (False,True):run(browser,filename,mobile)
        finally:
            browser.close()
