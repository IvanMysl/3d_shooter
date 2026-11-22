#!/usr/bin/env python3
"""Stage131: actual Chromium canvas/hud integration with a real generated arena.
Supports the standalone HTML and modular dev.html, touch and desktop profiles.
Uses a test-only instrumented bundle; no debug controls added to shipping code.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HOOK=r'''
window.__tag131={
 start(){
  mpMatchAbort();menu();
  mpWire={peerId:'host',close(){}};
  const roster=[{peerId:'host',id:0,nick:'Хозяин',team:0,host:true},
                {peerId:'guest',id:1,nick:'Гость 123',team:1,host:false}];
  mpRoom={code:'NR-AAAAAAAAAAAAAAAAAAAAAAAAAA',host:true,hostPeer:'host',
    settings:mpSettings({mapId:'reactor'}),players:roster,seq:1,nextId:2};
  if(!mpMatchOpen('test-tags',roster,mpRoom.settings))return {ok:false};
  const p=game.p,a=mpMatch.actors.get(1).p;
  // Search for a free segment in this REAL generated map, not a mock grid.
  for(let r=3;r<=10;r+=.5)for(let i=0;i<48;i++){
   const ang=i*TAU/48,x=p.x+Math.sin(ang)*r,z=p.z+Math.cos(ang)*r;
   const h=supportHeight({feetY:p.feetY,grounded:true},x,z);
   if(Math.abs(h-p.feetY)>.3||collide(x,z,.38)||worldSolidBodyCollision(x,z,.36,h,1.95))continue;
   const eye={x:p.x,y:p.feetY+1.47,z:p.z};
   if(!mpNameTagRayVisible(eye,{x,y:h+1.78,z})||!mpNameTagRayVisible(eye,{x,y:h+2.24,z}))continue;
   a.x=x;a.z=z;a.feetY=h;a.yaw=ang+Math.PI;p.yaw=ang;p.pitch=0;
   render();mpNameTagsUpdate();
   if($('mpNameTags').querySelector('.mpNameTag:not([hidden])'))return {ok:true,x,z,h,dist:r,webgl:glReady};
  }
  return {ok:false,reason:'No visible sector-2 position'};
 },
 visible(){if($('mpNameTags').hidden)return [];return [...document.querySelectorAll('#mpNameTags .mpNameTag:not([hidden])')].map(n=>({nick:n.textContent,style:n.getAttribute('style'),r:n.getBoundingClientRect().toJSON()}));},
 blocked(){
  const p=game.p,a=mpMatch.actors.get(1).p;
  const x=Math.floor((p.x+a.x)/2),z=Math.floor((p.z+a.z)/2);
  const old=mapCells[z]?.[x];if(!mapCells[z]||old===1)return {ok:false};
  mapCells[z][x]=1;mpNameTagsUpdate();
  const visible=window.__tag131.visible().length;
  mapCells[z][x]=old;
  mpNameTagsUpdate();return {ok:true,visible};
 },
 behavior(){
  const a=mpMatch.actors.get(1),m=mpMatch;
  const prev=m.preview;m.preview=true;mpNameTagsUpdate();const inPreview=window.__tag131.visible().length;m.preview=prev;
  m.paused=true;mpNameTagsUpdate();const paused=window.__tag131.visible().length;m.paused=false;
  m.settings.mode='teams';mpNameTagsUpdate();const enemy=$('mpNameTags').querySelector('.mpNameTag:not([hidden])')?.classList.contains('mpNameEnemy');
  a.nick='<img src=x onerror=alert(1)>';mpNameTagsUpdate();const safe=$('mpNameTags').querySelector('.mpNameTag:not([hidden])')?.textContent===a.nick&&!$('mpNameTags').querySelector('img');
  a.nick='Гость 123';m.settings.mode='ffa';mpNameTagsUpdate();
  return {inPreview,paused,enemy,safe};
 },
 moveAway(){const a=mpMatch.actors.get(1).p;a.hp=0;mpNameTagsUpdate();return window.__tag131.visible().length;},
 info(){return {state:game.state,webgl:glReady,map:mpMap(mpRoom.settings.mapId)?.sector,
   hasOverlay:!!$('mpNameTags'),count:window.__tag131.visible().length}}
};
'''

def check(browser,file,mobile):
    dims=(390,844) if mobile else (1365,768)
    ctx=browser.new_context(viewport={'width':dims[0],'height':dims[1]},is_mobile=mobile,has_touch=mobile)
    page=ctx.new_page();errs=[];page.on('pageerror',lambda err:errs.append(str(err)))
    try:
        js=(ROOT/'dist/game.js').read_text(encoding='utf-8')
        instrumented=js[:js.rindex('})();')]+HOOK+js[js.rindex('})();'):]
        html=(ROOT/file).read_text(encoding='utf-8')
        if file=='index.html':
            assert html.count(js)==1
            html=html.replace(js,instrumented,1)
        else:
            base='https://neon-131.invalid/'
            html=html.replace('<head>',f'<head><base href="{base}">',1)
            def serve(route):
                rel=route.request.url.removeprefix(base)
                if rel=='dist/game.js':return route.fulfill(status=200,body=instrumented,content_type='text/javascript')
                path=(ROOT/rel).resolve()
                if path.is_relative_to(ROOT) and path.is_file() and (rel.startswith('styles/') or rel=='dist/legacy-notes.js'):
                    return route.fulfill(status=200,body=path.read_bytes(),content_type='text/css' if rel.endswith('.css') else 'text/javascript')
                return route.abort()
            page.route(base+'**',serve)
        page.set_content(html,wait_until='load',timeout=60000)
        result=page.evaluate('window.__tag131.start()')
        assert result.get('ok'),result
        page.wait_for_timeout(120)
        visible=page.evaluate('window.__tag131.visible()')
        assert visible and visible[0]['nick']=='Гость 123',visible
        if file=='index.html':page.screenshot(path=str(ROOT/('STAGE131_NAMEPLATE_MOBILE.png' if mobile else 'STAGE131_NAMEPLATE_DESKTOP.png')))
        assert page.locator('#mpNameTags .mpNameTag:not([hidden])').count()==1
        assert page.locator('#mpNameTags .mpNameTag').evaluate('(n)=>getComputedStyle(n).pointerEvents')=='none'
        behavior=page.evaluate('window.__tag131.behavior()')
        assert behavior['inPreview']==0 and behavior['paused']==0 and behavior['enemy'] and behavior['safe'],behavior
        blocked=page.evaluate('window.__tag131.blocked()')
        assert blocked.get('ok') and blocked.get('visible')==0,blocked
        assert page.evaluate('window.__tag131.moveAway()')==0
        assert not errs,errs[:3]
        print(file,'mobile' if mobile else 'PC','WEBGL' if result['webgl'] else 'CANVAS','9 checks PASS')
        return 9
    finally:ctx.close()

if __name__=='__main__':
    with sync_playwright() as p:
        args={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):args['executable_path']='/usr/bin/chromium'
        b=p.chromium.launch(**args)
        try:
            total=0
            for f in ('index.html','dev.html'):
                for mobile in (False,True):total+=check(b,f,mobile)
            print('Stage131 browser',total,'PASS')
        finally:b.close()
