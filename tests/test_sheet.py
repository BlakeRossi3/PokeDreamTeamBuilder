"""Pokémon sheet: Battle tab (ability, item, level, nature, EVs/IVs, moves), move picker, item picker, Personalize.

    python3 tests/test_sheet.py [width height 2d|3d]

Screenshots: tests/out/sh_*.png
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
        await pg.evaluate(f'state.games.intro=1; state.games.ecoNew=0; state.mode="{MODE}"; state.teams.all=[6,445,10034,25]; state.team="all"; save()')
        await pg.click('#playBtn'); await pg.wait_for_timeout(500)
        await pg.evaluate(f'enterApp("{MODE}","all")'); await pg.wait_for_timeout(800)
        await pg.evaluate('loadLearnsets()'); await pg.wait_for_timeout(800)
        # tapping a team member opens the Battle tab
        await pg.click('.slot[data-num="445"]'); await pg.wait_for_timeout(600)
        assert await pg.locator('#bsRoot').count(), 'battle tab'
        await pg.select_option('#bNature', 'Jolly')
        await pg.select_option('#bPreset', '0')   # Fast physical
        await pg.wait_for_timeout(200)
        st = await pg.evaluate('JSON.stringify([memberOf("all",445), document.getElementById("bEvTot").textContent, document.querySelector(\'[data-sv="spe"]\').textContent])')
        print('after nature + preset', st)
        assert '"nature":"Jolly"' in st and '"508"' in st, st
        await pg.fill('[data-iv="spa"]', '0'); await pg.press('[data-iv="spa"]', 'Tab'); await pg.wait_for_timeout(100)
        print('iv', await pg.evaluate('JSON.stringify(memberOf("all",445).ivs)'))
        await pg.screenshot(path=OUT + f'sh_battle_{TAG}.png', full_page=False)
        # move picker: sort by power, STAB only, teach the strongest
        await pg.click('[data-mslot="0"]'); await pg.wait_for_selector('.mp-row[data-mv]', timeout=10000)
        n_all = await pg.locator('.mp-row[data-mv]').count()
        await pg.click('[data-sort="pow"]'); await pg.check('#mpStab'); await pg.wait_for_timeout(200)
        first = await pg.evaluate('document.querySelector(".mp-row[data-mv]").dataset.mv')
        n_stab = await pg.locator('.mp-row[data-mv]').count()
        print('moves', n_all, 'stab', n_stab, 'strongest', first)
        await pg.click('.mp-row[data-mv] >> nth=0'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=OUT + f'sh_movepicker_{TAG}.png')
        ov = await pg.evaluate('(() => { const m = document.getElementById("modal"); return Math.max(m.scrollWidth - m.clientWidth, Math.ceil(m.getBoundingClientRect().right - innerWidth)); })()'); print('modal overflow', ov); assert ov <= 1, 'modal overflows sideways' 
        await pg.click('#mpTeach'); await pg.wait_for_timeout(600)
        mv = await pg.evaluate('JSON.stringify(memberOf("all",445).moves)'); print('moves now', mv); assert first in mv
        # keyboard: open slot 2, search, arrow + enter
        await pg.click('[data-mslot="1"]'); await pg.wait_for_selector('#mpQ')
        await pg.uncheck('#mpStab'); await pg.fill('#mpQ', 'swords'); await pg.wait_for_timeout(100)
        await pg.press('#mpQ', 'ArrowDown'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(600)
        mv = await pg.evaluate('JSON.stringify(memberOf("all",445).moves)'); print('after keyboard', mv); assert 'Swords Dance' in mv
        # item picker
        await pg.click('#bItemBtn'); await pg.wait_for_selector('.ip-it')
        await pg.screenshot(path=OUT + f'sh_itempicker_{TAG}.png')
        await pg.click('[data-ipt="berry"]'); await pg.wait_for_timeout(150)
        await pg.click('.ip-it[data-it="Sitrus Berry"]'); await pg.wait_for_timeout(150)
        await pg.screenshot(path=OUT + f'sh_itemdetail_{TAG}.png')
        await pg.click('#ipGive'); await pg.wait_for_timeout(600)
        it = await pg.evaluate('memberOf("all",445).item'); print('item', it); assert it == 'Sitrus Berry'
        await pg.screenshot(path=OUT + f'sh_battle2_{TAG}.png')
        # Mega: no item
        await pg.evaluate('closeModal(); openSheet(10034, "battle")'); await pg.wait_for_timeout(500)
        assert await pg.locator('#bItemBtn').count() == 0, 'mega item'
        # Personalize + Info
        await pg.evaluate('openSheet(445, "look")'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT + f'sh_look_{TAG}.png')
        before = await pg.evaluate('isShinyMember("all",445)')
        await pg.click('#bShiny'); await pg.wait_for_timeout(200)
        after = await pg.evaluate('isShinyMember("all",445)'); print('shiny', before, '->', after); assert before != after
        await pg.evaluate('openSheet(445, "info")'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT + f'sh_info_{TAG}.png')
        sw = await pg.evaluate('Math.max(document.documentElement.scrollWidth, document.getElementById("modal").scrollWidth - document.getElementById("modal").clientWidth + document.documentElement.clientWidth)')
        print('scrollWidth', sw, W); assert sw <= W + 1, 'sideways scroll'
        # View team panel: Battle tab works there too
        await pg.evaluate('closeModal(); openView && openView()'); await pg.wait_for_timeout(800)
        if await pg.locator('[data-vsel="445"]').count():
            await pg.click('[data-vsel="445"]'); await pg.wait_for_timeout(300)
            await pg.click('[data-vtab="battle"]'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=OUT + f'sh_view_{TAG}.png')
        print('ERRS', errs[:5]); await b.close()
asyncio.run(main())
