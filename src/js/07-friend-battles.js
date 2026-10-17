// ================= FRIEND BATTLES (live; tables, rules and the private channel in supabase/migrations/*_friend_battles.sql) =================
// Two friends battle in real time, each controlling their own team. Both build the same Battle from the invite's seed
// (the engine's opt.rand) and each sends only its own choices over the private broadcast channel battle:<match_id>;
// when both are in, both resolve the turn (lockstep). Every 5 turns they compare a fingerprint of the battle; on a
// mismatch the inviter's battle wins and the other side copies it. Shared randomness is only drawn inside step();
// anything decided on one side alone (auto-picks when the timer runs out) uses Math.random.
const FB = {m:null, sub:null, hb:0, inv:null, invT:0, seen:new Set()};
const FB_PP = 60, FB_FMT = {1:"1 vs 1", 3:"3 vs 3", 6:"6 vs 6"};
const fbTurnMs = () => window.DTD_FB_TURN || 60000, fbGoneMs = () => window.DTD_FB_GONE || 30000;   // tests shorten these
const isOnlineNow = f => !!(f && f.last_active && Date.now() - Date.parse(f.last_active) < 180000);
const fbName = uid => ((FR.list || []).find(f => f.user_id === uid) || {}).username || "A friend";
// listen for challenges, and tell friends you're around (last_active, which only accepted friends can see)
function fbStart(){
  if (!friendsOn() || FB.sub) return;
  const me = profile.sb, on = r => fbInvite(r && r.new);
  FB.sub = SB.client.channel("invites:" + me)
    .on("postgres_changes", {event:"*", schema:"public", table:"battle_invites", filter:`to_user=eq.${me}`}, on)
    .on("postgres_changes", {event:"*", schema:"public", table:"battle_invites", filter:`from_user=eq.${me}`}, on)
    .subscribe();
  clearInterval(FB.hb); FB.hb = setInterval(fbBeat, 60000); fbBeat();
  SB.client.rpc("battle_inbox").then(({data}) => (data || []).forEach(r => fbInvite({...r, status:"pending", to_user:me})), () => {});
}
function fbStop(){
  if (FB.sub) { try { SB.client.removeChannel(FB.sub); } catch(e) { /* already gone */ } FB.sub = null; }
  clearInterval(FB.hb); fbHideInvite(); if (FB.m) fbDrop();
}
function fbBeat(){ if (friendsOn() && !document.hidden) SB.client.from("profiles").update({last_active:new Date().toISOString()}).eq("id", profile.sb).then(() => {}, () => {}); }
// an invite row changed: a challenge for me, or an answer to mine
function fbInvite(r){
  if (!r || !friendsOn()) return;
  const me = profile.sb, M = FB.m;
  if (r.to_user === me && r.status === "pending") {
    if (FB.seen.has(r.match_id) || Date.now() - Date.parse(r.created_at) > 120000 || (M && M.phase !== "gone")) return;
    FB.seen.add(r.match_id); fbShowInvite(r); return;
  }
  if (FB.inv && FB.inv.match_id === r.match_id && r.status !== "pending") fbHideInvite();   // withdrawn or expired
  if (M && M.id === r.match_id && M.me === 0 && M.phase === "waiting") {
    if (r.status === "accepted") { Sound.play("confirm"); fbJoin(); }
    else if (r.status !== "pending") { M.phase = "gone"; M.why = r.status === "declined" ? `${M.foe.name} can’t battle right now.` : r.status === "expired" ? `${M.foe.name} didn’t answer in time.` : "The challenge was withdrawn."; fbRender(); }
  }
}
function fbShowInvite(r){
  FB.inv = r; let el = $("fbInv");
  if (!el) { el = document.createElement("div"); el.id = "fbInv"; el.className = "fb-inv"; el.setAttribute("role", "alertdialog"); el.setAttribute("aria-labelledby", "fbInvT"); document.body.appendChild(el); }
  const who = r.username || fbName(r.from_user), R = r.rules || {};
  el.innerHTML = `<span class="fb-inv-ic" aria-hidden="true">${ICON.battle}</span><div class="fb-inv-b"><b id="fbInvT">${esc(who)} challenges you!</b><span class="meta">${FB_FMT[R.format] || "Battle"} · level 50 · Bag ${R.bag ? "on" : "off"} · <span class="fb-inv-c"></span></span>
    <div class="fb-inv-a"><button class="btn sm primary" type="button" data-fbi="yes">Accept</button><button class="btn sm" type="button" data-fbi="no">Not now</button></div></div>`;
  el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in"); Sound.play("up");
  el.onclick = e => { const b = e.target.closest("[data-fbi]"); if (b) fbAnswer(b.dataset.fbi === "yes"); };
  clearInterval(FB.invT); const end = Date.parse(r.created_at) + 120000;
  const tick = () => { const s = Math.max(0, Math.round((end - Date.now())/1000)), c = el.querySelector(".fb-inv-c"); if (c) c.textContent = `${s}s left`; if (s <= 0) fbHideInvite(); };
  tick(); FB.invT = setInterval(tick, 1000);
}
function fbHideInvite(){ clearInterval(FB.invT); FB.inv = null; const el = $("fbInv"); if (el) el.hidden = true; }
async function fbAnswer(yes){
  const r = FB.inv; if (!r) return; fbHideInvite();
  const {data, error} = await SB.client.rpc("respond_battle", {p_match:r.match_id, p_accept:yes});
  if (!yes) return;
  if (error || !data || data.status !== "accepted") { toast(error ? sbErrText(error) : data && data.status === "expired" ? "That challenge expired." : "That challenge isn’t open any more."); return; }
  Sound.play("confirm");
  fbOpen({id:data.match_id, seed:data.seed, rules:data.rules, me:1, foe:{id:r.from_user, name:r.username || fbName(r.from_user)}});
}
// challenge a friend: pick the format and the Bag, then wait for them to accept
function fbChallenge(f){
  if (!friendsOn()) return;
  let fmt = 3, bag = true;
  const md = openModal(`<h3 class="mt" id="modalTitle">Battle ${esc(f.username)}</h3>
    <p class="note">A live battle: you each control your own team, and everyone is level 50. A win is worth ${FB_PP} PokéPoints (up to 3 wins against each friend a day).</p>
    <div class="fb-opt"><span class="fb-lbl">Format</span><div class="seg" role="group" aria-label="Format">${[1, 3, 6].map(n => `<button type="button" data-fmt="${n}" aria-pressed="${n === fmt}">${FB_FMT[n]}</button>`).join("")}</div></div>
    <div class="vis-row"><span class="lab"><b>Bag</b><span>Potions, Revives and X items for both of you</span></span><button class="switch" type="button" role="switch" id="fbBag" aria-checked="true" aria-label="Bag"></button></div>
    <div class="actions"><button class="btn primary" type="button" id="fbSend">Send challenge</button></div>`);
  md.onclick = async e => {
    const b = e.target.closest("[data-fmt]"); if (b) { fmt = +b.dataset.fmt; md.querySelectorAll("[data-fmt]").forEach(x => x.setAttribute("aria-pressed", x === b)); Sound.play("select"); return; }
    if (e.target.closest("#fbBag")) { bag = !bag; md.querySelector("#fbBag").setAttribute("aria-checked", bag); return; }
    if (!e.target.closest("#fbSend")) return;
    closeModal();
    const {data, error} = await SB.client.rpc("invite_battle", {p_to:f.user_id, p_rules:{format:fmt, bag}});
    if (error || !data || data.status !== "sent") { toast(error ? sbErrText(error) : ({not_friends:"You can only battle friends.", too_many:"You have too many open challenges. Try again in a minute.", bad_rules:"Couldn’t send that challenge."})[data && data.status] || "Couldn’t send the challenge."); return; }
    Sound.play("confirm"); fbOpen({id:data.match_id, seed:data.seed, rules:data.rules, me:0, foe:{id:f.user_id, name:f.username}, phase:"waiting", at:Date.now()});
  };
}
// ---- the match (lobby → battle → rematch) ----
function fbOpen(M){
  if (FB.m) fbDrop(true);
  FB.m = {phase:"lobby", round:0, mine:null, their:{}, q:{}, w:{}, ended:null, seenAt:Date.now(), ...M};
  if (FB.m.phase === "lobby") fbJoin();
  openScreen("friends", "b:" + M.id);
}
function fbJoin(){
  const M = FB.m; if (!M) return; M.phase = "lobby"; M.seenAt = Date.now();
  if (!M.ch) {
    M.ch = SB.client.channel("battle:" + M.id, {config:{private:true, broadcast:{self:false}}})
      .on("broadcast", {event:"m"}, msg => fbMsg(msg && msg.payload))
      .subscribe(st => { if (st === "SUBSCRIBED") { M.live = true; fbSend({t:"hi"}); fbRender(); } });
    clearInterval(M.ping); M.ping = setInterval(() => { fbSend({t:"ping"}); fbCheckGone(); }, 5000);
  }
  fbRender();
}
function fbSend(p){ const M = FB.m; if (M && M.ch) Promise.resolve(M.ch.send({type:"broadcast", event:"m", payload:p})).catch(() => {}); }
function fbMsg(p){
  const M = FB.m; if (!M || !p || typeof p.t !== "string") return;
  M.seenAt = Date.now(); M.heard = true;
  switch (p.t) {
    case "hi": if (M.mine && M.mine.round === M.round) fbSend({t:"ready", v:M.mine}); fbSend({t:"hey"}); fbRender(); return;
    case "hey": fbRender(); return;
    case "ready": { const v = p.v; if (!v || !Array.isArray(v.team) || v.team.length < 1 || v.team.length > 6) return; M.their[v.round | 0] = {name:String(v.name || M.foe.name).slice(0, 24), tr:Number.isInteger(v.tr) ? v.tr : null, team:v.team.slice(0, M.rules.format), round:v.round | 0}; fbRender(); fbMaybeBegin(); return; }
    case "bye": case "ff": fbAbort({ff:true, left:p.t === "bye"}); if (M.phase !== "battle") { M.phase = "gone"; M.why = `${M.foe.name} left the battle.`; fbRender(); } return;
    case "c": case "r": case "u": case "h": case "st": fbPush(p.t, p.v); return;
  }
}
function fbRecv(k){ const M = FB.m; return new Promise(res => { if (!M) return res({ff:true}); if (M.ended) return res(M.ended); const q = M.q[k] || (M.q[k] = []); if (q.length) res(q.shift()); else (M.w[k] = M.w[k] || []).push(res); }); }
function fbPush(k, v){ const M = FB.m; if (!M) return; const w = M.w[k]; if (w && w.length) w.shift()(v); else (M.q[k] = M.q[k] || []).push(v); }
function fbAbort(v){ const M = FB.m; if (!M || M.ended) return; M.ended = v; for (const k of Object.keys(M.w)) while (M.w[k].length) M.w[k].shift()(v); if (F.cfg && F.cfg.live === M && F.resolve) resolveAsk(null); }
function fbCheckGone(){
  const M = FB.m; if (!M || M.phase === "gone" || M.phase === "waiting") return;
  if (M.heard && Date.now() - M.seenAt > fbGoneMs()) {   // nothing from them for 30 seconds: they forfeit
    if (M.phase === "battle") fbAbort({ff:true, gone:true}); else if (M.phase !== "over") { M.phase = "gone"; M.why = `${M.foe.name} lost connection.`; fbRender(); }
  }
}
// close the match: tell the other player, leave the channel, withdraw the invite
function fbDrop(quiet){
  const M = FB.m; if (!M) return; FB.m = null;
  if (!quiet || M.phase !== "gone") fbSend({t:M.phase === "battle" ? "ff" : "bye"});
  clearInterval(M.ping); clearInterval(M.tick);
  const ch = M.ch; M.ch = null; setTimeout(() => { try { SB.client.removeChannel(ch); } catch(e) { /* gone */ } }, 300);
  if (M.phase === "waiting" || M.phase === "lobby" || M.phase === "gone") SB.client.rpc("cancel_battle", {p_match:M.id}).then(() => {}, () => {});
}
function fbLeave(){ fbDrop(); openScreen("friends"); }
// a team member as plain data for the other player (both sides rebuild both parties from these, at level 50)
function fbSpec(teamId, n){ const m = monFromTeam(teamId, n, 50); return {n, nick:m.name !== m.species ? m.name : "", moves:m.moves.map(x => x[0]), ability:m.ability, item:m.item, nature:m.nature, evs:m.evs, ivs:m.ivs, sh:m.sh, ball:m.ball}; }
function fbMon(x){
  if (!x || !NAT_BY.has(+x.n)) return null;
  const n = +x.n, sp = NAT_BY.get(n), s = (v, l) => typeof v === "string" ? v.slice(0, l) : "";
  let moves = (Array.isArray(x.moves) ? x.moves : []).slice(0, 4).map(k => MOVE_BY.get(k)).filter(Boolean);
  if (!moves.length) moves = autoMoves(n, sp.types, true, rng(n));   // never random: both sides must build the same Pokémon
  return mkMon(n, {level:50, nick:s(x.nick, 24) || undefined, moves, ability:s(x.ability, 40) || undefined, item:s(x.item, 40), nature:s(x.nature, 12), evs:x.evs, ivs:x.ivs, sh:!!x.sh, ball:s(x.ball, 20) || "poke"});
}
function fbReady(teamId){
  const M = FB.m; if (!M || M.phase !== "lobby") return;
  pickForBattle(teamId, M.rules.format, `Your ${FB_FMT[M.rules.format]} line-up`, nums => {
    if (!FB.m || FB.m !== M) return;
    M.mine = {round:M.round, name:profile.uname || profile.name || "You", tr:trainerOf(teamId), team:nums.slice(0, M.rules.format).map(n => fbSpec(teamId, n))};
    fbSend({t:"ready", v:M.mine}); Sound.play("confirm"); fbRender(); fbMaybeBegin();
  });
}
async function fbMaybeBegin(){
  const M = FB.m; if (!M || M.phase !== "lobby" || !M.mine || M.mine.round !== M.round || !M.their[M.round]) return;
  M.phase = "battle"; await withMoves(); if (FB.m !== M) return;
  const T = M.their[M.round], mine = M.mine, side = (R, isMe) => ({name:isMe ? R.name : T.name, party:R.team.map(fbMon).filter(Boolean), human:true, foePrefix:isMe ? "" : `${T.name}’s `, bag:M.rules.bag ? BAG.standard() : null, ai:3});
  const sides = M.me === 0 ? [side(mine, true), side(T, false)] : [side(T, false), side(mine, true)];
  if (sides.some(S => !S.party.length)) { M.phase = "gone"; M.why = "Couldn’t set up the battle."; fbRender(); return; }
  const R = M.R = {s:(M.seed + M.round*7919) | 0};
  M.rand = () => { R.s = R.s + 0x6D2B79F5 | 0; let t = Math.imul(R.s ^ R.s >>> 15, 1 | R.s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  M.q = {}; M.w = {}; M.ended = null; M.seenAt = Date.now();
  state.games.social.fbN++; save();
  startBattle({live:M, me:M.me, force:"manual", back:"menu", backFn:() => fbLeave(), foe:{name:T.name, title:`Friend battle · ${FB_FMT[M.rules.format]}`, trIdx:T.tr, bg:"league"},
    sides, humans:[true, true], onEnd:(win, B) => fbEnd(win, B)});
}
// the lobby screen (friends → b:<match>)
function fbRender(){
  const M = FB.m; if (nav.screen !== "friends" || !nav.sub || !nav.sub.startsWith("b:")) return;
  if (!M || nav.sub !== "b:" + M.id) { $("scBody").innerHTML = `<div class="sc-narrow"><p>This battle is over.</p><div class="actions"><button class="btn" type="button" id="fbBack">Back to friends</button></div></div>`; nav.onClick = e => { if (e.target.closest("#fbBack")) openScreen("friends"); }; return; }
  $("scTitle").textContent = "Friend battle";
  const R = M.rules, T = M.their[M.round], foe = esc(M.foe.name), rules = `${FB_FMT[R.format]} · level 50 · Bag ${R.bag ? "on" : "off"}`;
  const stat = (who, st, cls) => `<div class="fb-p ${cls}"><b>${who}</b><span>${st}</span></div>`;
  let body;
  if (M.phase === "waiting") body = `<div class="fb-wait"><span class="fb-spin" aria-hidden="true"></span><p>Waiting for <b>${foe}</b> to accept…</p><p class="meta">${rules} · the challenge lasts 2 minutes</p></div><div class="actions"><button class="btn" type="button" id="fbCancel">Cancel challenge</button></div>`;
  else if (M.phase === "gone") body = `<p class="fb-why">${esc(M.why || "This battle is over.")}</p><div class="actions"><button class="btn primary" type="button" id="fbBack">Back to friends</button></div>`;
  else body = `<p class="meta fb-rules">${rules}${M.round ? ` · rematch ${M.round}` : ""}</p>
    <div class="fb-ps">${stat("You", M.mine && M.mine.round === M.round ? "✓ Ready" : "Choosing a team…", M.mine && M.mine.round === M.round ? "ok" : "")}<span class="fb-vs" aria-hidden="true">VS</span>${stat(foe, T ? "✓ Ready" : M.heard ? "Choosing a team…" : "Connecting…", T ? "ok" : "")}</div>
    ${M.mine && M.mine.round === M.round ? `<p class="note">Waiting for ${foe}…</p>` : nonEmptyTeams().length ? `${teamSelect("fbTeam", teamOf("all").length ? "all" : state.team, "Your team")}` : `<p class="note">Build a team first: you need at least one Pokémon to battle.</p>`}
    <div class="actions fb-acts">${!(M.mine && M.mine.round === M.round) && nonEmptyTeams().length ? `<button class="btn primary" type="button" id="fbGo">Ready</button>` : ""}<button class="btn" type="button" id="fbQuit">Leave</button></div>`;
  $("scBody").innerHTML = `<div class="sc-narrow fb-lobby"><h3 class="fb-h">${ic("battle")} You vs ${foe}</h3>${body}</div>`;
  nav.onClick = e => {
    if (e.target.closest("#fbGo")) { fbReady($("fbTeam").value); return; }
    if (e.target.closest("#fbCancel") || e.target.closest("#fbQuit") || e.target.closest("#fbBack")) { fbLeave(); return; }
  };
  nav.cleanup = () => { if (FB.m === M && M.phase !== "battle") fbDrop(); };
}
// ---- the live battle loop (renderFight runs this instead of runBattle when cfg.live is set) ----
function fbStep(B, fn){ const M = F.cfg.live; B.rand = M.rand; try { return fn(); } finally { B.rand = Math.random; } }
function fbValid(B, i, k, v){   // the same check on both sides, so a bad message can't split the two battles
  const S = B.s[i], O = B.options(i), firstMove = () => O.forced ? {move:O.forced.move} : O.struggle ? {move:-1} : {move:(O.moves.find(x => x.ok) || {j:-1}).j};
  if (k === "r" || k === "u") { const bench = B.bench(i); return bench.includes(v) ? v : bench[0]; }
  if (!v || typeof v !== "object") return firstMove();
  if (v.move !== undefined) { if (O.forced) return {move:O.forced.move}; if (O.struggle) return {move:-1}; const x = O.moves[v.move]; return x && x.ok ? {move:v.move} : firstMove(); }
  if (v.sw !== undefined) return O.canSwitch && B.bench(i).includes(v.sw) ? {sw:v.sw} : firstMove();
  if (v.item) return S.bag && S.bag[v.item] > 0 && O.bag && Number.isInteger(v.target) && S.party[v.target] && bagCanUse(v.item, S.party[v.target], v.target === S.act) ? {item:v.item, target:v.target} : firstMove();
  return firstMove();
}
// one of my decisions, with the turn timer; whatever I pick goes to the other player
async function fbMine(k, askFn, autoFn){
  F.timedOut = false; fbTimer(true);
  let v = await askFn();
  fbTimer(false);
  const M = F.cfg.live; if (M.ended) return M.ended;
  if (v && v.forfeit) { fbSend({t:"ff"}); return {ff:true, mine:true}; }
  if (v === null || v === undefined || (v && v.auto)) v = autoFn();
  fbSend({t:k, v}); renderWaitFor(); return v;
}
async function fbChoose(i, tok){
  for (;;) {
    const c = await ask(() => renderMoves(i)); if (tok !== F.tok || c === null) return null;
    if (c.forfeit || c.auto) return c;
    if (c.sw === "menu") { const k = await askSwitch(i, false); if (tok !== F.tok) return null; if (k === null) { if (F.timedOut || F.cfg.live.ended) return null; continue; } return {sw:k}; }
    if (c.bag === "menu") { const u = await askBag(i); if (tok !== F.tok) return null; if (!u) { if (F.timedOut || F.cfg.live.ended) return null; continue; } return u; }
    return c;
  }
}
function renderWaitFor(){ const c = $("btCmd"); if (!c || !F.cfg.live) return; c.innerHTML = `<p class="bt-q fb-waitq"><span class="fb-spin sm" aria-hidden="true"></span> Waiting for <b>${esc(F.cfg.live.foe.name)}</b>…</p>`; toSide(c); }
function fbTimer(on){
  const M = F.cfg.live, el = $("btTimer"); clearInterval(M.tick); if (el) el.hidden = !on; if (!on) return;
  const end = Date.now() + fbTurnMs();
  const tick = () => { const s = Math.max(0, Math.ceil((end - Date.now())/1000)), e = $("btTimer"); if (e) { e.textContent = `⏱ ${s}s`; e.classList.toggle("low", s <= 10); } if (s <= 0) { clearInterval(M.tick); F.timedOut = true; if (F.resolve) resolveAsk(null); } };
  tick(); M.tick = setInterval(tick, 250);
}
const fbHash = B => { const s = JSON.stringify([B.turnNo, B.weather, B.terrain, B.s.map(S => [S.act, S.party.map(m => [m.hp, m.status, m.pp, m.stages])]), F.cfg.live.R.s]); let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const fbSnap = B => JSON.stringify({b:Object.fromEntries(Object.keys(B).filter(k => k !== "rand" && typeof B[k] !== "function").map(k => [k, B[k]])), r:F.cfg.live.R.s});
async function fbSync(B, tok){
  const M = F.cfg.live, h = fbHash(B); fbSend({t:"h", v:h});
  const o = await fbRecv("h"); if (tok !== F.tok || o === h || (o && o.ff)) return;
  if (M.me === 0) { fbSend({t:"st", v:fbSnap(B)}); return; }
  const st = await fbRecv("st"); if (tok !== F.tok || !st || st.ff) return;
  try { const x = JSON.parse(st); Object.assign(B, x.b); M.R.s = x.r; } catch(e) { return; }
  for (const i of [0, 1]) { const m = B.get(i); setHP(i, m.hp, m.max, true); setSt(i, m.status); }
  logLine("Battle synced with " + esc(M.foe.name) + ".");
}
async function runLive(tok){
  const B = F.b, M = F.cfg.live, me = F.me, foe = 1 - me, alive = () => tok === F.tok && !B.over;
  const stop = async v => { if (!v || !v.ff) return false; rpLog(["f", v.mine ? me : foe]); await playEv(v.mine ? B.forfeit(me) : [{k:"msg", t:v.gone ? `${esc(M.foe.name)} lost connection.` : `${esc(M.foe.name)} left the battle.`}, ...B.forfeit(foe)], tok); return true; };
  await playEv(fbStep(B, () => B.start()), tok);
  while (alive()) {
    if (B.need[0] === "switch" || B.need[1] === "switch") {   // fainted: each picks their own, then both bring them in, side 0 first
      const pick = await Promise.all([0, 1].map(i => B.need[i] !== "switch" ? null : i === me ? fbMine("r", () => askSwitch(i, true), () => B.aiReplace(i)) : fbRecv("r")));
      if (!alive() || await stop(pick.find(p => p && p.ff))) break;
      for (const i of [0, 1]) if (pick[i] !== null) { const k = fbValid(B, i, "r", pick[i]); rpLog(["r", i, k]); await playEv(fbStep(B, () => B.replace(i, k)), tok); }
      continue;
    }
    const got = await Promise.all([fbMine("c", () => fbChoose(me, tok), () => B.ai(me)), fbRecv("c")]);
    if (!alive() || await stop(got.find(p => p && p.ff))) break;
    const ch = []; ch[me] = fbValid(B, me, "c", got[0]); ch[foe] = fbValid(B, foe, "c", got[1]);
    renderWait(); rpLog(["c", ch]); await playEv(fbStep(B, () => B.turn(ch)), tok);
    while (B.pend && alive()) {   // U-turn, Volt Switch, Eject Button…: whoever's side it is picks who comes in
      const i = B.pend.side, k = i === me ? await fbMine("u", () => askSwitch(i, true, true), () => B.aiReplace(i)) : await fbRecv("u");
      if (!alive() || await stop(k && k.ff ? k : null)) break;
      const kk = fbValid(B, i, "u", k); rpLog(["u", i, kk]); await playEv(fbStep(B, () => B.resume(i, kk)), tok);
    }
    if (alive() && B.turnNo % 5 === 0) await fbSync(B, tok);
  }
  if (tok === F.tok) finishBattle();
}
// the result: both players report it; when they agree, the winner gets PokéPoints (3 paid wins per friend a day)
function fbEnd(win, B){
  const M = F.cfg.live; M.phase = "over"; clearInterval(M.tick);
  if (win) state.games.social.fbW++; save();
  const round = M.round, winner = B.winner === M.me ? profile.sb : M.foe.id, solo = M.ended && M.ended.ff && !M.ended.mine;
  const report = (n = 0) => SB.client.rpc("report_battle", {p_match:M.id, p_round:round, p_winner:winner, p_turns:Math.min(1000, B.turnNo)}).then(({data}) => {
    if (data && data.status === "waiting" && n < 5) { setTimeout(() => report(n + 1), 2500); return; }
    if (data && data.status === "confirmed" && data.winner === profile.sb) { if (data.paid) earn(FB_PP, `Beat ${M.foe.name} in a friend battle`); else toast(`That’s 3 paid wins against ${M.foe.name} today: this one was just for fun.`); }
  }, () => {});
  report();
  return {text:win ? `You beat <b>${esc(M.foe.name)}</b>!${solo ? ` <span class="meta">PokéPoints need both players to confirm the result.</span>` : ""}` : `<b>${esc(M.foe.name)}</b> won this time.`,
    buttons:[...(solo || M.ended ? [] : [["Rematch", () => fbRematch(), true]]), ["Back to friends", () => fbLeave()]]};
}
function fbRematch(){
  const M = FB.m; if (!M) { openScreen("friends"); return; }
  if (M.phase === "gone" || M.ended) { toast(M.why || `${M.foe.name} left.`); fbLeave(); return; }
  if (M.phase !== "over") return;
  M.round++; M.mine = null; M.phase = "lobby"; M.ended = null; Sound.play("select");
  openScreen("friends", "b:" + M.id);
}
// ---- visiting a friend's Home: walk around and pet their Pokémon (read-only), leave one Like a day ----
async function renderFriendHome(uid){
  if (!VISIT || VISIT.who.user_id !== uid) {
    $("scBody").innerHTML = `<div class="sc-narrow"><p class="note">Knocking on the door…</p></div>`;
    let F; try { F = await fetchFriend(uid); } catch(e){}
    if (nav.screen !== "friends" || nav.sub !== "h:" + uid) return;
    if (!F) { openScreen("friends", "u:" + uid); return; }
    enterVisit(F.pub, F.who);
  }
  VISIT.visited = true;
  const who = VISIT.who;
  renderHome();
  $("scTitle").textContent = `${who.username}’s Home`;
  const cleanHome = nav.cleanup; nav.cleanup = () => { cleanHome && cleanHome(); leaveVisit(); };
  const bar = $("scBody").querySelector(".home-bar");
  bar.innerHTML = `<button class="btn sm" type="button" id="hvBack">← ${esc(who.username)}</button><button class="btn sm primary" type="button" id="hvLike">♥ Like</button><span class="meta hv-note">Visiting · ${homeMons().length} Pokémon live here</span>`;
  const help = $("scBody").querySelector(".home-help"); if (help) help.textContent = "Walk around and play with their Pokémon. Leave a Like once a day: you both get 20 PokéPoints.";
  const prev = nav.onClick;
  nav.onClick = async e => {
    if (e.target.closest("#hvBack")) { openScreen("friends", "u:" + uid); return; }
    const lk = e.target.closest("#hvLike");
    if (lk) {
      lk.disabled = true;
      const {data, error} = await SB.client.rpc("like_home", {p_owner:uid});
      const st = error ? "" : data && data.status;
      if (st === "liked") { Sound.play("up"); if (VISIT) VISIT.earn += LIKE_PP; ppChip(`+${LIKE_PP}`, `Liked ${who.username}’s Home`); toast(`You liked ${who.username}’s Home! You both get ${LIKE_PP} PokéPoints.`); lk.textContent = "♥ Liked"; }
      else { toast(error ? sbErrText(error) : st === "already_liked" ? "You already liked this Home today. Come back tomorrow!" : "You can only like friends’ Homes."); lk.textContent = st === "already_liked" ? "♥ Liked" : "♥ Like"; lk.disabled = st === "already_liked"; }
      return;
    }
    prev && prev(e);
  };
}

