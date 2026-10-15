import asyncio
from playwright.async_api import async_playwright
import os
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")   # the built website (python3 tests/run_all.py serves dist/web here)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep   # screenshots go here
os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        pg=await b.new_page(viewport={'width':1280,'height':860}, accept_downloads=True); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("window.__toasts=[]; new MutationObserver(()=>{const t=document.getElementById('toast'); if(t&&!t.hidden){const x=t.textContent; if(window.__toasts[window.__toasts.length-1]!==x) window.__toasts.push(x);}}).observe(document,{subtree:true,childList:true,attributes:true});")
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(600)
        # second save first (for versus)
        await pg.fill('#accName','Sofia'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(800)
        await pg.evaluate('state.games.intro=1; state.games.ecoNew=0; state.teams.all=[150,6,9,3,25,143]; save()')
        await pg.evaluate('signOut()'); await pg.wait_for_timeout(800)
        if await pg.locator('#accName').count()==0 or not await pg.locator('#accName').is_visible():
            await pg.evaluate('showSignIn("new")'); await pg.wait_for_timeout(500)
        await pg.fill('#accName','Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(800)
        await pg.evaluate('state.games.intro=1; state.games.ecoNew=0; state.ui.bmode="auto"; state.ui.bspeed="fast"; save()')
        await pg.click('#playBtn'); await pg.wait_for_timeout(600)
        # gym
        await pg.click('[data-go="battle"]'); await pg.click('[data-bsub="gym"]'); await pg.wait_for_timeout(600)
        await pg.click('.gym-card .btn >> nth=0'); await pg.wait_for_timeout(1500)
        for i in range(60):
            if await pg.locator('[data-res]').count(): break
            await pg.evaluate("(()=>{const b=document.querySelector('[data-bt=fast]'); if(b) b.click();})()")
            await pg.wait_for_timeout(500)
        print('gym end', await pg.inner_text('#btLog'), await pg.evaluate('JSON.stringify(state.games.badges)'))
        await pg.screenshot(path=OUT+'f_gym_end.png')
        await pg.wait_for_timeout(2000); await pg.evaluate('closeModal()'); await pg.click('[data-res="0"]') ; await pg.wait_for_timeout(800)
        await pg.evaluate('openScreen("battle","vs")'); await pg.wait_for_timeout(800)
        await pg.click('[data-vs]'); await pg.wait_for_timeout(600)
        await pg.click('[data-vsmode] [data-v="auto"]'); await pg.click('#vsGo'); await pg.wait_for_timeout(1500)
        for i in range(80):
            if await pg.locator('[data-res]').count(): break
            await pg.evaluate("(()=>{const b=document.querySelector('[data-bt=fast]'); if(b) b.click();})()")
            await pg.wait_for_timeout(500)
        print('vs end', await pg.inner_text('#btLog'), await pg.evaluate('JSON.stringify(state.games.vs)'))
        # card save
        await pg.evaluate('openScreen("card")'); await pg.wait_for_timeout(1500)
        btn = pg.locator('#scBody button:has-text("Save")').first
        if await btn.count(): await btn.click(); await pg.wait_for_timeout(2500)
        # hof gif export
        await pg.evaluate('enterApp(null,"all")'); await pg.wait_for_timeout(800); await pg.click('#hofBtn'); await pg.wait_for_timeout(3000)
        await pg.click('#hofGif'); await pg.wait_for_timeout(20000)
        await pg.screenshot(path=OUT+'f_gif.png')
        await pg.keyboard.press('Escape')
        # settings controls
        await pg.evaluate('openScreen("settings")'); await pg.wait_for_timeout(600)
        for sel in ['[data-tpick]','[data-acc]','[data-uk="text"] [data-v="large"]','[data-uk="motion"] [data-v="reduced"]','[data-uk="bspeed"] [data-v="normal"]','[data-stylepick] [data-v="2d"]','[data-tpick]','[data-stylepick] [data-v="3d"]']:
            loc = pg.locator(sel)
            n = await loc.count()
            for k in range(min(n,4)):
                await pg.locator(sel).nth(k).click(); await pg.wait_for_timeout(150)
        print('ui', await pg.evaluate('JSON.stringify(state.ui)'))
        print('toasts', await pg.evaluate('window.__toasts'))
        print('ERRS', errs[:5]); await b.close()
asyncio.run(main())
