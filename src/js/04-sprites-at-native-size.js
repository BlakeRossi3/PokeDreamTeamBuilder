// ================= SPRITES AT NATIVE SIZE =================
// Every sprite is shown at the size its source made it (or a whole-number multiple in 2D), never upscaled with a
// filter. 3D sprites are Pokémon Showdown's animated model renders; the player's side in battle uses their back
// sprites (`3db`/`3dbs` packs) and mirrors the front where a Pokémon has none.
// the frame index of an animated sprite at time t (ms)
function frameIdx(s, t){
  if (!s || s.frames.length === 1 || !s.total) return 0;
  let r = t % s.total;
  for (let i = 0; i < s.frames.length; i++) { const d = s.frames[i].delay; if (r < d) return i; r -= d; }
  return 0;
}
// the scale for a 3D sprite on a canvas: 1 sprite pixel per canvas pixel at the reference size `ref` (the stage height
// where sprites are native), a whole-number multiple on bigger stages, smaller only on small previews (never enlarged
// with a filter); a user scale close to a whole number snaps to it
function natK(stageH, ref, s = 1){
  const k = (stageH >= ref*.75 ? Math.max(1, Math.round(stageH/ref)) : stageH/ref)*s, r = Math.round(k);
  return r >= 1 && Math.abs(k - r) < .2 ? r : k;
}
const hasBack = (num, sh) => { const k = spKey(num, sh, "3db"); return !!(IDX[k] && IDX[k].some(e => e[0] === num)); };
let dlNs;
async function downloadsNs(){ if (dlNs === undefined) dlNs = window.claude && window.claude.use ? await window.claude.use("downloads").catch(() => null) : null; return dlNs; }
async function saveFile(filename, blob){
  const dl = await downloadsNs();
  if (!dl) {   // a normal website: a regular browser download
    try { const u = URL.createObjectURL(blob), a = Object.assign(document.createElement("a"), {href:u, download:filename}); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); toast("Saved " + filename); return true; }
    catch(e){ return false; }
  }
  try { await dl.save({filename, data: blob}); toast("Saved " + filename); return true; }
  catch(e){ if (e && e.code === "declined") return true; if (e && e.code === "rate_limited") { toast("A save is already waiting for you. Try again in a moment."); return true; } return false; }
}
// ---------- actions ----------
let toastTimer;
function toast(msg, o = {}){ const t = $("toast"); t.innerHTML = `<span>${esc(msg)}</span>` + (o.undo ? `<button class="toast-act" type="button" data-tundo>Undo</button>` : ""); t.hidden = false; document.documentElement.style.setProperty("--toast-b", Math.round(t.getBoundingClientRect().bottom) + "px"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, o.undo ? 5500 : 2600); }
function toggle(num, undoToast = false){
  const t = team();
  if (t.includes(num)) {
    const nm = nickOf(state.team, num);
    snap("Removed " + nm); Sound.play("remove");
    state.teams[state.team] = t.filter(n => n !== num);
    state.teamShiny[state.team] = (state.teamShiny[state.team] || []).filter(n => n !== num);
    if (state.members[state.team]) delete state.members[state.team][num];
    afterTeamChange(); if (undoToast) toast(`Removed ${nm}.`, {undo:true}); return true;
  }
  if (t.length >= sizeOf(state.team)) { const z = sizeOf(state.team); toast(`Your team is full at ${z === 6 ? "six" : z}. Remove one first.`); return false; }
  snap("Added " + monName(num)); Sound.play("add");
  state.teams[state.team] = [...t, num]; afterTeamChange(); return true;
}
function toggleMemberShiny(n){
  const arr = state.teamShiny[state.team] || [];
  state.teamShiny[state.team] = arr.includes(n) ? arr.filter(x => x !== n) : [...arr, n];
  touched(); save(); renderTeam();
}
function toggleFav(num){
  state.favs = isFav(num) ? state.favs.filter(n => n !== num) : [...state.favs, num];
  save();
  const b = document.querySelector(`.card .fav[data-fav="${num}"]`);
  if (b) { b.setAttribute("aria-pressed", isFav(num)); b.textContent = isFav(num) ? "♥" : "♡"; }
  if (state.f.fav || state.sort === "fav") renderGrid();
}
$("grid").addEventListener("click", e => {
  if (e.target.closest("[data-freset]")) { state.f = F0(); state.type = null; saveUI(); renderChips(); renderGrid(); return; }
  const f = e.target.closest("[data-fav]"); if (f){ e.stopPropagation(); toggleFav(+f.dataset.fav); return; }
  const info = e.target.closest("[data-info]"); if (info){ e.stopPropagation(); openSheet(+info.dataset.info); return; }
  const c = e.target.closest(".card"); if (c) toggle(+c.dataset.num);
});
$("grid").addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("card")) { e.preventDefault(); toggle(+e.target.dataset.num); }
});
$("slots").addEventListener("click", e => {
  const r = e.target.closest("[data-remove]"); if (r){ hideTip(); toggle(+r.dataset.remove, true); return; }
  const i = e.target.closest("[data-info]"); if (i) { openSheet(+i.dataset.info); return; }
  const sl = e.target.closest(".slot[data-num]"); if (sl) { hideTip(); openSheet(+sl.dataset.num, "battle"); }
});
$("trow").addEventListener("click", e => {
  if (e.target.closest("#pickTrainer")) openTrainerPicker();
  else if (e.target.closest("#viewBtn")) openView();
  else if (e.target.closest("#hofBtn")) openHof();
});
function setTeamOpen(open){ state.teamOpen = open; saveUI(); renderLayout(); renderParty(); }
$("hideTeam").addEventListener("click", () => setTeamOpen(false));
$("party").addEventListener("click", e => {
  if (e.target.closest("#partyToggle")) { setTeamOpen(!state.teamOpen); if (state.teamOpen && innerWidth <= 920) document.querySelector(".team-panel").scrollIntoView({behavior:"smooth", block:"start"}); return; }
  const m = e.target.closest("[data-info]"); if (m) openSheet(+m.dataset.info);
});
$("tabs").addEventListener("click", e => {
  if (e.target.closest("#editTabs")) { openTabEditor(); return; }
  if (e.target.closest("#newTeam")) { Sound.play("select"); openCustomEditor(); return; }
  const b = e.target.closest(".tab"); if (!b) return;
  const id = b.dataset.team; if (id === state.team) return;
  state.team = id; state.q = ""; $("search").value = ""; save(); hideTip();
  renderAll();
});
$("chips").addEventListener("click", e => {
  const c = e.target.closest(".chip"); if (!c) return;
  state.type = c.dataset.type || null; renderChips(); renderGrid();
});
$("search").addEventListener("input", e => { state.q = e.target.value; renderGrid(); });
document.addEventListener("keydown", e => { if (e.key === "/" && !$("app").hidden && $("modalWrap").hidden && $("hof").hidden && $("view").hidden && !e.target.closest("input, textarea, select")) { e.preventDefault(); $("search").focus(); } });
$("sort").addEventListener("change", e => { state.sort = e.target.value; saveUI(); renderGrid(); });
$("randomBtn").addEventListener("click", () => {
  const narrowed = !!(state.type || state.q.trim() || activeFilters()), pool = (narrowed ? filtered() : G().mons).map(m => m.num);
  if (!pool.length) { toast("No Pokémon match your filters to roll from."); return; }
  for (let i = pool.length - 1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [pool[i],pool[j]] = [pool[j],pool[i]]; }
  snap("Random team");
  state.teams[state.team] = pool.slice(0, sizeOf(state.team)); state.teamShiny[state.team] = []; state.members[state.team] = {}; afterTeamChange();
  toast(`Rolled a random ${sizeOf(state.team) === 6 && pool.length >= 6 ? "six" : "team of " + Math.min(sizeOf(state.team), pool.length)}${narrowed ? " from your filtered list" : ""}.`, {undo:true});
});
$("clearBtn").addEventListener("click", () => {
  if (!team().length) return;
  snap("Cleared team");
  state.teams[state.team] = []; state.teamShiny[state.team] = []; state.members[state.team] = {}; afterTeamChange();
  toast(`Cleared your ${G().title.replace(" dream team","")} team.`, {undo:true});
});
function setMode(mode){
  if (state.mode === mode) return;
  state.mode = mode; save();
  const app = $("app"); app.classList.remove("switching"); void app.offsetWidth; app.classList.add("switching");
  renderMode(); renderTeam(); renderGrid();
}
$("m2d").addEventListener("click", () => setMode("2d"));
$("m3d").addEventListener("click", () => setMode("3d"));
$("shinyBtn").addEventListener("click", () => { state.shiny = !state.shiny; save(); renderMode(); renderTeam(); paintAll($("grid")); });

// ---------- claude.ai sync (for the one save file that has sync turned on) ----------
const acct = {status:"local", name:"", ref:null, timer:null};
function syncLabel(){
  if (!profile) return "";
  if (profile.guest) return "Guest · not saving";
  if (profile.sb) return {checking:"Connecting…", synced:"Synced", saving:"Saving…", offline:"Offline", signedout:"Signed out", conflict:"Choose a save", toobig:"Not syncing"}[SB.status] || "Online";
  if (!profile.cloud) return ON_CLAUDE ? "This device" : "This browser";
  return {checking:"Connecting…", synced:"Synced", saving:"Saving…", readonly:"Sync paused", error:"Sync offline", local:"This device"}[acct.status] || "This device";
}
function renderAcct(){
  const b = $("acctBtn");
  b.dataset.s = !profile ? "local" : profile.guest ? "readonly" : profile.sb ? ({synced:"synced", saving:"saving", checking:"checking", offline:"error", toobig:"error"}[SB.status] || "readonly") : profile.cloud ? acct.status : "local";
  $("acctText").textContent = profile ? `${profile.guest ? "Guest" : profile.sb ? profile.uname || profile.name : profile.name} · ${syncLabel()}` : "Sign in";
  const av = $("acctAv");
  if (profile && !profile.guest && profile.icon && unlockOf("icon", profile.icon)) { av.innerHTML = iconHTML(profile.icon, "fill"); paintAll(av); av.hidden = false; }
  else if (profile && !profile.guest && profile.avatar !== null && profile.avatar !== undefined && TRAINERS[profile.avatar] !== undefined) { av.innerHTML = `<img class="tr" data-tr="${profile.avatar}" data-mode="3d" alt="">`; paintAll(av); av.hidden = false; }
  else av.hidden = true;
  const f = $("startAcct");
  if (!profile) { f.textContent = ""; return; }
  f.innerHTML = profile.guest
    ? `Playing as <b>guest</b> · nothing is saved <button class="linkbtn" type="button" data-sa="menu">Save my progress</button>${CLOUD_ON ? `<button class="linkbtn" type="button" data-sa="online">Create a free account</button>` : ""}<button class="linkbtn" type="button" data-sa="out">Sign out</button>`
    : `Signed in as <b>${esc(profile.sb ? profile.uname || profile.name : profile.name)}</b> · ${profile.sb ? "online account" : profile.cloud ? "synced with claude.ai" : "saved in this browser"} <button class="linkbtn" type="button" data-sa="switch">Switch</button>${CLOUD_ON && !profile.sb ? `<button class="linkbtn" type="button" data-sa="online">Play on any device</button>` : ""}<button class="linkbtn" type="button" data-sa="out">Sign out</button>`;
}
$("start").addEventListener("click", e => {
  const a = e.target.closest("[data-sa]"); if (!a) return;
  if (a.dataset.sa === "out") { if (profile && profile.sb) sbSignOut(profile); signOut(); }
  else if (a.dataset.sa === "online") showOnlineSignIn();
  else if (a.dataset.sa === "menu") openAccountMenu();
  else if (a.dataset.sa === "switch") { save(); startStage.stop(); profile = null; accounts.current = null; saveAccounts(); ss.del(SESSKEY); showSignIn("list"); }
});
function queueRemote(){
  if (!acct.ref || acct.status === "readonly" || !profile || !profile.cloud) return;
  clearTimeout(acct.timer);
  acct.status = "saving"; renderAcct();
  const ref = acct.ref;
  acct.timer = setTimeout(async () => {
    try { await ref.set({state: persisted(), updated: Date.now()}); if (acct.ref === ref) acct.status = "synced"; }
    catch(e){ if (acct.ref === ref) acct.status = e && e.code === "invalid_argument" ? "readonly" : "error"; }
    renderAcct();
  }, 900);
}
async function initAccount(linking){
  const me0 = profile;
  if (!me0 || me0.guest || !me0.cloud) return;
  acct.status = "checking"; renderAcct();
  const still = () => profile === me0 && me0.cloud;
  if (!window.claude || !window.claude.use) { acct.status = "error"; renderAcct(); return; }
  try {
    const [user, db] = await Promise.all([window.claude.use("user"), window.claude.use("db")]);
    if (!still()) return;
    if (!user || !db) { acct.status = "error"; renderAcct(); return; }
    const uid = await user.id();
    if (!uid) { acct.status = "error"; renderAcct(); return; }
    try { const me = await user.me(); acct.name = (me && me.name || "").split(" ")[0]; } catch(e){}
    const ref = db.doc(`data/users/${uid}/profile`);
    const snap = await ref.get();
    if (!still()) return;
    acct.ref = ref;
    const d = snap.exists ? snap.data() : null;
    const pushLocal = async () => { try { await ref.set({state: persisted(), updated: Date.now()}); acct.status = "synced"; } catch(e){ acct.status = e && e.code === "invalid_argument" ? "readonly" : "error"; } renderAcct(); };
    const pullRemote = () => {
      applySaved(d.state); save(); acct.status = "synced"; renderAcct();
      if (!$("app").hidden) renderAll(); else if (!$("start").hidden) { renderStartUI(); startStage.load(); if (document.documentElement.dataset.view === "hub") renderHub(); } else if (!$("screen").hidden) renderScreen();
    };
    if (d && d.state && linking) {
      const md = openModal(`<h3 class="mt" id="modalTitle">Your claude.ai account already has a save</h3>
        <p>Choose which teams to keep for <b>${esc(me0.name)}</b>. The other one is replaced.</p>
        <div class="actions"><button class="btn primary" type="button" id="lkPull">Use the claude.ai save</button><button class="btn" type="button" id="lkPush">Keep this device’s save</button></div>`);
      md.querySelector("#lkPull").onclick = () => { closeModal(); pullRemote(); toast("Loaded your claude.ai save."); };
      md.querySelector("#lkPush").onclick = () => { closeModal(); pushLocal(); toast("Your claude.ai save now matches this device."); };
      acct.status = "checking"; renderAcct();
      return;
    }
    if (d && d.state) pullRemote(); else await pushLocal();
  } catch(e){ if (still()) { acct.status = "error"; renderAcct(); } }
}
$("acctBtn").addEventListener("click", () => openAccountMenu());

// ---------- accounts: local save files on this device (+ optional claude.ai sync for one of them) ----------
const ACCKEY = "dreamteamdex.accounts", SESSKEY = "dreamteamdex.session", PKEY = id => "dreamteamdex.p." + id;
const ls = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch(e){} },
  del(k){ try { localStorage.removeItem(k); } catch(e){} },
};
const ss = { get(k){ try { return sessionStorage.getItem(k); } catch(e){ return null; } }, set(k, v){ try { sessionStorage.setItem(k, v); } catch(e){} }, del(k){ try { sessionStorage.removeItem(k); } catch(e){} } };
let accounts = {list:[], current:null};
let profile = null; // {id, name, ...} or {guest:true}
function loadAccounts(){
  try { const a = JSON.parse(ls.get(ACCKEY) || "null"); if (a && Array.isArray(a.list)) accounts = {list:a.list.filter(p => p && p.id && p.name), current:a.current || null}; } catch(e){}
  if (!ON_CLAUDE) accounts.list.forEach(p => { p.cloud = false; });
}
function saveAccounts(){ ls.set(ACCKEY, JSON.stringify(accounts)); }
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
async function hashPin(pin, salt){
  try { const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin)); return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join(""); }
  catch(e){ let h = 2166136261; for (const c of salt + ":" + pin) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return "f" + (h >>> 0).toString(16); }
}
function resetState(){ Object.assign(state, freshState()); rebuildTeams(); applyUI(); if (typeof undoStack !== "undefined") { undoStack.length = 0; redoStack.length = 0; renderUndo(); } }
function migrateLegacy(){
  if (accounts.list.length) return;
  const legacy = ls.get(KEY);
  if (!legacy) return;
  const id = newId();
  let name = "Player 1"; try { const s = JSON.parse(legacy); if (s && s.name) name = String(s.name).slice(0, 16); } catch(e){}
  accounts.list.push({id, name, pin:null, cloud:ON_CLAUDE, avatar:null, updated:Date.now()});
  accounts.current = id;
  ls.set(PKEY(id), legacy);
  saveAccounts();
  ls.del(KEY);
}
function profileMeta(id){ return accounts.list.find(p => p.id === id); }
// ---- backups: one JSON file per save, for moving between devices ----
async function exportSave(){
  if (!profile || profile.guest) return;
  save();
  const data = {app:"dream-team-dex", kind:"save", v:1, exported:new Date().toISOString(), name:profile.name, avatar:profile.avatar ?? null, state:persisted()};
  const blob = new Blob([JSON.stringify(data)], {type:"application/json"}), fname = `dream-team-dex-${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "save"}-${todayKey()}.json`;
  if (!(await saveFile(fname, blob))) toast("Couldn’t save the backup here. Try another browser.");
}
function importSave(){
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    let d; try { if (f.size > 5e6) throw 0; d = JSON.parse(await f.text()); } catch(e){ toast("That file isn’t a Dream Team Dex backup."); return; }
    if (!d || d.app !== "dream-team-dex" || !d.state || typeof d.state !== "object") { toast("That file isn’t a Dream Team Dex backup."); return; }
    let name = String(d.name || "Trainer").trim().slice(0, 16) || "Trainer", base = name, k = 2;
    while (accounts.list.some(p => p.name.toLowerCase() === name.toLowerCase())) name = `${base.slice(0, 13)} ${k++}`;
    const id = newId();
    accounts.list.push({id, name, pin:null, cloud:false, avatar:Number.isInteger(d.avatar) ? d.avatar : null, updated:Date.now()});
    ls.set(PKEY(id), JSON.stringify(d.state)); saveAccounts();
    if (profile && !profile.guest) save();
    closeModal();
    if (signIn(id, true)) { state.name = state.name || name; save(); finishSignIn(); toast(`Restored ${name}’s save.`); }
  };
  inp.click();
}
function teamsFilled(){ return Object.values(state.teams || {}).filter(t => Array.isArray(t) && t.length).length; }
function touchMeta(){
  if (!profile || profile.guest) return;
  const m = profileMeta(profile.id); if (!m) return;
  m.avatar = trainerOf("all"); m.icon = myIcon(); m.updated = Date.now(); m.teams = teamsFilled(); m.favs = state.favs.length;
  saveAccounts();
}
function signIn(id, remember){
  const m = profileMeta(id); if (!m) return false;
  resetState();
  try { applySaved(JSON.parse(ls.get(PKEY(id)) || "null")); } catch(e){}
  if (!ls.get(PKEY(id))) { state.name = m.name; state.sample = true; }
  profile = m;
  if (remember) { accounts.current = id; ss.del(SESSKEY); } else { accounts.current = null; ss.set(SESSKEY, id); }
  if (!state.games.since) state.games.since = Date.now();
  ecoMigrate(); checkAch(true);
  saveAccounts(); touchMeta();
  acct.ref = null; acct.status = "local"; acct.remote = null;
  document.documentElement.dataset.mode = state.mode;
  SB.status = m.sb ? "checking" : "local"; SB.seen = 0; FR.list = null; FR.pubSig = ""; fbStop();
  if (m.cloud) initAccount();
  if (m.sb) sbStart();
  renderAcct();
  return true;
}
function signInGuest(){
  resetState();
  profile = {guest:true, name:"Guest"}; ecoMigrate();
  accounts.current = null; saveAccounts(); ss.del(SESSKEY);
  acct.ref = null; acct.status = "guest";
  document.documentElement.dataset.mode = state.mode;
  renderAcct();
}
function signOut(){
  if (profile && !profile.guest) { clearTimeout(acct.timer); save(true); }
  profile = null; accounts.current = null; saveAccounts(); ss.del(SESSKEY);
  acct.ref = null; acct.status = "local";
  closeModal(); if (!$("hof").hidden) closeHof(); if (!$("view").hidden) closeView();
  startStage.stop();
  showSignIn();
}

// ---- Sign-in screen ("Choose your save file") ----
let accView = {mode:"list", pinFor:null, err:""};
function showSignIn(mode){
  accView = {mode: mode || (accounts.list.length ? "list" : "new"), pinFor:null, err:""};
  if (typeof leaveScreen === "function") leaveScreen();
  document.documentElement.dataset.view = "signin";
  $("app").hidden = true; $("start").hidden = true; $("screen").hidden = true; $("acc").hidden = false;
  if (typeof setMusic === "function") setMusic(null);
  renderSignIn();
}
function hideSignIn(){ $("acc").hidden = true; }
function fmtAgo(t){ if (!t) return ""; const d = (Date.now() - t)/1000; if (d < 90) return "just now"; if (d < 3600) return Math.round(d/60) + " min ago"; if (d < 86400) return Math.round(d/3600) + " h ago"; return Math.round(d/86400) + " d ago"; }
function renderSignIn(){
  const A = $("accBody");
  const prof = accounts.list.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0));
  if (accView.mode === "new") {
    const anyCloud = accounts.list.some(p => p.cloud);
    A.innerHTML = onlineCardHTML() + `<h2 class="acc-title">${CLOUD_ON ? "Or make a save file on this device" : "New save file"}</h2>
      <form class="acc-form" id="accNew" autocomplete="off">
        <label class="field">Trainer name<input id="accName" maxlength="16" required placeholder="e.g. Blake" value=""></label>
        <label class="field">PIN <span class="meta">(optional, 4 digits — stops others opening your save)</span><input id="accPin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="••••"></label>
        ${ON_CLAUDE ? `<label class="chk"><input type="checkbox" id="accCloud" ${anyCloud ? "" : "checked"}> Sync this save with my claude.ai account${anyCloud ? ` <span class="meta">(moves sync from ${esc(accounts.list.find(p => p.cloud).name)})</span>` : ""}</label>` : ""}
        <label class="chk"><input type="checkbox" id="accRemember" checked> Keep me signed in on this device</label>
        ${accView.err ? `<p class="acc-err" role="alert">${esc(accView.err)}</p>` : ""}
        <div class="actions"><button class="btn primary" type="submit">Start adventure</button><button class="btn" type="button" data-acc="import">Restore a backup</button>${accounts.list.length ? `<button class="btn" type="button" data-acc="list">Back</button>` : `<button class="btn" type="button" data-acc="guest">Play as guest</button>`}</div>
      </form>`;
    setTimeout(() => { const n = $("accName"); if (n) n.focus(); }, 0);
    return;
  }
  A.innerHTML = onlineCardHTML() + `<h2 class="acc-title">Choose your save file</h2>
    <div class="saves">${prof.map(p => `
      <div class="save${accView.pinFor === p.id ? " open" : ""}">
        <button class="save-main" type="button" data-signin="${p.id}" aria-label="Continue as ${esc(p.name)}">
          <div class="stage medal save-av">${p.avatar !== null && p.avatar !== undefined && TRAINERS[p.avatar] !== undefined ? `<img class="tr" data-tr="${p.avatar}" alt="">` : `<span class="ghost"></span>`}${p.icon && unlockOf("icon", p.icon) ? iconHTML(p.icon, "badge") : ""}</div>
          <span class="save-info"><b>${esc(p.name)}</b><span class="meta">${p.teams || 0} teams · ${p.favs || 0} favorites${p.updated ? " · " + fmtAgo(p.updated) : ""}</span>
          <span class="save-tags">${p.pin ? `<span class="pill mute">🔒 PIN</span>` : ""}${p.sb ? `<span class="pill good">Online · ${esc(p.uname || p.name)}</span>` : p.cloud ? `<span class="pill good">Synced to claude.ai</span>` : `<span class="pill mute">This browser</span>`}</span></span>
          <span class="save-go" aria-hidden="true">▶</span>
        </button>
        ${accView.pinFor === p.id ? `<form class="pin-row" data-pinform="${p.id}"><input id="pinIn" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="Enter PIN" aria-label="PIN for ${esc(p.name)}"><button class="btn primary sm" type="submit">Sign in</button>${accView.err ? `<span class="acc-err" role="alert">${esc(accView.err)}</span>` : ""}</form>` : ""}
      </div>`).join("")}</div>
    <label class="chk"><input type="checkbox" id="accRemember" checked> Keep me signed in on this device</label>
    <div class="actions"><button class="btn primary" type="button" data-acc="new">+ New save file</button><button class="btn" type="button" data-acc="guest">Play as guest</button></div>
    <p class="note">${CLOUD_ON ? "Save files without an online account live only in this browser." : "Save files live in this browser."} Back one up from its account menu to move it to another device. PINs keep friends and family out of each other’s teams but aren’t real security.</p>
    <div class="actions"><button class="btn sm" type="button" data-acc="import">Restore a backup</button></div>`;
  paintAll(A);
  const pi = $("pinIn"); if (pi) pi.focus();
}
const rememberChecked = () => { const r = $("accRemember"); return r ? r.checked : true; };
function finishSignIn(){ hideSignIn(); showStart(); }
$("acc").addEventListener("click", e => {
  const a = e.target.closest("[data-acc]");
  if (a) {
    if (a.dataset.acc === "new") { accView = {mode:"new", err:""}; renderSignIn(); }
    else if (a.dataset.acc === "list") { accView = {mode:"list", err:""}; renderSignIn(); }
    else if (a.dataset.acc === "guest") { signInGuest(); finishSignIn(); toast("Playing as guest. Nothing will be saved."); }
    else if (a.dataset.acc === "import") importSave();
    else if (a.dataset.acc === "google") sbGoogle();
    else if (a.dataset.acc === "emailback") { accView.online = {step:"start", email:(accView.online || {}).email || ""}; renderSignIn(); }
    return;
  }
  const s = e.target.closest("[data-signin]");
  if (s) {
    const m = profileMeta(s.dataset.signin); if (!m) return;
    if (m.sb && CLOUD_ON) { signIn(m.id, true); finishSignIn(); return; }
    if (m.pin) { accView = {mode:"list", pinFor:m.id, err:""}; renderSignIn(); return; }
    if (signIn(m.id, rememberChecked())) finishSignIn();
  }
});
$("acc").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  if (f.id === "accEmail" || f.id === "accCode") {
    const o = accView.online = accView.online || {step:"start"}, btn = f.querySelector("button[type=submit]");
    if (btn) btn.disabled = true;
    if (f.id === "accEmail") {
      o.email = $("accEm").value.trim(); o.err = await sbSendCode(o.email); if (!o.err) o.step = "code";
    } else o.err = await sbVerifyCode(o.email, $("accCd").value.replace(/\s/g, ""));
    if (!$("acc").hidden) { renderSignIn(); const cd = $("accCd"); if (cd) cd.focus(); }
    return;
  }
  if (f.id === "accNew") {
    const name = $("accName").value.trim().slice(0, 16), pin = $("accPin").value.trim();
    if (!name) { accView.err = "Give your save file a trainer name."; renderSignIn(); return; }
    if (accounts.list.some(p => p.name.toLowerCase() === name.toLowerCase())) { accView.err = `There’s already a save file called ${name}. Pick another name.`; renderSignIn(); $("accName").value = name; return; }
    if (pin && !/^\d{4}$/.test(pin)) { accView.err = "The PIN needs exactly 4 digits, or leave it empty."; renderSignIn(); $("accName").value = name; return; }
    const id = newId(), cloud = !!($("accCloud") && $("accCloud").checked), remember = $("accRemember").checked;
    let pinRec = null; if (pin) { const salt = newId(); pinRec = {salt, hash: await hashPin(pin, salt)}; }
    if (cloud) accounts.list.forEach(p => p.cloud = false);
    accounts.list.push({id, name, pin:pinRec, cloud, avatar:null, updated:Date.now()});
    saveAccounts();
    signIn(id, remember);
    state.name = name; state.sample = true; save();
    finishSignIn(); toast(`Welcome, ${name}!`);
    return;
  }
  if (f.dataset.pinform) {
    const m = profileMeta(f.dataset.pinform), pin = $("pinIn").value.trim();
    if (!m || !m.pin) return;
    if (await hashPin(pin, m.pin.salt) !== m.pin.hash) { accView.err = "That PIN doesn’t match. Try again."; renderSignIn(); return; }
    if (signIn(m.id, rememberChecked())) finishSignIn();
  }
});

// ---- Account menu ----
function openAccountMenu(){
  if (!profile) return;
  if (profile.guest) {
    const md = openModal(`<h3 class="mt" id="modalTitle">Playing as guest</h3>
      <p>Nothing you do as a guest is saved. Keep this session’s teams by turning it into a save file.</p>
      <label class="field">Trainer name<input id="gName" maxlength="16" placeholder="e.g. Blake"></label>
      <div class="actions"><button class="btn primary" type="button" id="gKeep">Save as new file</button>${CLOUD_ON ? `<button class="btn" type="button" id="gOnline">Create a free account</button>` : ""}<button class="btn" type="button" id="gOut">Sign out</button></div>
      <p class="acc-err" id="gErr" hidden></p>`);
    md.querySelector("#gOut").onclick = signOut;
    const gon = md.querySelector("#gOnline"); if (gon) gon.onclick = showOnlineSignIn;
    md.querySelector("#gKeep").onclick = () => {
      const name = md.querySelector("#gName").value.trim().slice(0, 16), err = md.querySelector("#gErr");
      if (!name) { err.textContent = "Give your save file a trainer name."; err.hidden = false; return; }
      if (accounts.list.some(p => p.name.toLowerCase() === name.toLowerCase())) { err.textContent = `There’s already a save file called ${name}.`; err.hidden = false; return; }
      const id = newId(); accounts.list.push({id, name, pin:null, cloud:false, avatar:null, updated:Date.now()});
      profile = profileMeta(id); accounts.current = id; state.name = name; saveAccounts(); save();
      acct.status = "local"; renderAcct(); renderStartUI(); closeModal(); toast(`Saved as ${name}.`);
    };
    return;
  }
  if (profile.sb && CLOUD_ON) { openOnlineMenu(profile); return; }
  const m = profile, cloudLabel = m.cloud ? (acct.status === "synced" || acct.status === "saving" ? `Synced with claude.ai${acct.name ? " (" + esc(acct.name) + ")" : ""}` : acct.status === "readonly" ? "Sync paused: this page is view-only for you" : acct.status === "error" ? "Sync couldn’t reach claude.ai; saved on this device" : "Sync on, waiting for claude.ai") : "Saved on this device only";
  const md = openModal(`
    <div class="acc-head"><div class="stage medal save-av">${m.avatar !== null && m.avatar !== undefined ? `<img class="tr" data-tr="${m.avatar}" alt="">` : ""}${m.icon && unlockOf("icon", m.icon) ? iconHTML(m.icon, "badge") : ""}</div>
      <div><h3 class="mt" id="modalTitle">${esc(m.name)}</h3><span class="meta">${cloudLabel}</span></div></div>
    <div class="actions"><button class="btn primary" type="button" id="amSwitch">Switch save file</button><button class="btn" type="button" id="amOut">Sign out</button></div>
    ${CLOUD_ON ? `<div class="cov-h">Play on any device</div><p class="note">Sign in with Google or your email, then bring this save into your account so it follows you everywhere.</p><div class="actions left"><button class="btn sm" type="button" id="amOnline">Sign in online</button></div>` : ""}
    <div class="cov-h">Manage</div>
    <label class="field">Trainer name<input id="amName" maxlength="16" value="${esc(m.name)}"></label>
    ${ON_CLAUDE ? `<div class="hrow"><span>Sync with my claude.ai account</span><button class="switch" type="button" role="switch" id="amCloud" aria-checked="${!!m.cloud}" aria-label="Sync with claude.ai"></button></div>
    <p class="note">Only one save file on this device can sync. Synced teams follow you to any device where you open this page signed in to claude.ai.</p>` : ""}
    <div class="cov-h">Backup</div>
    <div class="actions left"><button class="btn sm" type="button" id="amExport">Download a backup</button><button class="btn sm" type="button" id="amImport">Restore a backup</button></div>
    <p class="note">${ON_CLAUDE ? "A backup file" : "Your save lives in this browser. A backup file"} keeps everything: teams, settings, badges and achievements. Restore it on any device to carry on.</p>
    <div class="cov-h">PIN</div>
    <div class="pin-edit"><input id="amPin" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="New 4-digit PIN"><button class="btn sm" type="button" id="amPinSet">${m.pin ? "Change PIN" : "Set PIN"}</button>${m.pin ? `<button class="btn sm" type="button" id="amPinOff">Remove PIN</button>` : ""}</div>
    <p class="acc-err" id="amErr" hidden></p>
    <div class="cov-h">Danger zone</div>
    <button class="btn danger" type="button" id="amDel">Delete this save file</button>`);
  const err = t => { const e = md.querySelector("#amErr"); e.textContent = t; e.hidden = !t; };
  md.querySelector("#amSwitch").onclick = () => { save(true); closeModal(); startStage.stop(); profile = null; accounts.current = null; saveAccounts(); ss.del(SESSKEY); showSignIn("list"); };
  md.querySelector("#amOut").onclick = signOut;
  const onl = md.querySelector("#amOnline"); if (onl) onl.onclick = showOnlineSignIn;
  md.querySelector("#amName").addEventListener("change", e => {
    const v = e.target.value.trim().slice(0, 16);
    if (!v) { e.target.value = m.name; return; }
    if (accounts.list.some(p => p !== m && p.name.toLowerCase() === v.toLowerCase())) { err(`There’s already a save file called ${v}.`); e.target.value = m.name; return; }
    err(""); m.name = v; if (!state.name || state.name === m.name) state.name = v; saveAccounts(); save(); renderAcct(); md.querySelector("#modalTitle").textContent = v; toast("Name updated.");
  });
  md.querySelector("#amExport").onclick = exportSave;
  md.querySelector("#amImport").onclick = importSave;
  if (md.querySelector("#amCloud")) md.querySelector("#amCloud").onclick = e => {
    const on = !m.cloud;
    accounts.list.forEach(p => p.cloud = false); m.cloud = on; saveAccounts();
    e.currentTarget.setAttribute("aria-checked", on);
    if (on) { initAccount(true); toast("Syncing this save file with claude.ai."); }
    else { acct.ref = null; acct.status = "local"; renderAcct(); toast("Sync turned off. This save stays on this device."); }
  };
  md.querySelector("#amPinSet").onclick = async () => {
    const pin = md.querySelector("#amPin").value.trim();
    if (!/^\d{4}$/.test(pin)) { err("The PIN needs exactly 4 digits."); return; }
    const salt = newId(); m.pin = {salt, hash: await hashPin(pin, salt)}; saveAccounts(); err(""); toast("PIN saved."); openAccountMenu();
  };
  const off = md.querySelector("#amPinOff"); if (off) off.onclick = () => { m.pin = null; saveAccounts(); toast("PIN removed."); openAccountMenu(); };
  md.querySelector("#amDel").onclick = e => {
    const b = e.currentTarget;
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = `Tap again to delete ${m.name} for good`; return; }
    ls.del(PKEY(m.id)); accounts.list = accounts.list.filter(p => p !== m); saveAccounts();
    profile = null; acct.ref = null; closeModal(); startStage.stop(); toast(`Deleted ${m.name}.`); showSignIn();
  };
  paintAll(md);
}

