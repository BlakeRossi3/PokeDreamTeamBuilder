// ================= SOUND (original chiptune, synthesized in the browser) =================
const Sound = (() => {
  let ctx = null, master, mus, fx, noiseBuf, pulse25, pulse12, timer = 0, want = null, cur = null, step = 0, nextT = 0;
  const hz = n => 440*Math.pow(2, (n - 69)/12);
  // tracks: 8 bars of eighth notes; chords give bass roots + arpeggio
  const TR = {
    title:{bpm:118, chords:[[48,52,55],[45,48,52],[41,45,48],[43,47,50],[48,52,55],[45,48,52],[41,45,48],[43,47,50]],
      lead:[76,79,84,83,81,79,76,79, 81,0,84,81,76,0,72,76, 77,81,84,81,79,77,76,77, 74,79,83,86,83,0,79,0, 76,79,84,0,86,84,83,84, 81,0,76,0,72,74,76,79, 77,0,81,0,84,0,81,79, 79,77,76,74,72,0,0,0]},
    battle:{bpm:168, chords:[[45,48,52],[41,45,48],[43,47,50],[40,44,47],[45,48,52],[41,45,48],[43,47,50],[40,44,47]], drive:true,
      lead:[81,0,81,79,81,0,76,0, 77,0,77,76,77,0,72,0, 79,0,79,77,79,0,74,0, 76,0,80,0,83,0,80,76, 81,84,88,84,81,0,76,79, 77,81,84,81,77,0,72,76, 79,83,86,83,79,0,74,77, 76,80,83,88,83,80,76,0]},
    home:{bpm:84, chords:[[48,52,55],[45,48,52],[41,45,48],[43,47,50],[48,52,55],[41,45,48],[43,47,50],[48,52,55]], soft:true,
      lead:[72,0,76,0,79,0,76,0, 72,0,0,0,74,0,72,0, 69,0,72,0,76,0,74,0, 72,0,0,0,0,0,0,0, 72,0,76,0,79,0,81,0, 79,0,77,0,76,0,74,0, 74,0,77,0,76,0,74,0, 72,0,0,0,0,0,0,0]},
    field:{bpm:100, chords:[[43,47,50],[40,43,47],[36,40,43],[38,42,45],[43,47,50],[40,43,47],[36,40,43],[38,42,45]],
      lead:[74,0,79,0,78,0,76,0, 71,0,76,0,74,0,71,0, 72,0,76,0,79,0,76,0, 74,0,78,0,81,0,0,0, 79,0,78,79,81,0,79,0, 76,0,74,76,79,0,0,0, 72,74,76,79,81,79,76,72, 74,76,78,81,74,0,0,0]},
  };
  const JINGLE = {
    victory:{bpm:150, notes:[[72,1],[76,1],[79,1],[84,3],[79,1],[84,5]]},
    badge:{bpm:160, notes:[[79,1],[83,1],[86,1],[91,3],[0,1],[86,1],[91,5]]},
    ach:{bpm:180, notes:[[76,1],[79,1],[84,1],[88,4]]},
    lose:{bpm:110, notes:[[72,2],[71,2],[69,2],[65,5]]},
    shiny:{bpm:240, notes:[[88,1],[91,1],[96,1],[100,1],[96,1],[100,4]]},
  };
  function init(){
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ctx = new AC(); } catch(e){ return false; }
    master = ctx.createGain(); master.connect(ctx.destination);
    mus = ctx.createGain(); fx = ctx.createGain(); mus.connect(master); fx.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate*.5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1;
    const mk = duty => { const n = 32, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) im[k] = 2/(k*Math.PI)*Math.sin(k*Math.PI*duty); return ctx.createPeriodicWave(re, im); };
    pulse25 = mk(.25); pulse12 = mk(.125);
    vol(); return true;
  }
  function vol(){ if (!ctx) return; const u = state.ui; master.gain.value = u.sound ? 1 : 0; mus.gain.value = (u.music/100)*.16; fx.gain.value = (u.sfx/100)*.3; }
  function tone(dest, t, f, dur, type = "square", v = .5, slide = 0){
    const o = ctx.createOscillator(), g = ctx.createGain();
    if (type === "p25") o.setPeriodicWave(pulse25); else if (type === "p12") o.setPeriodicWave(pulse12); else o.type = type;
    o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f*slide), t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + .006); g.gain.setValueAtTime(v, t + dur*.6); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + .03);
  }
  function noise(dest, t, dur, v, hp = 1000){
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = hp;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + dur + .02);
  }
  function schedule(){
    if (!ctx || !cur) return;
    const T = TR[cur], spb = 60/T.bpm/2;
    while (nextT < ctx.currentTime + .2) {
      const bar = Math.floor(step/8) % 8, s8 = step % 8, ch = T.chords[bar], ln = T.lead[(step) % T.lead.length];
      if (ln) tone(mus, nextT, hz(ln), spb*(T.soft ? 1.6 : .92), T.soft ? "triangle" : "p25", T.soft ? .55 : .5);   // soft: the calm Home track
      tone(mus, nextT, hz(ch[(s8) % 3] + 12), spb*.5, T.soft ? "sine" : "p12", T.soft ? .22 : .16);
      const root = ch[0] - 12;
      if (T.drive) tone(mus, nextT, hz(s8 % 2 ? root + 12 : root), spb*.8, "triangle", .8);
      else if (s8 % 2 === 0) tone(mus, nextT, hz(s8 % 4 === 0 ? root : root + 7), spb*1.6, "triangle", .8);
      if (T.drive) { if (s8 % 4 === 0) tone(mus, nextT, 150, .09, "sine", .9, .3); if (s8 % 4 === 2) noise(mus, nextT, .09, .45, 1800); noise(mus, nextT, .03, .18, 7000); }
      else if (s8 % 2 === 1 && !T.soft) noise(mus, nextT, .03, .12, 7000);
      nextT += spb; step++;
    }
  }
  function startMusic(){
    clearInterval(timer); cur = null;
    if (!ctx || !want || !state.ui.sound || !state.ui.music || document.hidden) return;
    cur = want; step = 0; nextT = ctx.currentTime + .06; schedule(); timer = setInterval(schedule, 50);
  }
  function music(name){ if (want === name && (cur === name || !ctx)) return; want = name; startMusic(); }
  function unlock(){ if (!init()) return; if (ctx.state === "suspended") ctx.resume(); if (want && cur !== want) startMusic(); }
  ["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, unlock, {capture:true}));
  document.addEventListener("visibilitychange", () => { if (document.hidden) { clearInterval(timer); cur = null; } else startMusic(); });
  function play(name){
    if (!ctx || !state.ui.sound || !state.ui.sfx) return;
    const t = ctx.currentTime + .01;
    switch (name) {
      case "select": tone(fx, t, 1320, .05, "p25", .4); break;
      case "back": tone(fx, t, 700, .08, "p25", .4, .7); break;
      case "confirm": tone(fx, t, 988, .06, "p25", .4); tone(fx, t + .06, 1480, .09, "p25", .4); break;
      case "add": tone(fx, t, 880, .05, "p12", .35); tone(fx, t + .045, 1175, .07, "p12", .35); break;
      case "remove": tone(fx, t, 660, .06, "p12", .35, .6); break;
      case "hit": noise(fx, t, .13, .7, 600); tone(fx, t, 220, .12, "square", .4, .4); break;
      case "super": noise(fx, t, .2, .9, 400); tone(fx, t, 330, .18, "square", .5, .3); tone(fx, t + .08, 160, .14, "square", .4, .5); break;
      case "weak": noise(fx, t, .08, .4, 1500); break;
      case "faint": tone(fx, t, 700, .55, "p25", .45, .12); break;
      case "heal": [0, 4, 7, 12].forEach((s, i) => tone(fx, t + i*.05, hz(76 + s), .07, "p12", .35)); break;
      case "up": tone(fx, t, 440, .22, "p25", .35, 2.2); break;
      case "down": tone(fx, t, 880, .22, "p25", .35, .45); break;
      case "right": tone(fx, t, 988, .08, "p25", .45); tone(fx, t + .08, 1319, .14, "p25", .45); break;
      case "wrong": tone(fx, t, 196, .28, "square", .4, .85); break;
      case "send": noise(fx, t, .16, .4, 3000); tone(fx, t + .05, 520, .12, "p25", .3, 1.8); break;
      case "step": noise(fx, t, .025, .12, 2500); break;
      case "door": noise(fx, t, .06, .18, 900); tone(fx, t + .02, 300, .09, "square", .22, .7); tone(fx, t + .1, 200, .06, "square", .18, .8); break;
      case "crackle": noise(fx, t, .03, .1, 3000); noise(fx, t + .05 + Math.random()*.08, .02, .08, 4000); break;
      case "splash": noise(fx, t, .22, .25, 1800); tone(fx, t, 900, .1, "p12", .12, .5); break;
      case "pick": tone(fx, t, 1047, .05, "p12", .3); tone(fx, t + .05, 1568, .08, "p12", .3); break;
      case "encounter": tone(fx, t, 1047, .05, "p25", .4); tone(fx, t + .06, 1319, .05, "p25", .4); tone(fx, t + .12, 1568, .08, "p25", .4); break;
      default: {
        const J = JINGLE[name]; if (!J) return; const sp = 60/J.bpm/2; let tt = t;
        for (const [n, len] of J.notes) { if (n) { tone(fx, tt, hz(n), sp*len*.95, "p25", .5); tone(fx, tt, hz(n - 12), sp*len*.95, "triangle", .5); } tt += sp*len; }
        if (name === "shiny") for (let i = 0; i < 6; i++) noise(fx, t + i*.07, .05, .25, 8000);
      }
    }
  }
  return {music, play, vol, init:unlock, refresh:startMusic, _want:null};
})();

// ---------- state ----------
const KEY = "dreamteamdex.v1", UIKEY = "dreamteamdex.ui";
const freshState = () => ({order:[],mode:"3d", shiny:false, team:"g1", teams:{g1:[6,9,25,94,131,143], all:[6,248,445,887,1007,149]}, teamShiny:{all:[445]}, trainers:{}, scenes:{}, favs:[], name:"", hidden:[], sample:true, members:{}, notes:{}, custom:[], games:freshGames(), ui:freshUI()});
let state = {...freshState(), q:"", type:null, sort:"dex", f:F0(), fOpen:false, covOpen:false, teamOpen:true};
let VISIT = null;   // while showing a friend's things: their sandbox state is in `state` (see FRIENDS)
const legacyId = k => /^\d$/.test(k) ? (k === "0" ? "all" : "g" + k) : k;
const remap = o => { const r = {}; if (o && typeof o === "object") for (const [k,v] of Object.entries(o)) if (TEAM_BY.has(legacyId(k))) r[legacyId(k)] = v; return r; };
const remapScenes = o => { const r = {}; if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { const [b, m] = k.split("~"), id = legacyId(b); if (TEAM_BY.has(id) && (!m || m === "2d")) r[m ? id + "~2d" : id] = v; } return r; };
function applySaved(s){
  if (!s || typeof s !== "object") return;
  try { s = JSON.parse(JSON.stringify(s)); } catch(e){ return; }
  state.custom = cleanCustom(s.custom); rebuildTeams();
  if (s.mode === "2d" || s.mode === "3d") state.mode = s.mode;
  state.shiny = !!s.shiny;
  if (typeof s.team === "string" && TEAM_BY.has(s.team)) state.team = s.team;
  else if (Number.isInteger(s.gen) && s.gen >= 0 && s.gen <= 9) state.team = legacyId(String(s.gen));
  if (s.teams && typeof s.teams === "object") state.teams = remap(s.teams);
  state.teamShiny = remap(s.teamShiny);
  state.trainers = remap(s.trainers);
  if (s.trv !== 2) for (const k of Object.keys(state.trainers)) { const nm = OLD_TRAINERS[state.trainers[k]]; const ni = TR_BY_NAME.get(nm); if (ni === undefined) delete state.trainers[k]; else state.trainers[k] = ni; }
  state.favs = Array.isArray(s.favs) ? s.favs.filter(Number.isInteger) : [];
  state.name = typeof s.name === "string" ? s.name.slice(0,16) : "";
  state.hidden = Array.isArray(s.hidden) ? s.hidden.filter(id => TEAM_BY.has(id)) : [];
  state.sample = !!s.sample;
  state.scenes = remapScenes(s.scenes);
  state.order = Array.isArray(s.order) ? s.order.filter(id => TEAM_BY.has(id)) : [];
  state.members = {};
  for (const [id, o] of Object.entries(remap(s.members))) { if (!o || typeof o !== "object") continue; const r = {}; for (const [k, v] of Object.entries(o)) { const c = cleanMember(v, +k); if (c && NAT_BY.has(+k)) r[k] = c; } state.members[id] = r; }
  state.notes = {};
  for (const [id, o] of Object.entries(remap(s.notes))) if (o && typeof o === "object") state.notes[id] = {text:String(o.text || "").slice(0, 600), stars:Math.max(0, Math.min(5, o.stars | 0))};
  state.games = cleanGames(s.games);
  state.ui = cleanUI(s.ui); if (!VISIT) applyUI();
  fixCurrent(); if (!VISIT) ecoMigrate();
}
const persisted = () => VISIT ? VISIT.snap : ({v:7, trv:2, ui:state.ui, custom:state.custom, members:state.members, notes:state.notes, games:state.games, order:state.order, scenes:state.scenes, mode:state.mode, shiny:state.shiny, team:state.team, teams:state.teams, teamShiny:state.teamShiny, trainers:state.trainers, favs:state.favs, name:state.name, hidden:state.hidden, sample:state.sample});
function orderedTeams(){ const seen = new Set(), out = []; for (const id of (state.order || [])) if (TEAM_BY.has(id) && !seen.has(id)) { seen.add(id); out.push(TEAM_BY.get(id)); } for (const t of TEAMS) if (!seen.has(t.id)) out.push(t); return out; }
function moveInList(list, fromId, toId, after){ const a = list.filter(x => x !== fromId); let i = a.indexOf(toId); if (i < 0) return list; if (after) i++; a.splice(i, 0, fromId); return a; }
const visibleTeams = () => orderedTeams().filter(t => !state.hidden.includes(t.id));
function fixCurrent(){ if (state.hidden.includes(state.team) || !TEAM_BY.has(state.team)) state.team = (visibleTeams()[0] || TEAMS[0]).id; }
try { const u = JSON.parse(localStorage.getItem(UIKEY) || "null"); if (u){ state.sort = u.sort || "dex"; state.covOpen = !!u.covOpen; state.teamOpen = u.teamOpen !== false; if (u.f) state.f = cleanF(u.f); } } catch(e){}
function saveUI(){ try { localStorage.setItem(UIKEY, JSON.stringify({sort:state.sort, covOpen:state.covOpen, teamOpen:state.teamOpen, f:state.f})); } catch(e){} }
let saveWarned = false;
function save(){
  if (VISIT) return;   // looking at a friend's things: nothing of theirs is ever saved
  checkAch();
  if (!profile || profile.guest) return;
  try { localStorage.setItem(PKEY(profile.id), JSON.stringify(persisted())); saveWarned = false; }
  catch(e){ if (!saveWarned) { saveWarned = true; toast(profile.cloud ? "This device’s storage is full. Your progress still syncs to claude.ai." : "Couldn’t save: this browser’s storage is full. Download a backup from your account menu."); } }
  if (profile.sb && !SB.quiet) { profile.sbDirty = true; SB.edits++; }
  touchMeta();
  if (profile.cloud) queueRemote();
  if (profile.sb && !SB.quiet) sbQueue();
}

const G = () => TEAM_BY.get(state.team);
const teamOf = id => { const T = TEAM_BY.get(id); return T ? (state.teams[id] || []).filter(n => T.byNum.has(n)).slice(0, T.size || MAX) : []; };
const team = () => teamOf(state.team);
const isShinyMember = (id,n) => (state.teamShiny[id] || []).includes(n);
const trainerOf = id => { const i = state.trainers[id]; return Number.isInteger(i) && i >= 0 && i < TRAINERS.length ? i : (TR_BY_NAME.get(TEAM_BY.get(id).tr) ?? 0); };
const isFav = n => state.favs.includes(n);
function touched(){ state.sample = false; }

// ---------- sprite packs ----------
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const packs = new Map(), waiting = new Map();
const progEl = $("progress"), progBar = $("progBar"), progText = $("progText");
function ensurePack(key){
  if (packs.has(key)) return packs.get(key).promise;
  const p = {urls:null, bytes:null, loaded:0, total:0};
  p.promise = (async () => {
    const url = packUrl(key[0] === "t" ? `t/${key.slice(1)}.wasm` : `s/${key}.wasm`);
    let res;
    for (let tries = 0; ; tries++) {   // retry flaky networks twice before giving up
      try { res = await fetch(url); if (res.ok) break; if (res.status < 500) throw new Error(res.status); } catch(e){ if (tries >= 2) throw e; }
      if (tries >= 2) throw new Error(res ? res.status : "network");
      await new Promise(r => setTimeout(r, 600*(tries + 1)));
    }
    p.total = +res.headers.get("content-length") || 0;
    let buf;
    if (res.body && p.total) {
      const reader = res.body.getReader(), chunks = [];
      for(;;){ const {done, value} = await reader.read(); if (done) break; chunks.push(value); p.loaded += value.length; updateProgress(); }
      buf = new Uint8Array(p.loaded); let o = 0; for (const c of chunks){ buf.set(c,o); o += c.length; }
    } else buf = new Uint8Array(await res.arrayBuffer());
    const urls = new Map(), bytes = new Map();
    // kind 3 = shiny stored as a recoloured palette for the matching normal GIF
    const base = IDX[key].some(e => e[3] === 3) ? await ensurePack(key.replace(/^([a-z0-9]+?)s-/, "$1-")) : null;
    for (const [id, off, len, kind] of IDX[key]) {
      let b = buf.subarray(off, off+len), gif = kind;
      if (kind === 3) { const nb = base && base.bytes.get(id); if (!nb) continue; const c = new Uint8Array(nb.b); c.set(b, 13); b = c; gif = 1; }
      bytes.set(id, {b, kind:gif});
      urls.set(id, URL.createObjectURL(new Blob([b], {type: MIME[gif] || "image/png"})));
    }
    p.bytes = bytes; p.urls = urls; updateProgress(); return p;
  })().catch(err => { packs.delete(key); updateProgress(); throw err; });
  packs.set(key, p);
  return p.promise;
}
function updateProgress(){
  let l = 0, t = 0, n = 0;
  for (const p of packs.values()) if (!p.urls) { l += p.loaded; t += p.total; n++; }
  if (!n) { progEl.hidden = true; return; }
  progEl.hidden = false;
  const pct = t ? Math.min(100, Math.round(l / t * 100)) : 0;
  progBar.style.width = pct + "%";
  progText.textContent = `Loading sprites · ${pct}%`;
}
const imgMode = img => img.dataset.mode || state.mode;
const spKey = (num, sh, mode) => num > 1025 ? `${mode}${sh ? "s" : ""}-f${Math.floor(FORM_IDX.get(num)/CH)}` : `${mode}${sh ? "s" : ""}-${Math.floor((num-1)/CH)}`;
const hdKey = (num, sh) => sh ? spKey(num, true, "3d") : num > 1025 ? `h-f${Math.floor(FORM_IDX.get(num)/CH)}` : `h-${Math.floor((num-1)/CH)}`;
function keyFor(img){
  const mode = imgMode(img);
  if (img.dataset.ltr !== undefined) return "tl";
  if (img.dataset.tr !== undefined) return mode === "3d" && img.dataset.full ? "t3f" : "t" + mode;
  const n = +img.dataset.num, sh = img.dataset.sh === "1" || state.shiny;
  if (img.dataset.hd && mode === "3d") return hdKey(n, sh);
  if (img.dataset.back && mode === "3d" && hasBack(n, sh)) return spKey(n, sh, "3db");   // the player's side in battle
  return spKey(n, sh, mode);
}
function urlFor(img){
  const p = packs.get(keyFor(img));
  return p && p.urls ? p.urls.get(img.dataset.ltr !== undefined ? +img.dataset.ltr : img.dataset.tr !== undefined ? +img.dataset.tr : +img.dataset.num) || null : null;
}
let errToastAt = 0;
function paintImg(img){
  const url = urlFor(img), st = img.parentElement;
  if (url) { if (img.getAttribute("src") !== url) img.src = url; st && st.classList.remove("loading"); return; }
  img.removeAttribute("src"); st && st.classList.add("loading");
  const key = keyFor(img);
  let set = waiting.get(key); if (!set) { set = new Set(); waiting.set(key, set); }
  set.add(img);
  ensurePack(key).then(() => {
    const s = waiting.get(key); waiting.delete(key);
    if (s) s.forEach(im => { if (im.isConnected && urlFor(im)) paintImg(im); });
  }).catch(() => {
    const s = waiting.get(key); waiting.delete(key);
    if (s) s.forEach(im => im.parentElement && im.parentElement.classList.remove("loading"));
    if (Date.now() - errToastAt > 8000) { errToastAt = Date.now(); toast("Some sprites didn’t load. Switch tabs or modes to try again."); }
  });
}
function paintAll(root = document){
  root.querySelectorAll("img[data-num], img[data-tr], img[data-ltr]").forEach(img => {
    if (img.closest(".grid") && !img.dataset.seen) return;
    paintImg(img);
  });
}
// profile icons: sprites sit anywhere in their frame, so centre and size each badge on the Pokémon's own pixels
const iconBox = new Map();   // image URL -> visible bounding box
function fitIcon(img){
  let bb = iconBox.get(img.src);
  if (!bb) {
    try {
      const W = img.naturalWidth, H = img.naturalHeight, c = mkCanvas(W, H), x = c.getContext("2d", {willReadFrequently:true}); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) if (d[(y*W + i)*4 + 3] > 24) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return;
      bb = {W, H, cx:(x0 + x1 + 1)/2, cy:(y0 + y1 + 1)/2, m:Math.max(x1 - x0 + 1, y1 - y0 + 1)}; iconBox.set(img.src, bb);
    } catch(e){ return; }
  }
  const k = 88/bb.m;   // the Pokémon fills 88% of the badge; percentages keep it right at every badge size
  Object.assign(img.style, {position:"absolute", maxWidth:"none", margin:"0", width:bb.W*k + "%", height:bb.H*k + "%", left:50 - bb.cx*k + "%", top:50 - bb.cy*k + "%"});
}
// Pokémon sprites come in frames with room for wings and tails to move, so fitting the whole frame to a box makes
// wide-winged Pokémon look tiny. Fit the visible body instead: its height decides the size (never above native),
// wing tips may use up to 30% more than the box's width (the card clips them), and it stands centred on the box's floor.
const bodyBox = new Map();   // image URL -> visible bounds in the first frame
function bodyOf(img){
  let bb = bodyBox.get(img.src); if (bb !== undefined) return bb;
  try {
    const W = img.naturalWidth, H = img.naturalHeight, c = mkCanvas(W, H), x = c.getContext("2d", {willReadFrequently:true}); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) if (d[(y*W + i)*4 + 3] > 24) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    bb = x1 >= x0 ? {x:x0, y:y0, w:x1 - x0 + 1, h:y1 - y0 + 1} : null;
  } catch(e) { bb = null; }
  if (bodyBox.size > 600) bodyBox.clear(); bodyBox.set(img.src, bb); return bb;
}
function fitBody(img){
  const st = img.parentElement, bb = st && img.naturalWidth && bodyOf(img); if (!bb) return;
  const W = img.naturalWidth, H = img.naturalHeight, boxW = st.clientWidth, boxH = st.clientHeight - 2; if (boxW < 8 || boxH < 8) return;
  const s = Math.min(1, boxH/(bb.h*1.04), boxW*1.3/bb.w), mirror = /^matrix\(-1/.test(getComputedStyle(img).transform);
  Object.assign(img.style, {maxWidth:"none", maxHeight:"none", width:W*s + "px", height:H*s + "px",
    left:((W/2 - (bb.x + bb.w/2))*s*(mirror ? -1 : 1)).toFixed(1) + "px", marginBottom:(-(H - (bb.y + bb.h))*s).toFixed(1) + "px"});
}
document.addEventListener("load", e => {
  const img = e.target;
  if (img instanceof HTMLImageElement && img.closest(".picon")) { fitIcon(img); return; }
  if (img instanceof HTMLImageElement && img.classList.contains("spr") && img.dataset.num && (img.closest(".slot, .card, .vt-slot") || (img.closest(".bt-mon") && imgMode(img) !== "2d"))) { fitBody(img); return; }
  if (!(img instanceof HTMLImageElement) || !img.dataset.zoom) return;
  const slot = img.closest(".bt-mon");
  if (slot && imgMode(img) === "2d") { const k = Math.max(1, Math.min(2, Math.floor(Math.min(slot.clientWidth/img.naturalWidth, slot.clientHeight/img.naturalHeight)*2)/2)); img.style.width = Math.round(img.naturalWidth*k) + "px"; return; }
  img.style.width = (imgMode(img) === "2d") ? Math.min(img.naturalWidth * (+img.dataset.zoom || 2), 320) + "px" : "";   // 3D: native size
}, true);

const typeBadges = types => `<div class="types">${types.map(t => `<span class="tb" style="${tStyle(t)}">${t}</span>`).join("")}</div>`;
const spr = (num, {sh=false, mode="", zoom=false}={}) => `<div class="stage"><img class="spr" data-num="${num}"${sh?' data-sh="1"':""}${mode?` data-mode="${mode}"`:""}${zoom?' data-zoom="2"':""} alt="" draggable="false"></div>`;
const trImg = (i, mode="") => `<div class="stage medal"><img class="tr" data-tr="${i}"${mode?` data-mode="${mode}"`:""} alt="" draggable="false"></div>`;

// ---------- START ----------
function showStart(){
  if (!profile) { showSignIn(); return; }
  leaveScreen(); hideTip(); closeModal(); hideSignIn();
  if (!$("hof").hidden) closeHof(); if (!$("view").hidden) closeView();
  document.documentElement.dataset.view = "start"; document.documentElement.dataset.mode = state.mode;
  $("app").hidden = true; $("screen").hidden = true; $("start").hidden = false; nav.screen = null;
  renderStartUI(); renderSoundBtns(); setMusic("title"); if (sceneOf("all").intro && !startStage.running) startStage.playIntro(); startStage.start(); scrollTo(0,0);
}
function enterApp(mode, teamId){
  leaveScreen(); startStage.stop(); nav.screen = null; $("screen").hidden = true; setMusic(null);
  if (mode && mode !== state.mode) { state.mode = mode; save(); }
  if (teamId) { if (state.hidden.includes(teamId)) state.hidden = state.hidden.filter(x => x !== teamId); state.team = teamId; }
  document.documentElement.dataset.view = "app";
  $("start").hidden = true; $("app").hidden = false;
  renderAll(); scrollTo(0,0);
}
$("playBtn").addEventListener("click", () => { Sound.play("confirm"); showHub(); });
$("startEdit").addEventListener("click", () => enterApp(null, "all"));
$("startScene").addEventListener("click", () => { enterApp(null, "all"); openHof(); });
$("homeBtn").addEventListener("click", () => { Sound.play("back"); showHub(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && document.documentElement.dataset.view === "hub" && $("modalWrap").hidden) showStart(); });

// ---------- APP RENDER ----------
function renderMode(){
  document.documentElement.dataset.mode = state.mode;
  $("m2d").setAttribute("aria-pressed", state.mode === "2d");
  $("m3d").setAttribute("aria-pressed", state.mode === "3d");
  $("shinyBtn").setAttribute("aria-pressed", state.shiny);
}
function renderTabs(){
  const vis = visibleTeams();
  const tab = t => { const n = teamOf(t.id).length, z = sizeOf(t.id);
    return `<button class="tab${t.kind === "theme" ? " theme" : ""}${t.custom ? " custom" : ""}" type="button" data-team="${t.id}" data-sid="${t.id}" aria-current="${t.id === state.team}" title="${t.custom ? esc(t.blurb) + " · drag to reorder" : "Drag to reorder"}">
      <span class="num">${t.small}</span><span class="reg">${esc(t.big)}</span>
      <span class="dots${z > 6 ? " many" : ""}" aria-label="${n} of ${z} picked">${Array.from({length:z}, (_,i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span></button>`; };
  $("tabs").innerHTML = vis.map(tab).join("") + `<button class="tab-edit new" type="button" id="newTeam" title="Make a team with your own rules">＋ New team</button><button class="tab-edit" type="button" id="editTabs" title="Show, hide and reorder teams">⚙ Edit tabs</button>`;
  const cur = $("tabs").querySelector('[aria-current="true"]');
  if (cur) cur.scrollIntoView({block:"nearest", inline:"nearest"});
  tabFade();
}
// fade the ends of the team tab rail when more tabs are hidden that way
function tabFade(){ const w = $("tabs").parentElement; w.classList.toggle("fl", w.scrollLeft > 2); w.classList.toggle("fr", w.scrollLeft + w.clientWidth < w.scrollWidth - 2); }
$("tabs").parentElement.addEventListener("scroll", tabFade, {passive:true}); addEventListener("resize", tabFade);
function renderLayout(){
  $("layout").classList.toggle("closed", !state.teamOpen);
}
function renderTeam(){
  const t = team(), T = G(), tr = trainerOf(state.team);
  $("teamH").textContent = T.title;
  const Z = sizeOf(state.team);
  $("teamCount").textContent = `${t.length} / ${Z}`;
  $("randomBtn").textContent = Z === 6 ? "Random six" : "Random team";
  $("slots").classList.toggle("many", Z > 6);
  $("trow").innerHTML = `${trImg(tr)}<div class="tinfo"><span class="k">Trainer</span><b>${esc(TRAINERS[tr])}</b><button class="btn sm" type="button" id="pickTrainer">Change trainer</button></div>
    <div class="tbtns"><button class="btn primary" type="button" id="viewBtn">⛶ View team</button><button class="btn sm" type="button" id="hofBtn">🏆 Hall of Fame</button></div>`;
  let html = "";
  for (let i = 0; i < Z; i++){
    const m = T.byNum.get(t[i]);
    if (!m) { html += `<div class="slot empty"><span class="ghost" aria-hidden="true"></span><span>Slot ${i+1}</span></div>`; continue; }
    const sh = isShinyMember(state.team, m.num);
    const hi = memberOf(state.team, m.num).item;
    html += `<div class="slot" data-num="${m.num}" data-sid="${m.num}" title="Tap for moves, item and stats · drag to reorder">${hi ? `<span class="slot-item" title="Holding ${esc(hi)}">${itemIcon(hi)}</span>` : ""}${friendOf(m.num) >= 100 ? `<span class="slot-ribbon" title="Friendship ribbon: best friends in your Home">${RIBBON_SVG}</span>` : ""}
      <button class="info" type="button" data-info="${m.num}" aria-label="${esc(m.name)} stats">i</button>
      <button class="x" type="button" data-remove="${m.num}" aria-label="Remove ${esc(m.name)}">✕</button>
      ${spr(m.num, {sh})}<span class="nm" title="${esc(nickOf(state.team, m.num) === m.name ? m.name : nickOf(state.team, m.num) + " (" + m.name + ")")}">${ballImg(ballOf(state.team, m.num))}<span class="nt${nickOf(state.team, m.num).length > 12 ? " xl" : nickOf(state.team, m.num).length > 8 ? " l" : nickOf(state.team, m.num).length > 6 ? " m" : ""}">${esc(nickOf(state.team, m.num))}</span>${sh || state.shiny ? '<span class="shiny-mark" title="Shiny">✦</span>' : ""}</span></div>`;
  }
  $("slots").innerHTML = html;
  $("clearBtn").disabled = !t.length; renderUndo();
  paintAll($("trow")); paintAll($("slots"));
  renderParty(); renderCoverage();
}
function renderParty(){
  const t = team(), T = G();
  let minis = "";
  for (let i = 0; i < sizeOf(state.team); i++) {
    const m = T.byNum.get(t[i]);
    minis += m ? `<button class="mini" type="button" data-info="${m.num}" aria-label="${esc(m.name)}">${spr(m.num, {sh:isShinyMember(state.team, m.num)})}</button>` : `<span class="mini empty" aria-hidden="true"></span>`;
  }
  $("party").innerHTML = `<span class="pl">${esc(T.card)} team · ${t.length}/${sizeOf(state.team)}</span><div class="minis">${minis}</div>
    <button class="btn sm" type="button" id="partyToggle">${state.teamOpen ? "Hide team" : "Show team"}</button>`;
  paintAll($("party"));
}
function coverage(){
  const T = G(), members = team().map(n => T.byNum.get(n));
  const def = T.types.map(atk => {
    let weak = 0, resist = 0;
    for (const m of members){ const e = eff(atk, m.types, T.chart); if (e >= 2) weak++; else if (e < 1) resist++; }
    return {atk, weak, resist};
  });
  const atkTypes = m => { const mv = movesOf(state.team, m.num).filter(isDmg); return mv.length ? mv.map(x => x[1]) : m.types; };
  const usesMoves = members.some(m => movesOf(state.team, m.num).some(isDmg));
  const atk = new Set(members.flatMap(atkTypes));
  const off = T.types.map(d => ({d, hit: [...atk].some(a => (T.chart[d] || {})[a] >= 2)}));
  return {members, def, off, usesMoves};
}
const sev = c => (c.weak >= 3 && c.resist === 0) || (c.weak - c.resist >= 3) ? 2 : (c.weak > c.resist && c.weak >= 2) ? 1 : 0;
function renderCoverage(){
  const T = G(), {members, def, off, usesMoves} = coverage();
  $("covToggle").setAttribute("aria-expanded", state.covOpen);
  $("covBody").hidden = !state.covOpen;
  if (!members.length){
    $("covSum").innerHTML = `<span class="pill mute">No team yet</span>`;
    $("covBody").innerHTML = `<p class="meta" style="margin:0">Add Pokémon to see which attacking types your team is weak to, and which types your STAB moves hit super-effectively.</p>`;
    return;
  }
  const worst = def.filter(c => sev(c) === 2).sort((a,b) => (b.weak-b.resist)-(a.weak-a.resist));
  const warn = def.filter(c => sev(c) === 1);
  const hit = off.filter(o => o.hit).length;
  $("covSum").innerHTML = worst.length ? `<span class="pill bad">Weak to ${worst[0].atk}${worst.length > 1 ? ` +${worst.length-1}` : ""}</span>`
    : warn.length ? `<span class="pill warn">Watch ${warn[0].atk}${warn.length > 1 ? ` +${warn.length-1}` : ""}</span>`
    : `<span class="pill good">Balanced</span>`;
  let verdict;
  if (worst.length) verdict = `${worst.map(c=>`<b>${c.atk}</b> (${c.weak} weak, ${c.resist} resist)`).join(", ")}. Consider a Pokémon that resists ${worst.length>1?"these":"it"}.`;
  else if (warn.length) verdict = `${warn.map(c=>`<b>${c.atk}</b>`).join(", ")} ${warn.length>1?"hit":"hits"} more of your team than ${warn.length>1?"they're":"it's"} resisted by.`;
  else verdict = `No attacking type hits more of your team than it’s resisted by.`;
  const probs = (worst.length ? worst : warn).map(c => c.atk), sug = team().length < sizeOf(state.team) ? suggestFor(T, members, probs) : [];
  $("covBody").innerHTML = `
    <div class="verdict"><p>${verdict}</p>${sug.length ? `<div class="sug-row"><span class="meta">Good fits:</span>${sug.map(m => `<button class="sug" type="button" data-sug="${m.num}" title="Add ${esc(m.name)} · ${m.types.join("/")}">${m.types.map(t => `<i style="${tStyle(t)}"></i>`).join("")}${esc(m.name)}</button>`).join("")}</div>` : ""}</div>
    <div class="cov-h">Defense · attacks your team takes</div>
    <div class="matrix">${def.map(c => `<div class="cell sev${sev(c)}" title="${c.atk}: ${c.weak} weak, ${c.resist} resist or immune">
      <span class="ab" style="${tStyle(c.atk)}">${ABBR(c.atk)}</span>
      <span class="ct"><span class="${c.weak?"w":"z"}">▲${c.weak}</span><span class="${c.resist?"r":"z"}">▼${c.resist}</span></span></div>`).join("")}</div>
    <div class="legend"><span><b style="color:var(--bad)">▲</b> members weak</span><span><b style="color:var(--good)">▼</b> resist or immune</span><span>${T.rules} rules</span></div>
    <div class="cov-h">Offense · ${usesMoves ? "your moves hit super-effectively" : "STAB super-effective"}</div>
    <div><b>${hit}</b> of ${T.types.length} types</div>
    <div class="bar-off"><i style="width:${hit/T.types.length*100}%"></i></div>
    ${hit < T.types.length ? `<div class="meta" style="margin-bottom:6px">Not covered:</div><div class="uncov">${off.filter(o=>!o.hit).map(o=>`<span class="tb" style="${tStyle(o.d)}">${o.d}</span>`).join("")}</div>` : `<p class="meta" style="margin:0">Every type takes super-effective damage from one of your ${usesMoves ? "attacks" : "STAB types"}.</p>`}
    ${usesMoves ? `<p class="note">Uses the damaging moves you picked. Pokémon without moves count their own types.</p>` : ""}`;
}
// up to four Pokémon from this Pokédex that resist the team's problem types without being weak to any of them
function suggestFor(T, members, probs){
  if (!probs.length) return [];
  const have = new Set(members.map(m => m.num)), bases = new Set(members.map(m => baseOf(m.num))), legendTeam = T.kind === "theme" || members.some(m => isLegend(m.num));
  const scored = [];
  for (const m of T.mons) {
    if (have.has(m.num) || bases.has(baseOf(m.num)) || !isFE(m.num) || (!legendTeam && isLegend(m.num))) continue;
    let sc = 0, bad = false;
    for (const a of probs) { const e = eff(a, m.types, T.chart); if (e > 1) { bad = true; break; } sc += e === 0 ? 14 : e < 1 ? 10 : 0; }
    if (bad || !sc) continue;
    scored.push([sc + bst(m)/60 + ((m.num*7919) % 13)/6, m]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const out = [], seen = new Set();
  for (const [, m] of scored) { if (seen.has(baseOf(m.num))) continue; seen.add(baseOf(m.num)); out.push(m); if (out.length === 4) break; }
  return out;
}
$("covBody").addEventListener("click", e => { const b = e.target.closest("[data-sug]"); if (!b) return; if (toggle(+b.dataset.sug)) toast(`Added ${monName(+b.dataset.sug)}.`, {undo:true}); });
$("covToggle").addEventListener("click", () => { state.covOpen = !state.covOpen; saveUI(); renderCoverage(); });

function renderChips(){
  const T = G();
  const CT = T.chipTypes || T.types;
  if (state.type && !CT.includes(state.type)) state.type = null;
  $("chips").innerHTML = `<button class="chip all" type="button" data-type="" aria-pressed="${!state.type}">All types</button>` +
    CT.map(t => `<button class="chip" type="button" data-type="${t}" style="${tStyle(t)}" aria-pressed="${state.type===t}">${t}</button>`).join("");
  $("sort").value = state.sort;
  renderFilters();
}
function filtered(){
  const q = state.q.trim().toLowerCase().replace(/^#/,"");
  const fc = filterCtx();
  const qType = TYPE_ORDER.find(t => t.toLowerCase() === q);
  let list = G().mons.filter(m => (!state.type || m.types.includes(state.type)) && passFilters(m, fc) &&
    (!q || m.name.toLowerCase().includes(q) || String(baseOf(m.num)) === q.replace(/^0+/,"") || (qType && m.types.includes(qType))));
  if (state.sort === "name") list = [...list].sort((a,b) => a.name.localeCompare(b.name));
  else if (state.sort === "bst") list = [...list].sort((a,b) => bst(b) - bst(a) || a.num - b.num);
  else if (state.sort === "fav") list = [...list].sort((a,b) => (isFav(b.num) - isFav(a.num)) || a.num - b.num);
  else if (/^s[0-5]$/.test(state.sort)) { const k = +state.sort[1]; list = [...list].sort((a,b) => b.stats[k] - a.stats[k] || a.num - b.num); }
  return list;
}
// while the browser is idle, fetch (but don't unpack) the sprite packs of the next team in the list, so switching to it
// is instant; the service worker keeps them. Skipped on data saver and very slow connections.
const warmed = new Set();
function warmNextTeam(){
  const C = navigator.connection; if (C && (C.saveData || /2g/.test(C.effectiveType || ""))) return;
  const ts = orderedTeams(), i = ts.findIndex(t => t.id === state.team), T = ts[(i + 1) % ts.length]; if (!T) return;
  const keys = [...new Set(T.mons.slice(0, 60).map(m => spKey(m.num, false, state.mode)))].filter(k => IDX[k] && !packs.has(k) && !warmed.has(k)).slice(0, 4);
  const idle = window.requestIdleCallback || (f => setTimeout(f, 1500));
  keys.forEach((k, j) => idle(() => { if (warmed.has(k) || packs.has(k)) return; warmed.add(k); fetch(packUrl(k[0] === "t" ? `t/${k.slice(1)}.wasm` : `s/${k}.wasm`), {priority:"low"}).then(r => r.arrayBuffer()).catch(() => warmed.delete(k)); }, {timeout:4000 + j*1000}));
}
let io = null;
function observeGrid(){
  if (io) io.disconnect();
  io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) {
      const img = e.target.querySelector("img.spr");
      if (img) { img.dataset.seen = "1"; paintImg(img); }
      io.unobserve(e.target);
    }
  }, {root: matchMedia("(min-width:921px)").matches ? $("dexPanel") : null, rootMargin:"400px 0px"});
  $("grid").querySelectorAll(".card").forEach(c => io.observe(c));
  clearTimeout(observeGrid.w); observeGrid.w = setTimeout(warmNextTeam, 2500);
}
function renderGrid(){
  const T = G(), list = filtered(), t = new Set(team());
  $("dexH").textContent = T.dex;
  const tot = T.mons.length;
  $("dexMeta").textContent = (T.kind === "gen" ? `${fmtNo(T.range[0])}–${fmtNo(T.range[1])} · ` : T.blurb ? T.blurb + " · " : "") + (list.length === tot ? `${tot} Pokémon` : `${list.length} of ${tot}`);
  const card = m => `
    <div class="card${t.has(m.num)?" sel":""}" role="group" aria-roledescription="Pokémon card" tabindex="0" data-num="${m.num}" data-al="${esc(m.name)}, ${m.types.join(" and ")}" aria-label="${esc(m.name)}, ${m.types.join(" and ")}${t.has(m.num) ? ", on your team" : ""}">
      <button class="fav" type="button" data-fav="${m.num}" aria-pressed="${isFav(m.num)}" aria-label="Favorite ${esc(m.name)}">${isFav(m.num) ? "♥" : "♡"}</button>
      <button class="info" type="button" data-info="${m.num}" aria-label="${esc(m.name)} stats">i</button>
      ${spr(m.num)}
      <span class="no">${fmtNo(m.num)}</span>
      <span class="plate"><span class="nm">${esc(m.name)}</span><span class="td">${m.types.map(ty=>`<i style="${tStyle(ty)}" title="${ty}"></i>`).join("")}</span></span>
    </div>`;
  let html = "";
  const nf = activeFilters();
  if (!list.length) html = `<div class="empty-grid">${state.f.fav && !state.favs.length && nf === 1 ? "Tap the ♡ on any Pokémon to add it to your favorites." : nf ? "No Pokémon match these filters." : "No Pokémon here match."}${nf ? `<br><button class="btn sm" type="button" data-freset>Clear filters</button>` : ""}</div>`;
  else if (state.sort !== "dex") html = list.map(card).join("");
  else if (T.kind === "gen") {
    const kinds = [...new Set(list.filter(m => isForm(m.num)).map(m => FORM_BY.get(m.num).form))];
    const fn = list.filter(m => isForm(m.num)).length;
    let shown = false;
    for (const m of list) {
      if (isForm(m.num) && !shown) { shown = true; if (fn < list.length) html += `<div class="sect"><span class="k">Forms</span><h3>${kinds.map(k => k === "Mega" ? "Mega Evolutions" : k === "Primal" ? "Primal Reversion" : k + "n forms").join(" · ")}</h3><span class="meta">${fn}</span></div>`; }
      html += card(m);
    }
  }
  else {
    let cur = 0;
    for (const m of list) {
      const og = genOf(baseOf(m.num));
      if (og !== cur) { cur = og; const n = list.filter(x => genOf(baseOf(x.num)) === og).length;
        html += `<div class="sect"><span class="k">Gen ${ROMAN[og]}</span><h3>${REGION(og)}</h3><span class="meta">${n}</span></div>`; }
      html += card(m);
    }
  }
  $("grid").innerHTML = html;
  $("grid").classList.toggle("full", t.size >= sizeOf(state.team));
  const fcn = $("fCount"); if (fcn) fcn.textContent = `Showing ${list.length} of ${tot}`;
  observeGrid();
}
function syncSelection(){
  const t = new Set(team());
  $("grid").querySelectorAll(".card").forEach(c => { const on = t.has(+c.dataset.num); c.classList.toggle("sel", on); c.setAttribute("aria-label", c.dataset.al + (on ? ", on your team" : "")); });
  $("grid").classList.toggle("full", t.size >= sizeOf(state.team));
}
function renderAll(){ renderMode(); renderAcct(); renderLayout(); renderTabs(); renderTeam(); renderChips(); renderGrid(); }
function afterTeamChange(){ touched(); save(); renderTabs(); renderTeam(); syncSelection(); }

// ---------- stats + tooltip ----------
const statColor = v => v < 50 ? "#f0603c" : v < 80 ? "#f5a623" : v < 100 ? "#e8d23a" : v < 120 ? "#7fd14a" : v < 150 ? "#2fc49a" : "#3fb6f0";
function statsHTML(m, modern){
  const gen1 = !modern && state.team === "g1";
  const labels = gen1 ? ["HP","Atk","Def","Spc","Spe"] : ["HP","Atk","Def","SpA","SpD","Spe"];
  const vals = gen1 ? [m.stats[0],m.stats[1],m.stats[2],m.stats[3],m.stats[5]] : m.stats;
  const total = vals.reduce((a,b)=>a+b,0);
  return `<div class="stats">${labels.map((l,i)=>`<span class="l">${l}</span><span class="v">${vals[i]}</span><span class="b"><i style="width:${Math.min(100,vals[i]/200*100)}%;--sc:${statColor(vals[i])}"></i></span>`).join("")}
    <div class="tot"><span>Base stat total</span><span>${total}</span></div></div>`;
}
const tip = $("tip");
let tipTimer;
function showTip(el){
  const m = G().byNum.get(+el.dataset.num); if (!m) return;
  tip.innerHTML = `<h3>${fmtNo(m.num)} ${esc(m.name)}</h3>${statsHTML(m)}`;
  tip.hidden = false;
  const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  let x = r.right + 10, y = r.top;
  const pan = el.matches(".slot") && el.closest(".panel, aside, section");
  if (pan) { x = pan.getBoundingClientRect().right + 10; if (x + w > innerWidth - 8) x = r.left - w - 10; }   // team slots: beside the team panel, not over the other slots
  else if (x + w > innerWidth - 8) x = r.left - w - 10;
  if (x < 8) x = Math.max(8, Math.min(innerWidth - w - 8, r.left));
  if (y + h > innerHeight - 8) y = innerHeight - h - 8;
  tip.style.left = x + "px"; tip.style.top = Math.max(8, y) + "px";
}
function hideTip(){ clearTimeout(tipTimer); tip.hidden = true; }
if (matchMedia("(hover:hover) and (pointer:fine)").matches){
  document.addEventListener("pointerover", e => {
    const el = e.target.closest("#app .card, #app .slot[data-num]"); if (!el || el.contains(e.relatedTarget)) return;
    clearTimeout(tipTimer); tipTimer = setTimeout(() => showTip(el), 280);
  });
  document.addEventListener("pointerout", e => {
    const el = e.target.closest("#app .card, #app .slot[data-num]"); if (!el || el.contains(e.relatedTarget)) return; hideTip();
  });
  addEventListener("scroll", hideTip, {passive:true, capture:true});
}

// ---------- modal ----------
let lastFocus = null, onModalClose = null;
// sheet: a full-height bottom sheet on phones (the Pokémon sheet and its pickers)
function openModal(html, {wide=false, onClose=null, sheet=false}={}){
  hideTip();
  if (onModalClose) { const f = onModalClose; onModalClose = null; f(); }
  const m = $("modal");
  m.className = "modal" + (wide ? " wide" : "") + (sheet ? " sheet" : ""); m.onclick = null;   // #modal is reused: drop the last modal's click handler
  $("modalWrap").classList.toggle("as-sheet", !!sheet);
  m.innerHTML = `<button class="btn sm close" type="button" data-close aria-label="Close">✕</button>` + html;
  $("modalWrap").hidden = false;
  lastFocus = document.activeElement;
  m.querySelector("[data-close]").focus();
  onModalClose = onClose;
  paintAll(m);
  return m;
}
function closeModal(){
  if ($("modalWrap").hidden) return;
  if (onModalClose) { const f = onModalClose; onModalClose = null; f(); }
  $("modalWrap").hidden = true; $("modal").innerHTML = "";
  if (lastFocus && lastFocus.isConnected) lastFocus.focus();
}
$("modalWrap").addEventListener("click", e => { if (e.target === $("modalWrap") || e.target.closest("[data-close]")) closeModal(); });
document.addEventListener("keydown", e => { if (e.key !== "Escape") return; if (!$("modalWrap").hidden) closeModal(); else if (!$("hof").hidden) hofDone(); else if (!$("view").hidden) closeView(); });

function openSheet(num, tab = "info"){
  const T = G(), m = T.byNum.get(num); if (!m) return;
  if (tab === "build") tab = "look";   // older name of the Personalize tab
  if (!team().includes(num)) tab = "info";
  const inTeam = team().includes(num), og = genOf(baseOf(num));
  const weak = T.types.map(a => ({a, e: eff(a, m.types, T.chart)})).filter(x => x.e >= 2);
  const immune = T.types.filter(a => eff(a, m.types, T.chart) === 0);
  const sh = inTeam && isShinyMember(state.team, num);
  const nick = inTeam ? memberOf(state.team, num).nick : "";
  const head = `<div class="hero">${spr(m.num, {sh, zoom:true})}<div><div class="meta">${fmtNo(m.num)} · Gen ${ROMAN[og]} ${REGION(og)}${nick ? " · " + esc(m.name) : ""}</div><h3 class="mt" id="modalTitle">${inTeam ? ballImg(ballOf(state.team, num), "ball-ic lg") : ""}${esc(nick || m.name)}</h3>${typeBadges(m.types)}</div></div>
    ${inTeam ? `<div class="segrow sheet-tabs" role="group" aria-label="Sections">${[["battle", "Battle"], ["look", "Personalize"], ["info", "Info"]].map(([k, l]) => `<button type="button" data-stab="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</div>` : ""}`;
  if (tab === "battle" || tab === "look") {
    const md = openModal(head + (tab === "battle" ? battleHTML(num) : personalHTML(num)), {wide:tab === "battle", sheet:true});
    md.querySelectorAll("[data-stab]").forEach(b => b.onclick = () => openSheet(num, b.dataset.stab));
    if (tab === "battle") wireBattle(md.querySelector("#bsRoot"), num); else wirePersonal(md, num);
    return;
  }
  const md = openModal(head + `
    <div class="cov-h">Base stats</div>${statsHTML(m)}
    <div class="cov-h">Weak to</div><div class="uncov">${weak.map(x=>`<span class="tb" style="${tStyle(x.a)}">${x.a}${x.e>=4?" ×4":""}</span>`).join("") || '<span class="meta">Nothing</span>'}</div>
    ${immune.length ? `<div class="cov-h">Immune to</div><div class="uncov">${immune.map(a=>`<span class="tb" style="${tStyle(a)}">${a}</span>`).join("")}</div>` : ""}
    <p class="note">${state.team === "g1" ? "Gen I used a single Special stat for both attacking and defending. Types and matchups follow Gen I rules." : `Types, stats and matchups follow ${T.rules} rules.`}</p>
    <div class="actions">
      <button class="btn ${inTeam?"":"primary"}" type="button" id="sheetToggle">${inTeam ? "Remove from team" : "Add to team"}</button>
      <button class="btn" type="button" id="sheetFav" aria-pressed="${isFav(num)}">${isFav(num) ? "♥ Favorited" : "♡ Favorite"}</button>
    </div>`, {sheet:true});
  md.querySelectorAll("[data-stab]").forEach(b => b.onclick = () => openSheet(num, b.dataset.stab));
  md.querySelector("#sheetToggle").onclick = () => { if (toggle(num)) closeModal(); };
  md.querySelector("#sheetFav").onclick = e => { toggleFav(num); e.currentTarget.textContent = isFav(num) ? "♥ Favorited" : "♡ Favorite"; };
}

// ---------- show / hide teams ----------
function openTabEditor(){
  const label = t => t.kind === "gen" ? `${t.small} · ${t.big}` : t.kind === "all" ? "All gens · National" : t.dex;
  const draw = body => {
    const list = orderedTeams();
    body.innerHTML = `<div class="vis-list sortlist">${list.map((t, i) => `<div class="vis-row" data-sid="${t.id}">
        <span class="grip" aria-hidden="true" title="Drag to reorder">⠿</span>
        <div class="lab"><b>${esc(label(t))}${t.custom ? ' <span class="pill mute">Custom</span>' : ""}</b><span>${teamOf(t.id).length}/${sizeOf(t.id)} picked${t.blurb ? " · " + esc(t.blurb) : ""}</span></div>
        <span class="mv"><button class="btn sm" type="button" data-mv="-1" data-id="${t.id}" aria-label="Move ${esc(label(t))} up" ${i === 0 ? "disabled" : ""}>▲</button><button class="btn sm" type="button" data-mv="1" data-id="${t.id}" aria-label="Move ${esc(label(t))} down" ${i === list.length - 1 ? "disabled" : ""}>▼</button></span>
        <button class="switch" type="button" role="switch" data-vis="${t.id}" aria-checked="${!state.hidden.includes(t.id)}" aria-label="Show ${esc(t.dex)}"></button></div>`).join("")}</div>`;
  };
  openModal(`<h3 class="mt" id="modalTitle">Edit tabs</h3>
    <p class="note">Drag the ⠿ handle (or use ▲ ▼) to reorder. You can also drag tabs directly in the tab bar. Hidden teams keep their picks.</p>
    <div id="tabEdBody"></div>
    <div class="actions"><button class="btn" type="button" id="tabEdReset">Reset order</button><button class="btn primary" type="button" id="tabEdNew">＋ New team</button></div>`, {wide:true});
  $("tabEdNew").onclick = () => openCustomEditor();
  const body = $("tabEdBody"); draw(body);
  const after = () => { save(); renderTabs(); };
  body.addEventListener("click", e => {
    const mv = e.target.closest("[data-mv]");
    if (mv) { const ids = orderedTeams().map(t => t.id), i = ids.indexOf(mv.dataset.id), j = i + (+mv.dataset.mv); if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; state.order = ids; after(); draw(body); const nb = body.querySelector(`[data-mv="${mv.dataset.mv}"][data-id="${mv.dataset.id}"]`); if (nb && !nb.disabled) nb.focus(); return; }
    const s = e.target.closest("[data-vis]"); if (!s) return;
    const id = s.dataset.vis, show = state.hidden.includes(id);
    if (!show && visibleTeams().length <= 1) { toast("Keep at least one team visible."); return; }
    state.hidden = show ? state.hidden.filter(x => x !== id) : [...state.hidden, id];
    s.setAttribute("aria-checked", show);
    const was = state.team; fixCurrent(); save();
    if (was !== state.team) renderAll(); else renderTabs();
  });
  $("tabEdReset").onclick = () => { state.order = []; after(); draw(body); toast("Tab order reset."); };
  sortable(body, ".vis-row", {handle:".grip", axis:"y", onDrop:(from, to, aft) => { state.order = moveInList(orderedTeams().map(t => t.id), from, to, aft); after(); draw(body); }});
}

// ---------- drag to reorder (tabs, team slots, tab editor) ----------
function sortable(root, sel, {onDrop, handle = null, axis = "x", hold = 280}){
  let st = null, suppress = false;
  const items = () => [...root.querySelectorAll(sel)];
  const cancel = () => { if (!st) return; clearTimeout(st.timer); if (st.ghost) st.ghost.remove(); if (st.el) st.el.classList.remove("drag-src"); items().forEach(i => i.classList.remove("drop-before", "drop-after")); st = null; document.documentElement.classList.remove("sorting"); };
  const begin = () => {
    if (!st || st.active) return;
    st.active = true;
    const r = st.el.getBoundingClientRect(), g = st.el.cloneNode(true);
    g.classList.add("drag-ghost"); g.removeAttribute("id"); g.style.width = r.width + "px"; g.style.height = r.height + "px"; g.style.left = r.left + "px"; g.style.top = r.top + "px";
    st.ox = st.x0 - r.left; st.oy = st.y0 - r.top; st.ghost = g; document.body.appendChild(g);
    st.el.classList.add("drag-src"); document.documentElement.classList.add("sorting");
    if (navigator.vibrate) try { navigator.vibrate(12); } catch(e){}
  };
  root.addEventListener("pointerdown", e => {
    if (e.button > 0) return;
    const el = e.target.closest(sel); if (!el || !root.contains(el)) return;
    if (handle && !e.target.closest(handle)) return;
    if (!handle && e.target.closest("[data-remove], [data-info], [data-shy], .x, .info") ) return;
    st = {el, id:el.dataset.sid, x0:e.clientX, y0:e.clientY, x:e.clientX, y:e.clientY, touch:e.pointerType !== "mouse", active:false};
    if (st.touch && !handle) st.timer = setTimeout(begin, hold); else if (handle) begin();
  });
  window.addEventListener("pointermove", e => {
    if (!st) return;
    st.x = e.clientX; st.y = e.clientY;
    const moved = Math.hypot(st.x - st.x0, st.y - st.y0);
    if (!st.active) { if (st.touch) { if (moved > 10) cancel(); return; } if (moved < 6) return; begin(); }
    e.preventDefault();
    st.ghost.style.left = (st.x - st.ox) + "px"; st.ghost.style.top = (st.y - st.oy) + "px";
    // auto-scroll a scrolling parent near its edge
    const sc = root.closest(".tabs-wrap, .modal, .team-panel");
    if (sc) { const rr = sc.getBoundingClientRect(); if (axis === "x") { if (st.x < rr.left + 40) sc.scrollLeft -= 12; else if (st.x > rr.right - 40) sc.scrollLeft += 12; } else { if (st.y < rr.top + 40) sc.scrollTop -= 10; else if (st.y > rr.bottom - 40) sc.scrollTop += 10; } }
    let best = null, bd = Infinity;
    for (const it of items()) { if (it === st.el) continue; const r = it.getBoundingClientRect(), cx = r.left + r.width/2, cy = r.top + r.height/2, d = Math.hypot(st.x - cx, st.y - cy); if (d < bd) { bd = d; best = {it, r}; } }
    items().forEach(i => i.classList.remove("drop-before", "drop-after"));
    st.target = null;
    if (best) { const r = best.r, aft = axis === "y" ? st.y > r.top + r.height/2 : (Math.abs(st.y - (r.top + r.height/2)) < r.height/2 ? st.x > r.left + r.width/2 : st.y > r.top + r.height/2); best.it.classList.add(aft ? "drop-after" : "drop-before"); st.target = {id:best.it.dataset.sid, after:aft}; }
  }, {passive:false});
  window.addEventListener("touchmove", e => { if (st && st.active) e.preventDefault(); }, {passive:false});
  const end = () => {
    if (!st) return;
    const s0 = st; const wasActive = s0.active;
    cancel();
    if (wasActive) { suppress = true; setTimeout(() => suppress = false, 50); if (s0.target && s0.target.id !== s0.id) onDrop(s0.id, s0.target.id, s0.target.after); }
  };
  window.addEventListener("pointerup", end); window.addEventListener("pointercancel", () => cancel());
  root.addEventListener("click", e => { if (suppress) { e.stopPropagation(); e.preventDefault(); suppress = false; } }, true);
  root.addEventListener("contextmenu", e => { if (st && st.touch) e.preventDefault(); });
}
// a mouse wheel scrolls the tab strip sideways
document.querySelector(".tabs-wrap").addEventListener("wheel", e => { const w = e.currentTarget; if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && w.scrollWidth > w.clientWidth) { w.scrollLeft += e.deltaY; e.preventDefault(); } }, {passive:false});
sortable($("tabs"), ".tab", {axis:"x", onDrop:(from, to, aft) => { state.order = moveInList(orderedTeams().map(t => t.id), from, to, aft); save(); renderTabs(); }});
sortable($("slots"), ".slot[data-num]", {axis:"grid", onDrop:(from, to, aft) => {
  const t = team().map(String), next = moveInList(t, from, to, aft).map(Number);
  snap("Reordered team"); state.teams[state.team] = next; afterTeamChange();
}});

// ---------- trainer picker ----------
function openTrainerPicker(o = {}){
  const cur = o.cur ?? trainerOf(state.team);
  const md = openModal(`<h3 class="mt" id="modalTitle">${esc(o.title || "Choose a trainer")}</h3>
    <p class="note">${o.note || `For your ${esc(G().title.replace(" dream team",""))} team.`} ${TRAINERS.length} trainers, shown as ${state.mode === "2d" ? "pixel sprites" : "3D portraits"}.</p>${o.extra || ""}
    <input class="search tsearch" id="trSearch" type="search" placeholder="Search trainers" autocomplete="off" aria-label="Search trainers">
    <div id="trList"></div>`, {wide:true});
  const draw = () => {
    const q = md.querySelector("#trSearch").value.trim().toLowerCase();
    const match = i => !q || TRAINERS[i].toLowerCase().includes(q);
    const pro = PROTAG.map(n => TR_BY_NAME.get(n)).filter(i => i !== undefined && match(i));
    const proSet = new Set(pro);
    const rest = TRAINERS.map((_,i) => i).filter(i => !proSet.has(i) && match(i));
    const cardT = i => `<button class="tcard${i === cur ? " sel" : ""}" type="button" data-pick="${i}" aria-pressed="${i === cur}">${trImg(i)}<span>${esc(TRAINERS[i])}</span></button>`;
    md.querySelector("#trList").innerHTML =
      (pro.length ? `<div class="tsect">Protagonists</div><div class="tgrid">${pro.map(cardT).join("")}</div>` : "") +
      (rest.length ? `<div class="tsect">${q ? "Other trainers" : "Gym Leaders, Champions, rivals and more"}</div><div class="tgrid">${rest.map(cardT).join("")}</div>` : "") +
      (!pro.length && !rest.length ? `<p class="meta">No trainer matches “${esc(q)}”.</p>` : "");
    paintAll(md.querySelector("#trList"));
  };
  md.querySelector("#trSearch").addEventListener("input", draw);
  md.querySelector("#trList").addEventListener("click", e => {
    const b = e.target.closest("[data-pick]"); if (!b) return;
    if (o.onPick) { o.onPick(+b.dataset.pick); return; }
    snap("Changed trainer"); state.trainers[state.team] = +b.dataset.pick; touched(); save();
    closeModal(); renderTeam(); toast(`${TRAINERS[+b.dataset.pick]} now leads this team.`);
  });
  draw();
}

// ---------- team card (canvas, animated; exports GIF/PNG) ----------
const decoded = new Map();
async function decodeSprite(bytes, kind){
  if (kind !== 1 || !window.GifKit) {
    const bmp = await createImageBitmap(new Blob([bytes], {type: MIME[kind] || "image/png"}));
    const sp = {frames:[{img:bmp, delay:0}], total:0, w:bmp.width, h:bmp.height};
    sp.bb = alphaBox([bmp], bmp.width, bmp.height); return sp;
  }
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const parsed = GifKit.parseGIF(ab), frames = GifKit.decompressFrames(parsed, true);
  const W = parsed.lsd.width, H = parsed.lsd.height;
  const comp = document.createElement("canvas"); comp.width = W; comp.height = H;
  const cx = comp.getContext("2d", {willReadFrequently:true});
  const patch = document.createElement("canvas"), pc = patch.getContext("2d");
  const out = []; let total = 0;
  for (const f of frames) {
    const {left, top, width, height} = f.dims;
    const prev = f.disposalType === 3 ? cx.getImageData(0,0,W,H) : null;
    if (width && height) { patch.width = width; patch.height = height; pc.putImageData(new ImageData(f.patch, width, height), 0, 0); cx.drawImage(patch, left, top); }
    const snap = document.createElement("canvas"); snap.width = W; snap.height = H; snap.getContext("2d").drawImage(comp, 0, 0);
    const d = f.delay <= 10 ? 100 : f.delay;
    out.push({img:snap, delay:d}); total += d;
    if (f.disposalType === 2) cx.clearRect(left, top, width, height);
    else if (prev) cx.putImageData(prev, 0, 0);
  }
  const sp = {frames: out, total, w:W, h:H};
  sp.bb = alphaBox(out.map(f => f.img), W, H); return sp;
}
function alphaBox(imgs, W, H){
  try {
    const c = mkCanvas(W, H), x = c.getContext("2d", {willReadFrequently:true});
    for (const im of imgs) x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) if (d[(y*W + i)*4 + 3] > 12) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return {x:0, y:0, w:W, h:H};
    return {x:x0, y:y0, w:x1 - x0 + 1, h:y1 - y0 + 1};
  } catch(e){ return {x:0, y:0, w:W, h:H}; }
}
function getSprite(key, id){
  const dk = key + ":" + id;
  if (decoded.has(dk)) return decoded.get(dk);
  const pr = ensurePack(key).then(p => { const e = p.bytes.get(id); return e ? decodeSprite(e.b, e.kind) : null; });
  decoded.set(dk, pr);
  pr.catch(() => decoded.delete(dk));
  return pr;
}
const frameAt = (s, t) => s ? s.frames[frameIdx(s, t)].img : null;
