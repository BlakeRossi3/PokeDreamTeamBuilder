// ================= HOME GAMES: Berry Catch, Hide-and-seek =================
// Berry Catch: one of your Pokémon catches falling berries for 30 seconds; the first 3 rounds a day you keep up to 5 of
// them. Hide-and-seek: a Pokémon hides behind a piece of furniture; tap the right one to find it (friendship, 3 a day).
const CATCH_KEEP = 5, GAMES_A_DAY = 3, catchSecs = () => window.DTD_CATCH || 30;   // tests shorten a round with window.DTD_CATCH
function homeGamesDay(){ const D = homeData(), day = todayKey(); if (!D.games) D.games = {d:"", catchN:0, seekN:0, catchBest:0, found:0}; if (D.games.d !== day) Object.assign(D.games, {d:day, catchN:0, seekN:0}); return D.games; }
const hideSpots = () => placedItems().filter(p => !isFloorItem(p.it) && !p.s);
const homeResidents = () => HS.mons.filter(m => !m.visitor && m.sp);
function homeGames(){
  const Gd = homeGamesDay(), res = homeResidents(), spots = hideSpots(), canSeek = res.length && spots.length >= 2;
  const left = n => Math.max(0, GAMES_A_DAY - n);
  const md = openModal(`<h3 class="mt" id="modalTitle">Games</h3>
    <div class="hg-list">
      <button class="hg-card" type="button" data-hg="catch" ${res.length ? "" : "disabled"}><b>Berry Catch</b><span>Catch falling berries with one of your Pokémon. ${left(Gd.catchN) ? `You keep up to ${CATCH_KEEP} of them (${left(Gd.catchN)} more ${left(Gd.catchN) === 1 ? "round" : "rounds"} today).` : "Just for fun for the rest of today."}</span>${Gd.catchBest ? `<small>Best: ${Gd.catchBest}</small>` : ""}</button>
      <button class="hg-card" type="button" data-hg="seek" ${canSeek ? "" : "disabled"}><b>Hide-and-seek</b><span>${canSeek ? `A Pokémon hides behind your furniture. Find it to grow your friendship${left(Gd.seekN) ? ` (${left(Gd.seekN)} more today)` : ""}.` : "Needs a Pokémon at home and at least two pieces of furniture to hide behind."}</span>${Gd.found ? `<small>Found ${Gd.found} times</small>` : ""}</button>
    </div>${res.length ? "" : `<p class="note">Invite Pokémon to your Home first.</p>`}
    <div class="actions"><button class="btn" type="button" data-close>Close</button></div>`);
  md.onclick = e => { const b = e.target.closest("[data-hg]"); if (!b || b.disabled) return; Sound.play("select"); closeModal(); if (b.dataset.hg === "catch") berryCatch(); else seekStart(); };
}
function berryCatch(){
  const res = homeResidents(); if (!res.length) return;
  const m = [...res].sort((a, b) => friendOf(b.n) - friendOf(a.n))[0], name = nickFor(m.n), fav = favBerry(m.n);
  const W = 320, H = 240;
  const md = openModal(`<h3 class="mt" id="modalTitle">Berry Catch</h3>
    <p class="note" id="bcNote">Move ${esc(name)} with ← → (or A D), or drag. ${esc(name)}’s favourite, the ${esc(fav.name)}, makes it extra happy.</p>
    <div class="bc-wrap"><canvas class="bc-cv" id="bcCv" width="${W}" height="${H}" tabindex="0" aria-label="Berry Catch: move left and right to catch berries"></canvas>
      <div class="bc-hud"><span>Caught <b id="bcScore">0</b></span><span><b id="bcTime">${catchSecs()}</b>s</span></div></div>
    <div class="actions"><button class="btn primary" type="button" id="bcGo">Start</button><button class="btn" type="button" data-close>Close</button></div>`, {wide:true, onClose:() => stop()});
  const cv = md.querySelector("#bcCv"), c = cv.getContext("2d"); c.imageSmoothingEnabled = false;
  const G = {x:W/2, v:0, keys:new Set(), drag:null, berries:[], got:[], run:false, t0:0, last:0, next:0, raf:0, sp:null, pops:[]};
  getSprite(spKey(m.n, false, "2d"), m.n).then(sp => { G.sp = sp; draw(performance.now()); }).catch(() => {});
  const key = (e, on) => { const k = {ArrowLeft:-1, a:-1, A:-1, ArrowRight:1, d:1, D:1}[e.key]; if (k === undefined || !G.run) return; e.preventDefault(); if (on) G.keys.add(k); else G.keys.delete(k); };
  const kd = e => key(e, true), ku = e => key(e, false);
  document.addEventListener("keydown", kd); document.addEventListener("keyup", ku);
  const px = e => { const r = cv.getBoundingClientRect(); return (e.clientX - r.left)/r.width*W; };
  cv.addEventListener("pointerdown", e => { G.drag = px(e); cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => { if (G.drag !== null) G.drag = px(e); });
  cv.addEventListener("pointerup", () => { G.drag = null; }); cv.addEventListener("pointercancel", () => { G.drag = null; });
  function stop(){ cancelAnimationFrame(G.raf); G.run = false; document.removeEventListener("keydown", kd); document.removeEventListener("keyup", ku); }
  const box = () => { const sp = G.sp, w = sp ? Math.min(64, sp.bb.w) : 40, h = sp ? Math.min(64, sp.bb.h) : 40; return {w, h, y:H - 10 - h}; };
  function drawBerry(b){
    const x = Math.round(b.x), y = Math.round(b.y);
    c.fillStyle = "rgba(0,0,0,.35)"; c.beginPath(); c.arc(x, y + 1, 6, 0, 7); c.fill();
    c.fillStyle = b.col; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill();
    c.fillStyle = "rgba(255,255,255,.7)"; c.fillRect(x - 3, y - 3, 2, 2);
    c.fillStyle = "#3a8a3a"; c.fillRect(x - 1, y - 9, 2, 4); c.fillRect(x + 1, y - 9, 3, 2);
    if (b.fav) { c.strokeStyle = "#ffd43b"; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 8.5, 0, 7); c.stroke(); }
  }
  function draw(now){
    const two = state.mode === "2d", g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, two ? "#8fd0ff" : "#9fd8ff"); g.addColorStop(.75, "#d9f2ff"); g.addColorStop(.75, "#5cbf5c"); g.addColorStop(1, "#3f9a46"); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(255,255,255,.8)"; [[40, 30], [210, 50], [130, 18]].forEach(([x, y], i) => { const xx = Math.round((x + now*.006*(i + 1)) % (W + 60) - 30); c.fillRect(xx, y, 34, 8); c.fillRect(xx + 6, y - 5, 20, 5); });
    for (const b of G.berries) drawBerry(b);
    const B = box(), sp = G.sp;
    c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.ellipse(Math.round(G.x), H - 10, B.w*.4, 3, 0, 0, 7); c.fill();
    if (sp) { const img = sp.frames[frameIdx(sp, now)].img, s = Math.min(1, 64/Math.max(sp.bb.w, sp.bb.h)), w = Math.round(sp.bb.w*s), h = Math.round(sp.bb.h*s);
      c.save(); c.translate(Math.round(G.x), 0); if (G.v > 0) c.scale(-1, 1); c.drawImage(img, sp.bb.x, sp.bb.y, sp.bb.w, sp.bb.h, -Math.round(w/2), H - 10 - h, w, h); c.restore(); }
    for (const q of G.pops) { const a = 1 - (now - q.t)/600; if (a <= 0) continue; c.globalAlpha = a; c.fillStyle = q.fav ? "#ffd43b" : "#ffffff"; c.font = "bold 12px monospace"; c.fillText(q.fav ? "+1 ♥" : "+1", Math.round(q.x - 8), Math.round(q.y - (1 - a)*16)); c.globalAlpha = 1; }
    G.pops = G.pops.filter(q => now - q.t < 600);
  }
  function frame(now){
    const dt = Math.min(.05, (now - G.last)/1000); G.last = now;
    const el = (now - G.t0)/1000, left = Math.max(0, catchSecs() - el);
    const dir = [...G.keys].reduce((a, k) => a + k, 0), B = box();
    if (G.drag !== null) G.v = Math.max(-260, Math.min(260, (G.drag - G.x)*10)); else G.v = dir*230;
    G.x = Math.max(B.w/2, Math.min(W - B.w/2, G.x + G.v*dt));
    if (now >= G.next && left > .8) { const r = Math.random() < .2 ? fav : BERRIES[Math.floor(Math.random()*BERRIES.length)];
      G.berries.push({x:12 + Math.random()*(W - 24), y:-10, vy:70 + el*2.6 + Math.random()*40, col:r.col, id:r.id, fav:r.id === fav.id}); G.next = now + Math.max(260, 700 - el*14); }
    for (const b of G.berries) { b.y += b.vy*dt;
      if (!b.done && b.y >= B.y + 6 && b.y <= H - 12 && Math.abs(b.x - G.x) < B.w*.45 + 5) { b.done = true; G.got.push(b.id); G.pops.push({x:b.x, y:b.y, t:now, fav:b.fav}); if (b.fav) G.fav = (G.fav || 0) + 1; Sound.play(b.fav ? "up" : "pick"); md.querySelector("#bcScore").textContent = G.got.length; } }
    G.berries = G.berries.filter(b => !b.done && b.y < H + 12);
    md.querySelector("#bcTime").textContent = Math.ceil(left);
    draw(now);
    if (left <= 0) { finish(); return; }
    G.raf = requestAnimationFrame(frame);
  }
  function finish(){
    stop(); const Gd = homeGamesDay(), D = homeData(), n = G.got.length, keep = Gd.catchN < GAMES_A_DAY; missionBump("catch");
    Gd.catchN++; const best = n > Gd.catchBest; Gd.catchBest = Math.max(Gd.catchBest, n);
    const kept = []; if (keep) for (const id of G.got) { if (kept.length >= CATCH_KEEP || bagTotal() >= 99) break; D.bag[id] = (D.bag[id] | 0) + 1; kept.push(id); }
    const up = keep && n >= 8 ? Math.min(100 - friendOf(m.n), 2 + Math.min(3, G.fav || 0)) : 0; if (up > 0) D.fr[m.n] = friendOf(m.n) + up;
    save(); renderHomeBag(); renderResidents(); checkAch(); Sound.play(n >= 8 ? "up" : "select");
    const cnt = {}; kept.forEach(id => { cnt[id] = (cnt[id] || 0) + 1; });
    const bag = kept.length ? `You keep ${Object.entries(cnt).map(([id, k]) => `${k} × ${esc(BERRY_BY.get(id).name)}`).join(", ")}.` : keep ? "" : "No berries to keep after 3 rounds today, but well played!";
    md.querySelector("#bcNote").innerHTML = `<b>${esc(name)} caught ${n} ${n === 1 ? "berry" : "berries"}!</b>${best && n ? " A new best!" : ""} ${bag}${up > 0 ? ` Friendship +${up}.` : ""}`;
    const go = md.querySelector("#bcGo"); go.textContent = "Play again"; go.disabled = false;
  }
  md.querySelector("#bcGo").onclick = () => { if (G.run) return; Object.assign(G, {berries:[], got:[], fav:0, pops:[], x:W/2, run:true, t0:performance.now(), last:performance.now(), next:performance.now() + 300});
    md.querySelector("#bcScore").textContent = "0"; md.querySelector("#bcGo").disabled = true; cv.focus({preventScroll:true}); G.raf = requestAnimationFrame(frame); };
  draw(performance.now());
}
function seekStart(){
  const res = homeResidents(), spots = hideSpots(); if (!res.length || spots.length < 2) return;
  const m = res[Math.floor(Math.random()*res.length)], p = spots[Math.floor(Math.random()*spots.length)];
  if (m.st === "act") homeActEnd(m);
  Object.assign(m, {st:"idle", t:2000, path:null, plan:null, follow:false, v:0});
  HS.hide = {n:m.n, p:{x:p.x, y:p.y, id:p.id}, tries:0, t0:performance.now()};
  Sound.play("select"); renderHome();
  homeMsg(`Is hiding behind something… Tap the furniture you think it’s behind!`, {n:m.n, tag:"Hide-and-seek"});
}
function seekStop(quiet){
  if (!HS.hide || HS.hide.found) { HS.hide = null; return; }
  const m = HS.mons.find(x => x.n === HS.hide.n), p = HS.hide.p; HS.hide = null;
  if (m && p) { const it = unlockOf("furn", p.id); m.x = Math.max(.4, Math.min(HS.W - .4, p.x + (it ? it.w/2 : .5))); m.y = Math.min(HM.D - .3, p.y + (it ? it.d : 1) + .4); m.hop = 1; }
  if (!quiet) { renderHome(); if (m) homeMsg(`Was hiding behind the ${esc((unlockOf("furn", p.id) || {}).name || "furniture")}!`, {n:m.n, tag:"Hide-and-seek"}); }
}
function seekAt(q){
  const H2 = HS.hide, m = HS.mons.find(x => x.n === H2.n); if (!m) { HS.hide = null; return; }
  if (q.id === H2.p.id && q.x === H2.p.x && q.y === H2.p.y) {
    H2.found = true; m.x = Math.max(.4, Math.min(HS.W - .4, q.x + q.it.w/2)); m.y = Math.min(HM.D - .3, q.y + q.it.d + .4); m.hop = 1; m.st = "idle"; m.t = 2500; m.dir = HS.me.x < m.x ? -1 : 1;
    const Gd = homeGamesDay(), D = homeData(), reward = Gd.seekN < GAMES_A_DAY; Gd.seekN++; Gd.found++; missionBump("seek");
    const up = reward ? Math.min(100 - friendOf(m.n), H2.tries === 0 ? 6 : 4) : 0; if (up > 0) D.fr[m.n] = friendOf(m.n) + up;
    m.emote = {k:"heart", t0:performance.now(), dur:2000}; burst("heart", m, 8, {sp:1, dur:1200}); Sound.play("up");
    save(); HS.hide = null; renderHome();
    homeMsg(`Found! It was behind the ${esc(q.it.name)}${H2.tries === 0 ? " — first try!" : "."}${reward ? "" : ` <span class="meta">That’s plenty of games for today.</span>`}`, {n:m.n, f:friendOf(m.n), f0:friendOf(m.n) - up});
    checkAch(); return;
  }
  H2.tries++; Sound.play("wrong");
  const hint = H2.tries >= 3 ? (() => { const it = unlockOf("furn", H2.p.id), hx = H2.p.x + (it ? it.w/2 : .5); fx("spark", hx, H2.p.y + (it ? it.d : 1)*.5, 1.2, {col:"#ffd43b"}); return " You hear a giggle… look for the sparkle!"; })() : H2.tries === 2 ? ` It’s ${Math.abs((H2.p.x) - HS.me.x) < 4 ? "close by" : "further away"}.` : "";
  homeMsg(`Not behind the ${esc(q.it.name)}.${hint}`, {tag:"Hide-and-seek"});
}

