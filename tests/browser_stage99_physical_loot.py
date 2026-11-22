#!/usr/bin/env python3
"""Stage99: real browser loot physics, both self-contained and modular builds."""
from playwright.sync_api import sync_playwright
from browser_smoke import load


def verify(browser, filename, mobile):
    ctx = browser.new_context(viewport={'width':390 if mobile else 1365,
                                        'height':844 if mobile else 768},
                              is_mobile=mobile, has_touch=mobile)
    try:
        page=ctx.new_page(); errors=[]
        page.on('pageerror', lambda exc:errors.append(str(exc)))
        load(page, filename)
        result=page.evaluate("""() => {
          const result=[];
          for(const level of [8,14,35]){
            window.__neonMissionTest.selectStage(level);
            result.push(window.__neonTest.physicalLootAudit());
          }
          return result;
        }""")
        assert len(result)==3,result
        for item in result:
            assert item['collection'] and item['steelRim'] and item['steelBlocksPickup'],item
            assert item['build'] in ('99','100','101','102','103','104','105','106','107','108','109','110','111','112','113','114','115'),item
        assert sum(item['elevatedDecks'] for item in result)>0, result
        assert not errors,errors
        print(f'Stage99 {filename}/'+('mobile' if mobile else 'desktop')+
              ': 3 genuine levels, actual pickup credits, exact steel rim, physical blockers, elevated decks PASS')
    finally: ctx.close()


if __name__=='__main__':
    import os
    with sync_playwright() as p:
        kw={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):kw['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**kw)
        try:
            for filename in ('index.html','dev.html'):
                for mobile in (False,True):verify(browser,filename,mobile)
        finally:browser.close()
