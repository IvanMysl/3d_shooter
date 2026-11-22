#!/usr/bin/env python3
"""Actual Chromium DOM regression: nickname placeholder, no READY, host-only launch UI.
The debug hook injects an isolated room without connecting to the public Metered service.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HOOK=r'''window.__stage130LobbyTest={
 fake:(host,players,connected)=>{
  menu();
  mpWire={peerId:host?'host':'guest',close(){} };
  mpRoom={code:'NR-AAAAAAAAAAAAAAAAAAAAAAAAAA',host,hostPeer:'host',
   settings:mpSettings({mapId:'sector-100'}),seq:1,nextId:2,
   players:[{peerId:'host',id:0,nick:'Host',team:0,host:true},
            ...(players>1?[{peerId:'guest',id:1,nick:'Guest',team:1,host:false}]:[])]};
  if(connected){mpRtcLinks.set(host?'guest':'host',{peer:host?'guest':'host',
   pc:{signalingState:'stable'},control:{readyState:'open'},fast:{readyState:'open'}});}
  mpLobby();
 },
 canStart:()=>mpMatchCanStart()
};
'''

def run(browser,name,mobile):
    ctx=browser.new_context(viewport={'width':390 if mobile else 1365,'height':844 if mobile else 768},is_mobile=mobile,has_touch=mobile)
    page=ctx.new_page(); errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
    try:
        js=(ROOT/'dist/game.js').read_text('utf-8')
        instrumented=js[:js.rindex('})();')]+HOOK+js[js.rindex('})();'):]
        html=(ROOT/name).read_text('utf-8')
        if name=='index.html':
            assert html.count(js)==1
            html=html.replace(js,instrumented,1)
        else:
            base='https://neon-rift-130.invalid/'
            html=html.replace('<head>', '<head><base href="'+base+'">', 1)
            def serve(route):
                rel=route.request.url.removeprefix(base)
                if rel=='dist/game.js':return route.fulfill(status=200,body=instrumented,content_type='text/javascript')
                file=(ROOT/rel).resolve()
                if file.is_relative_to(ROOT.resolve()) and file.is_file() and (rel.startswith('styles/') or rel=='dist/legacy-notes.js'):
                    return route.fulfill(status=200,body=file.read_bytes(),content_type='text/css' if rel.endswith('.css') else 'text/javascript')
                route.abort()
            page.route(base+'**',serve)
        page.set_content(html,wait_until='load',timeout=45000)
        page.locator('#multiplayerMenu').click()
        page.locator('#mpOpenHost').click()
        inp=page.locator('#mpHostNick'); assert inp.get_attribute('placeholder')=='Ваш ник'
        assert inp.get_attribute('aria-label')=='Ваш ник'
        assert page.locator('label.mpField').filter(has_text='ВАШ НИК').count()==0
        assert page.get_by_text('Например, Ivan').count()==0
        assert inp.is_visible()
        page.keyboard.press('Escape')
        page.locator('#mpOpenJoin').click()
        inp=page.locator('#mpJoinNick');assert inp.get_attribute('placeholder')=='Ваш ник'
        assert inp.get_attribute('aria-label')=='Ваш ник'
        assert page.locator('#mpReady').count()==0
        page.evaluate('window.__stage130LobbyTest.fake(true,1,false)')
        start=page.locator('#mpStartTraining');assert start.count()==1 and start.is_disabled()
        assert page.locator('#mpReady').count()==0
        assert page.locator('text=Я ГОТОВ').count()==0
        page.evaluate('window.__stage130LobbyTest.fake(true,2,false)')
        assert page.locator('#mpStartTraining').is_disabled(), 'need 2 P2P channels before match'
        page.evaluate('window.__stage130LobbyTest.fake(true,2,true)')
        assert page.evaluate('window.__stage130LobbyTest.canStart()')
        assert page.locator('#mpStartTraining').is_enabled()
        assert 'НАЧАТЬ БОЙ' in start.text_content()
        page.evaluate('window.__stage130LobbyTest.fake(false,2,true)')
        assert page.locator('#mpStartTraining').count()==0
        assert page.locator('#mpReady').count()==0
        assert 'Ведущий может запустить бой' in page.locator('#panel').text_content()
        assert not errors,errors
        print(f'{name} {"mobile" if mobile else "desktop"}: placeholder, host launch gate, guest UI PASS')
    finally:
        ctx.close()

if __name__=='__main__':
    with sync_playwright() as p:
        kwargs={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):kwargs['executable_path']='/usr/bin/chromium'
        b=p.chromium.launch(**kwargs)
        try:
            for name in ('index.html','dev.html'):
                for mobile in (False,True):run(b,name,mobile)
        finally:b.close()
