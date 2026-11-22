#!/usr/bin/env python3
"""Stage98 Chromium: real physics, signal commander, timed resonance and old saves."""
from playwright.sync_api import sync_playwright
from browser_smoke import load


def verify(browser, filename, mobile):
    ctx=browser.new_context(viewport={'width':390 if mobile else 1365,
                                      'height':844 if mobile else 768},
                            is_mobile=mobile,has_touch=mobile)
    try:
        page=ctx.new_page();errors=[]
        page.on('pageerror', lambda exc:errors.append(str(exc)))
        load(page,filename)
        data=page.evaluate('''() => {
          const result=[];
          for(const sector of [13,17,33,37]){
            window.__neonMissionTest.selectStage(sector);
            result.push({sector,...window.__neonMissionTest.stage98Exercise()});
          }
          const phaseGate=window.__neonMissionTest.stage98CommanderPhaseGate();
          const saves=[window.__neonMissionTest.stage98CheckpointRoundtrip(13),
                       window.__neonMissionTest.stage98CheckpointRoundtrip(17)];
          const legacy=window.__neonMissionTest.stage98LegacyRecovery();
          return {result,phaseGate,saves,legacy};
        }''')
        assert len(data['result'])==4,data
        for item in data['result']:
            assert item['completed'] and item['before']['physical'],item
            assert item['after']['portal'] and item['after']['done']==item['after']['required'],item
            assert item['contacts'] and all(item['contacts']),item
            if item['before']['type']=='signal':
                assert item['afterScan'] and item['realCommander'],item
                assert item['after']['commanderKilled'],item
            else:
                assert item['windowStarted'] and item['reset'] and all(item['retry']),item
                assert item['physical'] and item['after']['surgeActivations']==2,item
        assert data['phaseGate']['reserved'] and data['phaseGate']['linked'] and \
               data['phaseGate']['appeared'] and data['phaseGate']['elite'] and \
               data['phaseGate']['solid'] and all(data['phaseGate']['contacts']),data['phaseGate']
        assert len(data['saves'])==2 and all(x and x['valid'] for x in data['saves']),data['saves']
        old=data['legacy']
        assert old and old['restored'] and old['count']==2 and old['preserved'],old
        assert old['moved'] and old['safe'] and old['physical'],old
        assert not errors,errors
        print(f'Stage98 {filename}/'+('mobile' if mobile else 'desktop')+
              ': 4 genuine sector operations, 2 real checkpoint roundtrips, '
              'pre-plinth legacy archive migration PASS')
    finally: ctx.close()

if __name__=='__main__':
    import os
    with sync_playwright() as p:
        kw={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):kw['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**kw)
        try:
            for name in ('index.html','dev.html'):
                for mobile in (False,True):verify(browser,name,mobile)
        finally:browser.close()
