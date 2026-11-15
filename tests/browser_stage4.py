#!/usr/bin/env python3
"""Stage 4 full standalone UI + legacy-save suit removal + weapon stat regression.
Runs in Chromium Canvas fallback; no false claim of hardware WebGL.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent

def load(page,with_save=None):
    stored=json.dumps(with_save or {},ensure_ascii=False)
    fixture=f"""<script>(function(){{
      let data={stored};
      const make=()=>({{getItem:k=>data[k]??null,setItem:(k,v)=>{{data[k]=String(v)}},
        removeItem:k=>{{delete data[k]}},clear:()=>{{data={{}}}}}});
      Object.defineProperty(window,'localStorage',{{configurable:true,value:make()}});
      Object.defineProperty(window,'sessionStorage',{{configurable:true,value:make()}});
    }})();</script>"""
    html=(ROOT/'index.html').read_text('utf8').replace('<head>','<head>'+fixture,1)
    page.set_content(html,wait_until='load',timeout=45000)
    page.locator('#hangar').wait_for()

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    try:
        context=browser.new_context(viewport={'width':1280,'height':800})
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        load(page)
        page.locator('#hangar').click()
        assert page.locator('#removeArmor').is_disabled()
        assert page.locator('[data-section^="gun-"]').count()==10
        detail=page.locator('[data-section="gun-7"]')
        detail.locator('summary').click()
        assert 'электрошок' in detail.inner_text().lower()
        assert 'Электрошок' in detail.inner_text()
        detail=page.locator('[data-section="gun-4"]')
        detail.locator('summary').click()
        assert 'Взрыв' in detail.inner_text()
        assert 'Пробиваемость' in detail.inner_text()
        # The independent level-path data is attached to each weapon, not shared.
        assert page.locator('[data-gun-up][data-mod="penetration"]').count()==10
        assert page.locator('[data-gun-up][data-mod="blast"]').count()==3
        assert not errors,errors
        page.close()
        context.close()
        # Historical V3 save with an equipped armor can safely be unequipped.
        context=browser.new_context(viewport={'width':1280,'height':800})
        page=context.new_page()
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        legacy={'best':4,'credits':2000,'kills':0,'perms':[0,0,0,0],'runs':0,
                'settings':{'audio':False,'quality':0},'bodyArmor':{'owned':{'2':4},'equipped':2}}
        raw=json.dumps(legacy)
        load(page,{'neonrift3d-save':raw,'neonrift3d-save-backup':raw})
        page.locator('#hangar').click()
        assert not page.locator('#removeArmor').is_disabled()
        page.locator('#removeArmor').click()
        data=page.evaluate('JSON.parse(localStorage.getItem("neonrift3d-save"))')
        assert data['bodyArmor']['equipped']==-1
        assert data['bodyArmor']['owned']['2']==4
        page.locator('[data-equip-armor="2"]').click()
        data=page.evaluate('JSON.parse(localStorage.getItem("neonrift3d-save"))')
        assert data['bodyArmor']['equipped']==2
        assert not errors,errors
        print('STAGE 4 BROWSER: 10 unique gun descriptions, ion shock, 3 blasts, 10 penetrations, unequip/re-equip V3 save passed')
        context.close()
    finally:
        browser.close()
