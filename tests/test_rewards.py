"""Rewards: the v2 reward table, migration of old saves, Shop exclusives, new furniture, Champion's Halls and titles.

    python3 tests/test_rewards.py [width height 2d|3d]

Screenshots: tests/out/rw_*.png
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep
os.makedirs(OUT, exist_ok=True)
W, H, MODE = (int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]) if len(sys.argv) > 3 else (1366, 860, "3d")
TAG = f"{MODE}_{W}"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        pg = await b.new_page(viewport={'width': W, 'height': H}); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.fill('#accName', 'Old'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(800)
        fresh = await pg.evaluate('JSON.stringify([state.games.eco, state.games.rw2])'); print('fresh save', fresh); assert fresh == '[2,0]', fresh
        # an old save (reward table v1): Kanto cleared, 4 Johto badges, owns a Net Ball bought in the old Shop
        await pg.evaluate(f'''(()=>{{const id=profile.id; const d=JSON.parse(localStorage.getItem(PKEY(id))); const g=d.games;
          g.eco=1; g.intro=1; g.ecoNew=0; g.badges={{"1":255,"2":15}}; g.leagues={{"1":true}}; g.own.ball=["master","net"]; g.own.furn={{"trophy1":1}}; delete g.e4; delete g.rw2; delete g.title;
          d.mode="{MODE}"; localStorage.setItem(PKEY(id), JSON.stringify(d));}})()''')
        await pg.reload(); await pg.wait_for_timeout(1000)
        st = await pg.evaluate('''JSON.stringify({eco:state.games.eco, rw2:state.games.rw2, e4:state.games.e4,
          furn:["fossil","shellfountain","teslalamp","flowerarch","crystalball","volcanotub","groundrug","windvane","ghostlantern","badgecase1","badgecase2","e4s1-0","e4s1-3","trophy1","snowman"].map(id => owns("furn", id)),
          ball:["master","net","safari","sport","friend","heavy","dive"].map(id => owns("ball", id)), bg:["hall1","hall2"].map(id => owns("bg", id)), icon:["e1-0","g1-3","c1","g2-0"].map(id => owns("icon", id)), titles:TITLES()})''')
        print('migrated', st); m = json.loads(st)
        assert m['eco'] == 2 and m['rw2'] > 10, m
        assert m['furn'] == [True]*7 + [True, True, True, True, True, True, True, False], m['furn']   # Pryce's Snowman (Johto gym 7) isn't won yet
        assert m['ball'] == [True, True, True, True, True, False, False], m['ball']
        assert m['bg'] == [True, False] and m['icon'] == [True, True, True, True], m
        await pg.evaluate('showHub()'); await pg.wait_for_timeout(1600)
        title = await pg.evaluate('document.getElementById("modalWrap").hidden ? null : document.getElementById("modalTitle").textContent'); print('news', title)
        assert title and 'rewards' in title.lower(), title
        await pg.screenshot(path=OUT + f'rw_news_{TAG}.png')
        await pg.evaluate('closeModal()')
        # Shop: owned exclusives show where they came from; the rest are "?" tiles
        await pg.evaluate('shopCat="furn"; openScreen("shop")'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=OUT + f'rw_shop_{TAG}.png', full_page=True)
        print('shop', await pg.evaluate('[document.querySelectorAll(".shop-item.ex").length, document.querySelectorAll(".q-tile").length]'))
        # Home: every new furniture piece placed in the living room and garden
        await pg.evaluate('''(()=>{ const ids = ITEMS_ALL.filter(it => it.cat === "furn" && isExclusive(it)).map(it => it.id); ids.forEach(id => { if (!owns("furn", id)) grant(unlockOf("furn", id)); });
          grant(unlockOf("exp","living")); grant(unlockOf("exp","garden")); grant(unlockOf("exp","hall"));
          const H = state.games.home; H.items = []; let x = 0, y = 0, room = 0;
          for (const id of ids) { const it = unlockOf("furn", id); if (x + it.w > 46) { x = 0; y += 2; } if (y > 5) break; H.items.push({id, x, y, f:0}); x += it.w + 1; }
          save(); })()''')
        await pg.evaluate('openScreen("home")'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=OUT + f'rw_home_{TAG}.png')
        # a thumbnail sheet of every new piece, as the Shop / reward pop-ups draw them
        await pg.evaluate('''(()=>{ const box = document.createElement("div"); box.id = "thumbs"; box.style.cssText = "position:fixed;inset:0;z-index:999;overflow:auto;background:#222;display:flex;flex-wrap:wrap;gap:4px;padding:4px";
          for (const it of ITEMS_ALL.filter(it => it.cat === "furn" && isExclusive(it))) { const d = document.createElement("div"); d.style.cssText = "color:#fff;font:10px sans-serif;width:160px;text-align:center"; d.innerHTML = itemThumb(it) + "<br>" + it.name; box.appendChild(d); }
          document.body.appendChild(box); paintThumbs(box); })()''')
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path=OUT + f'rw_thumbs_{TAG}.png', full_page=True)
        await pg.evaluate('document.getElementById("thumbs").remove()')
        # Champion's Hall background
        await pg.evaluate('enterApp(state.mode, "g1"); state.scenes.g1 = {...(state.scenes.g1 || {}), bg:"hall1"}; state.scenes["g1~2d"] = {...(state.scenes["g1~2d"] || {}), bg:"hall1"}; save(); openHof()'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=OUT + f'rw_hall_{TAG}.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        # trainer card title
        await pg.evaluate('openScreen("card")'); await pg.wait_for_timeout(1200)
        await pg.click('[data-title="champ1"]'); await pg.wait_for_timeout(1500)
        print('title', await pg.evaluate('[state.games.title, myTitle()]'))
        await pg.screenshot(path=OUT + f'rw_card_{TAG}.png')
        print('ERRS', errs[:5]); await b.close()
asyncio.run(main())
