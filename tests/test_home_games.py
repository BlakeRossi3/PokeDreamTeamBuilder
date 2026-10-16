"""Home games and new furniture: the hammock draws in both styles and is a nap spot, Berry Catch plays a (short) round
and keeps up to 5 berries, Hide-and-seek hides a Pokémon (wrong guesses give hints, the right one finds it and adds
friendship), and the new save fields survive cleanGames.

    python3 tests/test_home_games.py [mode width height]
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep
os.makedirs(OUT, exist_ok=True)
MODE = sys.argv[1] if len(sys.argv) > 1 else "2d"
W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (390, 844)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': W, 'height': H})).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.fill('#accName', 'Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(800)
        await pg.evaluate(f'''(() => {{ state.games.intro = 1; state.games.ecoNew = 0; state.mode = "{MODE}"; document.documentElement.dataset.mode = "{MODE}";
          for (const id of ["sofa", "hammock", "lamp"]) grant(unlockOf("furn", id));
          const H = state.games.home; H.mons = [25, 133, 4]; H.items = [{{id:"bed", x:1, y:0, f:0}}, {{id:"hammock", x:4, y:2, f:0}}, {{id:"sofa", x:7, y:0, f:0}}, {{id:"lamp", x:10, y:3, f:0}}];
          H.fr = {{"25":40, "133":40, "4":40}}; save(); window.DTD_TOD = "day"; window.DTD_CATCH = 3; }})()''')
        await pg.evaluate('openScreen("home")'); await pg.wait_for_timeout(2500)
        sp = await pg.evaluate('JSON.stringify(homeSpots().filter(s => s.kind === "hammock").map(s => s.act))'); print('hammock spots', sp); assert sp == '["nap"]'
        await pg.locator('#hmStage').screenshot(path=OUT + f'homegames_{MODE}_room.png')
        # Berry Catch: a 3-second round, walking right then left
        await pg.click('#hmGames'); await pg.click('[data-hg="catch"]'); await pg.click('#bcGo')
        await pg.keyboard.down('ArrowRight'); await pg.wait_for_timeout(900); await pg.keyboard.up('ArrowRight')
        await pg.locator('.bc-wrap').screenshot(path=OUT + f'homegames_{MODE}_catch.png')
        await pg.keyboard.down('ArrowLeft'); await pg.wait_for_timeout(900); await pg.keyboard.up('ArrowLeft'); await pg.wait_for_timeout(1800)
        r = json.loads(await pg.evaluate('JSON.stringify({note: $("bcNote").textContent, g: homeData().games, bag: homeData().bag})')); print('catch', r)
        assert r['g']['catchN'] == 1 and 'caught' in r['note'] and sum(r['bag'].values()) <= 5
        await pg.evaluate('closeModal()')
        # Hide-and-seek: one wrong guess, then the right one
        r = json.loads(await pg.evaluate('''(() => { seekStart(); const h = HS.hide, n = h.n, f0 = friendOf(n), all = placedItems().filter(q => !isFloorItem(q.it));
          const right = all.find(q => q.id === h.p.id && q.x === h.p.x && q.y === h.p.y), wrong = all.find(q => q !== right);
          const hidden = !HS.mons.find(m => m.n === n).box; seekAt(wrong); const tries = HS.hide.tries; seekAt(right);
          return JSON.stringify({n, hidden, tries, after: HS.hide, up: friendOf(n) - f0, g: homeData().games}); })()'''))
        print('seek', r); assert r['tries'] == 1 and r['after'] is None and r['up'] == 4 and r['g']['found'] == 1
        await pg.wait_for_timeout(600); await pg.locator('#hmStage').screenshot(path=OUT + f'homegames_{MODE}_found.png')
        ok = await pg.evaluate('JSON.stringify(cleanGames(JSON.parse(JSON.stringify(state.games))).home.games) === JSON.stringify(homeData().games)'); print('clean', ok); assert ok
        sw = await pg.evaluate('document.documentElement.scrollWidth'); print('scrollWidth', sw, W); assert sw <= W
        print('ERRS', errs[:3]); assert not errs
        await b.close()
asyncio.run(main())
