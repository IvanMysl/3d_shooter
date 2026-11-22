#!/usr/bin/env python3
"""Stage129: focus-retaining Android Back, resizing IME, UI and navigation-safe send.

Chromium cannot start a physical Android keyboard here. Simulate three realistic
browser signals on the built HTML while retaining native chat DOM scrolling.
"""
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
FIXTURE=r'''
window.__chatQA129={
 setup(){
  mpWire={peerId:'qa-host'};
  mpRoom={host:true,hostPeer:'qa-host',players:[{peerId:'qa-host',id:0,nick:'QA',host:true}]};
  panel('<div>QA Stage129</div><button id="mpLobbyChat">Чат комнаты</button>');
  $('mpLobbyChat').onclick=mpChatOpen;
 },
 messages(n){
  mpChat.items=Array.from({length:n},(_,i)=>({seq:i+1,id:'qa-'+i,nick:'Игрок '+i,
   text:'Длинное тестовое сообщение '+i+' c кириллицей, иными знаками и полезным текстом',at:Date.now()}));
  mpChatRender(true);
 },
 geometry(){
  const box=id=>{const r=$(id).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
  const sc=mpChatScrollBox();
  return {layer:box('mpChatLayer'),scroll:box('mpChatScroll'),history:box('mpChatHistory'),
   input:box('mpChatInput'),form:box('mpChatForm'),send:box('mpChatSend'),
   focused:document.activeElement===$('mpChatInput'),hide:$('mpChatHideKeyboard').hidden,
   isOpen:mpChat.open,assumed:mpChat.imeDismissed,reported:mpChat.imeReported,
   scrollTop:sc.scrollTop,maxScroll:sc.scrollHeight-sc.clientHeight};
 },
 simulateIME(height){
  const prop=Object.getOwnPropertyDescriptor(window,'visualViewport');
  window.__qaOriginalVV=prop;
  Object.defineProperty(window,'visualViewport',{configurable:true,value:{height,width:window.innerWidth,offsetLeft:0,offsetTop:0}});
  mpChatViewport();return this.geometry();
 },
 restoreIME(){
  const d=window.__qaOriginalVV;if(d)Object.defineProperty(window,'visualViewport',d);
  else delete window.visualViewport;
  mpChatViewport();return this.geometry();
 },
 reopenWithoutBlur(){mpChat.imeDismissed=false;mpChat.imeReported=false;mpChat.imeFocusAt=performance.now();mpChatViewport();},
 lateNoReportDismiss(){
  mpChat.imeFocusAt=performance.now()-1400;
  mpChatViewportEvent({type:'resize'});return this.geometry();
 }
};
'''

def doc(modular):
    output=(ROOT/('dev.html' if modular else 'index.html')).read_text(encoding='utf-8')
    if modular:
        output=re.sub(r'<link\s+[^>]*href="(styles/[^"]+)"[^>]*>',
                      lambda m:'<style>'+(ROOT/m.group(1)).read_text('utf-8')+'</style>',output)
        output=re.sub(r'<script\s+src="([^"]+)"\s*></script>',
                      lambda m:'<script>'+(ROOT/m.group(1)).read_text('utf-8')+'</script>',output)
    assert '})();\n</script>' in output
    return output.replace('})();\n</script>',FIXTURE+'})();\n</script>',1)


def main():
    n=0
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium'),
                                  args=['--disable-gpu','--use-gl=swiftshader'])
        for modular in (False, True):
            for width,height in ((800,360),(720,320),(390,844),(320,640),(360,780)):
                ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
                page=ctx.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
                page.set_content(doc(modular),wait_until='domcontentloaded')
                page.evaluate('window.__chatQA129.setup()')
                page.locator('#mpLobbyChat').tap();page.evaluate('window.__chatQA129.messages(100)')
                page.wait_for_timeout(80)
                g0=page.evaluate('window.__chatQA129.geometry()')
                assert g0['isOpen'] and not g0['focused'],g0;n+=1
                assert abs(g0['form']['bottom']-g0['layer']['bottom'])<4,(width,height,g0);n+=1
                assert g0['hide'],g0;n+=1
                # Focus and unsupported viewport fallback: composer above IME.
                page.locator('#mpChatInput').focus();page.wait_for_timeout(100)
                g1=page.evaluate('window.__chatQA129.geometry()')
                assert g1['layer']['height']<height*.65,(width,height,g1);n+=1
                assert g1['focused'] and not g1['hide'],g1;n+=1
                assert g1['send']['bottom']<=g1['layer']['bottom']+1,g1;n+=1
                if width>height:
                    # 3 Android system navigation keys often overlay the
                    # right edge of fullscreen content:// landscape pages.
                    assert g1['send']['right']<=g1['layer']['right']-44,(width,height,g1);n+=1
                # Explicit fallback: hide keyboard but do not close the chat.
                page.locator('#mpChatHideKeyboard').tap();page.wait_for_timeout(80)
                g2=page.evaluate('window.__chatQA129.geometry()')
                assert not g2['focused'] and g2['hide'] and g2['isOpen'],g2;n+=1
                assert g2['layer']['height']>=height*.90,(width,height,g2);n+=1
                assert abs(g2['form']['bottom']-g2['layer']['bottom'])<4,(width,height,g2);n+=1
                # Browser can keep focus on hidden IME. A low -> full viewport
                # transition should restore full height even without blur.
                page.locator('#mpChatInput').focus();page.wait_for_timeout(80)
                page.evaluate(f'window.__chatQA129.simulateIME({max(90,int(height*.56))})')
                g3=page.evaluate('window.__chatQA129.restoreIME()')
                page.wait_for_timeout(50)
                g3=page.evaluate('window.__chatQA129.geometry()')
                assert g3['focused'] and g3['assumed'] and g3['isOpen'],g3;n+=1
                assert g3['layer']['height']>=height*.90,(width,height,g3);n+=1
                assert abs(g3['form']['bottom']-g3['layer']['bottom'])<4,(width,height,g3);n+=1
                # Content:// may not update viewport size at all but may emit
                # a delayed resize event after the Android Back gesture.
                page.locator('#mpChatInput').focus();
                page.evaluate('window.__chatQA129.reopenWithoutBlur()')
                page.wait_for_timeout(70)
                g4=page.evaluate('window.__chatQA129.lateNoReportDismiss()')
                page.wait_for_timeout(80)
                g4=page.evaluate('window.__chatQA129.geometry()')
                assert g4['assumed'] and g4['focused'],g4;n+=1
                assert abs(g4['form']['bottom']-g4['layer']['bottom'])<4,(width,height,g4);n+=1
                # Native key Escape (when Android forwards Back) first hides
                # keyboard, the next press closes chat.
                page.locator('#mpChatInput').focus();
                page.evaluate('window.__chatQA129.reopenWithoutBlur()')
                page.keyboard.press('Escape');page.wait_for_timeout(70)
                g5=page.evaluate('window.__chatQA129.geometry()')
                assert g5['isOpen'] and not g5['focused'] and g5['layer']['height']>=height*.90,g5;n+=1
                page.keyboard.press('Escape')
                assert page.locator('#mpChatLayer').is_hidden();n+=1
                assert not errors,(modular,width,height,errors[:3]);n+=1
                print(('dev' if modular else 'index'),f'{width}x{height}','KEYBOARD RESTORE PASS')
                ctx.close()
        browser.close()
    print('STAGE129 MOBILE KEYBOARD RESTORE',n,'PASS')

if __name__=='__main__':main()
