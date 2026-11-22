#!/usr/bin/env python3
"""Both shipped launchers, desktop and mobile layouts, real keyboard event dispatch."""
from browser_smoke import load
from playwright.sync_api import sync_playwright
import os

def run(browser, filename, mobile):
    context=browser.new_context(viewport={'width':390 if mobile else 1365,'height':844 if mobile else 768},is_mobile=mobile,has_touch=mobile)
    try:
        page=context.new_page(); errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        load(page,filename)
        def esc(): page.keyboard.press('Escape')
        def present(selector): assert page.locator(selector).count()==1,selector
        def go(selector): page.locator(selector).click(timeout=8000)
        present('#campaignMap')
        for button,back in [('#campaignMap','#mapBack'),('#hangar','#back'),('#devToggle','#devBack')]:
            go(button);present(back);esc();present('#campaignMap')
        go('#multiplayerMenu');present('#mpBack');esc();present('#campaignMap')
        go('#multiplayerMenu');go('#mpOpenHost')
        data=page.locator('input[name="mpMap"]').evaluate_all('(els)=>els.map(e=>({id:e.value,name:e.parentElement.textContent.trim()}))')
        assert len(data)==100 and len(set(m['id'] for m in data))==100 and len(set(m['name'] for m in data))==100,data
        last_data=next(m for m in data if m['id']=='sector-100')
        assert last_data['name'].startswith('100 · '),last_data
        page.locator('.mpMapFamily[data-family="10"] > summary').click()
        last=page.locator('input[name="mpMap"][value="sector-100"]')
        last.check(timeout=8000)
        assert last.is_checked() and page.locator('#mpMapSelected').text_content()==last_data['name']
        assert page.locator('.mpMaps').evaluate('(x)=>x.scrollHeight>x.clientHeight && x.scrollTop>0')
        page.locator('#mpHostNick').fill('Tester');esc();present('#mpOpenHost');go('#mpOpenJoin');page.locator('#mpJoinNick').fill('Tester');esc();present('#mpOpenJoin');esc();present('#campaignMap')
        go('#newRun');page.wait_for_function("window.__neonTest.getState()?.state==='playing'")
        esc();present('#toMenu');assert page.evaluate("window.__neonTest.getState().state")=='paused'
        # Held Escape must not trigger the menu.
        page.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape',repeat:true,bubbles:true,cancelable:true}))")
        present('#toMenu');go('#unpause');assert page.evaluate("window.__neonTest.getState().state")=='playing'
        esc();present('#toMenu');esc();present('#campaignMap')
        assert page.evaluate('window.__neonMissionTest.checkpoint()?.sector')==1
        assert not errors,errors
        print(f'{filename} {"mobile" if mobile else "desktop"}: 100 choices, last selectable, campaign/hangar/dev/network/create/join/pause Escape PASS',flush=True)
    finally:context.close()

if __name__=='__main__':
    with sync_playwright() as p:
        opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):opts['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**opts)
        try:
            for name in ('index.html','dev.html'):
                for mobile in (False,True):run(browser,name,mobile)
        finally:browser.close()
