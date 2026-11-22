#!/usr/bin/env python3
"""Instrumented QA only: invoke built-in end screens without playing 100 missions.
The release HTML is not modified; the isolated test page exposes the closure's
existing screen functions to Playwright. The runtime handlers and DOM are real.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os
ROOT=Path(__file__).resolve().parents[1]
HOOK='''
window.__stage115ScreenAudit={
  defeat:()=>gameOver(),reward:()=>showUpgrade(),victory:()=>showFinalVictory(),
  home:()=>menu(),
  fakeLobby:()=>{menu();mpWire={peerId:'guest',close(){}};
   mpRoom={code:'NR-AAAAAAAAAAAAAAAAAAAAAAAAAA',host:false,hostPeer:'host',settings:mpSettings({mapId:'sector-100'}),players:[{peerId:'host',id:0,nick:'Host',team:0,ready:true,host:true},{peerId:'guest',id:1,nick:'Guest',team:1,ready:true,host:false}]};mpLobby();},
  fakeMatch:(results=false)=>{window.__stage115ScreenAudit.fakeLobby();
   game={state:'paused'};const roster=mpRoom.players;
   mpMatch={active:true,paused:false,self:1,host:false,actors:new Map(),roster,settings:mpRoom.settings,
    round:{ended:results,result:results?{mode:'ffa',reason:'score',winnerId:0,players:[{id:0,k:5,d:1},{id:1,k:1,d:5}]}:null}};
   if(results)mpRoundShowResults();else mpMatchPause();},
  state:()=>({game:game?.state,mp:!!mpRoom,paused:mpMatch?.paused,checkpoint:save.checkpoint?{sector:save.checkpoint.sector,state:save.checkpoint.state,pendingUpgrade:save.checkpoint.pendingUpgrade}:null})
};
'''

def run(browser,filename):
    ctx=browser.new_context(viewport={'width':1365,'height':768})
    page=ctx.new_page(); errors=[]
    page.on('pageerror',lambda x:errors.append(str(x)))
    try:
        js=(ROOT/'dist/game.js').read_text('utf-8');i=js.rindex('})();');instrumented=js[:i]+HOOK+js[i:]
        html=(ROOT/filename).read_text('utf-8')
        if filename=='index.html':
            assert html.count(js)==1;html=html.replace(js,instrumented,1)
        else:
            base='https://neon-rift-menu-audit.invalid/';html=html.replace('<head>','<head><base href="'+base+'">',1)
            def serve(route):
                rel=route.request.url.removeprefix(base)
                if rel=='dist/game.js':route.fulfill(status=200,body=instrumented,content_type='application/javascript');return
                file=(ROOT/rel).resolve()
                if file.is_relative_to(ROOT.resolve()) and file.is_file() and (rel.startswith('styles/') or rel=='dist/legacy-notes.js'):
                    route.fulfill(status=200,body=file.read_bytes(),content_type='text/css' if rel.endswith('.css') else 'application/javascript')
                else:route.abort()
            page.route(base+'**',serve)
        page.set_content(html,wait_until='load',timeout=45000)
        def evaluate(code):return page.evaluate(code)
        def expect(id):assert page.locator('#'+id).count()==1,id
        def esc():page.keyboard.press('Escape')
        evaluate('window.__neonTest.debugStart()');evaluate('window.__stage115ScreenAudit.reward()');expect('winMenu');before=evaluate('window.__stage115ScreenAudit.state().checkpoint');assert before['state']=='upgrade' and len(before['pendingUpgrade'])==3
        esc();expect('campaignMap');assert evaluate('window.__stage115ScreenAudit.state().checkpoint')==before
        evaluate('window.__neonTest.debugStart()');evaluate('window.__stage115ScreenAudit.defeat()');expect('backMenu');esc();expect('campaignMap')
        evaluate('window.__neonTest.debugStart()');evaluate('window.__stage115ScreenAudit.victory()');expect('finalMenu');esc();expect('campaignMap')
        evaluate('window.__stage115ScreenAudit.fakeLobby()');expect('mpLeave');esc();expect('campaignMap');assert not evaluate('window.__stage115ScreenAudit.state().mp')
        evaluate('window.__stage115ScreenAudit.fakeMatch(false)');expect('mpResume');esc();assert evaluate('window.__stage115ScreenAudit.state().paused') is False and evaluate('window.__stage115ScreenAudit.state().mp')
        evaluate('window.__stage115ScreenAudit.home()');evaluate('window.__stage115ScreenAudit.fakeMatch(true)');expect('mpResultExit');esc();expect('campaignMap');assert not evaluate('window.__stage115ScreenAudit.state().mp')
        assert not errors,errors
        print(filename+' end screens: reward retained, defeat, final, lobby, multiplayer pause and results PASS',flush=True)
    finally:ctx.close()
if __name__=='__main__':
    with sync_playwright() as p:
        opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):opts['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**opts)
        try:
            for name in ('index.html','dev.html'):run(browser,name)
        finally:browser.close()
