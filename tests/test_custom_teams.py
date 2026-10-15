import asyncio
from playwright.async_api import async_playwright
import os
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")   # the built website (python3 tests/run_all.py serves dist/web here)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep   # screenshots go here
os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        pg=await b.new_page(viewport={'width':1366,'height':860}); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' else None)
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.fill('#accName','Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(800)
        await pg.click('#playBtn'); await pg.evaluate('state.games.intro=1'); await pg.evaluate('state.games.intro=1'); await pg.click('[data-go="app"]'); await pg.wait_for_timeout(800)
        # 1: Megas only, size 8
        await pg.click('#newTeam'); await pg.wait_for_timeout(300)
        await pg.click('[data-preset="mega"]'); await pg.click('[data-csz="1"]'); await pg.click('[data-csz="1"]')
        await pg.screenshot(path=OUT+'ct_editor.png')
        print('count', await pg.inner_text('.ct-count'))
        await pg.click('#ctSave'); await pg.wait_for_timeout(1500)
        print('team', await pg.evaluate('[state.team, G().title, G().mons.length, sizeOf(state.team)]'))
        await pg.click('#randomBtn'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=OUT+'ct_mega.png')
        # 2: Fire, both? two national teams
        await pg.click('#newTeam'); await pg.wait_for_timeout(300)
        await pg.click('[data-cty="Fire"]'); await pg.fill('#ctName','Fire squad'); await pg.click('#ctSave'); await pg.wait_for_timeout(800)
        await pg.click('#newTeam'); await pg.wait_for_timeout(300)
        await pg.click('[data-preset="big"]'); await pg.click('#ctSave'); await pg.wait_for_timeout(800)
        await pg.click('#randomBtn'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=OUT+'ct_big.png')
        print('big', await pg.evaluate('[state.team, team().length, sizeOf(state.team), state.custom.map(c=>c.name)]'))
        await pg.click('#viewBtn'); await pg.wait_for_timeout(2500); await pg.screenshot(path=OUT+'ct_view.png')
        await pg.click('#viewClose'); await pg.click('#hofBtn'); await pg.wait_for_timeout(5000); await pg.screenshot(path=OUT+'ct_hof.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        # copy national team
        await pg.click('[data-team="all"]'); await pg.wait_for_timeout(500); await pg.click('#teamMore'); await pg.wait_for_timeout(200); await pg.click('#toCopy'); await pg.wait_for_timeout(800)
        print('copy', await pg.evaluate('[state.team, G().title, team()]'))
        code = await pg.evaluate('shareCode(state.team)'); print('code', code)
        # reload persistence
        await pg.reload(); await pg.wait_for_timeout(1500)
        print('after reload', await pg.evaluate('[state.custom.length, TEAMS.length, state.custom.map(c=>c.id+":"+c.name+":"+(state.teams[c.id]||[]).length)]'))
        # delete + undo
        await pg.evaluate('enterApp(null, state.custom[0].id)'); await pg.wait_for_timeout(500)
        await pg.click('#teamMore'); await pg.click('#toRules'); await pg.wait_for_timeout(200); await pg.click('#ctDel'); await pg.click('#ctDel'); await pg.wait_for_timeout(500)
        print('after delete', await pg.evaluate('[state.custom.length, state.team]'))
        await pg.click('#undoBtn'); await pg.wait_for_timeout(500)
        print('after undo', await pg.evaluate('[state.custom.length, state.team, team().length]'))
        await pg.screenshot(path=OUT+'ct_tabs.png')
        print('ERRS', errs[:8]); await b.close()
asyncio.run(main())
