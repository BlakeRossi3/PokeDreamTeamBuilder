import asyncio
from playwright.async_api import async_playwright
import os
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")   # the built website (python3 tests/run_all.py serves dist/web here)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep   # screenshots go here
os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]; pg=await b.new_page(viewport={'width':1366,'height':860})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.fill('#accName','Old'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(600)
        # fake an old save: no eco fields, badges, a league, used balls/bgs
        await pg.evaluate('''(()=>{const id=profile.id; const d=JSON.parse(localStorage.getItem(PKEY(id))); const g=d.games; for (const k of ["pp","ppTotal","spent","own","icon","eco","ecoNew","home"]) delete g[k]; g.intro=1; g.badges={"1":255,"2":15}; g.leagues={"1":true}; g.wins={"Red":1}; g.card="gold"; d.members={all:{"6":{ball:"master"}}}; d.scenes={all:{bg:"volcano"}}; localStorage.setItem(PKEY(id), JSON.stringify(d)); })()''')
        await pg.reload(); await pg.wait_for_timeout(1000)
        await pg.evaluate('showHub()'); await pg.wait_for_timeout(1500)
        print("modal", await pg.locator('#modalTitle').inner_text() if await pg.locator('#modalWrap:not([hidden]) #modalTitle').count() else None)
        await pg.screenshot(path=OUT+'migration_eco.png')
        print(await pg.evaluate('[state.games.pp, state.games.ecoNew, JSON.stringify(state.games.own), state.games.card]'))
        await pg.evaluate('closeModal()'); await pg.wait_for_timeout(300)
        print("ecoNew after", await pg.evaluate('state.games.ecoNew'))
        # personalize ball grid
        await pg.evaluate('enterApp("3d","all")'); await pg.wait_for_timeout(800)
        await pg.evaluate('openSheet(6, "build")'); await pg.wait_for_timeout(800)
        await pg.click('.ball-opt.locked >> nth=0'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT+'migration_ball.png')
        await pg.click('[data-ballbuy]'); await pg.wait_for_timeout(400)
        print("ball", await pg.evaluate('[ballOf("all",6), JSON.stringify(state.games.own.ball), state.games.pp]'))
        print("errors", errs)
        await b.close()
asyncio.run(main())
