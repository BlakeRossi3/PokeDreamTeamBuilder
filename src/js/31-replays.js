// ================= REPLAYS =================
// A battle is recorded as its seed, both sides as they started and every choice, in order. Replaying runs the same
// engine with the same dice (drawn only inside battle steps; the computer's choices and the screen use other dice)
// and the same choices, so it plays out exactly the same. The last 30 are kept per save file in this browser; any can
// be shared as a link (?replay=…) or pinned to the trainer card as the Battle of the week (friends can watch it).
const RP_MAX = 30, RPLINK = "dreamteamdex.replayLink";
const rpKey = () => "dreamteamdex.replays." + (profile && profile.id || "guest");
function rpList(){ try { const v = JSON.parse(ls.get(rpKey()) || "[]"); return Array.isArray(v) ? v.filter(r => r && r.v === 1) : []; } catch(e) { return []; } }
function rpStore(L){ try { ls.set(rpKey(), JSON.stringify(L.slice(0, RP_MAX))); } catch(e) { /* storage full: replays are a nice-to-have */ } }
const monOut = m => ({n:m.n, nk:m.name, lv:m.level, na:m.nature, ev:{...m.evs}, iv:{...m.ivs}, mv:m.moves.map(x => x[0]), ab:m.ability, it:m.item, sh:m.sh ? 1 : 0, b:m.ball, hp:m.hp, st:m.status || 0, sl:m.sleep || 0, tx:m.toxN || 0, pp:[...m.pp], th:m.timesHit || 0});   // copies: the battle changes these as it goes
// a recorded Pokémon back into a battler (also checks everything a shared link could carry)
function monIn(x){
  if (!x || !NAT_BY.has(+x.n)) return null;
  const n = +x.n, s = (v, l) => typeof v === "string" ? v.slice(0, l) : "", moves = (Array.isArray(x.mv) ? x.mv : []).slice(0, 4).map(k => MOVE_BY.get(k)).filter(Boolean);
  const m = mkMon(n, {level:Math.max(1, Math.min(100, x.lv | 0 || 50)), nick:s(x.nk, 24) || undefined, moves:moves.length ? moves : autoMoves(n, NAT_BY.get(n).types, true, rng(n)), ability:s(x.ab, 40) || undefined, item:s(x.it, 40), nature:s(x.na, 12), evs:x.ev, ivs:x.iv, sh:!!x.sh, ball:s(x.b, 20) || "poke"});
  m.hp = Math.max(0, Math.min(m.max, Number.isFinite(x.hp) ? Math.round(x.hp) : m.max));
  m.status = ["brn", "par", "psn", "tox", "slp", "frz"].includes(x.st) ? x.st : null; m.sleep = Math.max(0, Math.min(4, x.sl | 0)); m.toxN = Math.max(0, Math.min(16, x.tx | 0)); m.timesHit = Math.max(0, Math.min(6, x.th | 0));
  if (Array.isArray(x.pp)) m.pp = m.moves.map((mv, j) => Math.max(0, Math.min(maxPP(mv), Number.isFinite(x.pp[j]) ? x.pp[j] | 0 : maxPP(mv))));
  return m;
}
const sideOut = S => ({nm:S.name, h:S.human ? 1 : 0, fp:S.foePrefix || "", bag:S.bag ? {...S.bag} : null, ai:S.ai, a:S.act, p:S.party.map(monOut)});
function sideIn(x){
  const party = (Array.isArray(x && x.p) ? x.p : []).slice(0, 12).map(monIn).filter(Boolean); if (!party.length) return null;
  const bag = x.bag && typeof x.bag === "object" ? Object.fromEntries(Object.entries(x.bag).filter(([k, v]) => BAG_ITEMS[k] && Number.isInteger(v) && v > 0).map(([k, v]) => [k, Math.min(9, v)])) : null;
  return {name:String(x.nm || "Trainer").slice(0, 30), human:!!x.h, foePrefix:String(x.fp || "").slice(0, 40), bag, ai:Math.max(0, Math.min(4, x.ai | 0)), act:Math.max(0, Math.min(party.length - 1, x.a | 0)), party};
}
// the starting record of a battle (startBattle); its sides are filled in when it starts and its steps as it goes
const rpNew = (cfg, seed) => ({v:1, seed, me:cfg.me || 0, at:Date.now(), ti:String(cfg.foe && cfg.foe.title || "Battle").slice(0, 60), fo:{nm:String(cfg.foe && cfg.foe.name || "").slice(0, 30), tr:cfg.foe && Number.isInteger(cfg.foe.trIdx) ? cfg.foe.trIdx : null, bg:cfg.foe && cfg.foe.bg || "league"}, s:null, st:[]});
function rpFinish(B){
  const r = F.rec; if (!r || !r.s || F.cfg.replay) return; F.rec = null;
  r.w = B.winner; r.tn = B.turnNo; r.h = rpHash(B); const L = rpList(); L.unshift(r); rpStore(L);
}
// a fingerprint of how a battle ended (a replay that ends the same way has the same one)
const rpHash = B => { const t = JSON.stringify([B.turnNo, B.winner, B.weather, B.terrain, B.s.map(S => [S.act, S.party.map(m => [m.hp, m.status, m.pp])])]); let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return h >>> 0; };
// a record from a link or a friend: shape, sizes and every value checked; returns null if it isn't a replay
function rpCheck(r){
  if (!r || r.v !== 1 || !Array.isArray(r.s) || r.s.length !== 2 || !Array.isArray(r.st) || r.st.length > 1500) return null;
  const sides = r.s.map(sideIn); if (sides.some(x => !x)) return null;
  const st = r.st.filter(x => Array.isArray(x) && ["c", "r", "u", "f"].includes(x[0]));
  return {v:1, seed:r.seed | 0, me:r.me === 1 ? 1 : 0, at:Number.isFinite(r.at) ? r.at : Date.now(), ti:String(r.ti || "Battle").slice(0, 60), fo:{nm:String(r.fo && r.fo.nm || "").slice(0, 30), tr:r.fo && Number.isInteger(r.fo.tr) && TRAINERS[r.fo.tr] !== undefined ? r.fo.tr : null, bg:SCENE_BY.has(r.fo && r.fo.bg) ? r.fo.bg : "league"}, s:r.s, st, w:r.w === 1 ? 1 : 0, tn:r.tn | 0, sides};
}
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = str => Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/")), ch => ch.charCodeAt(0));
async function rpEncode(r){
  const json = JSON.stringify({v:1, seed:r.seed, me:r.me, at:r.at, ti:r.ti, fo:r.fo, s:r.s, st:r.st, w:r.w, tn:r.tn});
  if (!window.CompressionStream) return "j" + b64u(new TextEncoder().encode(json));
  return "z" + b64u(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
}
async function rpDecode(code){
  try {
    code = String(code || "").trim(); if (code.length > 30000) return null;
    const bytes = unb64u(code.slice(1)), json = code[0] === "z" ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text() : code[0] === "j" ? new TextDecoder().decode(bytes) : null;
    return json && json.length < 400000 ? rpCheck(JSON.parse(json)) : null;
  } catch(e) { return null; }
}
const rpLink = code => `${location.origin}${location.pathname}?replay=${code}`;
// watch a replay (checked record); back: where the end-screen button goes
function rpPlay(r, back){
  const R = rpCheck(r); if (!R) { toast("That replay can’t be played."); return; }
  const sides = R.sides; sides.forEach((S, i) => { S.act = R.sides[i].act; });
  startBattle({replay:R, seed:R.seed, me:R.me, force:"manual", back:"menu", backFn:back, humans:[false, false], foe:{name:R.fo.nm || sides[1 - R.me].name, title:"Replay · " + R.ti, trIdx:R.fo.tr, bg:R.fo.bg}, sides,
    onEnd:(win, B) => ({text:`Replay over: <b>${esc(B.s[B.winner].name)}</b> won in ${B.turnNo} turns.`, buttons:[["Watch again", () => rpPlay(r, back), true], ["Back", back]]})});
}
async function rpOpenCode(code){ const r = await rpDecode(code); if (!r) { toast("That replay link is broken or too old."); return; } rpPlay(r, () => openScreen("battle", "replays")); }
async function rpShare(r){
  const code = await rpEncode(r), url = rpLink(code);
  if (navigator.share) navigator.share({title:"Dream Team Dex replay", text:`Watch my battle: ${r.ti}`, url}).catch(() => {}); else copyText(url, "Replay link copied.");
}
async function rpPin(r){ state.games.botw = {code:await rpEncode(r), ti:r.ti, w:r.w === r.me ? 1 : 0, at:r.at}; save(); Sound.play("confirm"); toast("Pinned to your trainer card as your Battle of the week."); }
// the replays list (battle → replays)
function renderReplays(){
  const L = rpList(), botw = state.games.botw;
  $("scBody").innerHTML = `<div class="sc-narrow rp-wrap"><div class="ph"><h2>Replays</h2><span class="meta">Your last ${RP_MAX} battles on this device</span></div>
    ${botw ? `<div class="rp-botw">${ic("trophy")}<span><b>Battle of the week</b><small>${esc(botw.ti)} · ${botw.w ? "won" : "lost"}</small></span><button class="btn sm" type="button" data-rpb="watch">Watch</button><button class="btn sm" type="button" data-rpb="unpin">Unpin</button></div>` : ""}
    ${L.length ? `<div class="rp-list">${L.map((r, i) => `<div class="rp-row"><span class="rp-res ${r.w === r.me ? "won" : "lost"}">${r.w === r.me ? "Won" : "Lost"}</span><span class="rp-who"><b>${esc(r.ti)}</b><small>${esc(r.s[r.me].nm)} vs ${esc(r.s[1 - r.me].nm)} · ${r.tn} turns · ${fmtAgo(r.at)}</small></span>
      <span class="rp-acts"><button class="btn sm primary" type="button" data-rp="${i}" data-a="watch" aria-label="Watch">▶ Watch</button><button class="btn sm" type="button" data-rp="${i}" data-a="share">Share</button><button class="btn sm" type="button" data-rp="${i}" data-a="pin" title="Pin to your trainer card">★ Pin</button><button class="btn sm" type="button" data-rp="${i}" data-a="del" aria-label="Delete">✕</button></span></div>`).join("")}</div>`
      : `<div class="empty-grid">${ic("battle")}<h3>No replays yet</h3><p>Every battle you play is saved here so you can watch it again, share it or pin it to your trainer card.</p></div>`}
  </div>`;
  nav.onClick = async e => {
    const b = e.target.closest("[data-rp]"), back = () => openScreen("battle", "replays");
    if (b) { const r = L[+b.dataset.rp]; if (!r) return; const a = b.dataset.a;
      if (a === "watch") rpPlay(r, back); else if (a === "share") rpShare(r); else if (a === "pin") { await rpPin(r); renderReplays(); }
      else if (a === "del") { L.splice(+b.dataset.rp, 1); rpStore(L); renderReplays(); } return; }
    const k = e.target.closest("[data-rpb]");
    if (k && k.dataset.rpb === "watch" && botw) rpOpenCode(botw.code);
    if (k && k.dataset.rpb === "unpin") { state.games.botw = null; save(); renderReplays(); }
  };
}

