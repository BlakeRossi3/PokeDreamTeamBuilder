import asyncio, sys
from playwright.async_api import async_playwright
import os
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")   # the built website (python3 tests/run_all.py serves dist/web here)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep   # screenshots go here
os.makedirs(OUT, exist_ok=True)
W = int(sys.argv[1]) if len(sys.argv) > 1 else 1366
H = int(sys.argv[2]) if len(sys.argv) > 2 else 860
MODE = sys.argv[3] if len(sys.argv) > 3 else "3d"
O = f"{OUT}home_{W}_{MODE}"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        pg = await b.new_page(viewport={'width':W,'height':H}, has_touch=W < 700, is_mobile=False)
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(700)
        await pg.fill('#accName', 'Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(800)
        await pg.evaluate(f'state.mode="{MODE}"; state.favs=[25,133,6,9,3,150,448,94]; state.teams.all=[150,6,9,3,25,143]; state.teams.g1=[6,9,3,25]; save()')
        await pg.click('#playBtn'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=O + "_hub_welcome.png")
        print("welcome:", await pg.locator('#modalTitle').inner_text() if await pg.locator('#modalTitle').count() else None)
        await pg.evaluate('closeModal()'); await pg.wait_for_timeout(400)
        print("pp", await pg.evaluate('[state.games.pp, state.games.ecoNew, state.games.intro]'))
        await pg.screenshot(path=O + "_hub.png")
        # battle menu
        await pg.click('[data-go="battle"]'); await pg.wait_for_timeout(900); await pg.screenshot(path=O + "_battle.png", full_page=True)
        # shop
        await pg.evaluate('openScreen("shop")'); await pg.wait_for_timeout(700); await pg.screenshot(path=O + "_shop.png", full_page=True)
        for c in ["exp", "bg", "icon", "ball", "card"]:
            await pg.click(f'[data-scat="{c}"]'); await pg.wait_for_timeout(500); await pg.screenshot(path=O + f"_shop_{c}.png", full_page=True)
        await pg.click('[data-scat="furn"]'); await pg.wait_for_timeout(300)
        await pg.evaluate("state.games.pp += 1000"); await pg.click('[data-scat="exp"]'); await pg.click('[data-scat="furn"]'); await pg.click('[data-buy="sofa"]'); await pg.wait_for_timeout(300)
        await pg.click('[data-buy="lamp"]'); await pg.wait_for_timeout(300)
        print("after buy", await pg.evaluate('[state.games.pp, JSON.stringify(state.games.own.furn), state.games.spent]'))
        # home
        await pg.evaluate('openScreen("home")'); await pg.wait_for_timeout(1500); await pg.screenshot(path=O + "_home_empty.png")
        await pg.click('#hmPick'); await pg.wait_for_timeout(600)
        for n in [25, 133, 6, 9]:
            await pg.click(f'[data-hpk="{n}"]'); await pg.wait_for_timeout(100)
        await pg.screenshot(path=O + "_home_pick.png")
        await pg.click('#hmPickOk'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=O + "_home.png")
        # walk with keyboard
        await pg.focus('#hmCv')
        await pg.keyboard.down('ArrowRight'); await pg.wait_for_timeout(900); await pg.keyboard.up('ArrowRight')
        await pg.keyboard.down('ArrowDown'); await pg.wait_for_timeout(400); await pg.keyboard.up('ArrowDown')
        print("me", await pg.evaluate('[HS.me.x.toFixed(2), HS.me.y.toFixed(2)]'))
        # interact via residents list
        await pg.click('[data-hres="25"]'); await pg.wait_for_timeout(3500)
        print("fr", await pg.evaluate('JSON.stringify(state.games.home.fr)'), "pp", await pg.evaluate('state.games.pp'))
        await pg.screenshot(path=O + "_home_play.png")
        # decorate
        await pg.click('#hmDeco'); await pg.wait_for_timeout(600)
        await pg.click('[data-hplace="sofa"]'); await pg.wait_for_timeout(200)
        box = await pg.locator('#hmCv').bounding_box()
        await pg.mouse.move(box['x'] + box['width']*.45, box['y'] + box['height']*.6); await pg.wait_for_timeout(100)
        await pg.mouse.click(box['x'] + box['width']*.45, box['y'] + box['height']*.6); await pg.wait_for_timeout(500)
        await pg.click('[data-hplace="lamp"]'); await pg.wait_for_timeout(200)
        await pg.mouse.move(box['x'] + box['width']*.8, box['y'] + box['height']*.45); await pg.mouse.click(box['x'] + box['width']*.8, box['y'] + box['height']*.45); await pg.wait_for_timeout(500)
        print("items", await pg.evaluate('JSON.stringify(state.games.home.items)'))
        await pg.screenshot(path=O + "_home_deco.png")
        await pg.click('#hmDeco'); await pg.wait_for_timeout(600)
        # buy a room and check layout
        await pg.evaluate('state.games.pp += 20000; buy(unlockOf("exp","living")); buy(unlockOf("exp","pond")); buy(unlockOf("exp","garden")); buy(unlockOf("exp","hall")); state.games.home.mons=[25,133,6,9,3,150,448,94]; save(); openScreen("home")'); await pg.wait_for_timeout(2500)
        await pg.focus('#hmCv'); await pg.keyboard.down('ArrowRight'); await pg.wait_for_timeout(3000); await pg.keyboard.up('ArrowRight'); await pg.wait_for_timeout(800)
        await pg.screenshot(path=O + "_home_big.png")
        await pg.keyboard.down('ArrowRight'); await pg.wait_for_timeout(4000); await pg.keyboard.up('ArrowRight'); await pg.wait_for_timeout(800)
        await pg.screenshot(path=O + "_home_big2.png")
        # hall of fame gallery
        await pg.evaluate('openScreen("hofgal")'); await pg.wait_for_timeout(4000); await pg.screenshot(path=O + "_hofgal.png", full_page=True)
        other = "2d" if MODE == "3d" else "3d"
        await pg.click(f'[data-gm="{other}"]'); await pg.wait_for_timeout(4000); await pg.screenshot(path=O + "_hofgal_other.png", full_page=True)
        await pg.click('[data-hg="all"]'); await pg.wait_for_timeout(3000)
        print("hof mode", await pg.evaluate('[state.mode, $("hofName").textContent]'))
        await pg.click('#hofEdit'); await pg.wait_for_timeout(600); await pg.screenshot(path=O + "_hof_panel.png")
        # change bg in this mode, then confirm other mode unaffected
        await pg.evaluate('state.games.pp += 2000');
        await pg.click('[data-bg="cave"]'); await pg.wait_for_timeout(600); await pg.screenshot(path=O + "_hof_unlock.png")
        if await pg.locator('#unBuy').count(): await pg.click('#unBuy'); await pg.wait_for_timeout(600)
        print("scenes", await pg.evaluate('JSON.stringify(Object.fromEntries(Object.entries(state.scenes).map(([k,v])=>[k,v.bg])))'))
        await pg.click('#hofClose'); await pg.wait_for_timeout(1500)
        print("back to", await pg.evaluate('nav.screen'))
        # card
        await pg.evaluate('openScreen("card")'); await pg.wait_for_timeout(500)
        await pg.click('[data-icon="p25"]'); await pg.wait_for_timeout(300)
        await pg.click('[data-card="galaxy"]'); await pg.wait_for_timeout(500)
        if await pg.locator('#unBuy').count(): await pg.click('#unBuy'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=O + "_card.png", full_page=True)
        # gym win -> rewards
        await pg.evaluate('state.ui.bmode="auto"; state.ui.bspeed="fast"; save(); openScreen("battle","gym")'); await pg.wait_for_timeout(700)
        await pg.evaluate('startGym(1,0)'); await pg.wait_for_timeout(800)
        if await pg.locator('#gpkGo').count(): await pg.click('#gpkGo'); await pg.wait_for_timeout(1500)
        for i in range(80):
            if await pg.locator('[data-res]').count(): break
            await pg.evaluate("(()=>{const b=document.querySelector('[data-bt=fast]'); if(b) b.click();})()")
            await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path=O + "_gym_reward.png")
        print("gym", await pg.evaluate('[JSON.stringify(state.games.badges), JSON.stringify(state.games.own.icon), state.games.pp]'))
        # ach screen, hub
        await pg.evaluate('closeModal(); openScreen("ach")'); await pg.wait_for_timeout(500); await pg.screenshot(path=O + "_ach.png", full_page=True)
        await pg.evaluate('showHub()'); await pg.wait_for_timeout(1200); await pg.screenshot(path=O + "_hub2.png")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
