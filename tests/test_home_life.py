"""Pokémon Home life (Phase 7): furniture spots and type preferences, night naps and glows, berries and feeding,
gifts, friendship ribbons, decorating (drag, undo, turn), photo mode, phone controls, weather and the seasonal event.

    python3 tests/test_home_life.py [width height 2d|3d]

Screenshots: tests/out/hl_*.png
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep
os.makedirs(OUT, exist_ok=True)
W, H, MODE = (int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]) if len(sys.argv) > 3 else (1280, 860, "3d")
TAG = f"{MODE}_{W}"
PHONE = W < 500

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        ctx = await b.new_context(viewport={'width': W, 'height': H}, has_touch=PHONE, is_mobile=PHONE, accept_downloads=True)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.fill('#accName', 'Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(800)
        await pg.evaluate(f'''(() => {{ state.games.intro = 1; state.games.ecoNew = 0; state.mode = "{MODE}"; document.documentElement.dataset.mode = "{MODE}";
          for (const id of ["sofa", "tv", "fire", "tree", "tramp", "lamp", "bean", "rugb", "flowers", "tank"]) grant(unlockOf("furn", id)); grant(unlockOf("exp", "living"));
          const H = state.games.home; H.mons = [25, 4, 7, 1, 94, 133]; state.favs = [25, 4, 7, 1, 94, 133];
          H.items = [{{id:"bed", x:1, y:0, f:0}}, {{id:"bean", x:4, y:1, f:0}}, {{id:"lamp", x:9, y:0, f:0}}, {{id:"tree", x:6, y:3, f:0}}, {{id:"flowers", x:1, y:5, f:0}},
            {{id:"sofa", x:12, y:0, f:0}}, {{id:"tv", x:16, y:0, f:0}}, {{id:"fire", x:19, y:0, f:0}}, {{id:"tramp", x:13, y:4, f:0}}, {{id:"tank", x:17, y:4, f:0}}, {{id:"rugb", x:2, y:3, f:0}}];
          H.fr = {{"133":100, "25":70, "4":55}}; state.teams.all = [133, 25, 6]; save(); }})()''')
        # day: Pokémon pick spots by type
        await pg.evaluate('window.DTD_TOD = "day"; openScreen("home")'); await pg.wait_for_timeout(9000)
        st = await pg.evaluate('JSON.stringify(HS.mons.map(m => [m.n, m.st, m.act || (m.plan && m.plan.act) || null]))'); print('day', st)
        assert await pg.evaluate('HS.mons.some(m => m.act || m.plan)'), 'nobody used furniture or played'
        await pg.screenshot(path=OUT + f'hl_day_{TAG}.png')
        # night: most go to sleep, lights glow
        await pg.evaluate('window.DTD_TOD = "night"; HS.mons.forEach(m => { homeActEnd(m); m.t = 0; })'); await pg.wait_for_timeout(9000)
        st = await pg.evaluate('JSON.stringify(HS.mons.map(m => [m.n, m.st, m.act || (m.plan && m.plan.act) || null, !!m.visitor]))'); print('night', st)
        naps = await pg.evaluate('HS.mons.filter(m => !m.visitor && (m.act === "nap" || (m.plan && m.plan.act === "nap"))).length'); print('napping', naps)
        assert naps >= 2, st
        await pg.screenshot(path=OUT + f'hl_night_{TAG}.png')
        await pg.evaluate('window.DTD_TOD = "day"')
        # berries: pick one, hold it, feed a Pokémon
        await pg.evaluate('(() => { const t = placedItems().find(p => p.it.kind === "tree"); HS.me.x = t.x + 1; HS.me.y = t.y + t.it.d + .45; HS.me.path = null; pickBerry(t); })()')
        bag = await pg.evaluate('JSON.stringify(homeData().bag)'); print('bag', bag); assert bag != '{}'
        fed = await pg.evaluate('''(() => { const id = Object.keys(homeData().bag)[0], m = HS.mons.find(x => x.n === 133); HS.hold = id; const f0 = friendOf(1); const m1 = HS.mons.find(x => x.n === 1); m1.x = HS.me.x + .5; m1.y = HS.me.y; homeUseThing({k:"mon", m:m1}); return [homeData().fedN, friendOf(1) - f0]; })()''')
        print('fed', fed); assert fed[0] == 1 and fed[1] in (8, 15), fed
        await pg.screenshot(path=OUT + f'hl_feed_{TAG}.png')
        # gifts from a good friend
        g = await pg.evaluate('(() => { const m = HS.mons.find(x => x.n === 25), n0 = homeData().gifts.length; homeGift(m, todayKey()); const n = homeData().gifts.length; openGift(n - 1); return [n - n0, homeData().gifts.length - n0]; })()')
        print('gift', g); assert g == [1, 0], g
        # decorating: drag the beanbag, undo it, turn the long rug
        await pg.evaluate('HS.edit = true; renderHome()'); await pg.wait_for_timeout(800)
        pt = await pg.evaluate('''(() => { const r = HS.cv.getBoundingClientRect(), c = (x, y) => ({x:r.left + (x - HS.cam)*HS.ts*HS.k*r.width/HS.cv.width, y:r.top + (HM.WALL*HS.ts + y*HS.ts*HM.SQ - HS.camY)*HS.k*r.height/HS.cv.height});
          return [c(4.5, 1.6), c(7.5, 1.6)]; })()''')
        await pg.mouse.move(pt[0]['x'], pt[0]['y']); await pg.mouse.down(); await pg.mouse.move(pt[1]['x'] - 20, pt[1]['y'], steps=6); await pg.mouse.move(pt[1]['x'], pt[1]['y'], steps=4); await pg.mouse.up(); await pg.wait_for_timeout(300)
        bean = await pg.evaluate('JSON.stringify(homeData().items.find(i => i.id === "bean"))'); print('dragged', bean); assert '"x":4' not in bean, bean
        await pg.screenshot(path=OUT + f'hl_deco_{TAG}.png')
        await pg.click('[data-hact="undo"]'); await pg.wait_for_timeout(200)
        bean = await pg.evaluate('JSON.stringify(homeData().items.find(i => i.id === "bean"))'); print('undone', bean); assert '"x":4' in bean
        rot = await pg.evaluate('(() => { HS.sel = {...homeData().items.find(i => i.id === "rugb")}; homeEditAct("rotate"); return JSON.stringify(homeData().items.find(i => i.id === "rugb")); })()'); print('turned', rot)
        assert '"r":1' in rot
        await pg.evaluate('HS.edit = false; renderHome()'); await pg.wait_for_timeout(600)
        # photo mode: UI hidden, PNG saved
        await pg.click('#hmCam'); await pg.wait_for_timeout(500)
        hidden = await pg.evaluate('getComputedStyle(document.querySelector(".home-bar")).display'); assert hidden == 'none', hidden
        await pg.screenshot(path=OUT + f'hl_photo_{TAG}.png')
        async with pg.expect_download() as dl: await pg.click('[data-ph="png"]')
        d = await dl.value; print('photo', d.suggested_filename); assert d.suggested_filename.endswith('.png')
        await pg.wait_for_timeout(300); assert await pg.evaluate('homeData().photos') == 1
        await pg.click('[data-ph="exit"]'); await pg.wait_for_timeout(400)
        if PHONE: assert await pg.locator('#hmJoy').count() == 1 and await pg.locator('#hmPlay').count() == 1, 'phone controls'
        print('weather', await pg.evaluate('HS.weather'), 'event', await pg.evaluate('eventOn() && eventOn().id'))
        # ribbon on the Team Builder card
        await pg.evaluate(f'enterApp("{MODE}", "all")'); await pg.wait_for_timeout(1200)
        assert await pg.locator('.slot[data-num="133"] .slot-ribbon').count() == 1, 'ribbon'
        await pg.screenshot(path=OUT + f'hl_ribbon_{TAG}.png')
        print('ach', await pg.evaluate('["photo", "berries", "ribbons"].map(k => !!state.games.ach[k])'))
        sw = await pg.evaluate('document.documentElement.scrollWidth'); assert sw <= W + 1, 'sideways scroll'
        print('ERRS', errs[:5]); assert not errs, errs
        await b.close()
asyncio.run(main())
