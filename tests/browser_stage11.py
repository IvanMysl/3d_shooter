#!/usr/bin/env python3
"""Stage 11: actual browser engine creates nonoverlapping NPC spawns."""
from playwright.sync_api import sync_playwright
from browser_smoke import load

with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',
        args=['--no-sandbox','--disable-dev-shm-usage'])
    try:
        for filename in ('index.html','dev.html'):
            for mobile in (False,True):
                context=b.new_context(viewport={'width':390 if mobile else 1365,
                    'height':844 if mobile else 768},is_mobile=mobile,has_touch=mobile)
                page=context.new_page(); errors=[]
                page.on('pageerror',lambda exc:errors.append(str(exc)))
                load(page,filename)
                outcome=page.evaluate('''() => {
                    const t=window.__neonTest;
                    t.debugStart();
                    const p=t.playerPos();
                    const occupiedByPlayer=t.npcSpawnCheck(p.x,p.z,.48,1.9);
                    for(let i=0;i<5;i++)t.boss();
                    const crowd=t.npcCrowd();
                    return {occupiedByPlayer,crowd,weapons:t.weaponList().length,
                     state:t.getState().state};
                }''')
                assert outcome['occupiedByPlayer'] is False,outcome
                assert outcome['crowd']['living']==5,outcome
                assert outcome['crowd']['overlapPairs']==0,outcome
                assert outcome['weapons']==10 and outcome['state']=='playing',outcome
                assert not errors,(filename,mobile,errors)
                print('STAGE11',filename,'MOBILE' if mobile else 'DESKTOP',
                      '5 simultaneous boss spawns, separation and player safety OK')
                context.close()
    finally:
        b.close()
