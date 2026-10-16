"""Accessibility check with axe-core (npm install once): colour contrast (WCAG AA), names and labels on buttons, inputs
and images, and valid ARIA, on the main screens in 2D and 3D at desktop and phone sizes. Fails on any serious or
critical problem; lists the rest. Canvas drawings (Hall of Fame, Home, battle backgrounds) aren't checked.

    python3 tests/test_a11y.py [d m]

Report: tests/out/a11y.json
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out") + os.sep
os.makedirs(OUT, exist_ok=True)
AXE_JS = os.path.join(HERE, "..", "node_modules", "axe-core", "axe.min.js")
if not os.path.exists(AXE_JS): print("skipped: run npm install first (needs axe-core)"); sys.exit(0)
AXE = open(AXE_JS).read()
SIZES = {"d": (1366, 860), "m": (390, 844)}
RUN = '''async () => { const r = await axe.run(document, {runOnly:{type:"tag", values:["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]}, resultTypes:["violations"]});
  return r.violations.map(v => ({id:v.id, impact:v.impact, help:v.help, n:v.nodes.length, nodes:v.nodes.slice(0, 4).map(x => [x.target.join(" "), (x.any[0] || x.all[0] || x.none[0] || {}).message || ""])})); }'''

async def run(p, size, mode, report):
    W, H = SIZES[size]; tag = f"{size}{mode[0]}"
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': W, 'height': H}, reduced_motion="reduce")
    pg = await ctx.new_page(); await pg.add_init_script(AXE)
    async def check(name):
        await pg.mouse.move(2, 2); await pg.wait_for_timeout(500)
        for v in await pg.evaluate(RUN): v["screen"] = name; report.setdefault(tag, []).append(v)
    async def esc(): await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250)
    await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(1000)
    await check('signin')
    await pg.fill('#accName', 'Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(1800)
    await pg.evaluate(f'''state.games.intro = 1; state.games.ecoNew = 0; state.mode = "{mode}"; document.documentElement.dataset.mode = "{mode}";
      state.teams.all = [6, 248, 445, 887, 1007, 149]; state.teams.g1 = [6, 9, 25, 94, 131, 143]; state.favs = [25, 133]; state.games.home.mons = [25, 133]; save(); showHub()''')
    await pg.wait_for_timeout(1200); await check('hub')
    await pg.evaluate(f'enterApp("{mode}", "g1")'); await pg.wait_for_timeout(2000); await check('builder')
    await pg.evaluate('openSheet(6, "battle")'); await pg.wait_for_timeout(900); await check('sheet-battle')
    await pg.evaluate('openSheet(6, "look")'); await pg.wait_for_timeout(600); await check('sheet-look')
    await pg.evaluate('closeModal()'); await pg.wait_for_timeout(300)
    await pg.click('#pickTrainer'); await pg.wait_for_timeout(1000); await check('trainers'); await esc()
    for go in ['battle', 'home', 'shop', 'hofgal', 'quiz', 'card', 'ach', 'friends', 'settings']:
        await pg.evaluate(f'openScreen("{go}")'); await pg.wait_for_timeout(1500); await check(go)
        if go == 'battle':
            await pg.evaluate('openScreen("battle", "rival")'); await pg.wait_for_timeout(600); await pg.click('[data-rv="0"]'); await pg.wait_for_timeout(4500); await check('fight')
            await pg.evaluate('F.b && (F.b.over = true)')
    await pg.evaluate('openAccountMenu()'); await pg.wait_for_timeout(400); await check('account'); await esc()
    await b.close()

async def main():
    sizes = [a for a in sys.argv[1:] if a in SIZES] or list(SIZES)
    report = {}
    async with async_playwright() as p:
        for s in sizes:
            for mode in ['3d', '2d']: await run(p, s, mode, report)
    json.dump(report, open(OUT + 'a11y.json', 'w'), indent=1, ensure_ascii=False)
    bad = 0
    for tag, items in report.items():
        print(f"== {tag}: {len(items)} problems")
        for v in items:
            print(f"  [{v['screen']}] {v['impact']} {v['id']} ×{v['n']}: {v['help']}")
            for t, m in v["nodes"]: print(f"      {t}  {m[:110]}")
            if v["impact"] in ("serious", "critical"): bad += 1
    print("SERIOUS", bad)
    assert bad == 0, f"{bad} serious accessibility problems (see tests/out/a11y.json)"
asyncio.run(main())
