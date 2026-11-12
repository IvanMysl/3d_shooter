#!/usr/bin/env python3
"""Optional Chromium smoke tests for BOTH launchers, desktop and mobile.

Uses page.set_content (sandbox-safe) for index.html and fulfills references
from exact archived source files for dev.html. No public server or internet.
This is a browser logic test, not a substitute for on-device Android/WebGL QA.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def load(page, filename: str):
    if filename == 'index.html':
        page.set_content((ROOT / filename).read_text('utf-8'),
                         wait_until='load', timeout=45000)
        return []

    served = []
    root_url = 'https://neon-rift-test.invalid/'
    def serve(route):
        name = route.request.url.removeprefix(root_url).split('?', 1)[0]
        allowed = (name in ('dist/game.js', 'dist/legacy-notes.js') or
                   (name.startswith('styles/') and name.endswith('.css')))
        if not allowed:
            route.abort()
            return
        path = (ROOT / name).resolve()
        if not path.is_relative_to(ROOT.resolve()) or not path.is_file():
            route.abort()
            return
        route.fulfill(status=200, body=path.read_bytes(),
                      content_type='text/css' if name.endswith('.css') else 'text/javascript')
        served.append(name)
    page.route(root_url + '**', serve)
    html = (ROOT / filename).read_text('utf-8').replace(
        '<head>', '<head><base href="' + root_url + '">', 1)
    page.set_content(html, wait_until='load', timeout=45000)
    return served


def exercise(browser, filename, mobile):
    context = browser.new_context(
        viewport={'width':390 if mobile else 1365,'height':844 if mobile else 768},
        device_scale_factor=1,
        is_mobile=mobile,
        has_touch=mobile,
    )
    try:
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda err: errors.append(str(err)))
        served = load(page, filename)
        page.wait_for_timeout(200)
        state = page.evaluate("""() => ({
          title: document.title,
          overlay: !!document.getElementById('overlay'),
          panelText: document.getElementById('panel')?.textContent?.length,
          diagnostic: typeof window.__fpsDiagnostics,
          test: typeof window.__neonTest,
          missionTest: typeof window.__neonMissionTest,
          styles: document.styleSheets.length,
          scripts: document.scripts.length,
          webgl: document.body.classList.contains('webgl'),
          mobileControls: !!document.getElementById('joystick')
        })""")
        assert state['overlay'] and state['panelText'] > 200, state
        assert state['diagnostic'] == state['test'] == state['missionTest'] == 'object', state
        assert state['styles'] == (2 if filename == 'index.html' else 8), state
        assert state['scripts'] == 2 and state['mobileControls'], state
        if filename == 'dev.html':
            assert len(served) == 10 and len(set(served)) == 10, served

        game = page.evaluate("""() => {
          window.__neonTest.debugStart();
          return {game:window.__neonTest.getState(),
                  weapons:window.__neonTest.weaponList(),
                  environment:window.__neonTest.currentStyle(),
                  mission:window.__neonMissionTest.current(),
                  map:window.__neonTest.mapInfo(),
                  fps:window.__fpsDiagnostics.get()};
        }""")
        assert game['game'] and game['game']['state'] == 'playing', game
        assert len(game['weapons']) == 10, game
        assert game['environment']['themes'] == 18, game
        assert game['mission'] is not None, game
        assert game['map']['size'] > 15, game
        assert game['fps']['limit'] in (0, 30, 45, 60, 90, 120), game
        page.wait_for_timeout(350)
        assert not errors, errors
        print(f'{filename} / {"MOBILE" if mobile else "DESKTOP"}: OK | '
              f'level={game["game"]["sector"]} | '
              f'weapons={len(game["weapons"])} | '
              f'themes={game["environment"]["themes"]} | '
              f'render={"WebGL" if state["webgl"] else "Canvas fallback"}')
    finally:
        context.close()


if __name__ == '__main__':
    import os
    with sync_playwright() as p:
        kwargs = {'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.isfile('/usr/bin/chromium'):
            kwargs['executable_path'] = '/usr/bin/chromium'
        browser = p.chromium.launch(**kwargs)
        try:
            for filename in ('index.html', 'dev.html'):
                for mobile in (False, True):
                    exercise(browser, filename, mobile)
        finally:
            browser.close()
