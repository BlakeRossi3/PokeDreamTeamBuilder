"""Battle screen: moves with PP, the Bag, U-turn switching and the Elite Four run with one bag.

    python3 tests/test_battle_ui.py [width height 2d|3d]

Screenshots: tests/out/bt_*.png
"""
import asyncio, os, sys
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep
os.makedirs(OUT, exist_ok=True)
W, H, MODE = (int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]) if len(sys.argv) > 3 else (1280, 860, "3d")
TAG = f"{MODE}_{W}"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        pg = await b.new_page(viewport={'width': W, 'height': H}); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.fill('#accName', 'Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(800)
        await pg.evaluate(f'''state.games.intro=1; state.games.ecoNew=0; state.ui.bmode="manual"; state.ui.bspeed="fast"; state.mode="{MODE}";
          state.teams.g1=[6,9,3,25,143,123]; state.members.g1={{"123":{{moves:["U-turn","X-Scissor","Swords Dance","Aerial Ace"],item:"Leftovers",nature:"Adamant",evs:{{atk:252,spe:252,hp:4}}}}}};
          state.teams.all=[6,9,3,25,143,123]; state.members.all=state.members.g1; save()''')
        await pg.click('#playBtn'); await pg.wait_for_timeout(600)
        await pg.evaluate(f'document.documentElement.dataset.mode="{MODE}"')
        # a rival battle, picking moves by hand
        await pg.evaluate('openScreen("battle","rival")'); await pg.wait_for_timeout(600)
        await pg.select_option('#rvTeam', 'g1'); await pg.click('[data-rv="6"]'); await pg.wait_for_timeout(2500)
        await pg.wait_for_selector('.bt-move', timeout=15000)
        # make the rival harmless and sturdy so the steps below are predictable
        await pg.evaluate('F.b.s[1].party.forEach(m => { m.moves = [MOVE_BY.get("Splash")]; m.pp = [64]; m.hp = m.max = 999; }); F.b.s[1].bag = null')
        pp = await pg.evaluate('[...document.querySelectorAll(".bt-move .bt-pp")].map(x => x.textContent)')
        print('pp labels', pp)
        assert pp and all(x.startswith('PP ') for x in pp), pp
        await pg.screenshot(path=OUT + f'bt_moves_{TAG}.png')
        # take a hit, then use the Bag
        await pg.evaluate('F.b.get(0).hp = Math.floor(F.b.get(0).max/3)')
        await pg.click('[data-bt="bag"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT + f'bt_bag_{TAG}.png')
        items = await pg.evaluate('[...document.querySelectorAll(".bt-bagb b")].map(x => x.textContent)')
        print('bag', items); assert 'Hyper Potion' in items, items
        await pg.click('[data-bagit="Hyper Potion"]'); await pg.wait_for_timeout(300)
        if await pg.locator('[data-bagto]').count():
            await pg.screenshot(path=OUT + f'bt_bagto_{TAG}.png'); await pg.click('[data-bagto="0"]')
        await pg.wait_for_timeout(2500)
        log = await pg.inner_text('#btLog'); left = await pg.evaluate('F.b.s[0].bag["Hyper Potion"]')
        print('after potion', left, log.replace("\n", " | ")[:200])
        assert left == 1, left
        # switch to Scyther and U-turn: the game asks who comes in
        await pg.wait_for_selector('[data-bt="switch"]:not([disabled])', timeout=15000)
        await pg.click('[data-bt="switch"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT + f'bt_switch_{TAG}.png')
        await pg.click('[data-sw="5"]'); await pg.wait_for_timeout(3000)
        await pg.wait_for_selector('.bt-move', timeout=20000)
        await pg.click('.bt-move[data-mv="0"]');
        asked = False
        for _ in range(40):
            await pg.wait_for_timeout(300)
            q = await pg.evaluate('(document.querySelector(".bt-q")||{}).textContent || ""')
            if 'Who comes in' in q: asked = True; break
            if await pg.locator('.bt-move').count() and not await pg.evaluate('!!F.b.pend'): break
        print('u-turn asked', asked)
        if asked:
            await pg.screenshot(path=OUT + f'bt_uturn_{TAG}.png')
            await pg.click('.bt-swb:not([disabled]) >> nth=0'); await pg.wait_for_timeout(2500)
        # finish it automatically
        await pg.evaluate('F.b.s[1].party.forEach(m => m.hp = 1)')
        await pg.evaluate("(()=>{const b=document.querySelector('[data-bt=fast]'); if(b) b.click();})()")
        for _ in range(80):
            if await pg.locator('[data-res]').count(): break
            await pg.evaluate("(()=>{const b=document.querySelector('[data-bt=fast]'); if(b && !b.disabled) b.click(); const a=document.querySelector('[data-bt=auto]'); if(a) a.click();})()")
            await pg.wait_for_timeout(400)
        print('rival end', (await pg.inner_text('#btLog')).replace("\n", " | ")[-160:])
        # Elite Four: one bag for the run, shown between battles
        await pg.evaluate('state.games.badges[1]=255; save(); gymRegion=1; openScreen("battle","gym")'); await pg.wait_for_timeout(800)
        await pg.screenshot(path=OUT + f'bt_gympage_{TAG}.png', full_page=True)
        await pg.click('#e4Go'); await pg.wait_for_timeout(2500)
        print('e4 bag', await pg.evaluate('JSON.stringify(F.b.s[0].bag)'), await pg.evaluate('F.b.s[1].ai'), await pg.evaluate('JSON.stringify(F.b.s[1].bag)'))
        await pg.evaluate('F.b.s[0].bag["Max Potion"]--')   # pretend one was used in this battle
        await pg.evaluate('F.b.s[1].party.forEach(m => m.hp = 1)')
        await pg.evaluate("(()=>{const b=document.querySelector('[data-bt=fast]'); if(b) b.click();})()")
        for _ in range(80):
            if await pg.locator('[data-res]').count(): break
            await pg.evaluate("(()=>{const b=document.querySelector('[data-bt=fast]'); if(b && !b.disabled) b.click(); const a=document.querySelector('[data-bt=auto]'); if(a) a.click();})()")
            await pg.wait_for_timeout(400)
        end = await pg.inner_text('#btLog'); print('e4 1 end', end.replace("\n", " | ")[-220:])
        if 'Bag:' in end:
            await pg.click('[data-res="0"]'); await pg.wait_for_timeout(800)
            await pg.screenshot(path=OUT + f'bt_e4prep_{TAG}.png')
            chips = await pg.evaluate('[...document.querySelectorAll("[data-pbag]")].map(x => x.textContent)')
            print('prep bag', chips); assert any('Max Potion' in c and '×2' in c for c in chips), chips
        sw = await pg.evaluate('document.documentElement.scrollWidth'); print('scrollWidth', sw, W)
        assert sw <= W + 1, 'sideways scroll'
        print('ERRS', errs[:5]); await b.close()
asyncio.run(main())
