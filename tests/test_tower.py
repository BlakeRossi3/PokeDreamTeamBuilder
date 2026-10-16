"""Battle Tower: a streak starts with a picked team, a real (auto) battle finishes and updates the streak, wins at 21
and 49 give the Tower-only rewards once (never for sale), the 7th battle is the Tycoon, the save field survives
cleanGames, and the screen fits a phone.

    python3 tests/test_tower.py [width height mode]
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep
os.makedirs(OUT, exist_ok=True)
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (390, 844)
MODE = sys.argv[3] if len(sys.argv) > 3 else "2d"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': W, 'height': H})).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(800)
        await pg.fill('#accName', 'Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(1500)
        await pg.evaluate(f'state.games.intro = 1; state.games.ecoNew = 0; state.mode = "{MODE}"; document.documentElement.dataset.mode = "{MODE}"; state.teams.all = [149, 248, 445, 376, 384, 6]; state.ui.bmode = "auto"; state.ui.bspeed = "fast"; save()')
        await pg.evaluate('openScreen("battle", "tower")'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=OUT + f'tower_{MODE}_start.png')
        await pg.click('#twGo'); await pg.wait_for_timeout(500)
        await pg.click('#gpkGo')
        await pg.wait_for_selector('.bt-field', timeout=15000); await pg.wait_for_timeout(800)
        await pg.click('[data-bt="fast"]')
        await pg.wait_for_function('F.b && F.b.over', timeout=60000); await pg.wait_for_timeout(2500)
        r = json.loads(await pg.evaluate('JSON.stringify({w: F.b.winner, T: state.games.tower, pp: state.games.pp})')); print('battle 1', r)
        T = r['T']; assert (T['cur'] == 1 and T['won'] == 1) if r['w'] == 0 else T['cur'] == 0
        assert T['size'] == 3 and (T['cur'] == 0 or len(T['nums']) == 3)
        # reward logic: pretend a streak of 20 and win the next one (the onEnd handler is what a real win calls)
        res = json.loads(await pg.evaluate('''(async () => { const T = state.games.tower; Object.assign(T, {cur:20, best:20, team:"all", nums:[149, 248, 445], size:3});
          const before = ITEMS_ALL.filter(it => it.tower).map(it => owns(it.cat, it.id));
          await towerBattle(); await new Promise(r => setTimeout(r, 400)); const tyc = F.cfg.foe.name; F.tok++; const out = F.cfg.onEnd(true);
          const after = ITEMS_ALL.filter(it => it.tower).map(it => owns(it.cat, it.id)), pp0 = state.games.pp; Object.assign(T, {cur:20}); F.cfg.onEnd(true);
          return JSON.stringify({before, after, tyc, text: out.text, T, again: ITEMS_ALL.filter(it => it.tower && it.cat === "furn").map(it => state.games.own.furn[it.id]),
            sell: ITEMS_ALL.filter(it => it.tower).map(it => buy(it)), clean: JSON.stringify(cleanGames(JSON.parse(JSON.stringify(state.games))).tower) === JSON.stringify(T)}); })()'''))
        print('rewards', res); assert res['after'] == [True, True, False, False] and not any(res['before']) and res['tyc'] == 'Tycoon Palmer'
        assert not any(res['again']) and not any(res['sell']) and res['clean'] and res['T']['rw'] == 1
        await pg.evaluate('openScreen("battle", "tower")'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=OUT + f'tower_{MODE}_streak.png')
        sw = await pg.evaluate('document.documentElement.scrollWidth'); print('scrollWidth', sw, W); assert sw <= W
        print('ERRS', errs[:3]); assert not errs
        await b.close()
asyncio.run(main())
