"""Friends, with the stand-in Supabase client (tests/fake_supabase.js): Misty publishes her profile; Blake adds her,
sees her trainer card, showcased Hall of Fame card and lineup, visits her Home, leaves a Like (once a day), copies
her team, and his own save is untouched by any of it. Also the showcase setting on the Trainer card screen.

    python3 tests/test_friends.py [width height]

Screenshots: tests/out/fr_*.png
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out") + os.sep
os.makedirs(OUT, exist_ok=True)
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1280, 860)
TAG = str(W)
CONFIG = 'window.DTD_CONFIG = {supabaseUrl:"https://fake.supabase.co", supabaseAnonKey:"anon"};'
FAKE = open(os.path.join(HERE, "fake_supabase.js")).read()

async def sign_in(pg, code, name):
    await pg.evaluate('showOnlineSignIn()'); await pg.wait_for_timeout(300)
    await pg.fill('#accEm', name.lower() + '@example.com'); await pg.click('#accEmail button[type=submit]'); await pg.wait_for_timeout(300)
    await pg.fill('#accCd', code); await pg.click('#accCode button[type=submit]'); await pg.wait_for_selector('#unIn')
    await pg.fill('#unIn', name); await pg.click('#unForm button[type=submit]')
    await pg.wait_for_function('SB.status === "synced" || !!document.querySelector("[data-bring]")', timeout=8000)
    if await pg.locator('[data-bring="fresh"]').count(): await pg.click('[data-bring="fresh"]')
    await pg.wait_for_function('SB.status === "synced"', timeout=8000)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        ctx = await b.new_context(viewport={'width': W, 'height': H}, service_workers='block')
        await ctx.route('**/config.js', lambda r: r.fulfill(status=200, content_type='text/javascript', body=CONFIG))
        await ctx.add_init_script(FAKE)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(800)
        # Misty: a team, a Home, shows her team as a 2D card
        await sign_in(pg, '222222', 'Misty')
        await pg.evaluate('''state.games.intro = 1; state.teams.all = [121, 120, 54, 55, 131, 130]; state.trainers.all = 0;
          state.members.all = {"121":{nick:"Staryu Star", item:"Leftovers", moves:["Surf", "Psychic", "Thunderbolt", "Ice Beam"], ball:"dive"}};
          state.games.home.mons = [121, 54]; state.games.showcase = {team:"all", style:"2d"}; state.games.badges = {"1":3}; save()''')
        await pg.evaluate('friendsAfterSync(true)'); await pg.wait_for_timeout(600)
        pub = await pg.evaluate('JSON.stringify(Object.keys(fakeSB.get().public_profile))'); print('published', pub); assert '"u2"' in pub
        await pg.evaluate('sbSignOut(profile); signOut()'); await pg.wait_for_timeout(600)
        # Blake: his own team, then the Friends screen
        await sign_in(pg, '111111', 'Blake')
        await pg.evaluate('state.games.intro = 1; state.teams.all = [6, 445, 248]; state.games.pp = 500; save()')
        mine = await pg.evaluate('JSON.stringify(state.teams.all)')
        await pg.evaluate('openScreen("friends")'); await pg.wait_for_timeout(800)
        await pg.screenshot(path=OUT + f'fr_list_empty_{TAG}.png')
        await pg.fill('#frQ', 'misty'); await pg.click('#frAdd button[type=submit]'); await pg.wait_for_timeout(800)
        st = await pg.evaluate('JSON.stringify(fakeSB.get().friends)'); print('friends', st); assert '"pending"' in st
        # Misty accepts (her side, done straight in the stand-in database)
        await pg.evaluate('(() => { const d = fakeSB.get(); d.friends[0].status = "accepted"; d.profiles.u2.title = "Kanto Champion"; d.profiles.u2.last_active = new Date().toISOString(); fakeSB.set(d); })()')
        await pg.evaluate('FR.list = null; renderFriends()'); await pg.wait_for_selector('[data-fu="u2"]')
        await pg.screenshot(path=OUT + f'fr_list_{TAG}.png')
        # her profile: trainer card, Hall of Fame card, lineup
        await pg.click('[data-fu="u2"]'); await pg.wait_for_selector('.lu-mon'); await pg.wait_for_timeout(2500)
        n = await pg.locator('.lu-mon').count(); print('lineup', n); assert n == 6
        v = await pg.evaluate('[!!VISIT, JSON.stringify(state.teams.all), document.querySelector(".lu-mon").textContent.includes("Staryu Star"), document.querySelector(".hgal-cv").classList.contains("ready")]'); print('visit', v)
        assert v[0] and v[1] != mine and v[2], v
        await pg.screenshot(path=OUT + f'fr_profile_{TAG}.png', full_page=True)
        await pg.click('[data-lu="121"]'); await pg.wait_for_timeout(400); await pg.screenshot(path=OUT + f'fr_stats_{TAG}.png'); await pg.evaluate('closeModal()')
        # her Home: Like once a day
        await pg.click('#frHome'); await pg.wait_for_selector('#hvLike'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=OUT + f'fr_home_{TAG}.png')
        await pg.click('#hvLike'); await pg.wait_for_timeout(500)
        await pg.evaluate('document.getElementById("hvLike").disabled = false'); await pg.click('#hvLike'); await pg.wait_for_timeout(500)
        likes = await pg.evaluate('fakeSB.get().likes.length'); print('likes', likes); assert likes == 1
        # leave: Blake's own save is back, with the Like's PokéPoints and the visit counted
        await pg.click('#hvBack'); await pg.wait_for_selector('#frBack'); await pg.click('#frBack'); await pg.wait_for_timeout(500)
        v = await pg.evaluate('[!!VISIT, JSON.stringify(state.teams.all), state.games.pp, state.games.social.vis, JSON.stringify(fakeSB.get().saves.u1.data.teams.all)]'); print('after', v)
        assert v[0] is False and v[1] == mine and v[2] >= 520 and v[3] == ['u2'], v
        await pg.wait_for_timeout(4500)
        assert await pg.evaluate('JSON.stringify(fakeSB.get().saves.u1.data.teams.all)') == mine, 'uploaded save is Blake\'s'
        # battle her team (the AI plays her side), then back to her profile
        await pg.click('[data-fu="u2"]'); await pg.wait_for_selector('#frBattle'); await pg.click('#frBattle')
        await pg.wait_for_selector('.bt-mon.foe img[src]', timeout=15000); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=OUT + f'fr_battle_{TAG}.png')
        v = await pg.evaluate('[!!VISIT, F.b.s[1].party.length, F.b.s[1].party[0].name, JSON.stringify(state.teams.all)]'); print('battle', v)
        assert v[0] is False and v[1] == 6 and v[2] == 'Staryu Star' and v[3] == mine, v
        await pg.evaluate('void screenBack()'); await pg.wait_for_timeout(400)
        if await pg.locator('#cfYes').count(): await pg.click('#cfYes')
        await pg.wait_for_selector('#frCopyTeam'); await pg.click('#frBack'); await pg.wait_for_selector('[data-fu="u2"]')
        # copy her team
        await pg.click('[data-fu="u2"]'); await pg.wait_for_selector('#frCopyTeam'); await pg.click('#frCopyTeam'); await pg.wait_for_timeout(1200)
        c = await pg.evaluate('JSON.stringify([state.custom.map(c => c.name), state.teams[state.team], !!VISIT])'); print('copied', c)
        assert 'Misty' in c and '121' in c and 'false' in c
        # Misty collects her Like
        await pg.evaluate('sbSignOut(profile); signOut()'); await pg.wait_for_timeout(500)
        await pg.evaluate('(() => { const d = fakeSB.get(); d.session = {user:{id:"u2"}}; fakeSB.set(d); })()')
        await pg.evaluate('signIn(accounts.list.find(p => p.sb === "u2").id, true); finishSignIn()'); await pg.wait_for_timeout(2500)
        v = await pg.evaluate('[state.games.social.likes, state.games.pp]'); print('misty likes', v); assert v[0] == 1, v
        # showcase picker on the Trainer card screen
        await pg.evaluate('openScreen("card")'); await pg.wait_for_timeout(800)
        assert await pg.locator('#scTeam').count() == 1
        await pg.screenshot(path=OUT + f'fr_card_{TAG}.png')
        sw = await pg.evaluate('document.documentElement.scrollWidth'); assert sw <= W + 1, 'sideways scroll'
        print('ERRS', errs[:5]); assert not errs, errs
        await b.close()
asyncio.run(main())
