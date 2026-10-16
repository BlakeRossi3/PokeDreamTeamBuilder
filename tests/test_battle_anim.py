"""Battle animations: every move has a recipe, and every recipe draws without errors in 3D and 2D (each step at the
start, middle and end of its time). Then a real battle plays a sample of moves; screenshots are taken mid-animation.

    python3 tests/test_battle_anim.py [width height]

Screenshots: tests/out/anim_*.png
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep
os.makedirs(OUT, exist_ok=True)
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1280, 860)
SAMPLE = ["Flamethrower", "Surf", "Thunderbolt", "Earthquake", "Swords Dance", "Protect", "Shadow Ball", "Close Combat", "Crunch", "Leaf Blade", "Hyper Voice", "Stealth Rock"]

CHECK = '''(() => {
  const bad = [], kinds = {}, c = document.createElement("canvas"); c.width = 320; c.height = 180;
  for (const pixel of [false, true]) for (const mv of MOVES) {
    const steps = moveRecipe(mv);
    if (!steps || !steps.length) { bad.push(mv[0] + ": no recipe"); continue; }
    if (!pixel) { const k = SIG_FX[mv[0]] ? "signature" : steps.map(s => s[0]).join("+"); kinds[k] = (kinds[k] || 0) + 1; }
    const T = TYPE_FX[mv[1]] || TYPE_FX.Normal;
    for (const [p, a, b, o] of steps) {
      if (p === "shake") continue;
      if (!FXP[p]) { bad.push(mv[0] + ": unknown step " + p); continue; }
      if (!(a >= 0 && b <= 1 && a < b)) bad.push(mv[0] + ": bad timing " + p);
      for (const u of [0, .5, 1]) {
        const g = {c:c.getContext("2d"), A:{x:80, y:120, r:30}, T:{x:240, y:70, r:26}, pal:T.c, sh:T.p, pixel, W:320, H:180, U:2, shake:0};
        try { FXP[p](g, u, o || {}); } catch(e) { bad.push(mv[0] + ": " + p + " threw " + e.message); }
      }
    }
  }
  return JSON.stringify({n:MOVES.length, bad:bad.slice(0, 20), nbad:bad.length, kinds:Object.entries(kinds).sort((x, y) => y[1] - x[1]).slice(0, 12)});
})()'''

async def run(p, mode):
    b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': W, 'height': H})).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(800)
    await pg.fill('#accName', 'Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(1500)
    await pg.evaluate(f'state.games.intro = 1; state.games.ecoNew = 0; state.mode = "{mode}"; document.documentElement.dataset.mode = "{mode}"; state.teams.all = [6, 9, 3, 25, 94, 149]; save()')
    r = json.loads(await pg.evaluate(CHECK)); print(mode, 'moves', r['n'], 'problems', r['nbad'], r['bad'][:5]); print('  most common recipes', r['kinds'][:8])
    assert r['nbad'] == 0, r['bad']
    # a real battle: play a sample of moves and catch each mid-animation
    await pg.evaluate('openScreen("battle", "rival")'); await pg.wait_for_timeout(700); await pg.click('[data-rv="0"]')
    await pg.wait_for_selector('.bt-move', timeout=15000); await pg.wait_for_timeout(500)
    for i, name in enumerate(SAMPLE):
        await pg.evaluate(f'void (window.__fx = playMoveFx(MOVE_BY.get("{name}"), {i % 2}, {1 - i % 2}))')   # don't wait for it
        await pg.wait_for_timeout(430)
        await pg.locator('.bt-field').screenshot(path=OUT + f'anim_{mode}_{i:02d}.png')
        await pg.evaluate('window.__fx')
    # a turn through the normal battle flow still plays (and finishes) with the animation in it
    n0 = await pg.evaluate('$("btLog").children.length'); await pg.click('.bt-move:not([disabled])'); await pg.wait_for_timeout(6000)
    n1 = await pg.evaluate('$("btLog").children.length'); print(mode, 'log lines', n0, '->', n1); assert n1 > n0
    print(mode, 'ERRS', errs[:3]); assert not errs, errs
    await b.close()

async def main():
    async with async_playwright() as p:
        for mode in ['3d', '2d']: await run(p, mode)
asyncio.run(main())
