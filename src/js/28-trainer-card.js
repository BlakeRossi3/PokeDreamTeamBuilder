// ================= TRAINER CARD =================
function trainerId(uid){ const s = uid || (profile && profile.id ? profile.id : "guest"); let h = 0; for (const c of s) h = (h*31 + c.charCodeAt(0)) >>> 0; return String(h % 100000).padStart(5, "0"); }
function cardStats(){
  if (VISIT) return VISIT.card.rows;   // a friend's card: the numbers they published
  return [["Teams completed", `${fullTeams().length} / ${TEAMS.length}`], ["Favorites", state.favs.length], ["Gym badges", `${totalBadges()} / 72`], ["Leagues cleared", `${leaguesCleared()} / 9`], ["Rivals beaten", `${Object.keys(state.games.wins).length} / ${RIVALS.length}`], ["PokéPoints earned", state.games.ppTotal.toLocaleString()], ["Best quiz streak", bestQuiz()], ["Achievements", `${achDone()} / ${ACH.length}`]];
}
async function drawCard(cv, who){
  const W = 1000, H = 620, S = 2, two = state.mode === "2d", D = CARD_DESIGNS[state.games.card] || CARD_DESIGNS.red, st = D.c;
  cv.width = W*S; cv.height = H*S; const c = cv.getContext("2d"); c.setTransform(S, 0, 0, S, 0, 0); c.imageSmoothingEnabled = !two;
  const head = two ? '"Pixelify Sans", monospace' : '"Chakra Petch", sans-serif', body = two ? '"VT323", monospace' : '"Rubik", sans-serif';
  try { await Promise.all([document.fonts.load(`700 30px ${head}`), document.fonts.load(`20px ${body}`)]); } catch(e){}
  const r = two ? 0 : 28, rr = (x, y, w, h, rad) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, rad) : c.rect(x, y, w, h); };
  c.clearRect(0, 0, W, H);
  if (two) { c.fillStyle = "#28323f"; c.fillRect(0, 0, W, H); const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, st[0]); g.addColorStop(1, D.pat ? st[1] : st[0]); c.fillStyle = g; c.fillRect(8, 8, W - 16, H - 16); }
  else { const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, st[0]); g.addColorStop(1, st[1]); c.fillStyle = g; rr(0, 0, W, H, r); c.fill(); }
  c.save(); if (two) { c.beginPath(); c.rect(8, 8, W - 16, H - 16); } else rr(0, 0, W, H, r); c.clip(); cardPattern(c, D, W, H, two); c.restore();
  c.fillStyle = "#ffffff"; c.font = `700 ${two ? 30 : 32}px ${head}`; c.textBaseline = "middle"; c.fillText(two ? "TRAINER CARD" : "Trainer Card", 40, 50);
  if (D.champ) { const tw = c.measureText(two ? "TRAINER CARD" : "Trainer Card").width; c.font = `700 ${two ? 22 : 18}px ${head}`; c.fillStyle = "#ffe28a"; c.fillText(`★ ${GENS[D.champ - 1].region.toUpperCase()} CHAMPION`, 60 + tw, 52); }
  c.font = `${two ? 26 : 20}px ${body}`; c.textAlign = "right"; c.fillText(`ID No. ${trainerId(who && who.id)}`, W - 40, 50); c.textAlign = "left";
  // inner panel
  c.fillStyle = st[2]; if (two) { c.fillRect(30, 86, W - 60, H - 116); c.fillStyle = "#28323f"; c.fillRect(30, 86, W - 60, 3); } else { rr(30, 86, W - 60, H - 116, 20); c.fill(); }
  const ink = "#1d2631", mut = "#5b6878";
  const ico = myIcon(), nx = ico ? 146 : 60;
  if (ico) await drawIconBadge(c, unlockOf("icon", ico), 98, 146, 38, two);
  c.fillStyle = ink; c.font = `700 ${two ? 40 : 40}px ${head}`; const nm = who ? who.name : profile && !profile.guest ? profile.sb ? profile.uname || profile.name : profile.name : "Guest"; c.fillText(nm.toUpperCase(), nx, 130);
  const ttl = myTitle(); if (ttl) { c.font = `700 ${two ? 22 : 17}px ${head}`; c.fillStyle = "#b5841b"; c.fillText(`★ ${ttl}`.toUpperCase(), nx, 196); }
  c.font = `${two ? 22 : 17}px ${body}`; c.fillStyle = mut; c.fillText(state.games.since ? `Adventure started ${new Date(state.games.since).toLocaleDateString()}` : "Adventure just started", nx, 168);
  const rows = cardStats();
  c.font = `${two ? 24 : 18}px ${body}`;
  rows.forEach(([k, v], i) => { const y = 214 + i*32; c.fillStyle = mut; c.fillText(k, 60, y); c.fillStyle = ink; c.font = `700 ${two ? 24 : 18}px ${head}`; c.textAlign = "right"; c.fillText(String(v), 470, y); c.textAlign = "left"; c.font = `${two ? 24 : 18}px ${body}`; c.fillStyle = "rgba(0,0,0,.08)"; c.fillRect(60, y + 15, 410, 1); });
  // badges: 9 regions x 8
  c.fillStyle = mut; c.font = `${two ? 22 : 15}px ${body}`; c.fillText("Badges", 520, 230);
  LEAGUES.forEach((L, ri) => { const y = 256 + ri*22; c.fillStyle = mut; c.textAlign = "right"; c.fillText(ROMAN[L.g], 544, y); c.textAlign = "left"; L.gyms.forEach(([, ty], k) => { const x = 560 + k*20, on = hasBadge(L.g, k); c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x + 8, y); c.lineTo(x, y + 8); c.lineTo(x - 8, y); c.closePath(); if (on) { c.fillStyle = TC[ty.split("/")[0]]; c.fill(); } c.lineWidth = 1.5; c.strokeStyle = on ? "rgba(0,0,0,.35)" : "rgba(0,0,0,.18)"; c.stroke(); }); if (state.games.leagues[L.g]) { c.fillStyle = "#e2b13c"; c.font = `${two ? 20 : 15}px ${body}`; c.fillText("★", 730, y); c.font = `${two ? 22 : 15}px ${body}`; } });
  // trainer
  try {
    const tr = trainerOf("all"), sp = await getSprite(two ? "t2d" : "t3f", tr), img = frameAt(sp, 0), bb = sp.bb;
    const h = 380, w = bb.w*h/bb.h; c.drawImage(img, bb.x, bb.y, bb.w, bb.h, W - 60 - w, H - 60 - h + 20, w, h);
  } catch(e){}
  // featured team
  const t = teamOf("all");
  c.fillStyle = mut; c.font = `${two ? 22 : 15}px ${body}`; c.fillText("All-gen dream team", 60, 500);
  for (let i = 0; i < 6; i++) { const x = 60 + i*72, y = 520; c.fillStyle = "rgba(0,0,0,.07)"; if (two) c.fillRect(x, y, 64, 64); else { rr(x, y, 64, 64, 14); c.fill(); }
    const n = t[i]; if (!n) continue;
    try { const sh = isShinyMember("all", n) || state.shiny, sp = await getSprite(spKey(n, sh, two ? "2d" : "3d"), n), img = frameAt(sp, 0), bb = sp.bb, k = Math.min(56/bb.w, 56/bb.h); c.drawImage(img, bb.x, bb.y, bb.w, bb.h, x + 32 - bb.w*k/2, y + 60 - bb.h*k, bb.w*k, bb.h*k); } catch(e){}
    if (friendOf(n) >= 100) drawRibbon(c, x + 42, y - 4, 24); }
}
// card design patterns, drawn over the coloured border
function cardPattern(c, D, W, H, two){
  const p = D.pat, R = rng(7);
  c.save();
  if (!p) { c.globalAlpha = two ? .1 : .08; c.fillStyle = "#fff"; for (let i = -H; i < W; i += 46) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 20, 0); c.lineTo(i + 20 + H, H); c.lineTo(i + H, H); c.fill(); } }
  else if (p === "glow") { const g = c.createRadialGradient(W*.85, H*.05, 0, W*.85, H*.05, W*.7); g.addColorStop(0, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  else if (p === "wave") { c.strokeStyle = "rgba(255,255,255,.18)"; c.lineWidth = two ? 4 : 3; for (let y = -20; y < H + 40; y += 26) { c.beginPath(); for (let x = 0; x <= W; x += two ? 10 : 6) { const yy = y + Math.sin(x/60 + y/40)*8; x ? c.lineTo(x, two ? Math.round(yy/2)*2 : yy) : c.moveTo(x, yy); } c.stroke(); } }
  else if (p === "grid") { c.fillStyle = "rgba(255,255,255,.16)"; for (let x = 0; x < W; x += 20) c.fillRect(x, 0, 2, H); for (let y = 0; y < H; y += 20) c.fillRect(0, y, W, 2); }
  else if (p === "stars") { for (let i = 0; i < 140; i++) { const x = R()*W, y = R()*H, r = R() < .1 ? 2.6 : 1.2; c.fillStyle = `rgba(255,255,255,${.4 + R()*.6})`; if (two) c.fillRect(Math.round(x/2)*2, Math.round(y/2)*2, r > 2 ? 4 : 2, r > 2 ? 4 : 2); else { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } } }
  else if (p === "holo") { const g = c.createLinearGradient(0, 0, W, H); ["rgba(255,90,200,.45)", "rgba(90,200,255,.45)", "rgba(255,240,90,.45)", "rgba(90,255,170,.45)", "rgba(190,120,255,.45)"].forEach((col, i, a) => g.addColorStop(i/(a.length - 1), col)); c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalAlpha = .25; c.fillStyle = "#fff"; for (let i = -H; i < W; i += 90) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 30, 0); c.lineTo(i + 30 + H, H); c.lineTo(i + H, H); c.fill(); } }
  else if (p === "champ") { c.fillStyle = "rgba(255,215,90,.22)"; for (let i = -H; i < W; i += 28) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 10, 0); c.lineTo(i + 10 + H, H); c.lineTo(i + H, H); c.fill(); } c.strokeStyle = "#ffd76a"; c.lineWidth = 6; if (two) c.strokeRect(14, 14, W - 28, H - 28); else { c.beginPath(); c.roundRect ? c.roundRect(10, 10, W - 20, H - 20, 22) : c.rect(10, 10, W - 20, H - 20); c.stroke(); } }
  c.restore();
}
// a profile icon drawn onto a canvas (trainer card)
async function drawIconBadge(c, it, x, y, r, two){
  const m = NAT_BY.get(it.num), col = TC[m ? m.types[0] : "Normal"];
  c.save();
  if (two) { c.fillStyle = "#28323f"; c.fillRect(x - r - 3, y - r - 3, r*2 + 6, r*2 + 6); c.fillStyle = col; c.fillRect(x - r, y - r, r*2, r*2); c.beginPath(); c.rect(x - r, y - r, r*2, r*2); }
  else { c.fillStyle = isExclusive(it) ? "#ffd43b" : "#ffffff"; c.beginPath(); c.arc(x, y, r + 4, 0, 7); c.fill(); const g = c.createRadialGradient(x, y - r*.3, 2, x, y, r); g.addColorStop(0, shadeHex(col, 1.5)); g.addColorStop(1, col); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.beginPath(); c.arc(x, y, r, 0, 7); }
  c.clip();
  try { const sp = await getSprite(spKey(it.num, false, "2d"), it.num), img = frameAt(sp, 0), bb = sp.bb, k = Math.min(r*2.1/bb.w, r*2.1/bb.h); c.imageSmoothingEnabled = false; c.drawImage(img, bb.x, bb.y, bb.w, bb.h, x - bb.w*k/2, y + r*1.05 - bb.h*k, bb.w*k, bb.h*k); } catch(e){}
  c.restore();
}
function renderCard(){
  const G = state.games, designs = ITEMS_ALL.filter(it => it.cat === "card"), icons = ITEMS_ALL.filter(it => it.cat === "icon" && owns("icon", it.id));
  const shown = designs.filter(it => owns("card", it.id) || !isExclusive(it)), hiddenN = designs.length - shown.length;
  const sw = it => { const d = CARD_DESIGNS[it.id], ok = owns("card", it.id);
    return `<button type="button" class="card-opt${ok ? "" : " locked"}" data-card="${it.id}" aria-pressed="${G.card === it.id}" title="${esc(it.name)}${ok ? "" : " (locked)"}"><span class="card-sw ${d.pat || ""}" style="--a:${d.c[0]};--b:${d.c[1]};--c:${d.c[2]}"><i></i></span><small>${ok ? esc(it.name) : fmtPP(it.price)}</small></button>`; };
  $("scBody").innerHTML = `<div class="card-wrap"><canvas class="tcardcv" id="cardCv" aria-label="Your trainer card"></canvas>
    <div class="card-side">
      <div class="set-sub">Battle of the week</div>${state.games.botw ? `<div class="rp-botw">${ic("trophy")}<span><b>${esc(state.games.botw.ti)}</b><small>${state.games.botw.w ? "A win" : "A close one"} · friends can watch it on your profile</small></span><button class="btn sm" type="button" id="cardBotw">▶ Watch</button></div>` : `<p class="note">Pin a battle from Battle → Replays and friends can watch it from your profile.</p>`}
      <div class="set-sub">Card design</div><div class="card-grid">${shown.map(sw).join("")}${hiddenN ? `<button type="button" class="card-opt mystery" data-cardmore title="Champion designs"><span class="card-sw q">?</span><small>${hiddenN} Champion designs</small></button>` : ""}</div>
      <div class="set-sub">Title <span class="meta">· Champions earn one per region</span></div>
      <div class="segrow title-row">${[{id:"", name:"None"}, ...TITLES()].map(t => `<button type="button" data-title="${t.id}" aria-pressed="${(G.title || "") === t.id}">${esc(t.name)}</button>`).join("")}${TITLES().length ? "" : `<span class="meta">Clear a region’s Elite Four and Champion to earn its title.</span>`}</div>
      <div class="set-sub">Profile icon <span class="meta">· shows on your card and save file</span></div>
      <div class="icon-grid"><button type="button" class="icon-opt" data-icon="" aria-pressed="${!myIcon()}" title="Your trainer"><span class="picon none">—</span></button>${icons.map(it => `<button type="button" class="icon-opt" data-icon="${it.id}" aria-pressed="${G.icon === it.id}" title="${esc(it.name)}">${iconHTML(it.id)}</button>`).join("")}<button type="button" class="icon-opt more" data-iconshop title="Get more icons in the Shop"><span class="picon none">+</span></button></div>
      ${CLOUD_ON ? `<div class="set-sub">Show friends <span class="meta">· the team and Hall of Fame card friends see</span></div>
      <div class="sc-pick"><select class="select" id="scTeam" aria-label="Team friends see">${nonEmptyTeams().map(t => `<option value="${t.id}" ${t.id === (TEAM_BY.has(G.showcase.team) && teamOf(G.showcase.team).length ? G.showcase.team : "all") ? "selected" : ""}>${esc(t.dex)} · ${teamOf(t.id).length} Pokémon</option>`).join("") || `<option value="all">All-gen team</option>`}</select>
      <div class="segrow" data-scstyle>${[["3d", "3D card"], ["2d", "2D card"]].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${G.showcase.style === v}">${l}</button>`).join("")}</div></div>` : ""}
      <div class="actions"><button class="btn primary" type="button" id="cardSave">Save as image</button></div>
      <p class="note">The card follows your 2D or 3D style. Your trainer and featured team come from your All-gen team. Get more designs and icons in the Shop; Champions give out their own.</p><div id="cardOut"></div></div></div>`;
  paintAll($("scBody"));
  const draw = () => drawCard($("cardCv"));
  draw();
  nav.onChange = e => { if (e.target.id === "scTeam") { G.showcase.team = e.target.value; save(); Sound.play("select"); friendsAfterSync(); toast("Friends will see this team."); } };
  const bw = $("cardBotw"); if (bw) bw.onclick = () => rpOpenCode(state.games.botw.code);
  nav.onClick = async e => {
    const b = e.target.closest("[data-card]");
    if (b) { const it = unlockOf("card", b.dataset.card), use = () => { G.card = it.id; save(); renderCard(); };
      Sound.play("select"); if (owns("card", it.id)) use(); else offerUnlock(it, use); return; }
    if (e.target.closest("[data-cardmore]")) { toast("Become a region’s Champion to get its card design."); return; }
    const tb = e.target.closest("[data-title]");
    if (tb) { G.title = tb.dataset.title; save(); document.querySelectorAll("[data-title]").forEach(x => x.setAttribute("aria-pressed", x === tb)); Sound.play("select"); draw(); return; }
    const ib = e.target.closest("[data-icon]");
    if (ib) { G.icon = ib.dataset.icon || null; save(); document.querySelectorAll("[data-icon]").forEach(x => x.setAttribute("aria-pressed", x === ib)); Sound.play("select"); renderAcct(); draw(); return; }
    if (e.target.closest("[data-iconshop]")) { shopCat = "icon"; openScreen("shop"); return; }
    const sv = e.target.closest("[data-scstyle] [data-v]");
    if (sv) { G.showcase.style = sv.dataset.v; save(); document.querySelectorAll("[data-scstyle] [data-v]").forEach(x => x.setAttribute("aria-pressed", x === sv)); Sound.play("select"); friendsAfterSync(); return; }
    if (e.target.closest("#cardSave")) {
      const blob = await new Promise(r => $("cardCv").toBlob(r, "image/png"));
      state.games.cards++; save();
      if (!(await saveFile(`trainer-card-${(profile && profile.name || "guest").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`, blob))) $("cardOut").innerHTML = `<p class="note">Saving files isn’t available here. Press and hold the card (or right-click it) to save it.</p><img class="gifout" src="${URL.createObjectURL(blob)}" alt="Your trainer card">`;
    }
  };
  setMusic("title");
}

