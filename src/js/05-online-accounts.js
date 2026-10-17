// ================= ONLINE ACCOUNTS (Supabase: sign-in, cloud saves; see docs/supabase-setup.md) =================
// Turned on by site/config.js (project URL + public anon key). Without it, or offline, everything stays local.
// A save file linked to an online account has `sb` (the account id) in its entry in `accounts.list`, plus `sbVer`
// (the cloud version this device last synced) and `sbDirty` (changed here since). Play always reads and writes
// localStorage; changes upload a few seconds after the last edit and when the tab is hidden. Every upload names the
// version it builds on, so two devices can never silently overwrite each other: the player picks.
const SBC = window.DTD_CONFIG || {};
const CLOUD_ON = !ON_CLAUDE && !!(SBC.supabaseUrl && SBC.supabaseAnonKey);
const GOOGLE_ON = SBC.google === true;   // the "Continue with Google" button: add google: true to site/config.js once Google sign-in is set up
const SB = {client:null, loading:null, user:null, prof:null, timer:null, busy:false, status:"local", quiet:false, edits:0, again:false, bring:null, entering:false, seen:0};
const SB_MAX = 1e6;   // the database refuses saves over 1 MB
function sbLoad(){
  if (!CLOUD_ON) return Promise.resolve(null);
  if (SB.client) return Promise.resolve(SB.client);
  if (SB.loading) return SB.loading;
  SB.loading = new Promise(res => {
    const go = () => {
      // implicit flow: an email link signs in whichever browser opens it (a phone's mail app often opens links in its
      // own browser, where a PKCE link can't finish). A sign-in finished in another tab reaches a tab still waiting
      // for the code through onAuthStateChange.
      try { SB.client = window.supabase.createClient(SBC.supabaseUrl, SBC.supabaseAnonKey, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:"implicit"}});
        SB.client.auth.onAuthStateChange((ev, session) => { if (ev === "SIGNED_IN" && session && accView.online && accView.online.step === "code") setTimeout(() => sbOnSession(session.user), 0); });
        res(SB.client); }
      catch(e){ SB.loading = null; res(null); }
    };
    if (window.supabase && window.supabase.createClient) { go(); return; }
    const s = document.createElement("script"); s.src = "vendor/supabase.js";
    s.onload = go; s.onerror = () => { s.remove(); SB.loading = null; res(null); };
    document.head.appendChild(s);
  });
  return SB.loading;
}
const sbRedirect = () => location.origin + location.pathname;
function sbDevice(){
  const u = navigator.userAgent;
  const b = /Edg\//.test(u) ? "Edge" : /OPR\//.test(u) ? "Opera" : /Firefox\//.test(u) ? "Firefox" : /Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : "Browser";
  const o = /iPhone|iPad/.test(u) ? "iOS" : /Android/.test(u) ? "Android" : /Mac OS X/.test(u) ? "Mac" : /Windows/.test(u) ? "Windows" : /CrOS/.test(u) ? "Chromebook" : /Linux/.test(u) ? "Linux" : "";
  return o ? `${b} on ${o}` : b;
}
// usernames: the same rules the database checks (claim_username), so most problems show before sending
const UNAME_BAD = ["fuck","fuk","shit","bitch","cunt","dick","cock","pussy","nigg","fag","whore","slut","rape","nazi","hitler","porn","penis","vagina","boob","tits","bastard","retard","kkk","pedo","molest","sexy","horny","jizz","wank","twat","spic","chink","kike","dyke","tranny"];
const UNAME_SHORT = ["cum","anus","arse","hell","damn"];
function unameProblem(v){
  if (!/^[A-Za-z0-9_]{3,16}$/.test(v)) return "Use 3–16 letters, numbers or _ (no spaces).";
  const n = v.toLowerCase().replace(/[013457_]/g, c => ({"0":"o","1":"i","3":"e","4":"a","5":"s","7":"t","_":""}[c]));
  if (UNAME_BAD.some(w => n.includes(w)) || UNAME_SHORT.some(w => n.startsWith(w) && n.length <= w.length + 2)) return "That name isn’t allowed. Try another.";
  return "";
}
const SB_ERR = {username_not_allowed:"That name isn’t allowed. Try another.", username_taken:"Someone already has that name. Try another.", username_rate_limited:"You can change your username once a week.", not_signed_in:"You’re signed out. Sign in again."};
const sbErrText = e => { const m = String(e && (e.message || e.error_description) || ""); const k = Object.keys(SB_ERR).find(x => m.includes(x)); return k ? SB_ERR[k] : "Couldn’t reach your online account. Check your connection and try again."; };
const isAuthErr = e => e && (e.status === 401 || e.code === "PGRST301" || /JWT|not_signed_in/i.test(String(e.message || "")));
const fmtCode = c => c ? String(c).slice(0, 4) + "-" + String(c).slice(4) : "";
function rerenderVisible(){
  if (!$("app").hidden) renderAll();
  else if (!$("start").hidden) { renderStartUI(); startStage.load(); if (document.documentElement.dataset.view === "hub") renderHub(); }
  else if (!$("screen").hidden) renderScreen();
}
// what a save holds, for the "which progress?" choice
function saveSummary(d){
  const g = d && d.games || {}, bits = n => { let c = 0; for (let x = n | 0; x; x &= x - 1) c++; return c; };
  return {teams:Object.values(d && d.teams || {}).filter(t => Array.isArray(t) && t.length).length,
    badges:Object.values(g.badges || {}).reduce((a, n) => a + bits(n), 0), leagues:Object.values(g.leagues || {}).filter(Boolean).length, pp:g.pp | 0};
}
const sumHTML = s => `${s.teams} team${s.teams === 1 ? "" : "s"} · ${s.badges} badge${s.badges === 1 ? "" : "s"}${s.leagues ? ` · ${s.leagues} league${s.leagues === 1 ? "" : "s"}` : ""} · ${s.pp.toLocaleString()} PokéPoints`;

// ---- signing in ----
function pickUsername(){
  return new Promise(res => {
    let done = false;
    const md = openModal(`<h3 class="mt" id="modalTitle">Choose your username</h3>
      <p>Friends find you by this name. Use 3–16 letters, numbers or _. Don’t use your real name.</p>
      <form class="acc-form" id="unForm" autocomplete="off"><label class="field">Username<input id="unIn" maxlength="16" spellcheck="false" autocapitalize="off" required></label>
      <p class="acc-err" id="unErr" role="alert" hidden></p><div class="actions"><button class="btn primary" type="submit">Continue</button></div></form>`, {onClose:() => { if (!done) res(null); }});
    const inp = md.querySelector("#unIn"), err = t => { const e = md.querySelector("#unErr"); e.textContent = t; e.hidden = !t; };
    inp.value = String(state.name || "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 16); inp.focus();
    md.querySelector("#unForm").onsubmit = async e => {
      e.preventDefault();
      const v = inp.value.trim(), p = unameProblem(v); if (p) { err(p); return; }
      const {data, error} = await SB.client.rpc("claim_username", {p_name:v});
      if (error) { err(sbErrText(error)); return; }
      done = true; closeModal(); res(data);
    };
  });
}
// after Google, an email link or a code: open (or create) this account's save file on this device
async function sbOnSession(user){
  if (!user || SB.entering) return;
  if (profile && profile.sb === user.id) { if (SB.status !== "synced") sbStart(); return; }
  SB.entering = true;
  try {
    const c = SB.client; SB.user = user;
    const r = await c.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (r.error) { toast(sbErrText(r.error)); return; }
    let prof = r.data;
    if (!prof) { prof = await pickUsername(); if (!prof) { await c.auth.signOut({scope:"local"}); SB.user = null; toast("Sign-in cancelled."); return; } }
    SB.prof = prof;
    let guest = profile && profile.guest ? persisted() : null; const prev = profile && !profile.guest ? profile.id : null;
    if (!guest) try { guest = JSON.parse(ss.get(GSTASH) || "null"); } catch(e){}
    ss.del(GSTASH);
    if (profile && !profile.guest) save();
    let m = accounts.list.find(p => p.sb === user.id);
    if (!m) {
      let name = prof.username, k = 2; while (accounts.list.some(p => p.name.toLowerCase() === name.toLowerCase())) name = `${prof.username.slice(0, 13)} ${k++}`;
      m = {id:newId(), name, pin:null, cloud:false, avatar:null, updated:Date.now(), sb:user.id, sbVer:0, sbDirty:false};
      accounts.list.push(m); SB.bring = {guest, prev};
    }
    m.uname = prof.username; m.code = prof.friend_code; saveAccounts();
    closeModal(); signIn(m.id, true);
    if (!state.name || state.sample) state.name = prof.username;
    hideSignIn(); showStart(); toast(`Signed in as ${prof.username}.`);
  } finally { SB.entering = false; }
}
const GSTASH = "dreamteamdex.guestStash";   // a guest's progress, kept across the trip to Google and back
async function sbGoogle(){
  const c = await sbLoad(); if (!c) { toast("Online sign-in isn’t available right now."); return; }
  if (profile && profile.guest) ss.set(GSTASH, JSON.stringify(persisted()));
  const {error} = await c.auth.signInWithOAuth({provider:"google", options:{redirectTo:sbRedirect()}});
  if (error) toast(sbErrText(error));
}
async function sbSendCode(email){
  const c = await sbLoad(); if (!c) return "Online sign-in isn’t available right now.";
  const {error} = await c.auth.signInWithOtp({email, options:{emailRedirectTo:sbRedirect(), shouldCreateUser:true}});
  return error ? (error.status === 429 ? "Too many emails. Wait a minute and try again." : sbErrText(error)) : "";
}
async function sbVerifyCode(email, token){
  const c = await sbLoad(); if (!c) return "Online sign-in isn’t available right now.";
  const {data, error} = await c.auth.verifyOtp({email, token, type:"email"});
  if (error) return /expired|invalid/i.test(error.message || "") ? "That code didn’t work. Check it, or send a new one." : sbErrText(error);
  await sbOnSession(data.user); return "";
}
function showOnlineSignIn(){
  closeModal(); if (profile && !profile.guest) save();
  showSignIn();
  setTimeout(() => { const em = $("accEm"); if (em) { em.scrollIntoView({block:"center"}); em.focus(); } }, 0);
}
function onlineCardHTML(){
  if (!CLOUD_ON) return "";
  const o = accView.online || {step:"start"};
  return `<section class="online" aria-labelledby="onT">
    <h3 id="onT">Play on any device</h3>
    <p class="meta">Sign in and your teams, badges and PokéPoints follow you to every browser. Free, and you can add friends.</p>
    ${o.step === "code" ? `<form class="on-row" id="accCode" autocomplete="off"><input id="accCd" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="6-digit code" aria-label="Sign-in code" required><button class="btn primary" type="submit">Sign in</button></form>
      <p class="note">We sent a sign-in code to <b>${esc(o.email)}</b>. Type it here: you can read the email on any device. It can take a minute; check spam too. <button class="linkbtn" type="button" data-acc="emailback">Use a different email</button></p>`
    : `${GOOGLE_ON ? `<div class="on-row"><button class="btn google" type="button" data-acc="google"><span class="g-logo" aria-hidden="true">G</span> Continue with Google</button></div>` : ""}
      <form class="on-row" id="accEmail"><input id="accEm" type="email" autocomplete="email" placeholder="you@example.com" aria-label="Email" required value="${esc(o.email || "")}"><button class="btn" type="submit">Email me a code</button></form>`}
    ${o.err ? `<p class="acc-err" role="alert">${esc(o.err)}</p>` : ""}
    <p class="note">No password needed. We never show your email to anyone.</p>
  </section>`;
}
// first sign-in with no cloud save yet: offer to bring a save file from this device into the account
function bringChoices(b){
  const out = [];
  if (b && b.guest) out.push({key:"guest", name:"This guest session", data:b.guest});
  for (const p of accounts.list) {
    if (p.sb) continue;
    let d = null; try { d = JSON.parse(ls.get(PKEY(p.id)) || "null"); } catch(e){}
    if (d && d.teams) out.push({key:p.id, name:p.name, data:d, updated:p.updated, first:p.id === (b && b.prev)});
  }
  return out.sort((a, b2) => (b2.first ? 1 : 0) - (a.first ? 1 : 0) || (b2.updated || 0) - (a.updated || 0));
}
function bringOverModal(list){
  SB.status = "checking"; renderAcct();
  let chosen = false;
  const md = openModal(`<h3 class="mt" id="modalTitle">Bring a save into your account?</h3>
    <p>Your online account is new. Pick a save file from this device to carry on with it everywhere, or start fresh.</p>
    <div class="sync-pick">${list.map((c, i) => `<button class="sync-opt" type="button" data-bring="${i}"><b>${esc(c.name)}</b><span>${sumHTML(saveSummary(c.data))}${c.updated ? `<br>Played ${fmtAgo(c.updated)}` : ""}</span></button>`).join("")}
    <button class="sync-opt" type="button" data-bring="fresh"><b>Start fresh</b><span>A brand-new adventure</span></button></div>
    <p class="note">The save file stays on this device too. Download a backup any time from your account menu.</p>`, {onClose:() => { if (!chosen) sbUpload(); }});
  md.onclick = e => {
    const b = e.target.closest("[data-bring]"); if (!b) return;
    chosen = true; closeModal();
    if (b.dataset.bring !== "fresh") {
      const c = list[+b.dataset.bring];
      resetState(); applySaved(c.data); state.name = state.name || profile.name; save(); rerenderVisible(); toast(`${c.name}’s progress is now in your account.`);
    }
    sbUpload();
  };
}

// ---- syncing ----
async function sbStart(){
  const me0 = profile; if (!me0 || !me0.sb) return;
  SB.status = "checking"; renderAcct();
  const c = await sbLoad();
  if (profile !== me0) return;
  if (!c) { SB.status = "offline"; renderAcct(); return; }
  try {
    const {data:{session}} = await c.auth.getSession();
    if (profile !== me0) return;
    if (!session || session.user.id !== me0.sb) { SB.status = "signedout"; renderAcct(); return; }
    SB.user = session.user;
    if (!SB.prof || SB.prof.id !== me0.sb) { const p = await c.from("profiles").select("*").eq("id", me0.sb).maybeSingle(); if (p.data) SB.prof = p.data; }
    if (SB.prof) { me0.uname = SB.prof.username; me0.code = SB.prof.friend_code; saveAccounts(); }
    const r = await c.from("saves").select("data, version, updated_at, device").eq("user_id", me0.sb).maybeSingle();
    if (profile !== me0) return;
    if (r.error) throw r.error;
    const cloud = r.data;
    if (!cloud) {
      const list = bringChoices(SB.bring); SB.bring = null;
      if (list.length && !me0.sbVer) { bringOverModal(list); return; }
      me0.sbVer = 0; await sbUpload(me0); return;
    }
    SB.bring = null;
    if (cloud.version === me0.sbVer) { if (me0.sbDirty) await sbUpload(me0); else { SB.status = "synced"; renderAcct(); sbAfterSync(); } return; }
    if (!me0.sbDirty) { sbPull(cloud); return; }
    syncConflict(cloud);
  } catch(e){ if (profile === me0) { SB.status = isAuthErr(e) ? "signedout" : "offline"; renderAcct(); } }
}
function sbPull(cloud){
  SB.quiet = true; applySaved(cloud.data); save(); SB.quiet = false;
  profile.sbVer = cloud.version; profile.sbDirty = false; saveAccounts();
  SB.status = "synced"; renderAcct(); rerenderVisible(); sbAfterSync();
}
function sbQueue(){
  if (!profile || !profile.sb || !SB.client || ["conflict", "signedout", "checking", "toobig"].includes(SB.status)) return;
  clearTimeout(SB.timer);
  if (SB.status !== "saving") { SB.status = "saving"; renderAcct(); }
  SB.timer = setTimeout(() => sbUpload(), 4000);
}
async function sbUpload(meArg){
  const me0 = meArg || profile;
  if (!me0 || !me0.sb || !SB.client) return;
  if (SB.busy) { SB.again = true; return; }
  clearTimeout(SB.timer);
  const data = me0 === profile ? persisted() : JSON.parse(ls.get(PKEY(me0.id)) || "null");
  if (!data) return;
  if (JSON.stringify(data).length > SB_MAX) { SB.status = "toobig"; renderAcct(); toast("This save is too big to sync (over 1 MB). It’s still saved on this device."); return; }
  const edits = SB.edits;
  SB.busy = true; if (me0 === profile) { SB.status = "saving"; renderAcct(); }
  try {
    const {data:r, error} = await SB.client.rpc("put_save", {p_data:data, p_base:me0.sbVer || 0, p_device:sbDevice()});
    if (error) throw error;
    if (r && r.ok) {
      me0.sbVer = r.version; if (SB.edits === edits) me0.sbDirty = false; saveAccounts();
      if (me0 === profile) { SB.status = "synced"; sbAfterSync(); }
    } else if (me0 === profile) {   // another device saved first: let the player choose
      const c2 = await SB.client.from("saves").select("data, version, updated_at, device").eq("user_id", me0.sb).maybeSingle();
      if (c2.data) syncConflict(c2.data); else { me0.sbVer = 0; SB.again = true; }
    }
  } catch(e){ if (me0 === profile) SB.status = isAuthErr(e) ? "signedout" : "offline"; }
  finally {
    SB.busy = false; if (me0 === profile) renderAcct();
    if (SB.again) { SB.again = false; if (profile && profile.sb && profile.sbDirty) sbQueue(); }
  }
}
function syncConflict(cloud){
  SB.status = "conflict"; renderAcct();
  const here = saveSummary(persisted()), there = saveSummary(cloud.data), me0 = profile;
  const md = openModal(`<h3 class="mt" id="modalTitle">Which progress should we keep?</h3>
    <p>This device and your online account both changed since they last synced.</p>
    <div class="sync-pick">
      <button class="sync-opt" type="button" data-keep="here"><b>Keep this device’s progress</b><span>${sumHTML(here)}</span></button>
      <button class="sync-opt" type="button" data-keep="cloud"><b>Use the cloud progress</b><span>${sumHTML(there)}<br>Saved ${fmtAgo(Date.parse(cloud.updated_at))}${cloud.device ? " on " + esc(cloud.device) : ""}</span></button>
    </div>
    <p class="note">Nothing is lost silently: your account keeps its last 20 cloud saves. <button class="linkbtn" type="button" data-keep="backup">Download this device’s progress first</button></p>`);
  md.onclick = e => {
    const b = e.target.closest("[data-keep]"); if (!b || profile !== me0) return;
    if (b.dataset.keep === "backup") { exportSave(); return; }
    closeModal();
    if (b.dataset.keep === "cloud") { sbPull(cloud); toast("Loaded your cloud progress."); }
    else { me0.sbVer = cloud.version; me0.sbDirty = true; saveAccounts(); SB.status = "saving"; sbUpload(me0); toast("Your account now has this device’s progress."); }
  };
}
// after each sync (at most every 5 minutes): keep the profile's last-active time, icon and title fresh, update what
// friends see and collect Likes
function sbAfterSync(){
  if (!profile || !profile.sb || !SB.client) return;
  const now = Date.now(); if (now - SB.seen < 5*60e3) return; SB.seen = now;
  SB.client.from("profiles").update({last_active:new Date().toISOString(), icon:myIcon(), title:myTitle() || null}).eq("id", profile.sb).then(() => {}, () => {});
  friendsAfterSync();
}
document.addEventListener("visibilitychange", () => { if (document.hidden && profile && profile.sb && profile.sbDirty && SB.client) sbUpload(); });
addEventListener("online", () => { if (profile && profile.sb && SB.client) { if (SB.status === "offline") sbStart(); else if (profile.sbDirty) sbUpload(); } });
async function sbSignOut(m){
  const c = SB.client; if (!c) return;
  if (m && m.sbDirty) await sbUpload(m);
  try { await c.auth.signOut({scope:"local"}); } catch(e){}
  SB.user = null; SB.prof = null; SB.status = "local";
}

// ---- the online account menu ----
function openOnlineMenu(m){
  const st = {synced:"Synced with your online account", saving:"Saving to your online account…", checking:"Connecting…", offline:"Offline: saved on this device, syncs when you’re back online", signedout:"Signed out online: saved on this device", conflict:"Waiting for you to choose which progress to keep", toobig:"Too big to sync: saved on this device"}[SB.status] || "Saved on this device";
  const md = openModal(`
    <div class="acc-head"><div class="stage medal save-av">${m.avatar !== null && m.avatar !== undefined ? `<img class="tr" data-tr="${m.avatar}" alt="">` : ""}${m.icon && unlockOf("icon", m.icon) ? iconHTML(m.icon, "badge") : ""}</div>
      <div><h3 class="mt" id="modalTitle">${esc(m.uname || m.name)}</h3><span class="meta">${st}</span>${m.code ? `<span class="meta">Friend code <b class="fcode">${fmtCode(m.code)}</b></span>` : ""}</div></div>
    ${SB.status === "signedout" ? `<p class="note">Sign in again to sync this save.</p><div class="actions"><button class="btn primary" type="button" id="omIn">Sign in again</button></div>` : ""}
    <div class="actions"><button class="btn primary" type="button" id="omSwitch">Switch save file</button><button class="btn" type="button" id="omOut">Sign out</button></div>
    <div class="cov-h">Username</div>
    <form class="pin-edit" id="omName" autocomplete="off"><input id="omUn" maxlength="16" value="${esc(m.uname || "")}" aria-label="Username" spellcheck="false"><button class="btn sm" type="submit">Change</button></form>
    <p class="note">Friends find you by your username. You can change it once a week.</p>
    <p class="acc-err" id="omErr" role="alert" hidden></p>
    <div class="cov-h">Backup</div>
    <div class="actions left"><button class="btn sm" type="button" id="omExport">Download a backup</button><button class="btn sm" type="button" id="omData">Download my data</button></div>
    <p class="note">“Download my data” is everything your online account stores: profile, saves, friends and Likes.</p>
    <div class="cov-h">Danger zone</div>
    <button class="btn danger" type="button" id="omDel">Delete my online account</button>
    <p class="note">Deletes your profile, cloud saves and friends for good. This device keeps a local copy of your save.</p>`);
  const err = t => { const e = md.querySelector("#omErr"); e.textContent = t; e.hidden = !t; };
  md.querySelector("#omSwitch").onclick = () => { save(true); closeModal(); startStage.stop(); profile = null; accounts.current = null; saveAccounts(); ss.del(SESSKEY); showSignIn("list"); };
  md.querySelector("#omOut").onclick = () => { sbSignOut(m); signOut(); };
  const again = md.querySelector("#omIn"); if (again) again.onclick = () => { closeModal(); save(true); profile = null; accounts.current = null; saveAccounts(); showSignIn("list"); };
  md.querySelector("#omName").onsubmit = async e => {
    e.preventDefault();
    const v = md.querySelector("#omUn").value.trim(); if (v === m.uname) return;
    const p = unameProblem(v); if (p) { err(p); return; }
    if (!SB.client) { err("You’re offline. Try again when you’re connected."); return; }
    const {data, error} = await SB.client.rpc("claim_username", {p_name:v});
    if (error) { err(sbErrText(error)); return; }
    SB.prof = data; m.uname = data.username; saveAccounts(); err(""); renderAcct(); md.querySelector("#modalTitle").textContent = data.username; toast("Username updated.");
  };
  md.querySelector("#omExport").onclick = exportSave;
  md.querySelector("#omData").onclick = async () => {
    if (!SB.client) { err("You’re offline. Try again when you’re connected."); return; }
    const {data, error} = await SB.client.rpc("my_data");
    if (error) { err(sbErrText(error)); return; }
    const blob = new Blob([JSON.stringify({app:"dream-team-dex", kind:"account-data", exported:new Date().toISOString(), ...data}, null, 1)], {type:"application/json"});
    if (!(await saveFile(`dream-team-dex-account-${(m.uname || "me").toLowerCase()}-${todayKey()}.json`, blob))) toast("Couldn’t save the file here. Try another browser.");
  };
  md.querySelector("#omDel").onclick = async e => {
    const b = e.currentTarget;
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tap again to delete your online account for good"; return; }
    if (!SB.client) { err("You’re offline. Try again when you’re connected."); return; }
    b.disabled = true;
    const {error} = await SB.client.rpc("delete_my_account");
    if (error) { b.disabled = false; err(sbErrText(error)); return; }
    try { await SB.client.auth.signOut({scope:"local"}); } catch(x){}
    for (const k of ["sb", "sbVer", "sbDirty", "uname", "code"]) delete m[k];
    saveAccounts(); SB.user = null; SB.prof = null; SB.status = "local";
    closeModal(); renderAcct(); toast("Your online account is deleted. This device keeps a local copy of your save.");
  };
  paintAll(md);
}

// ---- boot: coming back from Google or an email link, or a session already on this device ----
async function sbBoot(){
  if (!CLOUD_ON) return;
  const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.slice(1)), fromAuth = q.has("code") || q.has("error_description") || h.has("access_token") || h.has("error_description");
  let hasToken = false; try { hasToken = Object.keys(localStorage).some(k => /^sb-.+-auth-token$/.test(k)); } catch(e){}
  if (!fromAuth && !hasToken && !accounts.list.some(p => p.sb)) return;
  const c = await sbLoad(); if (!c) return;
  c.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT" && profile && profile.sb) { SB.status = "signedout"; renderAcct(); } });
  let session = null; try { ({data:{session}} = await c.auth.getSession()); } catch(e){}
  if (fromAuth) {
    const why = q.get("error_description") || h.get("error_description");
    for (const k of ["code", "error", "error_code", "error_description", "state"]) q.delete(k);
    history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : ""));   // also drops the #access_token… part
    if (why) toast("Sign-in didn’t finish: " + why);
    if (session) sbOnSession(session.user);
  }
}

