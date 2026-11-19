#!/usr/bin/env python3
"""Real Chromium visual acceptance of hit reaction, both launchers and devices.

Compares actual rendered pixels before/after a hit in front-facing camera,
including hardware WebGL when Chromium exposes it. No network or credentials.
"""
from __future__ import annotations

from io import BytesIO
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright
from browser_smoke import load


def compare(before: bytes, after: bytes) -> tuple[int, float]:
    a = Image.open(BytesIO(before)).convert('RGB')
    b = Image.open(BytesIO(after)).convert('RGB')
    diff = ImageChops.difference(a, b)
    bbox = diff.getbbox()
    if bbox is None:
        return 0, 0.0
    px = diff.crop(bbox)
    changed = sum(1 for r, g, bl in px.getdata() if max(r, g, bl) > 25)
    return changed, changed / (a.width * a.height)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True,
        executable_path='/usr/bin/chromium',
        args=['--no-sandbox', '--disable-dev-shm-usage',
              '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'])
    try:
        for launcher in ('index.html', 'dev.html'):
            for mobile in (False, True):
                ctx = browser.new_context(
                    viewport={'width': 390 if mobile else 1365,
                              'height': 844 if mobile else 768},
                    is_mobile=mobile, has_touch=mobile,
                    device_scale_factor=1)
                try:
                    page = ctx.new_page()
                    errors: list[str] = []
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    load(page, launcher)
                    config = page.evaluate('''(mobile) => {
                      window.__neonTest.debugStart();
                      game.enemies=[];game.state='paused';
                      save.settings.cameraMode='second';
                      save.settings.quality=mobile?0:2;
                      const p=game.p;
                      p.shield=0;p.walk=0;p.hitFlash=0;
                      let pose=secondPersonCameraPose(p);
                      if(!pose.drawActor){
                        let found=false;
                        for(let x=3;x<mapSize-3&&!found;x++)
                         for(let z=3;z<mapSize-3&&!found;z++){
                           if(collide(x+.5,z+.5,.4))continue;
                           p.x=x+.5;p.z=z+.5;p.feetY=floorHeight(p.x,p.z);
                           pose=secondPersonCameraPose(p);
                           found=pose.drawActor&&pose.distance>2.5;
                         }
                        if(!found)throw Error('No open second-person camera space');
                      }
                      return {drawActor:pose.drawActor,distance:pose.distance,glReady,
                        cameraMode:save.settings.cameraMode};
                    }''', mobile)
                    assert config['drawActor'] and config['cameraMode'] == 'second', config
                    page.evaluate('render()')
                    before = page.locator('#gl').screenshot()
                    page.evaluate('''() => {
                      const p=game.p;
                      operatorHitReaction(p,{x:p.x+3,z:p.z+3});
                      render();if(glReady)gl.finish();
                    }''')
                    after = page.locator('#gl').screenshot()
                    changed, ratio = compare(before, after)
                    assert changed > 40 and ratio > .00003, (launcher, mobile,
                        config, changed, ratio, errors)
                    assert not errors, (launcher, mobile, errors)
                    print(f'STAGE48 {launcher} {"MOBILE" if mobile else "DESKTOP"} '
                          f'WebGL={config["glReady"]}: visible changed pixels={changed} '
                          f'({ratio:.2%})')
                finally:
                    ctx.close()
    finally:
        browser.close()
