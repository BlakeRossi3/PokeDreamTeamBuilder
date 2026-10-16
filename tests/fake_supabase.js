// An in-memory stand-in for the Supabase client, for tests/test_online.py and tests/test_friends.py.
// It implements only what the app calls, with the same answers as the SQL in supabase/migrations (not its security:
// that is checked by supabase/tests/run.sh). The data lives in localStorage so it survives reloads.
// Sign-in codes: 123456 or 111111 -> user u1, 222222 -> user u2.
(() => {
  const K = "fakeSB";
  const load = () => JSON.parse(localStorage.getItem(K) || '{"profiles":{},"saves":{},"public_profile":{},"friends":[],"likes":[],"session":null}');
  const store = d => localStorage.setItem(K, JSON.stringify(d));
  window.fakeSB = {get:load, set:store};
  const ok = data => Promise.resolve({data, error:null}), bad = message => Promise.resolve({data:null, error:{message}});
  const pair = (d, a, b) => d.friends.find(f => (f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a));
  function from(table){
    const q = {filter:{}, patch:null};
    const run = () => { const d = load(), uid = q.filter.id || q.filter.user_id, rows = d[table] || {};
      if (q.patch) { if (rows[uid]) Object.assign(rows[uid], q.patch); store(d); return ok(null); }
      return ok(rows[uid] ? JSON.parse(JSON.stringify(rows[uid])) : null); };
    const api = {
      select(){ return api; }, update(p){ q.patch = p; return api; }, eq(c, v){ q.filter[c] = v; return api; }, maybeSingle: run,
      upsert(row){ const d = load(); d[table][row.user_id || row.id] = JSON.parse(JSON.stringify(row)); store(d); return ok(null); },
      then(a, b){ return run().then(a, b); },
    };
    return api;
  }
  // ---- Realtime + friend battles. tests/test_friend_battle.py runs two players in two browser contexts and exposes
  // window.__fakeNet in both: a tiny shared server for the battle RPCs, the broadcast relay and invite changes.
  // Without it (the other tests), channels are silent and battle RPCs fail.
  const subs = [];
  window.fakeRT = {deliver(topic, type, data){
    for (const ch of [...subs]) for (const h of ch.hs) {
      if (h.type !== type) continue;
      if (type === "broadcast" && ch.topic === topic && (!h.filter.event || h.filter.event === data.event)) h.cb({event:data.event, payload:data.payload});
      if (type === "postgres_changes" && h.filter.table === data.table) { const m = /^(\w+)=eq\.(.+)$/.exec(h.filter.filter || ""); if (!m || String(data.new[m[1]]) === m[2]) h.cb(data); }
    }
  }};
  const net = (op, x) => window.__fakeNet ? window.__fakeNet(op, x) : Promise.resolve(null);
  function channel(topic){
    const ch = {topic, hs:[],
      on(type, filter, cb){ ch.hs.push({type, filter:filter || {}, cb}); return ch; },
      subscribe(cb){ subs.push(ch); net("sub", {topic}).then(() => cb && cb("SUBSCRIBED")); return ch; },
      send(m){ return net("send", {topic, event:m.event, payload:m.payload}).then(() => "ok"); },
      unsubscribe(){ const i = subs.indexOf(ch); if (i >= 0) subs.splice(i, 1); return net("unsub", {topic}).then(() => "ok"); },
    };
    return ch;
  }
  const client = {
    channel, removeChannel: ch => ch.unsubscribe(),
    auth:{
      getSession(){ return ok({session:load().session}); },
      onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; },
      signInWithOtp(){ return ok({}); },
      signInWithOAuth(){ return ok({}); },
      verifyOtp({token}){ const id = {"123456":"u1", "111111":"u1", "222222":"u2"}[token]; if (!id) return bad("Token has expired or is invalid"); const d = load(); d.session = {user:{id}}; store(d); return ok({user:d.session.user, session:d.session}); },
      signOut(){ const d = load(); d.session = null; store(d); return ok({}); },
    },
    from,
    rpc(name, a = {}){
      const d = load(), me = d.session && d.session.user.id;
      if (!me) return bad("not_signed_in");
      const done = v => { store(d); return ok(v); };
      if (/battle/.test(name)) return net("rpc", {name, args:a, me}).then(r => r && r.error ? {data:null, error:{message:r.error}} : {data:r ? r.data : null, error:r ? null : {message:"offline"}});
      switch (name) {
        case "claim_username": {
          if (/fuck/i.test(a.p_name)) return bad("username_not_allowed");
          if (Object.values(d.profiles).some(p => p.id !== me && p.username.toLowerCase() === a.p_name.toLowerCase())) return bad("username_taken");
          d.profiles[me] = {...(d.profiles[me] || {friend_code:me === "u1" ? "ABCD2345" : "WXYZ6789"}), id:me, username:a.p_name}; return done(d.profiles[me]);
        }
        case "put_save": {
          const cur = d.saves[me];
          if (!a.p_base) { if (cur) return ok({ok:false, version:cur.version}); d.saves[me] = {data:a.p_data, version:1, device:a.p_device, updated_at:new Date().toISOString()}; return done({ok:true, version:1}); }
          if (!cur || cur.version !== a.p_base) return ok({ok:false, version:cur ? cur.version : null});
          d.saves[me] = {data:a.p_data, version:cur.version + 1, device:a.p_device, updated_at:new Date().toISOString()}; return done({ok:true, version:cur.version + 1});
        }
        case "add_friend": {
          const q = a.p_query.replace(/-/g, "").toUpperCase(), other = Object.values(d.profiles).find(p => p.friend_code === q || p.username.toUpperCase() === q);
          if (!other) return ok({status:"not_found"}); if (other.id === me) return ok({status:"self"});
          const f = pair(d, me, other.id);
          if (f) { if (f.status === "accepted") return ok({status:"already_friends"}); if (f.requester === me) return ok({status:"already_sent"}); f.status = "accepted"; return done({status:"accepted"}); }
          d.friends.push({requester:me, addressee:other.id, status:"pending", at:new Date().toISOString()}); return done({status:"sent"});
        }
        case "respond_friend": { const f = d.friends.find(x => x.requester === a.p_other && x.addressee === me && x.status === "pending"); if (f) { if (a.p_accept) f.status = "accepted"; else d.friends.splice(d.friends.indexOf(f), 1); } return done(null); }
        case "remove_friend": d.friends = d.friends.filter(f => !(f.status !== "blocked" && pair(d, me, a.p_other) === f)); return done(null);
        case "block_user": d.friends = d.friends.filter(f => pair(d, me, a.p_other) !== f); d.friends.push({requester:me, addressee:a.p_other, status:"blocked"}); return done(null);
        case "unblock_user": d.friends = d.friends.filter(f => !(f.requester === me && f.addressee === a.p_other && f.status === "blocked")); return done(null);
        case "friend_list": return ok(d.friends.filter(f => f.requester === me || (f.addressee === me && f.status !== "blocked")).map(f => {
          const o = d.profiles[f.requester === me ? f.addressee : f.requester] || {};
          return {user_id:o.id, username:o.username, icon:o.icon || null, title:o.title || null, last_active:f.status === "accepted" ? o.last_active || null : null, status:f.status, outgoing:f.requester === me, since:f.at};
        }));
        case "like_home": {
          const f = pair(d, me, a.p_owner); if (!f || f.status !== "accepted") return ok({status:"not_friends"});
          const day = new Date().toISOString().slice(0, 10); if (d.likes.some(l => l.liker === me && l.owner === a.p_owner && l.day === day)) return ok({status:"already_liked"});
          d.likes.push({liker:me, owner:a.p_owner, day, at:new Date().toISOString()}); return done({status:"liked"});
        }
        case "likes_received": return ok(d.likes.filter(l => l.owner === me && (!a.p_since || l.at > a.p_since)).map(l => ({liker:(d.profiles[l.liker] || {}).username || "A friend", at:l.at})));
        case "my_data": return ok({profile:d.profiles[me], save:d.saves[me]});
        case "delete_my_account": delete d.profiles[me]; delete d.saves[me]; d.session = null; return done(null);
      }
      return bad("unknown " + name);
    },
  };
  window.supabase = {createClient: () => client};
})();
