# Offline browser startup from project bytes, controls, checkpoint reload and damaged import handling.
# Uses an isolated document and explicitly mocked Storage, not native file://.
from pathlib import Path
import json, math, os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
KEY='neonrift3d-save-protected-v1'
BACKUP='neonrift3d-save-protected-backup-v1'
SESSION='neonrift3d-save-protected-session-v1'

def run(browser,filename,mobile):
    context=browser.new_context(viewport={'width':390 if mobile else 1365,'height':844 if mobile else 768},is_mobile=mobile,has_touch=mobile,accept_downloads=True)
    direct=False
    origin='https://neon-release-audit.invalid/'
    target=(ROOT/filename).as_uri() if direct else origin+filename
    if not direct:
        def serve(route):
            name=route.request.url.removeprefix(origin).split('?',1)[0]
            path=(ROOT/name).resolve()
            if not path.is_relative_to(ROOT.resolve()) or not path.is_file():route.abort();return
            if name not in ('index.html','dev.html','dist/game.js','dist/legacy-notes.js') and not (name.startswith('styles/') and name.endswith('.css')):route.abort();return
            typ={'html':'text/html','css':'text/css','js':'text/javascript'}[path.suffix[1:]]
            route.fulfill(status=200,body=path.read_bytes(),content_type=typ)
        context.route(origin+'**',serve)
    page=context.new_page(); errors=[]; network=[]; dialogs=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:network.append(r.url) if r.url.startswith(('http:','https:')) and not r.url.startswith(origin) else None)
    def open_game(initial=None):
        if direct:
            page.goto(target,wait_until='load',timeout=45000)
        else:
            # The managed browser blocks top-level file/HTTP navigation. Use its
            # isolated document, with an in-memory Storage substitute for journal tests.
            data=json.dumps(initial or {}).replace('<','\\u003c')
            shim="""<script>(()=>{const db="""+data+""";const storage=()=>({getItem:k=>Object.hasOwn(db,k)?db[k]:null,setItem:(k,v)=>{db[k]=String(v)},removeItem:k=>delete db[k]});Object.defineProperty(window,'localStorage',{value:storage(),configurable:true});Object.defineProperty(window,'sessionStorage',{value:storage(),configurable:true});window.__auditJournal=db;})();</script>"""
            html=(ROOT/filename).read_text('utf-8').replace('<head>','<head><base href="'+origin+'">'+shim,1)
            page.set_content(html,wait_until='load',timeout=45000)
    def dialog(d):
        dialogs.append(d.message)
        d.accept()
    page.on('dialog',dialog)
    try:
        open_game()
        page.locator('#newRun').click(timeout=10000)
        page.wait_for_function("window.__neonTest.getState()?.state==='playing'")
        state=page.evaluate('window.__neonTest.getState()'); assert state['sector']==1,state
        page.evaluate('window.__neonTest.fire()'); assert page.evaluate('window.__neonTest.getState().shots')>0
        if not mobile:
            page.keyboard.down('w');page.wait_for_timeout(250);page.keyboard.up('w')
        pos=page.evaluate('window.__neonTest.playerPos()');assert all(math.isfinite(pos[k]) for k in ('x','z','yaw')),pos
        assert page.evaluate('window.__neonTest.saveNow()') is True
        good=page.evaluate('(k)=>JSON.parse(localStorage.getItem(k))',KEY)
        assert good['checkpoint']['sector']==1
        def reopen(initial):
            nonlocal page
            page.close();page=context.new_page()
            page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',dialog)
            page.on('request',lambda r:network.append(r.url) if r.url.startswith(('http:','https:')) and not r.url.startswith(origin) else None)
            open_game(initial)
        reopen({KEY:json.dumps(good)})
        page.locator('#resume').click();page.wait_for_function("window.__neonTest.getState()?.state==='playing'")
        assert page.evaluate('window.__neonTest.getState().sector')==1
        assert page.evaluate('window.__neonTest.saveNow()') is True
        good=page.evaluate('(k)=>JSON.parse(localStorage.getItem(k))',KEY)
        bad=json.loads(json.dumps(good));bad['checkpoint']['player']['weapon']=999
        bad['_savedAt']+=100000
        if direct:
            page.evaluate('([k,b,s,v])=>{localStorage.setItem(k,JSON.stringify(v));localStorage.removeItem(b);sessionStorage.removeItem(s)}',[KEY,BACKUP,SESSION,bad])
        reopen({KEY:json.dumps(bad)})
        page.locator('#resume').click();page.wait_for_function("window.__neonTest.getState()?.state==='playing'")
        assert page.evaluate('window.__neonTest.getState().weapon')==0
        assert page.evaluate('window.__neonTest.saveNow()') is True
        good=page.evaluate('(k)=>JSON.parse(localStorage.getItem(k))',KEY)
        reopen({KEY:json.dumps(good)})
        before=page.evaluate('(k)=>localStorage.getItem(k)',KEY)
        bad=json.loads(before);bad['checkpoint']['live']['enemies']={}
        input_el=page.locator('input[type=file][accept*=json]').first
        input_el.set_input_files({'name':'bad.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
        page.wait_for_function('document.querySelector("input[type=file][accept*=json]").value === ""')
        assert page.evaluate('(k)=>localStorage.getItem(k)',KEY)==before
        assert any('Не удалось импортировать' in d for d in dialogs),dialogs
        assert not errors,errors
        assert not network,network
        print(f'{filename} / {"mobile" if mobile else "desktop"}: {"FILE" if direct else "ISOLATED HTML + STORAGE MOCK"} OFFLINE + SAVE + RESUME + INVALID WEAPON + REJECT CORRUPT IMPORT PASS',flush=True)
    finally: context.close()

if __name__=='__main__':
    with sync_playwright() as p:
        kwargs={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):kwargs['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**kwargs)
        try:
            for name in ('index.html','dev.html'):
                for mobile in (False,True): run(browser,name,mobile)
        finally:browser.close()
