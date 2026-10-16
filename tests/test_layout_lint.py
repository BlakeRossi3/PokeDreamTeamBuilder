"""Layout checker: every main screen and modal, in 2D and 3D, at 1366×860, 768×1024 and 390×844. On each it runs
tests/layout_lint.js (controls sticking out of their box or off the screen, clipped text, overlaps, uneven wraps) and a
jitter check (nothing moves while nothing is happening). Writes tests/out/layout_lint.json and fails on any problem.

    python3 tests/test_layout_lint.py [size-tag ...]      # size tags: d, t, m (default: all three)
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out") + os.sep
os.makedirs(OUT, exist_ok=True)
LINT = open(os.path.join(HERE, "layout_lint.js")).read()
SIZES = {"d": (1366, 860), "t": (768, 1024), "m": (390, 844)}

async def run(p, size, mode, report):
    W, H = SIZES[size]; tag = f"{size}{mode[0]}"
    b = await p.chromium.launch(); errs = []
    ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1, has_touch=size == "m")
    pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(LINT)
    async def lint(name, jitter=False):
        await pg.mouse.move(2, 2); await pg.wait_for_timeout(350)   # no hover effects (and let hover transitions settle)
        res = await pg.evaluate('window.__layoutLint()')
        if jitter: res += await pg.evaluate('window.__layoutJitter()')
        if await pg.evaluate('document.documentElement.scrollWidth > innerWidth + 1'): res.append({"kind": "sideways", "el": "page", "where": "", "extra": "scrolls sideways"})
        for r in res: r["screen"] = name
        report.setdefault(tag, []).extend(res)
    async def esc(): await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250)
    await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(1000)
    await lint('signin')
    await pg.fill('#accName', 'Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(1800)
    await pg.evaluate(f'''state.games.intro = 1; state.games.ecoNew = 0; state.mode = "{mode}"; document.documentElement.dataset.mode = "{mode}";
      state.teams.all = [6, 248, 445, 887, 1007, 149]; state.teams.g1 = [6, 9, 25, 94, 131, 143]; state.favs = [25, 133, 6, 94];
      state.members.g1 = {{"6":{{nick:"Blazing Charizard", item:"Leftovers", moves:["Flamethrower","Air Slash","Dragon Pulse","Roost"]}}}}; state.games.home.mons = [25, 133]; save(); showHub()''')
    await pg.wait_for_timeout(1200); await lint('hub', jitter=True)
    await pg.evaluate(f'enterApp("{mode}", "g1")'); await pg.wait_for_timeout(2000); await lint('builder', jitter=True)
    await pg.evaluate('openSheet(6, "battle")'); await pg.wait_for_timeout(900); await lint('sheet-battle')
    await pg.evaluate('openSheet(6, "look")'); await pg.wait_for_timeout(600); await lint('sheet-look')
    await pg.evaluate('openSheet(6, "info")'); await pg.wait_for_timeout(600); await lint('sheet-info')
    await pg.evaluate('openSheet(6, "battle")'); await pg.wait_for_timeout(600)
    if await pg.locator('[data-mslot="0"]').count(): await pg.click('[data-mslot="0"]'); await pg.wait_for_timeout(1500); await lint('movepicker')
    await pg.evaluate('openSheet(6, "battle")'); await pg.wait_for_timeout(500)
    if await pg.locator('#bItemBtn').count(): await pg.click('#bItemBtn'); await pg.wait_for_timeout(800); await lint('itempicker')
    await pg.evaluate('closeModal()'); await pg.wait_for_timeout(300)
    await pg.click('#teamMore'); await pg.wait_for_timeout(400); await lint('teamopts'); await esc()
    await pg.click('#pickTrainer'); await pg.wait_for_timeout(1000); await lint('trainers'); await esc()
    await pg.click('#filterBtn'); await pg.wait_for_timeout(400); await lint('filters'); await pg.click('#filterBtn')
    await pg.click('#viewBtn'); await pg.wait_for_timeout(2000); await lint('view'); await pg.click('#viewClose'); await pg.wait_for_timeout(300)
    await pg.click('#newTeam'); await pg.wait_for_timeout(400); await lint('newteam'); await esc()
    for go in ['battle', 'home', 'shop', 'hofgal', 'quiz', 'card', 'ach', 'friends', 'settings']:
        await pg.evaluate(f'openScreen("{go}")'); await pg.wait_for_timeout(1500); await lint(go, jitter=go in ('home', 'shop', 'battle'))
        if go == 'battle':
            for sub in ['rival', 'gym', 'vs']:
                await pg.evaluate(f'openScreen("battle", "{sub}")'); await pg.wait_for_timeout(1200); await lint('battle-' + sub)
            await pg.evaluate('openScreen("battle", "rival")'); await pg.wait_for_timeout(600); await pg.click('[data-rv="0"]'); await pg.wait_for_timeout(4500); await lint('fight')
            await pg.evaluate('F.b && (F.b.over = true)')
        if go == 'home':
            await pg.click('#hmDeco'); await pg.wait_for_timeout(800); await lint('home-deco', jitter=True); await pg.click('#hmDeco'); await pg.wait_for_timeout(400)
        if go == 'shop':
            for c in ['exp', 'bg', 'icon', 'ball', 'card']:
                await pg.evaluate(f'shopCat = "{c}"; renderShop()'); await pg.wait_for_timeout(400); await lint('shop-' + c)
        if go == 'quiz':
            await pg.click('[data-qm="daily"]'); await pg.wait_for_timeout(1200); await lint('quiz-daily')
    await pg.evaluate('showStart()'); await pg.wait_for_timeout(800); await lint('title')
    await pg.evaluate('openAccountMenu()'); await pg.wait_for_timeout(400); await lint('account'); await esc()
    if errs: report.setdefault(tag, []).append({"kind": "error", "el": "page", "where": "", "extra": errs[0][:200], "screen": "-"})
    await b.close()

async def main():
    sizes = [a for a in sys.argv[1:] if a in SIZES] or list(SIZES)
    report = {}
    async with async_playwright() as p:
        for s in sizes:
            for mode in ['3d', '2d']:
                await run(p, s, mode, report)
    json.dump(report, open(OUT + 'layout_lint.json', 'w'), indent=1, ensure_ascii=False)
    total = 0
    for tag, items in report.items():
        print(f"== {tag}: {len(items)} problems")
        for it in items: print(f"  [{it['screen']}] {it['kind']}: {it['el']}  ({it['where']}) {it['extra']}")
        total += len(items)
    print("TOTAL", total)
    assert total == 0, f"{total} layout problems (see tests/out/layout_lint.json)"
asyncio.run(main())
