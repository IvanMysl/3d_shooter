#!/usr/bin/env python3
"""Stage128: native scrolling of mobile chat HISTORY + COMPOSER as one sheet.
Tests initial composer-at-bottom without IME, focus-driven keyboard-safe height,
subsequent touch scrolling moves the composer itself, returns to bottom, and
preserves read position after incoming new messages. IME occlusion is simulated.
"""
from pathlib import Path
import re, shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
FIXTURE=r'''
window.__chatQA128={
 setup(){
  mpWire={peerId:'qa-host'};
  mpRoom={host:true,hostPeer:'qa-host',players:[{peerId:'qa-host',id:0,nick:'Тестер',host:true}]};
  panel('<div>QA 128</div><button id="mpLobbyChat">Чат комнаты</button>');
  $('mpLobbyChat').onclick=mpChatOpen;
 },
 messages(n){
  mpChat.items=Array.from({length:n},(_,i)=>({seq:i+1,id:'qa-'+i,nick:'Игрок '+i,
   text:'Сообщение номер '+i+' — проверка плавного перемещения истории и строки ввода вместе с жестами.',at:Date.now()}));
  mpChatRender(true);
 },
 add(){
  const h=$('mpChatHistory');let first=h.querySelector('.mpChatLine');
  mpChat.items.push({seq:mpChat.items.length+1,id:'new-qa',nick:'Поздний',text:'Новое сообщение!',at:Date.now()});
  mpChatRender();return first===h.querySelector('.mpChatLine');
 },
 update(){mpChatRender();},
 hideIME(){
  $('mpChatInput').blur();mpChatViewport();
 },
 geometry(){
  const rect=id=>{const r=$(id).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}};
  const s=mpChatScrollBox();return {layer:rect('mpChatLayer'),history:rect('mpChatHistory'),
   scroll:rect('mpChatScroll'),form:rect('mpChatForm'),input:rect('mpChatInput'),
   scrollTop:s.scrollTop,maxScroll:s.scrollHeight-s.clientHeight,
   readerBrowsing:mpChat.readerBrowsing,focused:document.activeElement===$('mpChatInput')};
 }
};
'''

def doc(modular):
    html=(ROOT/('dev.html' if modular else 'index.html')).read_text(encoding='utf-8')
    if modular:
        html=re.sub(r'<link\s+[^>]*href="(styles/[^"]+)"[^>]*>',lambda m:'<style>'+(ROOT/m.group(1)).read_text('utf-8')+'</style>',html)
        html=re.sub(r'<script\s+src="([^"]+)"\s*></script>',lambda m:'<script>'+(ROOT/m.group(1)).read_text('utf-8')+'</script>',html)
    assert '})();\n</script>' in html
    return html.replace('})();\n</script>',FIXTURE+'})();\n</script>',1)

def touch_swipe(page,box,older):
    cdp=page.context.new_cdp_session(page)
    x=box['x']+box['width']*.5
    y1=box['y']+box['height']*(.20 if older else .80)
    y2=box['y']+box['height']*(.80 if older else .20)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y1}]})
    for j in range(1,11):
        cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y1+(y2-y1)*j/10}]})
        page.wait_for_timeout(11)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    page.wait_for_timeout(200)
    cdp.detach()


def main():
    checks=0
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--disable-gpu','--use-gl=swiftshader'])
        for modular in (False,True):
            for width,height in ((390,844),(320,640),(800,360),(360,780)):
                context=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
                page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                page.set_content(doc(modular),wait_until='domcontentloaded')
                page.evaluate('window.__chatQA128.setup()')
                page.locator('#mpLobbyChat').tap();page.wait_for_timeout(100)
                assert page.locator('#mpChatLayer').is_visible();checks+=1
                assert not page.evaluate('window.__chatQA128.geometry().focused'), 'Opening mobile chat must not auto-summon IME';checks+=1
                for count in (0,1,5,100):
                    page.evaluate(f'window.__chatQA128.messages({count})')
                    page.wait_for_timeout(60)
                    g=page.evaluate('window.__chatQA128.geometry()')
                    assert abs(g['form']['bottom']-g['layer']['bottom'])<4,(count,g);checks+=1
                    assert g['scroll']['top']>=g['layer']['top']-1,(count,g);checks+=1
                    assert g['form']['top']>=g['history']['bottom']-3,(count,g);checks+=1
                page.evaluate('window.__chatQA128.messages(100)')
                g0=page.evaluate('window.__chatQA128.geometry()')
                assert g0['maxScroll']>100,(width,height,g0);checks+=1
                # Native upward-history gesture: content moves, including composer.
                box=page.locator('#mpChatScroll').bounding_box()
                touch_swipe(page,{'x':box['x'],'y':box['y']+box['height']*.05,'width':box['width'],'height':box['height']*.60},True)
                g1=page.evaluate('window.__chatQA128.geometry()')
                assert g1['scrollTop']<g0['scrollTop']-20,(width,height,g0,g1);checks+=1
                assert g1['form']['top']>g0['form']['top']+20,(width,height,g0,g1);checks+=1
                assert page.evaluate('window.__chatQA128.add()');checks+=1
                g2=page.evaluate('window.__chatQA128.geometry()')
                assert g2['scrollTop']<g2['maxScroll']-20,(width,height,g2);checks+=1
                page.evaluate('window.__chatQA128.messages(100)')
                # Tap explicit message input -> reserves above IME and anchors bottom.
                page.locator('#mpChatInput').focus();page.wait_for_timeout(200)
                g3=page.evaluate('window.__chatQA128.geometry()')
                assert g3['focused'];checks+=1
                assert g3['layer']['height']<height*.65,(width,height,g3);checks+=1
                assert g3['input']['bottom']<=g3['layer']['bottom']+2,(width,height,g3);checks+=1
                assert g3['scrollTop']>=g3['maxScroll']-12,(width,height,g3);checks+=1
                # Native gesture with open IME; composer MUST follow instead of sticking.
                box=page.locator('#mpChatScroll').bounding_box()
                touch_swipe(page,{'x':box['x'],'y':box['y']+box['height']*.1,'width':box['width'],'height':box['height']*.65},True)
                g4=page.evaluate('window.__chatQA128.geometry()')
                assert g4['scrollTop']<g3['scrollTop']-15,(width,height,g3,g4);checks+=1
                assert g4['form']['top']>g3['form']['top']+15,(width,height,g3,g4);checks+=1
                # User explicitly hides IME; everything expands and composer returns bottom.
                page.evaluate('window.__chatQA128.hideIME()')
                page.evaluate('window.__chatQA128.messages(1)')
                page.wait_for_timeout(150)
                g5=page.evaluate('window.__chatQA128.geometry()')
                assert g5['layer']['height']>=height*.9,(width,height,g5);checks+=1
                assert abs(g5['form']['bottom']-g5['layer']['bottom'])<4,(width,height,g5);checks+=1
                assert not errors,(width,height,errors[:3]);checks+=1
                page.locator('#mpChatClose').tap();checks+=1
                print(('dev' if modular else 'index'),f'{width}x{height}','PASS')
                context.close()
        browser.close()
    print('STAGE128 SHARED CHAT SCROLL',checks,'PASS')

if __name__=='__main__':main()
