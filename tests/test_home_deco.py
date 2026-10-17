"""Decorate mode (looking around, the floating toolbar, nudging, Move + Esc, room buttons, a new piece in view), the Home
trainer picker, and Gyms opening to any team once a region's League is won.

    python3 tests/test_home_deco.py [mode width height]
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep
os.makedirs(OUT, exist_ok=True)
MODE = sys.argv[1] if len(sys.argv) > 1 else "2d"
W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1280, 860)
TAG = f'{MODE}_{W}'

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': W, 'height': H})).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.fill('#accName', 'Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(800)
        await pg.evaluate(f'''(() => {{ state.games.intro = 1; state.games.ecoNew = 0; setMode("{MODE}"); for (const r of ["living", "kitchen"]) grant(unlockOf("exp", r));
          grant(unlockOf("furn", "sofa")); save(); window.DTD_TOD = "day"; openScreen("home"); }})()''')
        await pg.wait_for_timeout(900); await pg.evaluate('HS.intro = null; HS.me.x = 14'); await pg.wait_for_timeout(800)
        await pg.click('#hmDeco'); await pg.wait_for_timeout(700)
        pt = lambda x, y: pg.evaluate(f'''(() => {{ const r = HS.cv.getBoundingClientRect(), k = (state.mode === "2d" ? HS.k : 1)*r.width/HS.cv.width; return [r.left + scrX({x})*k, r.top + scrY({y})*k]; }})()''')
        bed = json.loads(await pg.evaluate('JSON.stringify(homeData().items.find(i => i.id === "bed"))'))
        await pg.evaluate(f'HS.dcam = {bed["x"]} - 1'); await pg.wait_for_timeout(600)
        x, y = await pt(bed['x'] + 1, bed['y'] + 1.5); await pg.mouse.click(x, y); await pg.wait_for_timeout(400)
        fl = await pg.evaluate('[HS.sel && HS.sel.id, !$("hmFloat").hidden]'); print('selected', fl); assert fl == ['bed', True]
        await pg.locator('#hmStage').screenshot(path=OUT + f'deco_{TAG}_selected.png')
        await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(200)
        x1 = await pg.evaluate('homeData().items.find(i => i.id === "bed").x'); print('nudged', bed['x'], '->', x1); assert x1 == bed['x'] + 1
        await pg.click('#hmFloat [data-hact="move"]'); await pg.wait_for_timeout(200); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        back = await pg.evaluate('[homeData().items.filter(i => i.id === "bed").map(i => i.x), nav.screen, HS.edit]'); print('move + Esc', back); assert back == [[x1], 'home', True]
        c0 = await pg.evaluate('HS.cam'); mx, my = await pt(c0 + 1.5, 6.6)
        await pg.mouse.move(mx, my); await pg.mouse.down(); await pg.mouse.move(mx - 120, my, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(600)
        c1 = await pg.evaluate('HS.cam'); print('look around', round(c0, 2), '->', round(c1, 2)); assert c1 > c0 + .5
        await pg.click('[data-hroom="3"]'); await pg.wait_for_timeout(900)
        k = await pg.evaluate('[HS.cam, HS.rooms[3].x0, HS.rooms[3].w, HS.V.W/HS.ts]'); print('kitchen', k); assert k[0] + k[3] > k[1] and k[0] < k[1] + k[2]
        await pg.click('[data-hplace="sofa"]'); await pg.wait_for_timeout(300)
        g = json.loads(await pg.evaluate('JSON.stringify(HS.ghost)')); print('new piece in view', g); assert g and k[1] - 1 <= g['x'] <= k[1] + k[2]
        await pg.locator('#hmStage').screenshot(path=OUT + f'deco_{TAG}_placing.png')
        gx, gy = await pt(g['x'] + 1, g['y'] + .5); await pg.mouse.click(gx, gy); await pg.wait_for_timeout(400)
        so = await pg.evaluate('JSON.stringify(homeData().items.find(i => i.id === "sofa"))'); print('sofa', so); assert so != 'undefined' and so != 'null'
        sw = await pg.evaluate('document.documentElement.scrollWidth'); assert sw <= W, sw
        await pg.click('#hmDeco'); await pg.wait_for_timeout(600)
        # the trainer you walk around the Home as
        await pg.click('#hmTr'); await pg.wait_for_timeout(500); await pg.fill('#trSearch', 'Red'); await pg.wait_for_timeout(300); await pg.click('#trList [data-pick]'); await pg.wait_for_timeout(800)
        tr = await pg.evaluate('[homeData().tr, TRAINERS[homeTrainer()]]'); print('home trainer', tr); assert tr[1] == 'Red'
        c = await pg.evaluate('[cleanGames(state.games).home.tr, cleanGames({...state.games, home:{...state.games.home, tr:99999}}).home.tr]'); print('clean', c); assert c == [tr[0], None]
        # Gyms: the region's team only, until its League is won
        await pg.evaluate('gymRegion = 1; openScreen("battle", "gym")'); await pg.wait_for_timeout(800)
        assert not await pg.evaluate('!!$("gTeamSel")')
        await pg.evaluate('state.games.leagues[1] = 1; state.games.badges[1] = 255; save(); renderGym()'); await pg.wait_for_timeout(400)
        await pg.select_option('#gTeamSel', 'all'); await pg.wait_for_timeout(300)
        gt = await pg.evaluate('[gymTeam[1], document.querySelector(".gym-team b").textContent]'); print('gym team', gt); assert gt[0] == 'all'
        await pg.screenshot(path=OUT + f'deco_{TAG}_gym.png')
        print('ERRS', errs[:3]); assert not errs
        await b.close()
asyncio.run(main())
