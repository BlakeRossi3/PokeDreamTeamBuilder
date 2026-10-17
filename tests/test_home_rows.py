"""Home rows: the garden and pond behind the house, the house, and the front yard in front of it, joined by the front and
back doors. Walking into a door (keys, a tap or E) goes through it and the view slides up or down; paths and Pokémon go
through the doors to reach another row; furniture stays in its row and out of the doorways; Decorate moves between rows.

    python3 tests/test_home_rows.py [mode width height]
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep
os.makedirs(OUT, exist_ok=True)
MODE = sys.argv[1] if len(sys.argv) > 1 else "2d"
W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1280, 860)
TAG = f"{MODE}_{W}"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': W, 'height': H})).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.fill('#accName', 'Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(800)
        await pg.evaluate(f'''(() => {{ state.games.intro = 1; state.games.ecoNew = 0; setMode("{MODE}"); for (const id of ["living", "garden"]) grant(unlockOf("exp", id));
          for (const id of ["sofa", "tree", "bench"]) grant(unlockOf("furn", id));
          const D = state.games.home; D.lay = homeRooms().map(r => r.id).join(","); D.mons = [25, 1];
          D.items = [{{id:"bed", x:10, y:0, f:0}}, {{id:"sofa", x:22, y:0, f:0}}, {{id:"tree", x:35, y:1, f:0}}, {{id:"bench", x:6, y:4, f:0}}];
          save(); window.DTD_TOD = "day"; openScreen("home"); HS.weather = "sun"; }})()''')
        await pg.wait_for_timeout(1200); await pg.evaluate('HS.intro = null')
        # the rows, north to south, and the doors between them; saved positions (the strip of rooms) don't change
        r = json.loads(await pg.evaluate('JSON.stringify({rows: HS.rows.map(R => R.rooms.map(r => r.id).join("+")), x0: HS.rooms.map(r => r.x0), doors: HS.doors, lay: homeData().lay})'))
        print('rows', r['rows'], r['x0'], r['doors'])
        assert r['rows'] == ['garden', 'bedroom+living', 'yard'] and r['x0'] == [0, 9, 20, 31] and r['lay'] == 'yard,bedroom,living,garden'
        assert r['doors'] == [{'k': 0, 'n': {'x': 35.5, 'y': 6.65}, 's': {'x': 13.5, 'y': 0.45}}, {'k': 1, 'n': {'x': 13.5, 'y': 6.65}, 's': {'x': 4.5, 'y': 0.45}}]
        # rows are walled off from each other; rooms in a row still have their doorway
        w = await pg.evaluate('[blocked(9, 3.5), blocked(8.9, 5), blocked(20, 3.5), blocked(20, 1), blocked(31, 3.5)]'); print('walls', w); assert w == [True, True, False, True, True]
        await pg.locator('#hmStage').screenshot(path=OUT + f'rows_{TAG}_yard.png')
        # walking up into the front door goes inside; the view slides up to the house
        await pg.evaluate('HS.me.x = 4.5; HS.me.y = 1.3; HS.me.path = null'); await pg.wait_for_timeout(300); await pg.focus('#hmCv')
        await pg.keyboard.down('ArrowUp'); await pg.wait_for_timeout(450); await pg.keyboard.up('ArrowUp')
        s = await pg.evaluate('[rowOf(HS.me.x).k, Math.abs(HS.me.x - 13.5) < .01, HS.vy]'); print('front door', s); assert s[0] == 1 and s[1] and s[2] > 1
        await pg.wait_for_timeout(1200); a = await pg.evaluate('[HS.vy, HS.outA]'); print('inside', a); assert a[0] == 1 and a[1] < .05
        await pg.locator('#hmStage').screenshot(path=OUT + f'rows_{TAG}_house.png')
        # near the back door, E (or a tap) goes through it
        await pg.evaluate('HS.me.x = 13.5; HS.me.y = 1; HS.me.path = null; for (const m of HS.mons) { homeActEnd(m); m.x = 3; m.y = 5; m.st = "idle"; m.t = 1e5; m.path = null; }'); await pg.wait_for_timeout(200)
        t = json.loads(await pg.evaluate('JSON.stringify(nearestThing())')); print('near', t); assert t['k'] == 'door' and t['w']['up']
        await pg.keyboard.press('e'); await pg.wait_for_timeout(900); g = await pg.evaluate('rowOf(HS.me.x).k'); print('E at the back door', g); assert g == 0
        await pg.wait_for_timeout(1200); a = await pg.evaluate('HS.outA'); print('garden', a); assert a > .95
        await pg.locator('#hmStage').screenshot(path=OUT + f'rows_{TAG}_garden.png')
        # tapping the stepping stones at the garden's front edge goes back in; a path from the garden to the yard uses both doors
        pt = lambda x, y: pg.evaluate(f'''(() => {{ const r = HS.cv.getBoundingClientRect(), k = (state.mode === "2d" ? HS.k : 1)*r.width/HS.cv.width; return [r.left + scrX({x})*k, r.top + scrY({y})*k]; }})()''')
        x, y = await pt(35.5, 6.75); await pg.mouse.click(x, y); await pg.wait_for_timeout(2500)
        g = await pg.evaluate('rowOf(HS.me.x).k'); print('tapped the stones', g); assert g == 1
        await pg.wait_for_timeout(100); await pg.locator('#hmStage').screenshot(path=OUT + f'rows_{TAG}_roof.png')
        p2 = json.loads(await pg.evaluate('JSON.stringify(findPath({x:37, y:4}, {x:3, y:5}).filter(p => p.to))')); print('garden to yard', p2); assert len(p2) == 2
        # Pokémon walk through the doors too
        m = await pg.evaluate('''(async () => { const m = HS.mons.find(q => q.n === 25); homeActEnd(m); m.x = 3; m.y = 4; m.st = "idle"; homeWalk(m, {x:37, y:5}, null);
          const doors = (m.path || []).filter(p => p.to).length; for (let i = 0; i < 4000 && m.st === "walk"; i++) { m.t = 1e9; homeUpdate(.03, performance.now()); }
          return [doors, rowOf(m.x).k, needPath(m, {x:3, y:4})]; })()'''); print('Pikachu', m); assert m == [2, 0, True]
        # followers keep to your row
        f = await pg.evaluate('(() => { HS.me.x = 9.4; HS.me.dir = 1; HS.followers = [25]; const m = HS.mons.find(q => q.n === 25); m.st = "idle"; m.plan = null; homeData().fr[25] = 60; homeUpdate(.016, performance.now()); return [m.tx >= 9, sameRow(m.tx, HS.me.x)]; })()'); print('follower', f); assert f == [True, True]
        # Decorate: pieces stay in their row and out of the doorways; up/down and the room buttons switch rows
        ok = await pg.evaluate('[fits(unlockOf("furn", "sofa"), 6, 2), fits(unlockOf("furn", "sofa"), 7, 2), fits(unlockOf("furn", "sofa"), 13, 0), fits(unlockOf("furn", "sofa"), 13, 3), fits(unlockOf("furn", "bench"), 4, 0)]')
        print('fits', ok); assert ok == [True, False, False, True, False]
        await pg.evaluate('HS.me.x = 4; HS.me.y = 4; HS.me.path = null'); await pg.wait_for_timeout(300)
        await pg.click('#hmDeco'); await pg.wait_for_timeout(500); d0 = await pg.evaluate('HS.drow')
        await pg.focus('#hmCv'); await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(1300); d1 = await pg.evaluate('[HS.drow, HS.vy]')
        await pg.click('[data-hroom="3"]'); await pg.wait_for_timeout(700); d2 = await pg.evaluate('HS.drow')
        print('decorate rows', d0, d1, d2); assert d0 == 2 and d1 == [1, 1] and d2 == 0
        await pg.locator('#hmStage').screenshot(path=OUT + f'rows_{TAG}_deco.png')
        await pg.click('#hmDeco'); await pg.wait_for_timeout(500)
        # old saves load the same: positions unchanged, and cleanGames keeps them
        c = json.loads(await pg.evaluate('JSON.stringify(cleanGames(state.games).home.items.map(p => [p.id, p.x, p.y]))')); print('clean', c)
        assert c == [['bed', 10, 0], ['sofa', 22, 0], ['tree', 35, 1], ['bench', 6, 4]]
        sw = await pg.evaluate('document.documentElement.scrollWidth'); print('scrollWidth', sw, W); assert sw <= W
        print('ERRS', errs[:3]); assert not errs
        await b.close()
asyncio.run(main())
