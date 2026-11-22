#!/usr/bin/env python3
"""Stage93 browser audit: reachable *physical* device faces and route choices."""
from playwright.sync_api import sync_playwright
from browser_smoke import load


def verify(browser, filename, mobile):
    context=browser.new_context(viewport={'width':390 if mobile else 1365,
                                          'height':844 if mobile else 768},
                                is_mobile=mobile,has_touch=mobile)
    try:
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        load(page,filename)
        checks=page.evaluate('''() => {
          const result=[];
          for(const stage of [8,14,21]){
            window.__neonMissionTest.selectStage(stage);
            const qa=window.__neonTest.missionContacts();
            if(!qa||qa.sector!==stage)throw new Error('Invalid Stage93 audit');
            result.push(qa);
          }
          return result;
        }''')
        assert len(checks)==3,checks
        for data in checks:
            assert data['targets']>=3 and data['accessible']==data['targets'],data
            assert data['blocked']==0 and data['guided']==data['targets'],data
            assert data['choiceCorrect'],data
        assert not errors,errors
        print(f'Stage93 {filename} / {"MOBILE" if mobile else "DESKTOP"}: '
              f'{len(checks)} real mission maps, {sum(q["targets"] for q in checks)} '
              'usable physical interaction faces + route choices PASS')
    finally:
        context.close()


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
