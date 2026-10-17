"""Home layout v2: the front yard and kitchen, old saves moving their furniture with their rooms, the house seen from
outside in a yard, house designs from the Shop, and Pokémon sprites following the 2D/3D switch.

    python3 tests/test_home_layout.py [mode width height]
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep
os.makedirs(OUT, exist_ok=True)
MODE = sys.argv[1] if len(sys.argv) > 1 else "2d"
W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1280, 860)
OTHER = "3d" if MODE == "2d" else "2d"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': W, 'height': H})).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.fill('#accName', 'Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(800)
        # an old save: bedroom + living room + garden, positions in the old order (bedroom 0, living 11, garden 22), no `lay`
        await pg.evaluate(f'''(() => {{ state.games.intro = 1; state.games.ecoNew = 0; setMode("{MODE}");
          for (const id of ["living", "garden"]) grant(unlockOf("exp", id)); for (const id of ["sofa", "tree", "lamp"]) grant(unlockOf("furn", id));
          const H = state.games.home; H.mons = [25, 133]; delete H.lay;
          H.items = [{{id:"bed", x:1, y:0, f:0}}, {{id:"sofa", x:13, y:0, f:0}}, {{id:"tree", x:25, y:1, f:0}}, {{id:"lamp", x:30, y:3, f:0}}];
          H.trees = {{"25,1": {{d:todayKey(), n:1}}}}; H.gifts = [{{n:25, x:27.5, y:5, k:"pp", v:20}}];
          save(); window.DTD_TOD = "day"; }})()''')
        await pg.reload(); await pg.wait_for_timeout(1200)   # through the real load path (cleanGames)
        await pg.evaluate('openScreen("home")'); await pg.wait_for_timeout(1200)
        r = json.loads(await pg.evaluate('JSON.stringify({rooms: HS.rooms.map(r => [r.id, r.x0]), items: homeData().items.map(p => [p.id, p.x]), trees: Object.keys(homeData().trees), gifts: homeData().gifts.map(g => g.x), lay: homeData().lay})'))
        print('migrated', r)
        assert r['rooms'] == [['yard', 0], ['bedroom', 9], ['living', 20], ['garden', 31]], r['rooms']
        assert r['items'] == [['bed', 10], ['sofa', 22], ['tree', 34], ['lamp', 39]], r['items']
        assert r['trees'] == ['34,1'] and r['gifts'] == [36.5] and r['lay'] == 'yard,bedroom,living,garden'
        # reloading doesn't move anything again
        await pg.reload(); await pg.wait_for_timeout(1000); await pg.evaluate('openScreen("home")'); await pg.wait_for_timeout(800)
        again = json.loads(await pg.evaluate('JSON.stringify(homeData().items.map(p => [p.id, p.x]))')); print('after reload', again); assert again == r['items']
        # buying the kitchen (between the living room and the garden) moves the garden along
        await pg.evaluate('state.games.pp = 9999; buy(unlockOf("exp", "kitchen")); openScreen("home")'); await pg.wait_for_timeout(800)
        k = json.loads(await pg.evaluate('JSON.stringify({rooms: HS.rooms.map(r => r.id), items: homeData().items.map(p => [p.id, p.x]), trees: Object.keys(homeData().trees)})')); print('with kitchen', k)
        assert k['rooms'] == ['yard', 'bedroom', 'living', 'kitchen', 'garden'] and k['items'][2] == ['tree', 44] and k['trees'] == ['44,1']
        # outside in the yard the house front covers the rooms; inside it's gone
        await pg.evaluate('HS.intro = null; HS.me.x = 4; HS.me.y = 4; HS.me.path = null'); await pg.wait_for_timeout(900)
        out = await pg.evaluate('[HS.outA, JSON.stringify(HS.spans)]'); print('in the yard', out); assert out[0] > .95
        await pg.locator('#hmStage').screenshot(path=OUT + f'homelayout_{MODE}_yard.png')
        await pg.evaluate('HS.me.x = 14'); await pg.wait_for_timeout(900)
        a = await pg.evaluate('HS.outA'); print('inside', a); assert a < .05
        await pg.evaluate('HS.me.x = 33'); await pg.wait_for_timeout(900)
        await pg.locator('#hmStage').screenshot(path=OUT + f'homelayout_{MODE}_kitchen.png')
        # a house design bought in the Shop is used right away
        await pg.evaluate('shopCat = "house"; openScreen("shop")'); await pg.wait_for_timeout(600)
        await pg.click('[data-buy="villa"]'); await pg.wait_for_timeout(300)
        hs = await pg.evaluate('[homeData().house, houseOf().id, owns("house", "villa")]'); print('house', hs); assert hs == ['villa', 'villa', True]
        await pg.screenshot(path=OUT + f'homelayout_{MODE}_shop.png')
        await pg.click('[data-house="cottage"]'); assert await pg.evaluate('houseOf().id') == 'cottage'
        await pg.click('[data-house="villa"]')
        await pg.evaluate('openScreen("home")'); await pg.wait_for_timeout(600); await pg.evaluate('HS.intro = null; HS.me.x = 4; HS.outA = null'); await pg.wait_for_timeout(900)
        await pg.locator('#hmStage').screenshot(path=OUT + f'homelayout_{MODE}_villa.png')
        # the 2D/3D switch while the Home is open: every resident gets the new style's sprite
        await pg.evaluate(f'setMode("{OTHER}")'); await pg.wait_for_timeout(2500)
        sm = json.loads(await pg.evaluate('JSON.stringify(HS.mons.map(m => [m.spMode, !!m.sp]))')); print('after switch', sm)
        assert sm and all(m == [OTHER, True] for m in sm)
        # the new fields survive cleanGames; a bad house falls back to the cottage
        c = json.loads(await pg.evaluate('JSON.stringify([cleanGames(state.games).home.lay, cleanGames(state.games).home.house, cleanGames({...state.games, home:{...state.games.home, house:"castle", lay:"yard,nope"}}).home])'))
        print('clean', c[:2], c[2]['house'], repr(c[2]['lay'])); assert c[0] == 'yard,bedroom,living,kitchen,garden' and c[1] == 'villa' and c[2]['house'] == 'cottage' and c[2]['lay'] == ''
        sw = await pg.evaluate('document.documentElement.scrollWidth'); print('scrollWidth', sw, W); assert sw <= W
        print('ERRS', errs[:3]); assert not errs
        await b.close()
asyncio.run(main())
