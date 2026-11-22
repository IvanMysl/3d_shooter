#!/usr/bin/env python3
"""Real Chromium: drawn archive pedestals stay physically solid after collection."""
from playwright.sync_api import sync_playwright
from browser_smoke import load

def check(browser, filename, mobile):
    ctx=browser.new_context(viewport={'width':390 if mobile else 1365,'height':844 if mobile else 768},is_mobile=mobile,has_touch=mobile)
    try:
        page=ctx.new_page(); errors=[]; page.on('pageerror',lambda e: errors.append(str(e)))
        load(page,filename)
        state=page.evaluate('''() => {
          window.__neonMissionTest.selectStage(8);
          const before=window.__neonMissionTest.archivePedestals();
          const mission=window.__neonMissionTest.current().mission;
          const active=mission.routeOrder[0];
          const completed=window.__neonMissionTest.collectOneCache(active);
          const after=window.__neonMissionTest.archivePedestals();
          const ready=window.__neonMissionTest.current().mission.done;
          return {before,after,completed,ready,active,render:document.body.classList.contains('webgl')?'WebGL':'Canvas'};
        }''')
        assert len(state['before'])==len(state['after'])==3,state
        assert all(q['box'] and q['blocksBody'] and q['blocksBullet'] and q['blocksRocket'] for q in state['before']),state
        assert state['completed'] and state['ready']==1,state
        assert any(q['got'] and q['id']==state['active'] for q in state['after']),state
        assert all(q['box'] and q['blocksBody'] and q['blocksBullet'] and q['blocksRocket'] for q in state['after']),state
        assert not errors,errors
        print(f'Stage87 browser {filename} / {"MOBILE" if mobile else "DESKTOP"} / {state["render"]}: archive plinths and collection PASS')
    finally:
        ctx.close()

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
