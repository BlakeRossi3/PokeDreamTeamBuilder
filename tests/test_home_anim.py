"""Animated 2D Home furniture: every item with art/2d/anim/<id>.png loads as a frame sheet, is drawn in a 2D Home and
actually changes between frames; the same items still draw in 3D (canvas) without errors.

    python3 tests/test_home_anim.py [width height]
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep
os.makedirs(OUT, exist_ok=True)
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1280, 860)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDS = sorted(f[:-4] for f in os.listdir(os.path.join(ROOT, "art", "2d", "anim")))

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': W, 'height': H})).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.fill('#accName', 'Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(800)
        ids = json.dumps(IDS)
        await pg.evaluate(f'''(() => {{ const ids = {ids}; state.games.intro = 1; state.games.ecoNew = 0; state.mode = "2d"; document.documentElement.dataset.mode = "2d";
          for (const r of ["living", "garden", "hall"]) grant(unlockOf("exp", r));
          const H = state.games.home; H.mons = [25]; H.items = []; let x = 1;
          for (const id of ids) {{ const it = unlockOf("furn", id); grant(it); H.items.push({{id, x, y:1, f:0}}); x += it.w + 1; }}
          save(); window.DTD_TOD = "day"; }})()''')
        await pg.wait_for_timeout(1500)   # art2d.json
        r = json.loads(await pg.evaluate(f'JSON.stringify({ids}.map(id => {{ const A = furnAnim(id); return [id, A ? A.n : 0]; }}))'))
        print('frames', r); assert all(n >= 4 for _, n in r), r
        await pg.evaluate('HS.me = null; openScreen("home")'); await pg.wait_for_timeout(600); await pg.evaluate('HS.intro = null; HS.me.x = 6; HS.me.y = 4.6'); await pg.wait_for_timeout(2500)
        await pg.locator('#hmStage').screenshot(path=OUT + 'homeanim_2d_a.png')
        a = await pg.evaluate('HS.cv.toDataURL()'); await pg.wait_for_timeout(400); b2 = await pg.evaluate('HS.cv.toDataURL()')
        # each animated item, drawn at two frames, differs
        same = await pg.evaluate(f'''{ids}.filter(id => {{ const it = unlockOf("furn", id), A = furnAnim(id);
          return furnSprite(it, 32, true, false, 1).c.toDataURL() === furnSprite(it, 32, true, false, Math.floor(A.n/2)).c.toDataURL(); }})''')
        print('items whose frames look identical', same); assert not same
        print('canvas changes over time', a != b2)
        await pg.evaluate('state.mode = "3d"; document.documentElement.dataset.mode = "3d"; openScreen("home")'); await pg.wait_for_timeout(1500)
        await pg.locator('#hmStage').screenshot(path=OUT + 'homeanim_3d.png')
        print('ERRS', errs[:3]); assert not errs
        await b.close()
asyncio.run(main())
