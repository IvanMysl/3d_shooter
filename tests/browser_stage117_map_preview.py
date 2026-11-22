from pathlib import Path
import os,json,math
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]

def run(browser,filename,width,touch):
    ctx=browser.new_context(viewport={'width':width,'height':780},is_mobile=touch,has_touch=touch)
    page=ctx.new_page(); errors=[];network=[];checks=0
    page.on('pageerror',lambda e:errors.append(str(e)))
    origin='https://neon-preview-audit.invalid/'
    def serve(route):
        name=route.request.url.removeprefix(origin).split('?',1)[0]
        allowed=name in ('dist/game.js','dist/legacy-notes.js') or name.startswith('styles/') and name.endswith('.css')
        p=(ROOT/name).resolve()
        if allowed and p.is_relative_to(ROOT) and p.is_file():route.fulfill(status=200,body=p.read_bytes(),content_type='text/css' if p.suffix=='.css' else 'text/javascript')
        else:route.abort()
    ctx.route(origin+'**',serve)
    page.on('websocket',lambda s:network.append(s.url))
    page.on('request',lambda r:network.append(r.url) if r.url.startswith(('https:','http:')) and not r.url.startswith(origin) else None)
    shim="""<script>(()=>{const db={};const obj={getItem:k=>db[k]??null,setItem:(k,v)=>{db[k]=String(v);window.__previewWrites++},removeItem:k=>{delete db[k];window.__previewWrites++}};window.__previewWrites=0;Object.defineProperty(window,'localStorage',{value:obj,configurable:true});Object.defineProperty(window,'sessionStorage',{value:obj,configurable:true});window.__previewDb=db;})();</script>"""
    html=(ROOT/filename).read_text('utf-8').replace('<head>','<head><base href="'+origin+'">'+shim,1)
    def check(v,msg):
        nonlocal checks
        assert v,msg
        checks+=1
    def click(el):
        el.tap() if touch else el.click()
    try:
        page.set_content(html,wait_until='load',timeout=45000)
        click(page.locator('#multiplayerMenu'));click(page.locator('#mpOpenHost'))
        page.locator('#mpHostNick').fill('PreviewTester');page.locator('#mpMode').select_option('teams');page.locator('#mpEquipment').select_option('equal');page.locator('#mpWeapon').select_option('3');page.locator('#mpScoreLimit').select_option('50');page.locator('#mpTimeLimit').select_option('900')
        original=page.evaluate('''()=>({writes:window.__previewWrites,db:JSON.stringify(window.__previewDb),save:JSON.stringify(__neonTest.saveSummary()),campaign:JSON.stringify(__neonTest.campaign())})''')
        data=page.locator('.mpMapCard').evaluate_all('''els=>els.map(e=>({radio:e.querySelector('input').value,preview:e.querySelector('button').dataset.previewMap,label:e.querySelector('label').textContent.trim()}))''')
        check(len(data)==100 and len({x['preview'] for x in data})==100,'100 independent preview buttons')
        for x in data:check(x['radio']==x['preview'],'paired map id')
        # Real touch/click on different families; choose a map distinct from the inspected map.
        for sector in (19,100,1):
            equipment='owned' if sector==1 else 'equal'
            page.locator('#mpEquipment').select_option(equipment)
            map_id=next(x['preview'] for x in data if int(x['label'].split(' · ')[0])==sector)
            group=page.locator(f'.mpMapFamily[data-family="{(sector-1)%18+1}"]')
            if not group.evaluate('e=>e.open'):click(group.locator('summary'))
            button=group.locator(f'button[data-preview-map="{map_id}"]');button.scroll_into_view_if_needed()
            box=button.bounding_box();check(box['height']>=43 and box['width']>=43,'touch target')
            check(page.locator('#mpMapFamilies').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),'no horizontal overflow')
            expected=page.evaluate('''()=>({selected:document.querySelector('input[name=mpMap]:checked').value,open:[...document.querySelectorAll('.mpMapFamily[open]')].map(e=>e.dataset.family),pane:document.querySelector('#panel').scrollTop,list:document.querySelector('#mpMapFamilies').scrollTop})''')
            click(button)
            page.wait_for_function("document.body.classList.contains('mpMapPreview')",timeout=30000)
            state=page.evaluate('window.__neonTest.getState()');check(state['sector']==sector and state['enemies']==state['spawned']==state['kills']==state['score']==0 and not state['portalReady'],'empty preview exact sector')
            check(page.locator('#sectorText').text_content().startswith(f'{sector:02d} · '),'map title')
            check(page.evaluate('window.__neonTest.nodes().length')==0,'no reactors')
            check(page.evaluate('window.__neonTest.saveNow()') is False,'save blocked')
            page.evaluate('window.__neonTest.weaponSelect(4)')
            page.wait_for_timeout(400)
            page.evaluate('window.__neonTest.fire()')
            page.wait_for_function('window.__neonTest.getState().shots>0',timeout=5000)
            check(page.evaluate('window.__neonTest.getState().shots>0'),'PvP shot')
            check(page.evaluate('window.__neonTest.getState().weapon')==(4 if equipment=='owned' else 3),'weapon rule')
            if sector==19:
                if touch:click(page.locator('#shieldTouch'))
                else:page.keyboard.press('c')
                page.wait_for_function("document.querySelector('#shieldTouch').classList.contains('abilityActive')",timeout=5000)
                check(page.locator('#shieldTouch').get_attribute('data-cooldown')=='АКТИВНА','shield via input')
                if touch:click(page.locator('#viewTouch'))
                else:page.keyboard.press('F5')
                check(page.locator('body').evaluate("e=>e.classList.contains('thirdPerson')"),'local camera switch')
                p0=page.evaluate('window.__neonTest.playerPos()')
                if not touch:
                    page.keyboard.down('w');page.wait_for_timeout(350);page.keyboard.up('w')
                else:
                    # Use genuine Chromium touch events (pointer capture is handled by browser).
                    rect=page.locator('#joystick').bounding_box();cdp=ctx.new_cdp_session(page)
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':rect['x']+rect['width']/2,'y':rect['y']+10}]})
                    page.wait_for_timeout(400)
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
                p1=page.evaluate('window.__neonTest.playerPos()')
                check(math.hypot(p1['x']-p0['x'],p1['z']-p0['z'])>.01,'walking')
                if touch:click(page.locator('#flightToggle'))
                else:page.keyboard.press('v')
                page.wait_for_function("document.body.classList.contains('flying')",timeout=5000)
                check(page.locator('body').evaluate("e=>e.classList.contains('flying')"),'flight enabled')
                y=page.evaluate('window.__neonTest.vertical().feetY')
                if not touch:
                    page.keyboard.down('Space');page.wait_for_timeout(350);page.keyboard.up('Space')
                else:
                    rect=page.locator('#flightUp').bounding_box();cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':rect['x']+rect['width']/2,'y':rect['y']+rect['height']/2}]});page.wait_for_timeout(400);cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
                check(page.evaluate('window.__neonTest.vertical().feetY')>y+.01,'vertical flight')
                if os.environ.get('SCREENSHOTS'):page.screenshot(path=f'/mnt/data/neon118_preview_{width}.png')
            if sector==100:
                page.evaluate('''()=>{window.__pulsePeak=0;const until=performance.now()+5000;function sample(){window.__pulsePeak=Math.max(window.__pulsePeak,__neonTest.pulseFxCount());if(performance.now()<until)requestAnimationFrame(sample)}sample()}''')
                if touch:click(page.locator('#pulseTouch'))
                else:page.keyboard.press('q')
                page.wait_for_function("document.querySelector('#pulseTouch').classList.contains('recharging')",timeout=5000)
                page.wait_for_function('window.__pulsePeak===45',timeout=5000)
                check(page.evaluate('window.__pulsePeak===45'),'full cyan pulse particles via input')
            if sector==1:
                if touch:click(page.locator('#mobileSwitch'))
                else:page.keyboard.press('r')
                check(page.locator('#weaponDrawer [data-wpn]').count()==10,'all ten weapons in arsenal')
                click(page.locator('#weaponDrawer [data-wpn="0"]'))
                check(page.evaluate('window.__neonTest.getState().weapon===0'),'arsenal select')
                if touch:click(page.locator('#dashTouch'))
                else:page.keyboard.press('e')
                page.wait_for_function("document.querySelector('#dashTouch').classList.contains('recharging')",timeout=5000)
                check(True,'dash via input')
                page.evaluate('window.__neonTest.setDamage(22)')
                if touch:click(page.locator('#healTouch'))
                else:page.keyboard.press('f')
                page.wait_for_function("document.querySelector('#armorLabel').textContent.startsWith('30/30')",timeout=5000)
                check(True,'repair via input')
                # A real rocket meeting a surface must leave a physical mark,
                # not merely an explosion orb. Exercise the final UI build.
                page.wait_for_function('__neonTest.effectCounts().projectiles===0',timeout=8000)
                page.evaluate('__neonTest.weaponSelect(4)')
                page.wait_for_timeout(650)
                check(bool(page.evaluate('__neonTest.testAimWall()')),'aim at real wall')
                old_marks=page.evaluate('__neonTest.effectCounts().decals')
                page.evaluate('__neonTest.fire()')
                page.wait_for_function(f'__neonTest.effectCounts().decals>{old_marks}',timeout=8000)
                check(page.evaluate('__neonTest.effectCounts().decals')>old_marks,'rocket surface mark in preview')
            if sector==100 and not touch:page.keyboard.press('Escape')
            else:click(page.locator('#pauseBtn'))
            check(not page.locator('body').evaluate("e=>e.classList.contains('mpMapPreview')"),'exit preview')
            check(page.evaluate('window.__neonTest.getState()') is None,'preview game released')
            actual=page.evaluate('''()=>({selected:document.querySelector('input[name=mpMap]:checked').value,open:[...document.querySelectorAll('.mpMapFamily[open]')].map(e=>e.dataset.family),pane:document.querySelector('#panel').scrollTop,list:document.querySelector('#mpMapFamilies').scrollTop})''')
            check(actual['selected']==expected['selected'] and actual['open']==expected['open'],'radio/group restored')
            check(abs(actual['pane']-expected['pane'])<=3 and abs(actual['list']-expected['list'])<=3,('scroll restored',actual,expected))
            for sel,val in (('#mpHostNick','PreviewTester'),('#mpMode','teams'),('#mpEquipment',equipment),('#mpWeapon','3'),('#mpScoreLimit','50'),('#mpTimeLimit','900')):check(page.locator(sel).input_value()==val,sel)
            check(page.evaluate('''()=>({writes:window.__previewWrites,db:JSON.stringify(window.__previewDb),save:JSON.stringify(__neonTest.saveSummary()),campaign:JSON.stringify(__neonTest.campaign())})''')==original,'no save writes or campaign changes')
        check(not network,network);check(not errors,errors)
        if os.environ.get('SCREENSHOTS'):page.screenshot(path=f'/mnt/data/neon118_form_{width}.png')
        print(f'{filename} {width}px: {checks} checks PASS',flush=True)
    finally:ctx.close()

if __name__=='__main__':
    with sync_playwright() as p:
        opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']}
        if Path('/usr/bin/chromium').is_file():opts['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**opts)
        try:
            for filename in os.environ.get('FILES','index.html,dev.html').split(','):
                for width in map(int,os.environ.get('WIDTHS','1365,390,320').split(',')):run(browser,filename,width,width<700)
        finally:browser.close()
