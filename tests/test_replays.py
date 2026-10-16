"""Replays: a few auto-battles are recorded, then re-simulated from their records (and through a share link) and must
end exactly the same; the Replays screen plays one to the end. Quick: one desktop run.

    python3 tests/test_replays.py
"""
import asyncio, os, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
SIM = '''async (code) => { const r = code ? await rpDecode(code) : rpCheck(rpList()[0]); const B = new Battle(r.sides), R = rng(r.seed), step = fn => { B.rand = R; try { return fn(); } finally { B.rand = Math.random; } };
  step(() => B.start());
  for (const x of r.st) { if (B.over) break;
    if (x[0] === "c") { const ch = [fbValid(B, 0, "c", x[1][0]), fbValid(B, 1, "c", x[1][1])]; step(() => B.turn(ch)); }
    else if (x[0] === "r") step(() => B.replace(x[1], fbValid(B, x[1], "r", x[2]))); else if (x[0] === "u") step(() => B.resume(x[1], fbValid(B, x[1], "u", x[2]))); else if (x[0] === "f") B.forfeit(x[1]); }
  return rpHash(B); }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': 1280, 'height': 860})).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(700)
        await pg.fill('#accName', 'Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(1200)
        await pg.evaluate('state.games.intro = 1; state.games.ecoNew = 0; state.ui.bmode = "auto"; state.teams.all = [6, 9, 3, 25, 94, 149]; save()')
        ok = 0
        for k in range(4):
            await pg.evaluate('openScreen("battle", "rival")'); await pg.wait_for_timeout(500); await pg.click(f'[data-rv="{k}"]'); await pg.wait_for_timeout(600)
            await pg.click('[data-bt="fast"]'); await pg.wait_for_selector('.bt-acts.end', timeout=60000)
            rec = json.loads(await pg.evaluate('JSON.stringify(rpList()[0])'))
            h1 = await pg.evaluate(SIM, None); code = await pg.evaluate('rpEncode(rpList()[0])'); h2 = await pg.evaluate(SIM, code)
            print(f'battle {k}: {rec["tn"]} turns, {len(rec["st"])} steps, link {len(code)} chars, same ending: {h1 == rec["h"] and h2 == rec["h"]}')
            ok += h1 == rec["h"] and h2 == rec["h"]
        assert ok == 4, "a replay didn't end the same way"
        await pg.evaluate('openScreen("battle", "replays")'); await pg.wait_for_timeout(500)
        assert await pg.locator('.rp-row').count() == 4
        await pg.click('[data-rp="0"][data-a="watch"]'); await pg.wait_for_timeout(800); await pg.click('[data-bt="fast"]'); await pg.wait_for_selector('.bt-acts.end', timeout=60000)
        assert 'Replay over' in await pg.locator('#btLog').inner_text()
        print('ERRS', errs[:3]); assert not errs
        await b.close()
asyncio.run(main())
