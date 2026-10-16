"""Daily missions + login streak: three missions fit the save, progress from real events (a battle win, feeding),
pay once, the bonus pays once for all three; the streak grows on consecutive days, keeps half after a gap, pays more
on day 7; the save fields survive cleanGames; the hub bar and the modal fit a phone.

    python3 tests/test_missions.py [mode width height]
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep
os.makedirs(OUT, exist_ok=True)
MODE = sys.argv[1] if len(sys.argv) > 1 else "3d"
W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (390, 844)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': W, 'height': H})).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.fill('#accName', 'Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(800)
        await pg.evaluate(f'state.games.intro = 1; state.games.ecoNew = 0; state.mode = "{MODE}"; document.documentElement.dataset.mode = "{MODE}"; state.games.home.mons = [25, 4, 7]; state.games.home.bag = {{cheri: 5}}; save(); showHub()')
        await pg.wait_for_timeout(1800)
        r = json.loads(await pg.evaluate('JSON.stringify({m: missionsToday(), L: state.games.login})')); print('today', r)
        assert len(r['m']['list']) == 3 and len({x['k'] for x in r['m']['list']}) == 3 and r['L']['cur'] == 1
        await pg.screenshot(path=OUT + f'missions_{MODE}_hub.png')
        # force a known set, then complete it through the real hooks
        r = json.loads(await pg.evaluate('''(() => { const T = missionsToday(); T.list = [{k:"win", a:"", n:0, goal:2, done:0}, {k:"wintype", a:"Electric", n:0, goal:1, done:0}, {k:"feed", a:"", n:0, goal:3, done:0}]; T.bonus = 0;
          const pp0 = state.games.pp, side = {party:[{n:25}, {n:6}]};
          missionWin({back:"rival"}, side); missionWin({back:"tower"}, {party:[{n:7}]});
          for (let i = 0; i < 4; i++) missionBump("feed");
          return JSON.stringify({list: T.list.map(x => [x.k, x.n, x.done]), bonus: T.bonus, gained: state.games.pp - pp0}); })()'''))
        print('done', r); assert all(x[2] for x in r['list']) and r['bonus'] == 1 and (r['gained'] - (60 + 80 + 70)) % 100 == 0   # plus any achievement (100 each)
        await pg.wait_for_timeout(1300)
        pp = await pg.evaluate('state.games.pp'); missionsAgain = await pg.evaluate('(missionBump("feed"), state.games.pp)'); assert missionsAgain == pp, 'paid twice'
        # streak: yesterday -> +1; a 3-day gap keeps half; day 7 pays 200
        r = json.loads(await pg.evaluate('''(() => { const L = state.games.login, d = n => { const x = new Date(); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
          const out = []; Object.assign(L, {last:d(1), cur:5}); loginTick(); out.push(L.cur);
          Object.assign(L, {last:d(3), cur:10}); loginTick(); out.push(L.cur);
          Object.assign(L, {last:d(1), cur:6}); loginTick(); out.push(L.cur, LOGIN_PTS(7), LOGIN_PTS(30), LOGIN_PTS(8));
          const c = cleanGames(JSON.parse(JSON.stringify(state.games)));
          return JSON.stringify({out, same: JSON.stringify(c.login) === JSON.stringify(L) && JSON.stringify(c.missions) === JSON.stringify(state.games.missions)}); })()'''))
        print('streak', r); assert r['out'] == [6, 6, 7, 200, 1000, 25] and r['same']
        await pg.wait_for_timeout(1500); await pg.evaluate('renderHub(); openMissions()'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT + f'missions_{MODE}_modal.png')
        sw = await pg.evaluate('document.documentElement.scrollWidth'); print('scrollWidth', sw, W); assert sw <= W
        print('ERRS', errs[:3]); assert not errs
        await b.close()
asyncio.run(main())
