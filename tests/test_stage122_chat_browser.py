#!/usr/bin/env python3
"""Optional offline Chromium UI regression. Requires playwright and Chromium.

Exercises the actual standalone HTML, and the modular source assembled in
memory with inlined assets. No network server or third-party endpoints.
"""
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = r'''
window.__chatQA={
 setup(){
  mpWire={peerId:'test-host'};
  mpRoom={host:true,hostPeer:'test-host',players:[{peerId:'test-host',id:0,nick:'Тестер',host:true}]};
  panel('<div class="eyebrow">СЕТЕВОЕ ЛОББИ · QA</div><button id="mpLobbyChat">Чат комнаты</button>');
  $('mpLobbyChat').onclick=mpChatOpen;
  return true;
 },
 state(){return {open:mpChat.open,items:mpChat.items.map(x=>({nick:x.nick,text:x.text})),count:mpChat.items.length,draft:mpChat.draft};}
};
'''

def standalone(with_modular=False):
    if with_modular:
        html=(ROOT/'dev.html').read_text()
        html=re.sub(r'<link\s+[^>]*href="(styles/[^"]+)"[^>]*>',
                    lambda m:'<style>'+ (ROOT/m.group(1)).read_text()+'</style>', html)
        html=re.sub(r'<script\s+src="([^"]+)"\s*></script>',
                    lambda m:'<script>'+ (ROOT/m.group(1)).read_text()+'</script>', html)
    else:
        html=(ROOT/'index.html').read_text()
    assert '})();\n</script>' in html
    return html.replace('})();\n</script>',FIXTURE+'})();\n</script>',1)

def main():
    count=0
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,
            executable_path=(shutil.which('chromium') or shutil.which('google-chrome') or None),
            args=['--disable-gpu','--use-gl=swiftshader'])
        for modular in (False,True):
            html=standalone(modular)
            for width,height,label in ((1365,768,'PC'),(390,844,'Android 390'),(320,640,'Android 320'),(800,360,'Android landscape')):
                phone=label!='PC'
                context=browser.new_context(viewport={'width':width,'height':height},is_mobile=phone,has_touch=phone)
                page=context.new_page();errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.set_content(html,wait_until='domcontentloaded')
                page.wait_for_timeout(250)
                assert page.evaluate('window.__chatQA.setup()')
                if phone:page.locator('#mpLobbyChat').tap()
                else:page.keyboard.press('t')
                assert page.locator('#mpChatLayer').is_visible()
                count+=1
                page.locator('#mpChatInput').press_sequentially('Привет, сетевой мир!',delay=1)
                assert page.locator('#mpChatInput').input_value()=='Привет, сетевой мир!'
                count+=1
                page.keyboard.press('Enter');page.wait_for_timeout(30)
                assert page.evaluate('window.__chatQA.state().count')==1
                assert 'Привет, сетевой мир!' in page.locator('#mpChatHistory').inner_text()
                count+=2
                if phone:
                    box=page.locator('#mpChatDialog').bounding_box()
                    assert box and box['x']>=-1 and box['width']<=width+1,(label,box)
                    assert page.locator('#mpChatLayer').is_visible()
                    page.locator('#mpChatClose').tap()
                    count+=2
                else:
                    assert not page.locator('#mpChatLayer').is_visible()
                if phone:page.locator('#mpLobbyChat').tap()
                else:page.keyboard.press('t')
                page.locator('#mpChatInput').fill('<img src=x onerror=alert(1)>')
                page.locator('#mpChatSend').click()
                assert page.locator('#mpChatHistory img').count()==0
                assert page.evaluate('window.__chatQA.state().items[1].text')=='<img src=x onerror=alert(1)>'
                count+=2
                if page.locator('#mpChatLayer').is_visible():
                    page.keyboard.press('Escape')
                    if phone and page.locator('#mpChatLayer').is_visible():
                        # Stage129: Android Back/Escape first hides its IME,
                        # the second press closes the room chat itself.
                        assert not page.locator('#mpChatInput').evaluate('(el) => document.activeElement === el')
                        count+=1
                        page.keyboard.press('Escape')
                assert not page.locator('#mpChatLayer').is_visible()
                assert not errors,(label,errors[:3])
                count+=2
                print(('modular' if modular else 'standalone'),label,'PASS')
                context.close()
        browser.close()
    print('STAGE122 CHAT CHROMIUM:',count,'assertions PASS')
if __name__=='__main__':main()
