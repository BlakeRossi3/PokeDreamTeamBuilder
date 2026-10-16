"""Showdown import/export: a team exported to Showdown text and imported back keeps species, forms, nickname, item,
ability, nature, EVs/IVs, level, shiny and moves; real Showdown text (with forms, Mega Stones and junk lines) imports
with notes; the Team options buttons open both dialogs.

    python3 tests/test_showdown.py [width height]
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep
os.makedirs(OUT, exist_ok=True)
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (390, 844)
TEXT = """Chompy (Garchomp) (M) @ Choice Scarf
Ability: Rough Skin
Level: 50
Shiny: Yes
Tera Type: Dragon
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Outrage
- Stone Edge
- Fire Fang

Ninetales-Alola @ Light Clay
Ability: Snow Warning
EVs: 252 HP / 4 Def / 252 Spe
Timid Nature
IVs: 0 Atk
- Aurora Veil
- Blizzard
- Moonblast
- Hidden Power [Fire]

Charizard-Mega-Y @ Charizardite Y
Ability: Drought
- Flamethrower
- Solar Beam
- Not A Real Move

Fakemon @ Leftovers
- Tackle"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': W, 'height': H})).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(800)
        await pg.fill('#accName', 'Blake'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(1500)
        await pg.evaluate('state.games.intro = 1; state.games.ecoNew = 0; save()')
        r = json.loads(await pg.evaluate('JSON.stringify(sdParse(%s))' % json.dumps(TEXT)))
        print('parsed', [(m['n'], m['sh']) for m in r['mons']]); print('notes', r['notes'])
        g = r['mons'][0]['member']; print('garchomp', g)
        assert len(r['mons']) == 3 and r['mons'][0]['sh'] and g['nick'] == 'Chompy' and g['item'] == 'Choice Scarf' and g['nature'] == 'Jolly'
        assert g['evs'] == {'atk': 252, 'spd': 4, 'spe': 252} and g['moves'] == ['Earthquake', 'Outrage', 'Stone Edge', 'Fire Fang']
        assert not r['mons'][2]['member'] or 'item' not in r['mons'][2]['member']
        assert any('Fakemon' in t for t in r['notes']) and any('Not A Real Move' in t for t in r['notes'])
        # import through the dialog into a new team, then export and parse again: same members
        await pg.evaluate('openTeamOptions()'); await pg.click('#sdImp'); await pg.fill('#sdIn', TEXT); await pg.click('#sdGo'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=OUT + 'showdown_notes.png')
        await pg.evaluate('closeModal()')
        res = json.loads(await pg.evaluate('''(() => { const id = state.team, txt = sdExport(id), R = sdParse(txt);
          const a = teamOf(id).map(n => [n, JSON.stringify(cleanMember(state.members[id][n] || {}, n))]), b = R.mons.map(m => [m.n, JSON.stringify(m.member)]);
          return JSON.stringify({id, custom: !!G().custom, txt, same: JSON.stringify(a) === JSON.stringify(b), a, b, notes: R.notes, sh: state.teamShiny[id]}); })()'''))
        print('round trip same', res['same'], 'notes', res['notes'], 'shiny', res['sh'])
        if not res['same']: print(res['a'], '\n', res['b'])
        print(res['txt'].split('\n\n')[0])
        assert res['custom'] and res['same'] and not res['notes']
        await pg.evaluate('openTeamOptions()'); await pg.click('#sdExp'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT + 'showdown_export.png')
        sw = await pg.evaluate('document.documentElement.scrollWidth'); print('scrollWidth', sw, W); assert sw <= W
        print('ERRS', errs[:3]); assert not errs
        await b.close()
asyncio.run(main())
