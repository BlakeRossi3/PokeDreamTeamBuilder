"""Online accounts with a stand-in Supabase client: email code sign-in, username, bringing a save over, upload,
versioned sync, the "which progress?" choice, reload, the account menu. Also checks the app is unchanged when
site/config.js is empty (no online card).

    python3 tests/test_online.py [width height]

Screenshots: tests/out/on_*.png
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep
os.makedirs(OUT, exist_ok=True)
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1280, 860)
TAG = str(W)

CONFIG = 'window.DTD_CONFIG = {supabaseUrl:"https://fake.supabase.co", supabaseAnonKey:"anon"};'
# the stand-in Supabase client (shared with test_friends.py)
FAKE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "fake_supabase.js")).read()
(() => {
  const K = "fakeSB", load = () => JSON.parse(localStorage.getItem(K) || '{"profiles":{},"saves":{},"session":null}'), store = d => localStorage.setItem(K, JSON.stringify(d));
  window.fakeSB = {get:load, set:store};
  const ok = data => Promise.resolve({data, error:null}), bad = message => Promise.resolve({data:null, error:{message}});
  function from(table){
    const q = {filter:{}, patch:null};
    const run = () => { const d = load(), uid = q.filter.id || q.filter.user_id, rows = d[table] || {};
      if (q.patch) { if (rows[uid]) Object.assign(rows[uid], q.patch); store(d); return ok(null); }
      return ok(rows[uid] ? JSON.parse(JSON.stringify(rows[uid])) : null); };
    const api = {select(){ return api; }, update(p){ q.patch = p; return api; }, eq(c, v){ q.filter[c] = v; return api; }, maybeSingle: run, then(a, b){ return run().then(a, b); }};
    return api;
  }
  const client = {
    auth:{
      getSession(){ return ok({session:load().session}); },
      onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; },
      signInWithOtp(){ return ok({}); },
      signInWithOAuth(){ return ok({}); },
      verifyOtp({token}){ if (token !== "123456") return bad("Token has expired or is invalid"); const d = load(); d.session = {user:{id:"u1"}}; store(d); return ok({user:d.session.user, session:d.session}); },
      signOut(){ const d = load(); d.session = null; store(d); return ok({}); },
    },
    from,
    rpc(name, a){
      const d = load(), me = d.session && d.session.user.id;
      if (!me) return bad("not_signed_in");
      if (name === "claim_username") { if (/fuck/i.test(a.p_name)) return bad("username_not_allowed"); d.profiles[me] = {...(d.profiles[me] || {friend_code:"ABCD2345"}), id:me, username:a.p_name}; store(d); return ok(d.profiles[me]); }
      if (name === "put_save") {
        const cur = d.saves[me];
        if (!a.p_base) { if (cur) return ok({ok:false, version:cur.version}); d.saves[me] = {data:a.p_data, version:1, device:a.p_device, updated_at:new Date().toISOString()}; store(d); return ok({ok:true, version:1}); }
        if (!cur || cur.version !== a.p_base) return ok({ok:false, version:cur ? cur.version : null});
        d.saves[me] = {data:a.p_data, version:cur.version + 1, device:a.p_device, updated_at:new Date().toISOString()}; store(d); return ok({ok:true, version:cur.version + 1});
      }
      if (name === "my_data") return ok({profile:d.profiles[me], save:d.saves[me]});
      if (name === "delete_my_account") { delete d.profiles[me]; delete d.saves[me]; d.session = null; store(d); return ok(null); }
      return bad("unknown " + name);
    },
  };
  window.supabase = {createClient: () => client};
})();
'''

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        ctx = await b.new_context(viewport={'width': W, 'height': H}, service_workers='block')
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        # 1. no config: sign-in screen exactly as before
        await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(600)
        assert await pg.locator('.online').count() == 0, 'online card without config'
        # a local save file with some progress
        await pg.fill('#accName', 'Old'); await pg.click('#accNew button[type=submit]'); await pg.wait_for_timeout(800)
        await pg.evaluate('state.games.intro=1; state.games.ecoNew=0; state.teams.g1=[6,9,3]; state.teams.g2=[157]; state.games.pp=1234; state.games.badges={"1":7}; save()')
        # 2. turn the online accounts on (config + stand-in client)
        await ctx.route('**/config.js', lambda r: r.fulfill(status=200, content_type='text/javascript', body=CONFIG))
        await ctx.add_init_script(FAKE)
        await pg.reload(); await pg.wait_for_timeout(1000)
        await pg.evaluate('showOnlineSignIn()'); await pg.wait_for_timeout(400)
        assert await pg.locator('.online').count() == 1, 'online card'
        await pg.screenshot(path=OUT + f'on_signin_{TAG}.png')
        await pg.fill('#accEm', 'blake@example.com'); await pg.click('#accEmail button[type=submit]'); await pg.wait_for_timeout(400)
        await pg.fill('#accCd', '000000'); await pg.click('#accCode button[type=submit]'); await pg.wait_for_timeout(400)
        print('bad code', await pg.locator('.online .acc-err').inner_text()); assert 'didn’t work' in await pg.locator('.online .acc-err').inner_text()
        await pg.fill('#accCd', '123456'); await pg.click('#accCode button[type=submit]'); await pg.wait_for_selector('#unIn')
        await pg.fill('#unIn', 'fuckboy'); await pg.click('#unForm button[type=submit]'); await pg.wait_for_timeout(200)
        assert not await pg.locator('#unErr').is_hidden(), 'offensive name refused'
        await pg.fill('#unIn', 'Blake_1'); await pg.screenshot(path=OUT + f'on_username_{TAG}.png')
        await pg.click('#unForm button[type=submit]'); await pg.wait_for_selector('[data-bring]')
        await pg.screenshot(path=OUT + f'on_bring_{TAG}.png')
        await pg.click('[data-bring="0"]'); await pg.wait_for_timeout(1500)
        st = await pg.evaluate('JSON.stringify([profile.sb, profile.uname, state.teams.g1, state.games.pp, profile.sbVer, profile.sbDirty, SB.status, fakeSB.get().saves.u1 && fakeSB.get().saves.u1.version])')
        print('after bring', st); m = json.loads(st)
        assert m[0] == 'u1' and m[1] == 'Blake_1' and m[2] == [6, 9, 3] and m[3] >= 1234 and m[4] == 1 and m[6] == 'synced', m
        # 3. an edit uploads a few seconds later, as version 2
        await pg.evaluate('state.teams.g3=[252]; save()'); await pg.wait_for_timeout(300)
        assert await pg.evaluate('SB.status') == 'saving'
        await pg.wait_for_timeout(4700)
        v = await pg.evaluate('[fakeSB.get().saves.u1.version, profile.sbVer, profile.sbDirty, $("acctText").textContent]'); print('after edit', v)
        assert v[0] == 2 and v[1] == 2 and v[2] is False and 'Synced' in v[3], v
        # 4. another device saved meanwhile and this one changed too: the player chooses
        await pg.evaluate('''(() => { const d = fakeSB.get(); const c = d.saves.u1; c.data = {...c.data, games:{...c.data.games, pp:99999}}; c.version = 5; c.device = "Safari on iOS"; fakeSB.set(d); })()''')
        await pg.evaluate('state.games.pp = 1300; save(); clearTimeout(SB.timer); sbStart()'); await pg.wait_for_selector('[data-keep="cloud"]')
        await pg.screenshot(path=OUT + f'on_conflict_{TAG}.png')
        txt = await pg.locator('.sync-pick').inner_text(); print('conflict', txt.replace('\n', ' | ')); assert '99,999' in txt and '1,300' in txt
        await pg.click('[data-keep="cloud"]'); await pg.wait_for_timeout(500)
        assert await pg.evaluate('state.games.pp') == 99999
        # 5. reload: the online save file opens and is in sync
        await pg.reload(); await pg.wait_for_timeout(2000)
        v = await pg.evaluate('[profile && profile.sb, SB.status, state.games.pp]'); print('after reload', v); assert v == ['u1', 'synced', 99999], v
        # 6. account menu
        await pg.evaluate('openAccountMenu()'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=OUT + f'on_menu_{TAG}.png')
        assert 'ABCD-2345' in await pg.locator('#modal').inner_text()
        sw = await pg.evaluate('document.documentElement.scrollWidth'); assert sw <= W + 1, 'sideways scroll'
        print('ERRS', errs[:5]); assert not errs, errs
        await b.close()
asyncio.run(main())
