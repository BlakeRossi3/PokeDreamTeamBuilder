"""Live friend battles, two players in two browser contexts (each with its own saves), joined by a tiny stand-in
server in this file: the battle RPCs (same answers as supabase/migrations/*_friend_battles.sql), the Realtime
broadcast relay and invite changes. Blake challenges Misty to a 1v1 (Misty lets the turn timer run out once), they
rematch as 3v3, then a third battle where Misty disconnects and Blake wins after the wait. Both screens must agree
on every result; the winner gets 60 PokéPoints once both have reported.

    python3 tests/test_friend_battle.py [width height]

Screenshots: tests/out/fb_*.png
"""
import asyncio, os, sys, time, uuid, random
from datetime import datetime, timezone
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out") + os.sep
os.makedirs(OUT, exist_ok=True)
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1280, 860)
TAG = str(W)
CONFIG = 'window.DTD_CONFIG = {supabaseUrl:"https://fake.supabase.co", supabaseAnonKey:"anon"};'
FAKE = open(os.path.join(HERE, "fake_supabase.js")).read()
FAST = 'window.DTD_FB_TURN = 7000; window.DTD_FB_GONE = 6000;'   # a 7 s turn timer, 6 s before a silent player forfeits

# ---------------------------------------------------------------- the stand-in server
NET = {"inv": {}, "rep": {}, "res": {}, "subs": []}
iso = lambda: datetime.now(timezone.utc).isoformat()

async def deliver(page, topic, kind, data):
    try:
        if not page.is_closed(): await page.evaluate("([t, k, d]) => window.fakeRT && fakeRT.deliver(t, k, d)", [topic, kind, data])
    except Exception: pass

def push_invite(row):
    pub = {k: v for k, v in row.items() if k != "t"}
    for page in {p for p, t in NET["subs"] if t.startswith("invites:")}:
        asyncio.ensure_future(deliver(page, "pg", "postgres_changes", {"table": "battle_invites", "eventType": "UPDATE", "new": pub}))

def rpc(me, name, a):
    now = time.time()
    for i in NET["inv"].values():
        if i["status"] == "pending" and now - i["t"] > 120: i["status"] = "expired"
    inv = NET["inv"].get(a.get("p_match"))
    if name == "invite_battle":
        r = a.get("p_rules") or {}
        if r.get("format") not in (1, 3, 6) or not isinstance(r.get("bag"), bool): return {"data": {"status": "bad_rules"}}
        for i in NET["inv"].values():
            if i["from_user"] == me and i["to_user"] == a["p_to"] and i["status"] == "pending": i["status"] = "cancelled"
        mid = str(uuid.uuid4())
        row = NET["inv"][mid] = {"match_id": mid, "from_user": me, "to_user": a["p_to"], "status": "pending", "seed": random.randrange(2**31 - 1), "rules": {"format": r["format"], "bag": r["bag"]}, "created_at": iso(), "t": now}
        push_invite(row)
        return {"data": {"status": "sent", "match_id": mid, "seed": row["seed"], "rules": row["rules"]}}
    if name == "respond_battle":
        if not inv or inv["to_user"] != me: return {"data": {"status": "not_found"}}
        if inv["status"] == "pending": inv["status"] = "accepted" if a["p_accept"] else "declined"; push_invite(inv)
        return {"data": {"status": inv["status"], "match_id": inv["match_id"], "seed": inv["seed"], "rules": inv["rules"], "from_user": inv["from_user"]}}
    if name == "cancel_battle":
        if inv and me in (inv["from_user"], inv["to_user"]) and inv["status"] in ("pending", "accepted"): inv["status"] = "cancelled"; push_invite(inv)
        return {"data": None}
    if name == "battle_inbox":
        return {"data": [{"match_id": i["match_id"], "from_user": i["from_user"], "username": "Blake", "rules": i["rules"], "created_at": i["created_at"]} for i in NET["inv"].values() if i["to_user"] == me and i["status"] == "pending"]}
    if name == "report_battle":
        if not inv or me not in (inv["from_user"], inv["to_user"]): return {"data": {"status": "not_found"}}
        key = (inv["match_id"], a["p_round"]); NET["rep"].setdefault(key, {})[me] = a["p_winner"]
        if key in NET["res"]: return {"data": NET["res"][key]}
        reps = NET["rep"][key]
        if len(reps) < 2: return {"data": {"status": "waiting"}}
        if len(set(reps.values())) > 1: return {"data": {"status": "mismatch"}}
        w = a["p_winner"]; l = inv["to_user"] if w == inv["from_user"] else inv["from_user"]
        paid = sum(1 for (m, r), x in NET["res"].items() if x["winner"] == w and x.get("loser") == l and x["paid"]) < 3
        NET["res"][key] = {"status": "confirmed", "winner": w, "loser": l, "paid": paid}
        return {"data": NET["res"][key]}
    if name == "battle_record": return {"data": {"wins": 0, "losses": 0}}
    return {"error": "unknown " + name}

async def server(source, op, data):
    page = source["page"]
    if op == "sub": NET["subs"].append((page, data["topic"])); return True
    if op == "unsub": NET["subs"] = [(p, t) for p, t in NET["subs"] if not (p == page and t == data["topic"])]; return True
    if op == "send":
        for p, t in list(NET["subs"]):
            if t == data["topic"] and p != page: asyncio.ensure_future(deliver(p, t, "broadcast", {"event": data["event"], "payload": data["payload"]}))
        return True
    if op == "rpc":
        me = await page.evaluate("(fakeSB.get().session || {user:{}}).user.id")
        return rpc(me, data["name"], data["args"] or {})

# ---------------------------------------------------------------- helpers
async def sign_in(pg, code, name):
    await pg.evaluate('showOnlineSignIn()'); await pg.wait_for_timeout(300)
    await pg.fill('#accEm', name.lower() + '@example.com'); await pg.click('#accEmail button[type=submit]'); await pg.wait_for_timeout(300)
    await pg.fill('#accCd', code); await pg.click('#accCode button[type=submit]'); await pg.wait_for_selector('#unIn')
    await pg.fill('#unIn', name); await pg.click('#unForm button[type=submit]')
    await pg.wait_for_function('SB.status === "synced" || !!document.querySelector("[data-bring]")', timeout=8000)
    if await pg.locator('[data-bring="fresh"]').count(): await pg.click('[data-bring="fresh"]')
    await pg.wait_for_function('SB.status === "synced"', timeout=8000)

async def player(b, code, name, other, team):
    ctx = await b.new_context(viewport={'width': W, 'height': H}, service_workers='block')
    await ctx.route('**/config.js', lambda r: r.fulfill(status=200, content_type='text/javascript', body=CONFIG))
    await ctx.expose_binding("__fakeNet", server)
    await ctx.add_init_script(FAKE); await ctx.add_init_script(FAST)
    pg = await ctx.new_page(); pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    await pg.goto(BASE); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(800)
    await sign_in(pg, code, name)
    me = await pg.evaluate("profile.sb")
    await pg.evaluate(f'''(() => {{ const d = fakeSB.get(), now = new Date().toISOString();
      d.profiles["{other[0]}"] = {{id:"{other[0]}", username:"{other[1]}", friend_code:"{other[2]}", last_active:now}};
      d.profiles["{me}"].last_active = now; d.friends.push({{requester:"u1", addressee:"u2", status:"accepted", at:now}}); fakeSB.set(d);
      window.__earned = []; const e0 = window.earn; window.earn = (n, why) => {{ window.__earned.push(why); return e0(n, why); }};
      state.games.intro = 1; state.games.ecoNew = 0; state.ui.bspeed = "fast"; state.teams.all = {team}; save(); FR.list = null; openScreen("friends"); }})()''')
    await pg.wait_for_timeout(1200)
    return ctx, pg

async def act(pg):
    """Take one action on this player's battle screen if one is waiting: the first move, or the first Pokémon to send in."""
    return await pg.evaluate('''(() => { if (document.querySelector(".bt-acts.end")) return "end";
      const m = document.querySelector("#btSide .bt-move:not([disabled]), #btCmd .bt-move:not([disabled])"); if (m) { m.click(); return "move"; }
      const s = document.querySelector(".bt-swb:not([disabled])"); if (s) { s.click(); return "sw"; } return ""; })()''')

async def battle(A, B, hold_b=0.0, limit=240):
    t0 = time.time(); held = False
    while time.time() - t0 < limit:
        ra = await act(A)
        if hold_b and not held and await B.locator(".bt-move:not([disabled])").count():
            held = True; await B.wait_for_timeout(int(hold_b*1000)); continue   # Misty lets the timer run out
        rb = await act(B)
        if ra == "end" and rb == "end": return True
        await A.wait_for_timeout(150)
    return False

async def result(pg):
    return await pg.evaluate('JSON.stringify([F.b.winner, F.b.turnNo, F.me, fbHash(F.b), $("btLog").textContent.includes("Battle synced")])')

async def lobby_ready(pg):
    await pg.wait_for_selector('#fbGo', timeout=15000); await pg.click('#fbGo'); await pg.wait_for_timeout(400)
    if await pg.locator('#gpkGo').count(): await pg.click('#gpkGo')   # the line-up picker starts with the first ones chosen

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctxA, A = await player(b, '123456', 'Blake', ("u2", "Misty", "WXYZ6789"), "[6, 9, 3]")
        ctxB, Bp = await player(b, '222222', 'Misty', ("u1", "Blake", "ABCD2345"), "[130, 94, 143]")
        # 1. Blake sees Misty online and challenges her to a 1v1 without the Bag
        await A.wait_for_selector('[data-fbat]', timeout=8000); await A.screenshot(path=OUT + f'fb_list_{TAG}.png')
        await A.click('[data-fbat]'); await A.wait_for_timeout(300)
        await A.click('[data-fmt="1"]'); await A.click('#fbBag'); await A.screenshot(path=OUT + f'fb_challenge_{TAG}.png'); await A.click('#fbSend')
        await A.wait_for_selector('.fb-wait', timeout=5000)
        # 2. Misty gets the invite and accepts
        await Bp.wait_for_selector('#fbInv:not([hidden])', timeout=8000); await Bp.screenshot(path=OUT + f'fb_invite_{TAG}.png')
        await Bp.click('[data-fbi="yes"]')
        await A.wait_for_selector('#fbGo', timeout=8000); await Bp.wait_for_selector('#fbGo', timeout=8000)
        await A.screenshot(path=OUT + f'fb_lobby_{TAG}.png')
        # 3. both ready (a 1v1 asks each for one Pokémon), then battle; Misty lets the timer pick for her once
        await lobby_ready(A); await lobby_ready(Bp)
        await A.wait_for_selector('.bt2', timeout=10000); await Bp.wait_for_selector('.bt2', timeout=10000)
        await A.wait_for_timeout(1500); await A.screenshot(path=OUT + f'fb_fight_{TAG}.png'); await Bp.screenshot(path=OUT + f'fb_fight_b_{TAG}.png')
        timer = await Bp.locator('#btTimer:not([hidden])').count(); print('timer shown', timer); assert timer == 1
        assert await battle(A, Bp, hold_b=8.5), "1v1 didn't finish"
        ra, rb = await result(A), await result(Bp); print('1v1', ra, rb)
        a, bb = __import__("json").loads(ra), __import__("json").loads(rb)
        assert a[0] == bb[0] and a[1] == bb[1] and a[3] == bb[3] and a[2] == 0 and bb[2] == 1 and not a[4] and not bb[4], (a, bb)
        await A.screenshot(path=OUT + f'fb_end_{TAG}.png')
        # the winner gets 60 PokéPoints once both reports agree
        win_pg = A if a[0] == 0 else Bp
        await win_pg.wait_for_function('window.__earned.some(w => /friend battle/.test(w))', timeout=12000)
        print('results', NET["res"]); assert len(NET["res"]) == 1 and list(NET["res"].values())[0]["paid"]
        # 4. rematch as... the same match: both press Rematch, ready with three, battle
        await A.click('[data-res="0"]'); await Bp.click('[data-res="0"]')
        await lobby_ready(A); await lobby_ready(Bp)
        await A.wait_for_selector('.bt2', timeout=10000); await Bp.wait_for_selector('.bt2', timeout=10000)
        assert await battle(A, Bp), "rematch didn't finish"
        ra, rb = await result(A), await result(Bp); print('rematch', ra, rb)
        a, bb = __import__("json").loads(ra), __import__("json").loads(rb); assert a[0] == bb[0] and a[3] == bb[3], (a, bb)
        await A.wait_for_timeout(3000); assert len(NET["res"]) == 2, NET["res"]
        # 5. back to friends, then a new challenge: 3v3 with the Bag, three Pokémon each
        await A.click('[data-res="1"]'); await Bp.click('[data-res="1"]'); await A.wait_for_timeout(600)
        await A.wait_for_selector('[data-fbat]', timeout=8000); await A.click('[data-fbat]'); await A.wait_for_timeout(300)
        await A.click('[data-fmt="3"]'); await A.click('#fbSend')
        await Bp.wait_for_selector('#fbInv:not([hidden])', timeout=8000); await Bp.click('[data-fbi="yes"]')
        await lobby_ready(A); await lobby_ready(Bp)
        await A.wait_for_selector('.bt2', timeout=10000); await Bp.wait_for_selector('.bt2', timeout=10000)
        n = await A.evaluate('[F.b.s[0].party.length, F.b.s[1].party.length, !!F.b.s[0].bag]'); print('3v3 parties', n); assert n == [3, 3, True], n
        assert await battle(A, Bp), "3v3 didn't finish"
        ra, rb = await result(A), await result(Bp); print('3v3', ra, rb)
        a, bb = __import__("json").loads(ra), __import__("json").loads(rb); assert a[0] == bb[0] and a[1] == bb[1] and a[3] == bb[3] and a[1] >= 3, (a, bb)
        await A.screenshot(path=OUT + f'fb_3v3_end_{TAG}.png')
        # 6. a rematch where Misty's connection drops: Blake wins after the wait
        await A.click('[data-res="0"]'); await Bp.click('[data-res="0"]')
        await lobby_ready(A); await lobby_ready(Bp)
        await A.wait_for_selector('.bt2', timeout=10000); await Bp.wait_for_selector('.bt2', timeout=10000)
        await act(A); await ctxB.close()
        await A.wait_for_selector('.bt-acts.end', timeout=20000)
        txt = await A.locator('#btLog').inner_text(); print('disconnect log end:', txt[-160:].replace('\n', ' | '))
        assert 'lost connection' in txt and await A.evaluate('F.b.winner === F.me')
        await A.screenshot(path=OUT + f'fb_gone_{TAG}.png')
        sw = await A.evaluate('document.documentElement.scrollWidth'); assert sw <= W + 1, 'sideways scroll'
        print('ERRS', A.errs[:5] + Bp.errs[:5]); assert not A.errs and not Bp.errs, A.errs + Bp.errs
        await b.close()
asyncio.run(main())
