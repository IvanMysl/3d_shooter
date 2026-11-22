#!/usr/bin/env python3
"""Chromium visual-layout regression for mobile IME overlay and full chat logs.

No OS keyboard is available to headless Chromium, so simulate its *occlusion*
using a screen-space bound and ensure composer stays above it even when browser
fails to report a reduced VisualViewport (observed in Android content:// pages).
"""
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = r'''
window.__chatQA125={
 setup(){
  mpWire={peerId:'qa-host'};
  mpRoom={host:true,hostPeer:'qa-host',players:[{peerId:'qa-host',id:0,nick:'Проверка',host:true}]};
  panel('<div>Проверка чата</div><button id="mpLobbyChat">Чат комнаты</button>');
  $('mpLobbyChat').onclick=mpChatOpen;
  return true;
 },
 log(n){
  mpChat.items=Array.from({length:n},(_,i)=>({seq:i+1,id:'qa-'+i,nick:'Игрок '+i,text:'Сообщение '+i+' с длинным текстом для нескольких строк, который должен прокручиваться',at:Date.now()}));
  mpChatRender(true);
 },
 mapping(){return miniZoom},
 keyInInput(){
  const before=miniZoom;
  const e=new KeyboardEvent('keydown',{code:'KeyM',key:'m',bubbles:true,cancelable:true});
  $('mpChatInput').dispatchEvent(e);
  return before===miniZoom && !e.defaultPrevented;
 }
};
'''

def page_html(modular):
    html=(ROOT/('dev.html' if modular else 'index.html')).read_text(encoding='utf-8')
    if modular:
        html=re.sub(r'<link\s+[^>]*href="(styles/[^"]+)"[^>]*>',
                    lambda m:'<style>'+(ROOT/m.group(1)).read_text(encoding='utf-8')+'</style>',html)
        html=re.sub(r'<script\s+src="([^"]+)"\s*></script>',
                    lambda m:'<script>'+(ROOT/m.group(1)).read_text(encoding='utf-8')+'</script>',html)
    assert '})();\n</script>' in html
    return html.replace('})();\n</script>',FIXTURE+'})();\n</script>',1)


def main():
    total=0
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--disable-gpu','--use-gl=swiftshader'])
        for modular in (False,True):
            for width,height,kb_top,label in (
                (800,360,180,'Android landscape'),
                (390,844,375,'Android portrait 390'),
                (320,640,275,'Android portrait 320'),
            ):
                context=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
                page=context.new_page();errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                page.set_content(page_html(modular),wait_until='domcontentloaded');page.wait_for_timeout(100)
                assert page.evaluate('window.__chatQA125.setup()')
                page.locator('#mpLobbyChat').tap()
                assert page.locator('#mpChatLayer').is_visible();total+=1
                input_element=page.locator('#mpChatInput')
                # Stage128 deliberately leaves the IME closed when chat opens;
                # focus explicitly to exercise the old keyboard-obscuration QA.
                input_element.focus();page.wait_for_timeout(160)
                for n in (0,1,3,12,50,100):
                    page.evaluate(f'window.__chatQA125.log({n})')
                    bounds=page.evaluate('''() => {
                      const field=document.getElementById('mpChatInput').getBoundingClientRect(),header=document.querySelector('#mpChatDialog header').getBoundingClientRect(),
                            history=document.getElementById('mpChatHistory').getBoundingClientRect(),scroll=document.getElementById('mpChatScroll').getBoundingClientRect(),layer=document.getElementById('mpChatLayer').getBoundingClientRect();
                      return {field:{y:field.y,bottom:field.bottom},header:{bottom:header.bottom},history:{y:history.y,height:history.height},scroll:{y:scroll.y,height:scroll.height},layer:{height:layer.height}};
                    }''')
                    assert bounds['field']['y']>=bounds['history']['y']+bounds['history']['height']-2,(label,n,bounds)
                    assert bounds['field']['bottom']<=kb_top,(label,n,'INPUT HIDDEN UNDER KEYBOARD',bounds)
                    assert bounds['scroll']['y']>=bounds['header']['bottom']-2,(label,n,bounds)
                    assert bounds['history']['height']>=0,(label,n,bounds)
                    total+=4
                input_element.fill('Я пишу M, ь и 🙂')
                assert input_element.input_value()=='Я пишу M, ь и 🙂';total+=1
                assert page.evaluate('window.__chatQA125.keyInInput()');total+=1
                page.locator('#mpChatClose').tap()
                assert not page.locator('#mpChatLayer').is_visible();total+=1
                assert not errors,(label,errors[:3]);total+=1
                print(('modular' if modular else 'standalone'),label,'PASS')
                context.close()
        # Desktop composer remains below history, with Enter/Esc intact.
        context=browser.new_context(viewport={'width':1365,'height':768})
        page=context.new_page();page.set_content(page_html(False));page.evaluate('window.__chatQA125.setup()');page.keyboard.press('t')
        assert page.locator('#mpChatLayer').is_visible();total+=1
        page.evaluate('window.__chatQA125.log(12)')
        form=page.locator('#mpChatForm').bounding_box();hist=page.locator('#mpChatHistory').bounding_box()
        assert form['y']>=hist['y']+hist['height']-1;total+=1
        page.keyboard.press('Escape');assert not page.locator('#mpChatLayer').is_visible();total+=1
        context.close();browser.close()
    print('STAGE126 CHAT KEYBOARD LAYOUT:',total,'PASS')

if __name__=='__main__':main()
