// ================= FRIENDS (online accounts only; tables and rules in supabase/migrations) =================
// Friends see a public copy of each other: trainer card, one showcased team (its Hall of Fame card and lineup) and
// the Home. To show a friend's things with the same code that draws ours, `enterVisit` swaps in a sandbox `state`
// built from their public data; while it is in, `save()`, `checkAch()` and `earn()` do nothing and `persisted()`
// returns a snapshot of our own save, so nothing of theirs can leak into ours. `leaveVisit` puts ours back.
const FR = {list:null, busy:false, pubSig:"", err:""};
const LIKE_PP = 20;
const friendsOn = () => CLOUD_ON && !!(profile && profile.sb && SB.client);
function cleanCardPub(c){
  const rows = Array.isArray(c && c.rows) ? c.rows.filter(r => Array.isArray(r) && r.length === 2).slice(0, 12).map(([k, v]) => [String(k).slice(0, 40), String(v).slice(0, 24)]) : [];
  const b = c && c.botw, botw = b && typeof b.code === "string" && /^[zj][A-Za-z0-9_-]{20,16000}$/.test(b.code) ? {code:b.code, ti:String(b.ti || "Battle").slice(0, 60), w:b.w ? 1 : 0} : null;
  return {rows, botw};
}
function enterVisit(pub, who){
  if (VISIT) leaveVisit();
  save();
  const mine = state, snap = persisted(), sc = pub && pub.showcase || {}, h = pub && pub.home || {}, myTr = homeTrainer();
  VISIT = {who, mine, snap, myTr, card:cleanCardPub(pub && pub.card), nicks:{}, earn:0, visited:false, team:"all", style:sc.style === "2d" ? "2d" : "3d"};
  for (const [k, v] of Object.entries(h.nicks && typeof h.nicks === "object" ? h.nicks : {})) if (NAT_BY.has(+k) && typeof v === "string") VISIT.nicks[k] = v.slice(0, 16);
  state = {...freshState(), q:"", type:null, sort:"dex", f:F0(), fOpen:false, covOpen:false, teamOpen:true};
  const s = sc.save && typeof sc.save === "object" ? sc.save : {};
  applySaved({...s, games:h.games, ui:mine.ui, mode:mine.mode, hidden:[], order:[]});
  state.ui = mine.ui; state.mode = mine.mode; state.shiny = false;
  VISIT.team = TEAM_BY.has(sc.team) && teamOf(sc.team).length ? sc.team : "all";
  HS.mons = []; HS.edit = false;
}
function leaveVisit(){
  if (!VISIT) return;
  const v = VISIT; VISIT = null; state = v.mine; rebuildTeams(); HS.mons = [];
  const so = state.games.social;
  if (v.visited && !so.vis.includes(v.who.user_id)) so.vis = [...so.vis, v.who.user_id].slice(-200);
  if (v.earn) earn(v.earn, "", true); else save();
}
// what friends can see, uploaded after a sync whenever it changed
function publicProfile(){
  const G = state.games, sc = G.showcase, id = TEAM_BY.has(sc.team) && teamOf(sc.team).length ? sc.team : "all", ids = [...new Set([id, "all"])];
  const pick = (o, keys) => Object.fromEntries(keys.filter(k => o && o[k] !== undefined).map(k => [k, o[k]]));
  const nicks = {}; for (const n of homeMons()) { const k = nickFor(n); if (k !== monName(n)) nicks[n] = k; }
  return {
    card:{rows:cardStats(), ...(G.botw ? {botw:G.botw} : {})},
    showcase:{team:id, style:sc.style, save:{custom:state.custom.filter(c => ids.includes(c.id)), teams:pick(state.teams, ids), teamShiny:pick(state.teamShiny, ids), members:pick(state.members, ids), trainers:pick(state.trainers, ids), scenes:pick(state.scenes, [id, id + "~2d", "all", "all~2d"])}},
    home:{games:{badges:G.badges, leagues:G.leagues, e4:G.e4, card:G.card, icon:G.icon, title:G.title, since:G.since, own:G.own, home:{mons:G.home.mons, items:G.home.items, fr:G.home.fr, lay:G.home.lay, house:G.home.house}}, nicks},
  };
}
async function friendsAfterSync(force){
  if (!friendsOn() || VISIT) return;
  fbStart();
  const me0 = profile, c = SB.client;
  try {
    const pub = publicProfile(), sig = JSON.stringify(pub);
    if (sig.length < 250000 && (force || sig !== FR.pubSig)) {
      const {error} = await c.from("public_profile").upsert({user_id:me0.sb, ...pub, updated_at:new Date().toISOString()});
      if (!error) FR.pubSig = sig;
    }
    // Likes on my Home since I last looked: 20 PokéPoints each
    const so = state.games.social, {data:likes} = await c.rpc("likes_received", {p_since:so.likeAt || null});
    if (profile === me0 && !VISIT && Array.isArray(likes) && likes.length) {
      so.likes += likes.length; so.likeAt = likes[likes.length - 1].at;
      earn(LIKE_PP*likes.length, likes.length === 1 ? `${likes[0].liker} liked your Home` : `${likes.length} Likes on your Home`);
    }
    const link = ss.get(FRLINK); if (link && profile === me0) { ss.del(FRLINK); openScreen("friends"); offerFriendLink(link); }
  } catch(e){}
}
async function loadFriends(){
  if (!friendsOn()) return null;
  const {data, error} = await SB.client.rpc("friend_list");
  if (error) { FR.err = sbErrText(error); return null; }
  FR.err = ""; FR.list = Array.isArray(data) ? data : [];
  const n = FR.list.filter(f => f.status === "accepted").length, so = (VISIT ? VISIT.mine : state).games.social;
  if (n > so.friends && !VISIT) { so.friends = n; save(); }
  return FR.list;
}
// ---- share links: …/PokeDreamTeamBuilder/?friend=CODE ----
const FRLINK = "dreamteamdex.friendLink";
const friendLink = code => `${location.origin}${location.pathname}?friend=${code}`;
function offerFriendLink(code){
  if (!friendsOn()) { ss.set(FRLINK, code); toast(CLOUD_ON ? "Sign in online to add this friend." : "Friends aren’t available on this copy of the app."); return; }
  if (profile.code === code) { toast("That’s your own friend code."); return; }
  const md = openModal(`<h3 class="mt" id="modalTitle">Add a friend?</h3><p>Send a friend request to the trainer with friend code <b class="fcode">${esc(fmtCode(code))}</b>?</p>
    <div class="actions"><button class="btn primary" type="button" id="flYes">Send request</button><button class="btn" type="button" data-close>Not now</button></div>`);
  md.querySelector("#flYes").onclick = async () => { closeModal(); await sendFriendRequest(code); };
}
const ADD_MSG = {sent:"Friend request sent!", accepted:"You’re now friends!", already_friends:"You’re already friends.", already_sent:"You already sent them a request.", not_found:"No trainer has that code or username.", self:"That’s you!", rate_limited:"That’s a lot of requests today. Try again tomorrow."};
async function sendFriendRequest(q){
  q = String(q || "").trim(); if (!q) return;
  const {data, error} = await SB.client.rpc("add_friend", {p_query:q});
  const st = error ? "" : data && data.status;
  toast(error ? sbErrText(error) : ADD_MSG[st] || "Done."); if (st === "sent" || st === "accepted") Sound.play("confirm");
  if (nav.screen === "friends" && !nav.sub) { await loadFriends(); renderFriends(); }
}
function friendAv(f){ const it = f.icon && unlockOf("icon", f.icon); return it ? iconHTML(f.icon, "sm") : `<span class="fr-av">${esc((f.username || "?")[0].toUpperCase())}</span>`; }

// ---- the Friends screen: code, add, requests, list ----
function renderFriends(){
  if (nav.sub && nav.sub.startsWith("u:")) { renderFriendProfile(nav.sub.slice(2)); return; }
  if (nav.sub && nav.sub.startsWith("h:")) { renderFriendHome(nav.sub.slice(2)); return; }
  if (nav.sub && nav.sub.startsWith("b:")) { setMusic("title"); fbRender(); return; }
  setMusic("title");
  if (!friendsOn()) {
    $("scBody").innerHTML = `<div class="sc-narrow fr-intro">${ic("friends")}<h3>Play with friends</h3>
      <p>With a free online account you get a friend code. Add friends to see their trainer cards and dream teams, visit their Pokémon Homes and leave a Like (20 PokéPoints for both of you, once a day).</p>
      ${CLOUD_ON ? `<div class="actions"><button class="btn primary" type="button" id="frIn">${profile && profile.sb ? "Sign in again" : "Sign in online"}</button></div>` : `<p class="note">Online accounts aren’t turned on for this copy of Dream Team Dex.</p>`}
      <p class="note">There’s no chat: friends only see your username, trainer card, the team you choose to show and your Home.</p></div>`;
    nav.onClick = e => { if (e.target.closest("#frIn")) { if (profile && profile.sb) openOnlineMenu(profile); else showOnlineSignIn(); } };
    return;
  }
  const L = FR.list || [], acc = L.filter(f => f.status === "accepted"), inc = L.filter(f => f.status === "pending" && !f.outgoing), out = L.filter(f => f.status === "pending" && f.outgoing), blk = L.filter(f => f.status === "blocked");
  const row = (f, acts) => `<div class="fr-row">${friendAv(f)}<div class="fr-who"><b>${esc(f.username)}</b>${f.title ? `<small>★ ${esc(f.title)}</small>` : ""}${f.last_active ? `<small class="meta">Active ${fmtAgo(Date.parse(f.last_active))}</small>` : ""}</div><div class="fr-acts">${acts}</div></div>`;
  $("scBody").innerHTML = `<div class="fr-wrap">
    <section class="set-card fr-me"><h3>Your friend code</h3>
      <div class="fr-code"><b class="fcode">${esc(fmtCode(profile.code))}</b><button class="btn sm" type="button" id="frCopy">Copy</button><button class="btn sm" type="button" id="frShare">Share link</button></div>
      <p class="note">Give your code or username to friends. They see your trainer card, the team you show off and your Home.</p></section>
    <section class="set-card"><h3>Add a friend</h3>
      <form class="on-row" id="frAdd" autocomplete="off"><input id="frQ" maxlength="20" placeholder="Friend code or username" aria-label="Friend code or username" spellcheck="false" autocapitalize="off"><button class="btn primary" type="submit">Send request</button></form></section>
    ${inc.length ? `<section class="set-card"><h3>Requests for you</h3>${inc.map(f => row(f, `<button class="btn sm primary" type="button" data-fok="${f.user_id}">Accept</button><button class="btn sm" type="button" data-fno="${f.user_id}">Decline</button><button class="btn sm" type="button" data-fblk="${f.user_id}">Block</button>`)).join("")}</section>` : ""}
    <section class="set-card"><h3>Friends <span class="meta">${acc.length}</span></h3>
      ${FR.list === null ? `<p class="note">${FR.err ? esc(FR.err) : "Loading…"}</p>` : acc.length ? acc.map(f => `<div class="fr-acc"><button class="fr-row fr-open" type="button" data-fu="${f.user_id}">${friendAv(f)}<div class="fr-who"><b>${esc(f.username)}</b>${f.title ? `<small>★ ${esc(f.title)}</small>` : ""}${isOnlineNow(f) ? `<small class="fr-on">Online now</small>` : f.last_active ? `<small class="meta">Active ${fmtAgo(Date.parse(f.last_active))}</small>` : ""}</div><span class="save-go" aria-hidden="true">▶</span></button>${isOnlineNow(f) ? `<button class="btn sm primary fr-bat" type="button" data-fbat="${f.user_id}">${ic("battle")}Battle</button>` : ""}</div>`).join("") : `<p class="note">No friends yet. Share your code to get started.</p>`}</section>
    ${out.length ? `<section class="set-card"><h3>Waiting for an answer</h3>${out.map(f => row(f, `<button class="btn sm" type="button" data-fcancel="${f.user_id}">Cancel</button>`)).join("")}</section>` : ""}
    ${blk.length ? `<section class="set-card"><h3>Blocked</h3>${blk.map(f => row(f, `<button class="btn sm" type="button" data-funblk="${f.user_id}">Unblock</button>`)).join("")}</section>` : ""}
  </div>`;
  paintAll($("scBody"));
  const act = async (fn, args, msg) => { const {error} = await SB.client.rpc(fn, args); if (error) toast(sbErrText(error)); else if (msg) toast(msg); await loadFriends(); if (nav.screen === "friends" && !nav.sub) renderFriends(); };
  nav.onClick = async e => {
    let b;
    if (e.target.closest("#frCopy")) { copyText(fmtCode(profile.code), "Friend code copied."); return; }
    if (e.target.closest("#frShare")) { const u = friendLink(profile.code); if (navigator.share) navigator.share({title:"Dream Team Dex", text:`Add me on Dream Team Dex! My friend code is ${fmtCode(profile.code)}.`, url:u}).catch(() => {}); else copyText(u, "Link copied. Send it to a friend."); return; }
    if ((b = e.target.closest("[data-fu]"))) { Sound.play("select"); openScreen("friends", "u:" + b.dataset.fu); return; }
    if ((b = e.target.closest("[data-fbat]"))) { const f = acc.find(x => x.user_id === b.dataset.fbat); if (f) fbChallenge(f); return; }
    if ((b = e.target.closest("[data-fok]"))) { Sound.play("confirm"); act("respond_friend", {p_other:b.dataset.fok, p_accept:true}, "You’re now friends!"); return; }
    if ((b = e.target.closest("[data-fno]"))) act("respond_friend", {p_other:b.dataset.fno, p_accept:false}, "Request declined.");
    else if ((b = e.target.closest("[data-fcancel]"))) act("remove_friend", {p_other:b.dataset.fcancel}, "Request cancelled.");
    else if ((b = e.target.closest("[data-fblk]"))) act("block_user", {p_other:b.dataset.fblk}, "Blocked. They can’t find or see you any more.");
    else if ((b = e.target.closest("[data-funblk]"))) act("unblock_user", {p_other:b.dataset.funblk}, "Unblocked.");
  };
  $("frAdd").onsubmit = e => { e.preventDefault(); const v = $("frQ").value; $("frQ").value = ""; sendFriendRequest(v); };
  if (FR.list === null && !FR.busy) { FR.busy = true; loadFriends().finally(() => { FR.busy = false; if (nav.screen === "friends" && !nav.sub) renderFriends(); }); }
  fbStart();
}
function copyText(t, msg){ (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast(msg), () => toast(t)); }

// ---- a friend's profile: trainer card, showcased Hall of Fame card, team lineup, Home ----
async function fetchFriend(uid){
  const c = SB.client;
  const [p, pub] = await Promise.all([c.from("profiles").select("id, username, icon, title, last_active").eq("id", uid).maybeSingle(), c.from("public_profile").select("card, showcase, home, updated_at").eq("user_id", uid).maybeSingle()]);
  if (p.error || pub.error) throw p.error || pub.error;
  if (!p.data) return null;
  return {who:{user_id:uid, username:p.data.username, title:p.data.title, icon:p.data.icon, last:p.data.last_active}, pub:pub.data || {}};
}
function lineupHTML(id){
  const t = teamOf(id), mode = state.mode;
  if (!t.length) return `<p class="note">No Pokémon in this team yet.</p>`;
  return `<div class="lineup">${t.map(n => { const M = memberOf(id, n), m = NAT_BY.get(n), mv = movesOf(id, n);
    return `<button class="lu-mon" type="button" data-lu="${n}" aria-label="${esc(nickOf(id, n))}: see stats">
      <span class="lu-art">${spr(n, {sh:isShinyMember(id, n), mode})}${ballImg(ballOf(id, n))}</span>
      <b class="lu-nm">${esc(nickOf(id, n))}</b>${M.nick ? `<small class="meta">${esc(monName(n))}</small>` : ""}${typeBadges(m.types)}
      ${M.item ? `<span class="lu-item">${itemIcon(M.item)}<span>${esc(M.item)}</span></span>` : `<span class="lu-item meta">No item</span>`}
      <span class="lu-moves">${mv.length ? mv.map(x => `<span class="tb" style="${tStyle(x[1])}">${esc(x[0])}</span>`).join("") : `<span class="meta">Moves not set</span>`}</span></button>`; }).join("")}</div>`;
}
function luStats(id, n){
  const M = memberOf(id, n), mon = monFromTeam(id, n, 50), st = mon.stats, base = NAT_BY.get(n).stats;
  const L = [["HP", "hp"], ["Attack", "atk"], ["Defense", "def"], ["Sp. Atk", "spa"], ["Sp. Def", "spd"], ["Speed", "spe"]];
  openModal(`<h3 class="mt" id="modalTitle">${esc(nickOf(id, n))}</h3><p class="note">${esc(monName(n))} · Lv 50 · ${esc(mon.nature)} nature · ${esc(mon.ability)}${M.item ? " · " + esc(M.item) : ""}</p>
    <div class="lu-st">${spr(n, {sh:isShinyMember(id, n)})}<div class="stats">${L.map(([l, k], i) => `<span class="l">${l}</span><span class="v">${st[k]}</span><span class="b"><i style="width:${Math.min(100, (Array.isArray(base) ? base[i] : base[k] || 0)/1.8)}%;--sc:var(--accent)"></i></span>`).join("")}</div></div>
    <p class="note">Stats at level 50 with their nature, EVs and IVs. The bar shows the base stat.</p>`);
}
async function renderFriendProfile(uid){
  setMusic("title");
  $("scBody").innerHTML = `<div class="sc-narrow"><p class="note">Loading your friend’s profile…</p></div>`;
  let F;
  try { F = await fetchFriend(uid); } catch(e){ F = undefined; }
  if (nav.screen !== "friends" || nav.sub !== "u:" + uid) return;
  if (!F) { $("scBody").innerHTML = `<div class="sc-narrow"><p>${F === null ? "This trainer isn’t on your friends list any more." : "Couldn’t load this profile. Check your connection."}</p><div class="actions"><button class="btn" type="button" id="frBack">Back to friends</button></div></div>`; nav.onClick = e => { if (e.target.closest("#frBack")) openScreen("friends"); }; return; }
  enterVisit(F.pub, F.who);
  nav.cleanup = () => { galTok++; leaveVisit(); };
  const V = VISIT, id = V.team, tok = ++galTok, hasPub = !!(F.pub && F.pub.showcase);
  $("scTitle").textContent = F.who.username;
  $("scBody").innerHTML = `<div class="fr-prof">
    <div class="fr-top"><button class="btn sm" type="button" id="frBack">← Friends</button><span class="meta">${F.who.last ? `Active ${fmtAgo(Date.parse(F.who.last))}` : ""}</span>
      <span class="fr-top-acts">${isOnlineNow({last_active:F.who.last}) ? `<button class="btn sm primary" type="button" id="frLive">${ic("battle")} Battle</button>` : ""}<button class="btn sm${isOnlineNow({last_active:F.who.last}) ? "" : " primary"}" type="button" id="frHome">${ic("home")} Visit Home</button><button class="btn sm" type="button" id="frMore" aria-haspopup="true">⋯</button></span></div>
    ${hasPub ? "" : `<p class="note">${esc(F.who.username)} hasn’t synced since adding friends, so some of their profile isn’t here yet.</p>`}
    <canvas class="tcardcv" id="frCard" aria-label="${esc(F.who.username)}’s trainer card"></canvas>
    <h3 class="fr-h">Showcased team · ${esc(TEAM_BY.get(id).card)}</h3>
    <button class="hgal-card fr-hof" type="button" id="frHof" aria-label="View their Hall of Fame card full screen"><span class="hgal-cv"><canvas id="frHofCv" width="960" height="540"></canvas><i class="hgal-mode">${V.style === "2d" ? "2D" : "3D"}</i></span></button>
    <div class="fr-lineup">${lineupHTML(id)}</div>
    ${F.pub && F.pub.card && cleanCardPub(F.pub.card).botw ? `<div class="rp-botw">${ic("trophy")}<span><b>Battle of the week</b><small>${esc(cleanCardPub(F.pub.card).botw.ti)}</small></span><button class="btn sm" type="button" id="frBotw">▶ Watch</button></div>` : ""}
    <div class="actions left"><button class="btn primary" type="button" id="frBattle">Battle this team (vs computer)</button><button class="btn" type="button" id="frCopyTeam">Copy this team</button></div>
    <p class="note">Battle their showcased team with the computer playing for them. Just for fun: no PokéPoints, and nothing changes for them.</p>
  </div>`;
  paintAll($("scBody"));
  drawCard($("frCard"), {name:F.who.username, id:uid}).catch(() => {});
  hofCardArt($("frHofCv"), id, V.style, tok).catch(() => {});
  nav.onClick = e => {
    if (e.target.closest("#frBack")) { openScreen("friends"); return; }
    if (e.target.closest("#frHome")) { Sound.play("confirm"); openScreen("friends", "h:" + uid); return; }
    if (e.target.closest("#frLive")) { fbChallenge({user_id:uid, username:F.who.username}); return; }
    const lu = e.target.closest("[data-lu]"); if (lu) { luStats(id, +lu.dataset.lu); return; }
    if (e.target.closest("#frHof")) {
      const md = openModal(`<h3 class="mt" id="modalTitle">${esc(F.who.username)}’s Hall of Fame</h3><div class="hgal-cv fr-hof-big"><canvas id="frHofBig" width="1280" height="720"></canvas></div>`, {wide:true});
      hofCardArt(md.querySelector("#frHofBig"), id, V.style, galTok).catch(() => {}); return;
    }
    if (e.target.closest("#frCopyTeam")) { copyFriendTeam(id, F.who.username); return; }
    if (e.target.closest("#frBattle")) { battleFriend(id, F.who); return; }
    if (e.target.closest("#frBotw")) { const code = cleanCardPub(F.pub.card).botw.code; leaveVisit(); nav.cleanup = null; rpDecode(code).then(r => r ? rpPlay(r, () => openScreen("friends", "u:" + uid)) : toast("That replay can’t be played.")); return; }
    if (e.target.closest("#frMore")) {
      const md = openModal(`<h3 class="mt" id="modalTitle">${esc(F.who.username)}</h3><div class="actions"><button class="btn" type="button" id="frRm">Remove friend</button><button class="btn danger" type="button" id="frBl">Block</button></div><p class="note">Blocking removes them and hides you from them completely.</p>`);
      const go = async (fn, msg) => { closeModal(); const {error} = await SB.client.rpc(fn, {p_other:uid}); toast(error ? sbErrText(error) : msg); FR.list = null; openScreen("friends"); };
      md.querySelector("#frRm").onclick = () => go("remove_friend", `Removed ${F.who.username}.`);
      md.querySelector("#frBl").onclick = () => go("block_user", `Blocked ${F.who.username}.`);
    }
  };
}
// copy a friend's showcased team into a new custom team with a share code (nothing of yours is replaced)
function copyFriendTeam(id, who){
  const code = shareCode(id), T = TEAM_BY.get(id); if (!code) return;
  leaveVisit(); nav.cleanup = null;
  const c = parseCode(code); if (!c) { toast("Couldn’t copy this team."); openScreen("friends"); return; }
  const nc = addCustom({...ctDraft0(), name:`${who}’s ${T.card}`.slice(0, 24), size:Math.max(MAX, c.mons.length)}); if (!nc) return;
  state.teams[nc.id] = c.mons; state.teamShiny[nc.id] = c.shiny;
  state.members[nc.id] = Object.fromEntries(Object.entries(c.balls).map(([n, b]) => [n, {ball:b}]));
  if (c.tr !== null) state.trainers[nc.id] = c.tr;
  save(); Sound.play("confirm"); toast(`Copied to your teams as “${nc.name}”.`);
  enterApp(state.mode, nc.id);
}
// battle a friend's showcased team, with the AI playing their side (roadmap stretch goal)
async function battleFriend(id, who){
  await withMoves();
  if (!VISIT) return;
  const T = TEAM_BY.get(id), party = teamOf(id).slice(0, MAX).map(n => monFromTeam(id, n, Math.max(1, Math.min(100, memberOf(id, n).level || 50)))), trI = trainerOf(id);
  leaveVisit(); nav.cleanup = null;
  const mine = teamOf("all").length ? "all" : state.team;
  if (!teamOf(mine).length) { toast("Build a team first, then come back to battle."); openScreen("friends", "u:" + who.user_id); return; }
  const back = () => openScreen("friends", "u:" + who.user_id), again = () => openScreen("friends", "u:" + who.user_id);
  startBattle({back:"menu", backFn:back, foe:{name:who.username, title:`Friend battle · ${T.dex}`, trIdx:trI, bg:"league"},
    sides:[{...playerSide(mine), foePrefix:""}, {name:who.username, party, human:false, foePrefix:`${who.username}’s `, bag:BAG.standard(), ai:3}], humans:[true, false],
    onEnd:win => ({text: win ? `You beat <b>${esc(who.username)}</b>’s team!` : `<b>${esc(who.username)}</b>’s team won this time.`, buttons:[["Back to " + esc(who.username), again, true]]})});
}
