#!/usr/bin/env python3
"""Chromium integration: actual persisted armory and two-finger mobile input."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
BASE='https://neon-rift-stage1.invalid/'

def open_game(page):
 page.set_content((ROOT/'index.html').read_text(),wait_until='load',timeout=45000)
 page.locator('#hangar').wait_for(timeout=15000)

def center(page,selector):
 return page.locator(selector).evaluate('(el) => {const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}}')

with sync_playwright() as playwright:
 browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  desktop=browser.new_context(viewport={'width':1300,'height':850})
  p=desktop.new_page();errors=[];p.on('pageerror',lambda err:errors.append(str(err)))
  open_game(p)
  # Import an old-format saved game through the real in-game JSON importer.
  old={'best':4,'credits':100000,'kills':3,'perms':[0,0,0,0],'runs':0,'settings':{'audio':False,'aim':False,'quality':0,'fpsLimit':30},'checkpoint':None}
  p.locator('input[type=file]').set_input_files({'name':'old-save.json','mimeType':'application/json','buffer':json.dumps({'format':'NEON_RIFT_BACKUP_V3','saved':old}).encode()})
  p.wait_for_timeout(200)
  p.locator('#mapHangar').click()
  assert p.locator('[data-gun-up]').count()==30
  assert p.locator('[data-buy-armor]').count()==12
  p.locator('[data-buy-armor="0"]').click()
  p.locator('[data-armor-up="0"]').click()
  p.locator('[data-section="gun-4"] summary').click()
  p.locator('[data-gun-up="4"][data-mod="blast"]').click()
  # The UI must reflect the new gear and its level before the next fight.
  assert 'LVL 1/20' in p.locator('#panel').inner_text()
  p.locator('#back').click()
  p.locator('#newRun').click()
  p.wait_for_timeout(150)
  assert p.locator('#bodyArmorLabel').text_content() not in ('НЕТ','0/0')
  assert not errors,errors
  print('PC: old save migrated; independent rocket radius upgrade; purchased/equipped/upgraded armor persisted')
  desktop.close()
  mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  page=mobile.new_page();merrors=[];page.on('pageerror',lambda err:merrors.append(str(err)))
  open_game(page)
  page.evaluate('window.__neonTest.debugStart()')
  page.wait_for_timeout(150)
  joy=center(page,'#joystick');arsenal=center(page,'#mobileSwitch')
  cdp=mobile.new_cdp_session(page)
  first={'x':joy['x'],'y':joy['y'],'id':1}
  other={'x':arsenal['x'],'y':arsenal['y'],'id':2}
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[first]})
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[first,other]})
  page.wait_for_timeout(100)
  is_open=page.locator('#weaponDrawer').evaluate('(e)=>e.classList.contains("open")')
  assert is_open,'multitouch: arsenal failed to open while first finger held joystick'
  cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[first]})
  cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  # Mobile sprint is a dedicated toggle, distinct from dash.
  page.locator('#mobileSwitch').evaluate('el=>el.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,pointerType:"touch",pointerId:3}))')
  page.locator('#runTouch').evaluate('el=>el.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,pointerType:"touch",pointerId:4}))')
  assert page.locator('#runTouch').get_attribute('aria-pressed')=='true'
  assert not merrors,merrors
  print('MOBILE: joystick held + arsenal opened on separate touch; RUN toggles; no uncaught errors')
  mobile.close()
 finally:browser.close()
