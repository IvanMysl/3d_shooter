#!/usr/bin/env python3
"""Stage126 mobile chat: conversation above composer, composer above IME.

Headless Chromium does not provide Android's physical IME. Exercises both
synthetic occlusion (keyboard never reports geometry) and viewport/VirtualKeyboard
geometry paths against the real compiled and modular game. Includes log sizes
0-100, portrait and landscape, input focus and text keyboard routing.
"""
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
FIXTURE=r'''
window.__chatQA126={
 setup(){
  mpWire={peerId:'qa-host'};
  mpRoom={host:true,hostPeer:'qa-host',players:[{peerId:'qa-host',id:0,nick:'Тестер',host:true}]};
  panel('<div>Проверка чата Stage126</div><button id="mpLobbyChat">Чат комнаты</button>');
  $('mpLobbyChat').onclick=mpChatOpen;
 },
 log(n){
  mpChat.items=Array.from({length:n},(_,i)=>({seq:i+1,id:'qa-'+i,nick:'Игрок '+i,
   text:'Сообщение №'+i+' с довольно длинным текстом: это проверка того, как история прокручивается.',at:Date.now()}));
  mpChatRender(true);
 },
 height(base,visual,inner,kb,focused,mobile){return mpChatAvailableHeight(base,visual,inner,kb,focused,mobile);},
 simulatedReportedViewport(visible,kb=0){
  const viewportDescriptor=Object.getOwnPropertyDescriptor(window,'visualViewport');
  const keyboardDescriptor=Object.getOwnPropertyDescriptor(navigator,'virtualKeyboard');
  const realVV=window.visualViewport;
  try {
   Object.defineProperty(window,'visualViewport',{configurable:true,value:{height:visible,width:window.innerWidth,offsetTop:0,offsetLeft:0}});
   Object.defineProperty(navigator,'virtualKeyboard',{configurable:true,value:{boundingRect:{height:kb}}});
   mpChatViewport();return this.geometry();
  } finally {
   if(viewportDescriptor)Object.defineProperty(window,'visualViewport',viewportDescriptor);
   else delete window.visualViewport;
   if(keyboardDescriptor)Object.defineProperty(navigator,'virtualKeyboard',keyboardDescriptor);
   else delete navigator.virtualKeyboard;
   mpChatViewport();
  }
 },
 mapState(){return miniZoom;},
 invalidateKey(){
  const before=miniZoom;
  const e=new KeyboardEvent('keydown',{code:'KeyM',key:'m',bubbles:true,cancelable:true});
  $('mpChatInput').dispatchEvent(e);
  return before===miniZoom&&!e.defaultPrevented;
 },
 geometry(){
  const box=id=>{const r=$(id).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,width:r.width};};
  return {header:box('mpChatTitle'),history:box('mpChatHistory'),scroll:box('mpChatScroll'),form:box('mpChatForm'),
   input:box('mpChatInput'),layer:box('mpChatLayer'),scrollHeight:$('mpChatHistory').scrollHeight};
 }
};
'''

def html(modular):
    out=(ROOT/('dev.html' if modular else 'index.html')).read_text(encoding='utf-8')
    if modular:
        out=re.sub(r'<link\s+[^>]*href="(styles/[^"]+)"[^>]*>',
                   lambda m:'<style>'+(ROOT/m.group(1)).read_text(encoding='utf-8')+'</style>',out)
        out=re.sub(r'<script\s+src="([^"]+)"\s*></script>',
                   lambda m:'<script>'+(ROOT/m.group(1)).read_text(encoding='utf-8')+'</script>',out)
    assert '})();\n</script>' in out
    return out.replace('})();\n</script>',FIXTURE+'})();\n</script>',1)


def main():
    checks=0
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium'),
                                   args=['--disable-gpu','--use-gl=swiftshader'])
        for modular in (False,True):
            for width,height,keyboard_top in ((800,360,180),(390,844,375),(320,640,275),
                                              (720,320,160),(360,780,340),(360,280,130)):
                c=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
                page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                page.set_content(html(modular),wait_until='domcontentloaded');page.evaluate('window.__chatQA126.setup()')
                page.locator('#mpLobbyChat').tap();assert page.locator('#mpChatLayer').is_visible();checks+=1
                # Stage128 separates opening chat from opening Android keyboard.
                page.locator('#mpChatInput').focus();page.wait_for_timeout(120)
                g=page.evaluate('window.__chatQA126.geometry()')
                # No IME geometry reported: conservative fallback must keep input above overlay.
                assert g['input']['bottom']<=keyboard_top,(modular,width,height,g);checks+=1
                for n in (0,1,3,12,50,100):
                    page.evaluate(f'window.__chatQA126.log({n})')
                    g=page.evaluate('window.__chatQA126.geometry()')
                    assert g['scroll']['top']>=g['header']['bottom']-8,(modular,width,height,n,g);checks+=1
                    assert g['form']['top']>=g['history']['bottom']-2,(modular,width,height,n,g);checks+=1
                    assert g['input']['bottom']<=keyboard_top,(modular,width,height,n,g);checks+=1
                    assert g['layer']['bottom']<=keyboard_top,(modular,width,height,n,g);checks+=1
                    assert g['history']['height']>=0,(modular,width,height,n,g);checks+=1
                # The keyboard is explicitly reported as a shorter visual
                # viewport. The composer should be at the bottom of THAT area.
                visible=int(height*.63)
                reported=page.evaluate(f'window.__chatQA126.simulatedReportedViewport({visible},0)')
                assert reported['input']['bottom']<=visible,(modular,width,height,reported);checks+=1
                assert reported['history']['bottom']<=reported['form']['top']+2;checks+=1
                # Both APIs reporting must NOT subtract keyboard height twice.
                both=page.evaluate(f'window.__chatQA126.simulatedReportedViewport({visible},80)')
                assert both['input']['bottom']<=visible,(modular,width,height,both);checks+=1
                assert abs(both['form']['bottom']-reported['form']['bottom'])<2;checks+=1
                page.locator('#mpChatInput').fill('Привет! M, ь, Ё, 🙂')
                assert page.locator('#mpChatInput').input_value()=='Привет! M, ь, Ё, 🙂';checks+=1
                assert page.evaluate('window.__chatQA126.invalidateKey()');checks+=1
                # When OS/browser reports a smaller viewport, do not subtract the
                # keyboard a second time from that already reduced height.
                v=page.evaluate('''() => [
                  window.__chatQA126.height(360,280,360,0,true,true),
                  window.__chatQA126.height(360,280,360,80,true,true),
                  window.__chatQA126.height(360,360,360,80,true,true),
                  window.__chatQA126.height(360,360,360,0,true,true),
                  window.__chatQA126.height(360,360,360,0,false,true)]''')
                assert v==[280,280,280,151,360],(v,width,height);checks+=5
                page.locator('#mpChatClose').tap();assert not page.locator('#mpChatLayer').is_visible();checks+=1
                assert not errors,(width,height,modular,errors);checks+=1
                if not modular and width==800:
                    page.locator('#mpLobbyChat').tap();page.evaluate('window.__chatQA126.log(100)')
                    page.screenshot(path='/mnt/data/NEON_RIFT_3D_STAGE126_CHAT_UI_PREVIEW.png')
                    page.locator('#mpChatClose').tap()
                c.close()
                print(('modular' if modular else 'standalone'),f'{width}x{height}','PASS')
        # Desktop should remain messages above composer at normal height.
        c=browser.new_context(viewport={'width':1365,'height':768});page=c.new_page()
        page.set_content(html(False),wait_until='domcontentloaded');page.evaluate('window.__chatQA126.setup()')
        page.keyboard.press('t');page.evaluate('window.__chatQA126.log(100)')
        g=page.evaluate('window.__chatQA126.geometry()')
        assert g['form']['top']>=g['history']['bottom']-2;checks+=1
        assert g['layer']['height']>g['history']['height'];checks+=1
        page.keyboard.press('Escape');assert not page.locator('#mpChatLayer').is_visible();checks+=1
        c.close();browser.close()
    print('STAGE126 MOBILE CHAT KEYBOARD',checks,'PASS')

if __name__=='__main__':main()
