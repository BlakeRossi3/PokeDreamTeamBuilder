import asyncio, sys, json
from playwright.async_api import async_playwright
import os
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")   # the built website (python3 tests/run_all.py serves dist/web here)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep   # screenshots go here
os.makedirs(OUT, exist_ok=True)
async def run(p, w, h, mode, tag, dark=False):
    b=await p.chromium.launch(); errs=[]
    ctx=await b.new_context(viewport={'width':w,'height':h}, color_scheme='dark' if dark else 'light', device_scale_factor=1)
    pg=await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.on('console', lambda m: errs.append('CONSOLE '+m.text) if m.type in ('error','warning') and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
    async def shot(name, full=False):
        await pg.screenshot(path=f'{OUT}{tag}_{name}.png', full_page=full)
        ov = await pg.evaluate('document.documentElement.scrollWidth - innerWidth')
        if ov > 1: errs.append(f'HOVERFLOW {name} {ov}px')
    await pg.add_init_script("window.__toasts=[]; new MutationObserver(()=>{const t=document.getElementById('toast'); if(t&&!t.hidden){const x=t.textContent; if(window.__toasts[window.__toasts.length-1]!==x) window.__toasts.push(x);}}).observe(document,{subtree:true,childList:true,attributes:true});")
    await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(1200)
    await shot('00signin')
    await pg.fill('#accName','Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(2500)
    if mode=='2d': await pg.click('[data-sm="2d"]'); await pg.wait_for_timeout(1500)
    await shot('01title')
    await pg.click('#playBtn'); await pg.wait_for_timeout(1500); await shot('02a_welcome')
    if await pg.locator('#wlClose').count(): await pg.click('#wlClose'); await pg.wait_for_timeout(300)
    await shot('02hub')
    await pg.click('[data-go="app"]'); await pg.wait_for_timeout(2500); await shot('03builder')
    await pg.evaluate('window.scrollTo(0, 900)'); await pg.wait_for_timeout(800); await shot('03b_builder_scroll'); await pg.evaluate('window.scrollTo(0,0)')
    await pg.click('[data-team="all"]'); await pg.wait_for_timeout(2500); await shot('04national')
    await pg.click('#filterBtn'); await pg.wait_for_timeout(500); await shot('05filters'); await pg.click('#filterBtn')
    await pg.click('#slots .slot[data-num] >> nth=0'); await pg.wait_for_timeout(1500); await shot('06personalize'); await pg.keyboard.press('Escape')
    await pg.click('.card >> nth=3 >> .info'); await pg.wait_for_timeout(800); await shot('07sheet'); await pg.keyboard.press('Escape')
    await pg.click('#teamMore'); await pg.wait_for_timeout(400); await shot('08teamopts'); await pg.keyboard.press('Escape')
    await pg.click('#pickTrainer'); await pg.wait_for_timeout(1500); await shot('09trainers'); await pg.keyboard.press('Escape')
    await pg.click('#viewBtn'); await pg.wait_for_timeout(2500); await shot('10view'); await pg.click('#viewClose')
    await pg.click('#hofBtn'); await pg.wait_for_timeout(4000); await shot('11hof')
    await pg.click('#hofEdit') if await pg.locator('#hofEdit').count() else None
    await pg.wait_for_timeout(600); await shot('11b_hofedit'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300); await pg.keyboard.press('Escape')
    await pg.click('#newTeam'); await pg.wait_for_timeout(400); await shot('12newteam'); await pg.keyboard.press('Escape')
    await pg.click('#homeBtn'); await pg.wait_for_timeout(800)
    for go in ['battle','home','shop','hofgal','quiz','card','ach']:
        await pg.click(f'[data-go="{go}"]'); await pg.wait_for_timeout(1800); await shot('20'+go)
        if go=='battle':
            for sub in ['rival','gym','vs']:
                await pg.click(f'[data-bsub="{sub}"]'); await pg.wait_for_timeout(1500); await shot('21battle_'+sub); await pg.click('#scBack'); await pg.wait_for_timeout(500)
            await pg.click('[data-bsub="rival"]'); await pg.wait_for_timeout(800); await pg.click('[data-rv="0"]'); await pg.wait_for_timeout(5000); await shot('22fight')
            await pg.wait_for_timeout(3000); await shot('22fight2')
            await pg.click('#scBack'); await pg.wait_for_timeout(500)
            if await pg.locator('#cfYes').count(): await pg.click('#cfYes'); await pg.wait_for_timeout(600)
            await pg.click('#scBack'); await pg.wait_for_timeout(500)
        if go=='quiz':
            await pg.click('[data-qm="daily"]'); await pg.wait_for_timeout(1500); await shot('23daily')
            for k in range(10):
                await pg.click('[data-qa] >> nth=0'); await pg.wait_for_timeout(250); await pg.click('#qzNext'); await pg.wait_for_timeout(500)
            await shot('23daily_done')
        await pg.click('#scBack'); await pg.wait_for_timeout(800)
        if await pg.locator('#cfYes').count(): await pg.click('#cfYes'); await pg.wait_for_timeout(500)
        if not await pg.locator('#hubGrid').is_visible():
            await pg.evaluate('showHub()'); await pg.wait_for_timeout(500)
    await pg.locator('[data-gear]:visible').first.click(); await pg.wait_for_timeout(1000); await shot('30settings', full=True)
    toasts = await pg.evaluate('window.__toasts || []')
    print(tag, json.dumps(errs[:20]), toasts[:10])
    await b.close()
async def main():
    async with async_playwright() as p:
        await run(p,1366,860,'3d','d3')
        await run(p,1366,860,'2d','d2')
        await run(p,390,844,'3d','m3', dark=True)
        await run(p,390,844,'2d','m2')
asyncio.run(main())
