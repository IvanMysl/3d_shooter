from browser_smoke import load
from playwright.sync_api import sync_playwright
from pathlib import Path

def run(browser, file, width, touch):
    ctx=browser.new_context(viewport={'width':width,'height':844},is_mobile=touch,has_touch=touch)
    try:
        page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));load(page,file)
        page.locator('#multiplayerMenu').click();page.locator('#mpOpenHost').click()
        groups=page.locator('.mpMapFamily');assert groups.count()==18
        assert page.locator('.mpMapFamily[open]').count()==0
        data=groups.evaluate_all('''els=>els.map(g=>({family:+g.dataset.family,maps:[...g.querySelectorAll('input')].map(i=>({id:i.value,label:i.parentElement.textContent.trim()}))}))''')
        ids=set();sectors=set();names=set()
        for f in data:
            n=f['family'];assert len(f['maps'])==(6 if n<=10 else 5)
            group=groups.nth(n-1);summary=group.locator('summary');summary.evaluate('e=>e.click()')
            assert group.evaluate('e=>e.open') and page.locator('.mpMapFamily[open]').count()==1
            for m in f['maps']:
                sector=int(m['label'].split(' · ')[0]);assert (sector-1)%18+1==n
                assert m['id'] not in ids and sector not in sectors and m['label'] not in names
                ids.add(m['id']);sectors.add(sector);names.add(m['label'])
                assert page.locator(f'input[value="{m["id"]}"]').evaluate('e=>{e.click();return e.checked}')
                assert page.locator('#mpMapSelected').text_content()==m['label']
                assert group.locator('small').text_content()=='Выбрана: '+m['label']
                assert page.locator('.mpMapFamilySelected').count()==1
        assert sectors==set(range(1,101)) and len(ids)==len(names)==100
        header=groups.nth(9).locator('summary');header.focus();page.keyboard.press('Enter')
        assert groups.nth(9).evaluate('e=>e.open') and page.locator('.mpMapFamily[open]').count()==1
        radio=page.locator('input[value="sector-100"]');radio.focus();page.keyboard.press('Space')
        assert radio.is_checked() and page.locator('#mpMapSelected').text_content().startswith('100 · ')
        assert page.locator('#mpMapFamilies').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
        header.focus();page.keyboard.press('Space');assert not groups.nth(9).evaluate('e=>e.open') and radio.is_checked()
        # Actual tap/click, not merely synthetic events.
        header=groups.nth(0).locator('summary')
        if touch:header.tap()
        else:header.click()
        assert groups.nth(0).evaluate('e=>e.open')
        label=groups.nth(0).locator('label').first
        if touch:label.tap()
        else:label.click()
        assert page.locator('input[value="citadel"]').is_checked()
        page.keyboard.press('Escape');assert page.locator('#mpOpenHost').count()==1
        assert not errors,errors
        print(f'{file} {width}px: 18 groups, 100 selections, keyboard, exclusivity, no horizontal scroll, Esc PASS',flush=True)
    finally:ctx.close()

if __name__=='__main__':
    with sync_playwright() as p:
        opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']}
        if Path('/usr/bin/chromium').is_file():opts['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**opts)
        try:
            for file in ('index.html','dev.html'):
                for width,touch in ((1365,False),(390,True),(320,True)):run(browser,file,width,touch)
        finally:browser.close()
