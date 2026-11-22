#!/usr/bin/env python3
"""Stage85: actual browser wiring for sequential missions on both launchers."""
from playwright.sync_api import sync_playwright
from browser_smoke import load

def check(browser, filename, mobile):
    ctx = browser.new_context(viewport={'width':390 if mobile else 1365, 'height':844 if mobile else 768},is_mobile=mobile,has_touch=mobile)
    try:
        page=ctx.new_page(); errors=[]; page.on('pageerror', lambda e: errors.append(str(e)))
        load(page,filename)
        # Stage8 is a near-first archive chain; Stage14 is a far-first relay.
        r=page.evaluate('''() => {
          window.__neonMissionTest.selectStage(8);
          const m=window.__neonMissionTest.current().mission;
          const current=m.routeOrder[0],last=m.routeOrder[m.routeOrder.length-1];
          const blocked=window.__neonMissionTest.collectOneCache(last);
          const allowed=window.__neonMissionTest.collectOneCache(current);
          const now=window.__neonMissionTest.current().mission;
          return {mode:m.routeMode,order:m.routeOrder,blocked,allowed,done:now.done,
                  hint:document.getElementById('missionHUD')?.textContent?.slice(0,60)};
        }''')
        assert r['mode']=='near-first' and len(r['order'])==3 and not r['blocked'] and r['allowed'] and r['done']==1,r
        assert not errors,errors
        print(f'Stage85 browser {filename} / {"mobile" if mobile else "desktop"}: sequential archives PASS')
    finally:ctx.close()

if __name__=='__main__':
    import os
    with sync_playwright() as p:
        kw={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):kw['executable_path']='/usr/bin/chromium'
        b=p.chromium.launch(**kw)
        try:
            for file in ('index.html','dev.html'):
                for mob in (False,True):check(b,file,mob)
        finally:b.close()
