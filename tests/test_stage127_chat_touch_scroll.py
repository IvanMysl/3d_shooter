#!/usr/bin/env python3
"""Stage127: actual Chromium touch gestures in room log, IME on/off.

The Android IME itself is not available in headless Chromium.  Focus uses
Stage126's conservative visible area and the test dispatches real CDP touch
input to the browser's native scroll handler.  Regression also tests history
updates and chat reset while the reader has scrolled to older entries.
"""
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
FIXTURE=r'''
window.__chatQA127={
 setup(){
  mpWire={peerId:'qa-host'};
  mpRoom={host:true,hostPeer:'qa-host',players:[{peerId:'qa-host',id:0,nick:'Тестер',host:true}]};
  panel('<div>Stage127</div><button id="mpLobbyChat">Чат комнаты</button>');
  $('mpLobbyChat').onclick=mpChatOpen;
 },
 set(n){
  mpChat.items=Array.from({length:n},(_,i)=>({seq:i+1,id:'qa-'+i,nick:'Игрок '+i,
   text:'Текст '+i+' — сообщение с достаточной длиной для прокрутки и проверки кириллицы.',at:Date.now()}));
  mpChatRender(true);
 },
 append(){
  const retained=$('mpChatHistory').querySelectorAll('.mpChatLine')[49];
  mpChat.items.push({seq:101,id:'qa-100',nick:'Поздний игрок',text:'Новое сообщение',at:Date.now()});
  mpChat.items.splice(0,1);mpChatRender();return !!retained?.isConnected;
 },
 refresh(){const h=$('mpChatHistory'),first=h.querySelector('.mpChatLine');mpChatRender();return first===h.querySelector('.mpChatLine');},
 geometry(){
  const r=id=>$(id).getBoundingClientRect();const h=mpChatScrollBox();
  return {historyHeight:r('mpChatScroll').height,top:r('mpChatScroll').top,
   bottom:r('mpChatHistory').bottom,inputBottom:r('mpChatInput').bottom,
   formTop:r('mpChatForm').top,scrollTop:h.scrollTop,maxScroll:h.scrollHeight-h.clientHeight,
   children:h.children.length,first:h.firstElementChild?.dataset.chatKey};
 }
};
'''

def document(modular):
    output=(ROOT/('dev.html' if modular else 'index.html')).read_text('utf-8')
    if modular:
        output=re.sub(r'<link\s+[^>]*href="(styles/[^"]+)"[^>]*>',
                      lambda m:'<style>'+(ROOT/m.group(1)).read_text('utf-8')+'</style>',output)
        output=re.sub(r'<script\s+src="([^"]+)"\s*></script>',
                      lambda m:'<script>'+(ROOT/m.group(1)).read_text('utf-8')+'</script>',output)
    assert '})();\n</script>' in output
    return output.replace('})();\n</script>',FIXTURE+'})();\n</script>',1)


def swipe(page, box, downward):
    cdp=page.context.new_cdp_session(page)
    x=box['x']+box['width']*.50
    # Swipe across the single scroll surface: the form moves with messages.
    start=box['y']+box['height']*(.20 if downward else .80)
    end=box['y']+box['height']*(.80 if downward else .20)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':start}]})
    for j in range(1,11):
        y=start+(end-start)*j/10
        cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y}]})
        page.wait_for_timeout(13)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    page.wait_for_timeout(360)
    cdp.detach()


def main():
    checks=0
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium'),
                                   args=['--disable-gpu','--use-gl=swiftshader'])
        for modular in (False,True):
            for width,height in ((390,844),(320,640),(800,360)):
                context=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
                page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                page.set_content(document(modular),wait_until='domcontentloaded')
                page.evaluate('window.__chatQA127.setup()');page.locator('#mpLobbyChat').tap()
                page.evaluate('window.__chatQA127.set(100)')
                for keyboard in (True,False):
                    if keyboard:
                        page.locator('#mpChatInput').focus()
                    else:
                        page.evaluate("document.getElementById('mpChatInput').blur();window.__chatQA127.refresh()")
                    page.wait_for_timeout(120)
                    g=page.evaluate('window.__chatQA127.geometry()')
                    assert g['historyHeight']>=20,(width,height,keyboard,g);checks+=1
                    assert g['maxScroll']>300,(width,height,keyboard,g);checks+=1
                    # Finger down means moving towards older lines. Even
                    # landscape has a narrow but usable strip; give it room.
                    if g['historyHeight']<70:
                        page.evaluate("() => {const h=document.getElementById('mpChatScroll');h.scrollTop=h.scrollHeight-h.clientHeight-280}")
                    before=page.evaluate('window.__chatQA127.geometry()')['scrollTop'];box=page.locator('#mpChatScroll').bounding_box()
                    swipe(page,box,True)
                    after=page.evaluate('window.__chatQA127.geometry()')['scrollTop']
                    assert after<before-5,(width,height,keyboard,before,after);checks+=1
                    # No forced snap-to-bottom when chat/HUD periodically refresh.
                    assert page.evaluate('window.__chatQA127.refresh()');checks+=1
                    refreshed=page.evaluate('window.__chatQA127.geometry()')['scrollTop']
                    assert abs(refreshed-after)<25,(width,height,keyboard,after,refreshed);checks+=1
                    # New message (oldest trimmed at 100) must retain read position.
                    if keyboard:
                        assert page.evaluate('window.__chatQA127.append()');checks+=1
                        changed=page.evaluate('window.__chatQA127.geometry()')['scrollTop']
                        assert changed<page.evaluate('window.__chatQA127.geometry()')['maxScroll']-5,(width,height,keyboard,refreshed,changed,page.evaluate('window.__chatQA127.geometry()'));checks+=1
                    # Finger up navigates back towards newest lines. Make sure
                    # there is runway; near-bottom fling otherwise clamps.
                    page.evaluate("() => {const h=document.getElementById('mpChatScroll');h.scrollTop=Math.max(0,Math.min(h.scrollTop,h.scrollHeight-h.clientHeight-220))}")
                    refreshed=page.evaluate('window.__chatQA127.geometry()')['scrollTop']
                    box=page.locator('#mpChatScroll').bounding_box()
                    swipe(page,box,False)
                    newer=page.evaluate('window.__chatQA127.geometry()')['scrollTop']
                    assert newer>refreshed+5,(width,height,keyboard,refreshed,newer);checks+=1
                    page.evaluate("() => {const h=document.getElementById('mpChatScroll');h.scrollTop=h.scrollHeight}")
                # Chat remains editable after gestures.
                page.locator('#mpChatInput').fill('Привет M, ь 🙂')
                assert page.locator('#mpChatInput').input_value()=='Привет M, ь 🙂';checks+=1
                page.locator('#mpChatClose').tap();assert page.locator('#mpChatLayer').is_hidden();checks+=1
                assert not errors,(width,height,modular,errors[:3]);checks+=1
                print(('dev' if modular else 'index'),f'{width}x{height}','TOUCH SCROLL PASS')
                context.close()
        browser.close()
    print('STAGE127 TOUCH CHAT',checks,'PASS')

if __name__=='__main__':main()
