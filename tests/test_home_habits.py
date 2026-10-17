"""Home habits: fish stay in the pond and water types live there, fliers perch and fly over it, walkers go round it, each
type has favourite spots and places (in, out, rain), bedtime is in the bedroom, snacks are eaten at the table, and big
Pokémon don't squeeze onto chairs while tiny ones like cushions.

    python3 tests/test_home_habits.py [mode width height]
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep
os.makedirs(OUT, exist_ok=True)
MODE = sys.argv[1] if len(sys.argv) > 1 else "2d"
W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1280, 860)
MONS = [129, 7, 16, 4, 1, 143, 172, 66]   # Magikarp, Squirtle, Pidgey, Charmander, Bulbasaur, Snorlax, Pichu, Machop

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': W, 'height': H})).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.fill('#accName', 'Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(800)
        await pg.evaluate(f'''(() => {{ state.games.intro = 1; state.games.ecoNew = 0; setMode("{MODE}"); for (const r of ROOMS) grant(unlockOf("exp", r.id));
          for (const id of ["shelf", "chair", "sofa", "cushion", "punchbag", "fire", "tv"]) grant(unlockOf("furn", id));
          const H = state.games.home; H.lay = homeRooms().map(r => r.id).join(","); H.mons = {json.dumps(MONS)};
          H.items = [{{id:"bed", x:10, y:0, f:0}}, {{id:"shelf", x:14, y:2, f:0}}, {{id:"cushion", x:17, y:3, f:0}}, {{id:"chair", x:22, y:1, f:0}}, {{id:"sofa", x:25, y:0, f:0}},
            {{id:"fire", x:28, y:0, f:0}}, {{id:"tv", x:23, y:4, f:0}}, {{id:"table", x:33, y:2, f:0}}, {{id:"punchbag", x:45, y:1, f:0}}];
          save(); window.DTD_TOD = "day"; openScreen("home"); HS.weather = "sun"; }})()''')
        await pg.wait_for_timeout(1500)
        mon = lambda n: f'HS.mons.find(m => m.n === {n})'
        r = json.loads(await pg.evaluate(f'''JSON.stringify((() => {{ const S = homeSpots(), sp = (k, a) => S.find(s => s.kind === k && (!a || s.act === a));
          const W = (n, s) => s ? +spotWeight(HS.mons.find(m => m.n === n), s, false).toFixed(2) : null;
          return {{perch:!!sp("shelf", "perch"), pidgeyPerch:W(16, sp("shelf", "perch")), charPerch:W(4, sp("shelf", "perch")),
            snorlaxChair:W(143, sp("chair")), snorlaxSofa:W(143, sp("sofa")), pichuCushion:W(172, sp("cushion")), charCushion:W(4, sp("cushion")),
            charFire:W(4, sp("fire")), bulbFire:W(1, sp("fire")), machopBag:W(66, sp("bag")), squirtleBag:W(7, sp("bag")), sun:!!sp("sun"), bulbSun:W(1, sp("sun")),
            pref:[placePref({mon(1)}), placePref({mon(4)})], fishDecides:homeDecide({mon(129)}, performance.now()),
            pathChar:needPath({mon(4)}, {{x:HS.rooms.find(r => r.pond).x0 + 8, y:3.8}}), pathPidgey:needPath({mon(16)}, {{x:HS.rooms.find(r => r.pond).x0 + 8, y:3.8}})}}; }})())'''))
        print('weights', r)
        assert r['perch'] and r['pidgeyPerch'] > 0 and r['charPerch'] == 0, 'perches are for fliers'
        assert r['snorlaxChair'] == 0 and r['snorlaxSofa'] == 0, 'Snorlax is too big for chairs'
        assert r['pichuCushion'] > r['charCushion'], 'tiny ones like cushions'
        assert r['charFire'] > r['bulbFire'] and r['machopBag'] > r['squirtleBag'] and r['sun'] and r['bulbSun'] > 5, 'type favourites'
        assert r['pref'] == ['out', 'in'] and r['fishDecides'] is False
        await pg.evaluate('HS.weather = "rain"'); rain = await pg.evaluate(f'[placePref({mon(4)}), placePref({mon(7)})]'); print('rain', rain); assert rain == ['in', 'out']
        await pg.evaluate('HS.weather = "sun"')
        # live: Magikarp never leaves the pond, Squirtle mostly swims
        await pg.evaluate(f'''(() => {{ const pr = HS.rooms.find(r => r.pond); for (const n of [129, 7]) {{ const m = HS.mons.find(q => q.n === n); m.x = pr.x0 + pr.w/2; m.y = HM.D*.55; m.st = "idle"; m.t = 0; m.act = null; }} HS.me.x = pr.x0 + 2; HS.intro = null; }})()''')
        inside = []
        for i in range(16):
            await pg.wait_for_timeout(500)
            inside.append(json.loads(await pg.evaluate('JSON.stringify([129, 7].map(n => { const m = HS.mons.find(q => q.n === n); return !!inPond(roomAt(m.x), m.x, m.y); }))')))
        fish = sum(a for a, _ in inside); print('Magikarp in the pond', fish, '/16'); assert fish == 16
        # Squirtle's choices over 200 decisions: mostly the pond
        sq = await pg.evaluate('''(() => { const m = HS.mons.find(q => q.n === 7), pr = HS.rooms.find(r => r.pond); let n = 0;
          for (let i = 0; i < 200; i++) { homeActEnd(m); m.x = pr.x0 + pr.w/2; m.y = HM.D*.55; m.st = "idle"; m.t = 0; m.plan = null; homeUpdate(.016, performance.now()); if (m.st === "walk" && !m.plan && inPond(roomAt(m.tx), m.tx, m.ty)) n++; }
          return n; })()'''); print('Squirtle chose the pond', sq, '/200'); assert sq >= 100
        await pg.locator('#hmStage').screenshot(path=OUT + f'habits_{MODE}_pond.png')
        # a perched bird
        await pg.evaluate(f'''(() => {{ const m = {mon(16)}, s = homeSpots().find(s => s.kind === "shelf" && s.act === "perch"); homeActEnd(m); homeAct(m, {{act:"perch", spot:s}}, performance.now()); HS.me.x = s.x + 1.5; }})()''')
        await pg.wait_for_timeout(900); per = await pg.evaluate(f'[{mon(16)}.act, {mon(16)}.z > 1]'); print('perched', per); assert per == ['perch', True]
        await pg.locator('#hmStage').screenshot(path=OUT + f'habits_{MODE}_perch.png')
        # snacks at the table
        await pg.evaluate(f'''(() => {{ homeData().bag.pecha = 2; const m = {mon(1)}; homeActEnd(m); m.x = 30; m.y = 5; feedMon(m, "pecha"); }})()''')
        eat = await pg.evaluate(f'[{mon(1)}.st, {mon(1)}.plan && {mon(1)}.plan.act]'); print('fed', eat); assert eat == ['walk', 'eat']
        # bedtime in the bedroom (or on a sofa)
        await pg.evaluate(f'''(() => {{ window.DTD_TOD = "night"; const m = {mon(4)}; homeActEnd(m); m.x = 40; m.y = 4; homeDecide(m, performance.now()); }})()''')
        bed = await pg.evaluate(f'(() => {{ const m = {mon(4)}; return [m.plan && m.plan.act, roomAt(m.tx).id, m.plan && m.plan.spot && m.plan.spot.kind]; }})()'); print('bedtime', bed)
        assert bed[0] == 'nap' and (bed[1] == 'bedroom' or bed[2] in ('sofa', 'bed'))
        sw = await pg.evaluate('document.documentElement.scrollWidth'); assert sw <= W, sw
        print('ERRS', errs[:3]); assert not errs
        await b.close()
asyncio.run(main())
