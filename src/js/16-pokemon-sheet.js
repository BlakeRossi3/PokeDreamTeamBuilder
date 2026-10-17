// ================= POKÉMON SHEET: Battle (everything that changes a battle) + Personalize (looks only) =================
// ---- item icons (official bag icons, one 32×32 sheet: packs/items.png) ----
const ITEM_ICONS = /*ITEMICONS*/;
const itemIcon = (name, big) => { const i = ITEM_ICONS.idx[name], c = ITEM_ICONS.cell, sc = big ? 2 : 1;
  if (i === undefined) return `<i class="itm none${big ? " big" : ""}" aria-hidden="true"></i>`;
  return `<i class="itm${big ? " big" : ""}" aria-hidden="true" style="background-position:${-(i % ITEM_ICONS.cols)*c*sc}px ${-Math.floor(i/ITEM_ICONS.cols)*c*sc}px;background-size:${ITEM_ICONS.cols*c*sc}px ${ITEM_ICONS.rows*c*sc}px"></i>`; };
const ITEM_IDX = new Map(ITEMS.map((it, i) => [it[0], i]));
document.documentElement.style.setProperty("--itm-sheet", `url("${packUrl("items.png")}")`);
const itemDesc = name => { const i = ITEM_IDX.get(name); return i === undefined ? (BAG_ITEMS[name] || {}).d || "" : (LSDATA && LSDATA.ID && LSDATA.ID[i]) || ITEMS[i][1]; };
// ---- moves: category icons, descriptions, how they're learned ----
const CAT_SVG = {P:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1l1.6 3.7 3.9-1.2-1.7 3.6 3.2 2.3-3.9.7.2 4-3.3-2.3L4.7 14l.2-4L1 9.4l3.2-2.3L2.5 3.5l3.9 1.2z" fill="currentColor"/></svg>',
  S:'<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="8" r="2.6" fill="currentColor"/></svg>',
  X:'<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 1.5a6.5 6.5 0 0 1 0 13a3.25 3.25 0 0 1 0-6.5a3.25 3.25 0 0 0 0-6.5z" fill="currentColor"/></svg>'};
const catIcon = mv => `<span class="cat-ic cat-${mv[2]}" title="${catName(mv)}">${CAT_SVG[mv[2]] || CAT_SVG.X}</span>`;
const MOVE_IDX = new Map(MOVES.map((m, i) => [m[0], i]));
const moveDesc = (mv, full) => { const i = MOVE_IDX.get(mv[0]); return LSDATA ? ((full ? LSDATA.MF : LSDATA.MD) || [])[i] || "" : ""; };
const LEARN_LBL = {L:"Level", M:"TM", E:"Egg", T:"Tutor", S:"Event", V:"Transfer", P:"Pre-evolution", D:"Dream World", R:"Special"};
const learnTag = c => !c ? "" : c[0] === "L" ? `Lv ${c.slice(1)}` : LEARN_LBL[c[0]] || c;
function learnInfo(n){
  if (!LSDATA) return new Map();
  const key = LSDATA.LS[String(n)] ? String(n) : String(baseOf(n)), ls = LSDATA.LS[key] || [], lm = (LSDATA.LM || {})[key] || [];
  return new Map(ls.map((i, k) => [MOVES[i] && MOVES[i][0], lm[k] || ""]).filter(x => x[0]));
}
const STAT_SHORT = {hp:"HP", atk:"Atk", def:"Def", spa:"SpA", spd:"SpD", spe:"Spe"};
const natureLabel = n => { const x = NATURES[n] || []; return x.length ? `${n} (+${STAT_SHORT[x[0]]} −${STAT_SHORT[x[1]]})` : `${n} (neutral)`; };
const POPULAR_ITEMS = ["Leftovers", "Life Orb", "Choice Band", "Choice Specs", "Choice Scarf", "Focus Sash", "Assault Vest", "Sitrus Berry", "Lum Berry", "Heavy-Duty Boots", "Rocky Helmet", "Eviolite", "Expert Belt", "Weakness Policy", "Air Balloon", "Black Sludge", "Booster Energy", "Light Clay", "Covert Cloak", "Clear Amulet", "Loaded Dice", "Toxic Orb", "Flame Orb", "King's Rock", "Scope Lens", "Quick Claw", "White Herb", "Mental Herb", "Shell Bell", "Muscle Band", "Wise Glasses", "Throat Spray", "Power Herb", "Red Card", "Eject Button", "Safety Goggles", "Punching Glove", "Mirror Herb"];
const EV_PRESETS = [["Fast physical", {atk:252, spe:252, hp:4}], ["Fast special", {spa:252, spe:252, hp:4}], ["Bulky physical", {hp:252, atk:252, def:4}], ["Bulky special", {hp:252, spa:252, spd:4}], ["Physical wall", {hp:252, def:252, spd:4}], ["Special wall", {hp:252, spd:252, def:4}], ["Mixed bulk", {hp:252, def:128, spd:128}], ["Even spread", {hp:84, atk:84, def:84, spa:84, spd:84, spe:84}]];
const memberLevel = (id, n) => memberOf(id, n).level || 50;

// ---- the Battle tab ----
function moveSlot(mv, i, n){
  if (!mv) return `<div class="mslot empty"><button class="mslot-main" type="button" data-mslot="${i}"><b>＋ Choose move ${i + 1}</b><span>Tap to pick from everything it can learn</span></button></div>`;
  const off = !moveWorks(mv);
  return `<div class="mslot" style="${tStyle(mv[1])}"><button class="mslot-main" type="button" data-mslot="${i}" title="${esc(moveDesc(mv) || mv[0])}">
      <b>${esc(mv[0])}</b><span>${catIcon(mv)}${mv[1]} · ${catName(mv)}${mv[3] ? ` · ${mv[3]} power` : ""}${mv[4] ? ` · ${mv[4]}%` : ""} · ${maxPP(mv)} PP${off ? " · <i>no effect here</i>" : ""}</span></button>
    <span class="mslot-tools"><button class="btn sm" type="button" data-mup="${i}" aria-label="Move ${esc(mv[0])} up" ${i === 0 ? "disabled" : ""}>▲</button><button class="btn sm" type="button" data-mdn="${i}" aria-label="Move ${esc(mv[0])} down" ${i >= n - 1 ? "disabled" : ""}>▼</button><button class="btn sm" type="button" data-mrm="${i}" aria-label="Forget ${esc(mv[0])}">✕</button></span></div>`;
}
function battleHTML(num, id = state.team){
  const M = memberOf(id, num), m = NAT_BY.get(num), ready = !!LSDATA, abil = abilitiesOf(num), mv = movesOf(id, num), ha = LSDATA && (LSDATA.HA || {})[String(num)];
  const it = M.item, mega = isMega(num);
  return `<div class="bsheet" id="bsRoot">
    <div class="bs-top">
      <label class="field">Ability<select class="select" id="bAbil">${ready ? "" : `<option value="">Loading…</option>`}${abil.map(a => `<option value="${esc(a)}" ${(M.ability || defaultAbility(num)) === a ? "selected" : ""}>${esc(a)}${a === ha ? " (hidden)" : ""}${ABIL_WORKS.has(a) ? "" : " · no effect here"}</option>`).join("")}${M.ability && !abil.includes(M.ability) ? `<option selected>${esc(M.ability)}</option>` : ""}</select></label>
      <div class="field">Held item${mega ? `<div class="item-pick disabled">${itemIcon("")}<span><b>No item</b><small>Mega Pokémon can’t hold items.</small></span></div>` : `<button class="item-pick" type="button" id="bItemBtn">${itemIcon(it)}<span><b>${it ? esc(it) : "No item"}</b><small>${it ? (itemWorks(it) ? `<em class="ok">Works in battle</em>` : `<em class="no">No battle effect here</em>`) : "Tap to choose an item"}</small></span><span class="chev" aria-hidden="true">›</span></button>`}</div>
      <label class="field">Level<input id="bLevel" type="number" inputmode="numeric" min="1" max="100" value="${memberLevel(id, num)}"></label>
      <label class="field">Nature<select class="select" id="bNature">${NATURE_NAMES.map(n => `<option value="${n}" ${(M.nature || "Hardy") === n ? "selected" : ""}>${natureLabel(n)}</option>`).join("")}</select></label>
    </div>
    <p class="note bs-desc" id="bDesc"></p>
    <div class="cov-h">Moves <span class="meta" id="bMvNote">${ready ? `${learnset(num).length} it can learn` : "Loading moves…"}</span></div>
    <div class="mslots" id="bMoves">${[0, 1, 2, 3].map(i => moveSlot(mv[i], i, mv.length)).join("")}</div>
    <div class="cov-h">Stats <span class="meta">EVs <b id="bEvTot">0</b> / 510</span></div>
    <div class="ev-tools"><select class="select" id="bPreset" aria-label="EV spread"><option value="">EV spread…</option>${EV_PRESETS.map(([n], k) => `<option value="${k}">${n}</option>`).join("")}<option value="clear">Clear EVs</option></select><button class="btn sm" type="button" id="bIvMax">IVs all 31</button></div>
    <div class="sgrid" id="bStats"></div>
    <div class="bs-two"><div><div class="cov-h">Type matchups</div><div id="bMatch"></div></div><div><div class="cov-h">Move coverage</div><div id="bCov"></div></div></div>
    <p class="note">${m.name}’s level is used in Versus. Gyms, the Elite Four and rival battles set the level for both sides.</p>
  </div>`;
}
function wireBattle(root, num, id = state.team, onChange){
  const m = NAT_BY.get(num);
  const changed = () => { renderTeam(); if (onChange) onChange(); };
  const M = () => memberOf(id, num);
  const desc = () => { const a = M().ability || defaultAbility(num), lines = [];
    if (a && ABIL[a]) lines.push(`<b>${esc(a)}:</b> ${esc(ABIL[a])}${ABIL_WORKS.has(a) ? "" : " <i>(No effect in these battles.)</i>"}`);
    const it = M().item; if (it) lines.push(`<b>${esc(it)}:</b> ${esc(itemDesc(it))}`);
    root.querySelector("#bDesc").innerHTML = lines.join("<br>"); };
  const stats = () => {
    const X = M(), L = memberLevel(id, num), nat = NATURES[X.nature || "Hardy"] || [], evs = {hp:0, atk:0, def:0, spa:0, spd:0, spe:0, ...(X.evs || {})}, ivs = {hp:31, atk:31, def:31, spa:31, spd:31, spe:31, ...(X.ivs || {})};
    const st = calcStats(m.stats, L, X.nature || "Hardy", evs, ivs, baseOf(num) === 292), tot = Object.values(evs).reduce((a, b) => a + b, 0);
    root.querySelector("#bEvTot").textContent = tot;
    const g = root.querySelector("#bStats");
    if (!g.dataset.built) {
      g.dataset.built = 1;
      g.innerHTML = `<div class="sg-row hdr"><span class="sg-l">Stat</span><span class="sg-b">Base</span><span class="sg-ev">EVs</span><span class="sg-iv">IV</span><span class="sg-v">Lv ${L}</span></div>` + STATS6.map((k, i) => `<div class="sg-row">
        <span class="sg-l">${STAT_SHORT[k]}</span><span class="sg-b"><b>${m.stats[i]}</b><i style="width:${Math.min(100, m.stats[i]/200*100)}%;--sc:${statColor(m.stats[i])}"></i></span>
        <span class="sg-ev"><input type="range" min="0" max="252" step="4" data-ev="${k}" aria-label="${STAT_NAME[k]} EVs"><input type="number" min="0" max="252" data-evn="${k}" aria-label="${STAT_NAME[k]} EVs (number)"></span>
        <span class="sg-iv"><input type="number" min="0" max="31" data-iv="${k}" aria-label="${STAT_NAME[k]} IV"></span>
        <span class="sg-v" data-sv="${k}"></span></div>`).join("") + `<div class="sg-row tot"><span class="sg-l">Total</span><span class="sg-b"><b>${bst(m)}</b></span><span class="sg-ev"></span><span class="sg-iv"></span><span class="sg-v" data-sv="tot"></span></div>`;
    }
    for (const k of STATS6) {
      const r = g.querySelector(`[data-ev="${k}"]`), nb = g.querySelector(`[data-evn="${k}"]`), iv = g.querySelector(`[data-iv="${k}"]`), v = g.querySelector(`[data-sv="${k}"]`);
      if (document.activeElement !== r) r.value = evs[k]; if (document.activeElement !== nb) nb.value = evs[k]; if (document.activeElement !== iv) iv.value = ivs[k];
      const up = nat[0] === k, dn = nat[1] === k;
      v.innerHTML = `${st[k]}${up ? '<em class="nat up" title="Raised by its nature">▲</em>' : dn ? '<em class="nat dn" title="Lowered by its nature">▼</em>' : ""}`; v.className = "sg-v" + (up ? " up" : dn ? " dn" : "");
    }
    g.querySelector('[data-sv="tot"]').textContent = STATS6.reduce((a, k) => a + st[k], 0);
  };
  const matchups = () => {
    const t = TYPE_ORDER.map(a => [a, effOf(a, m.types)]);
    const row = (lbl, list) => list.length ? `<div class="mu"><span>${lbl}</span>${list.map(([a, e]) => `<span class="tb" style="${tStyle(a)}">${a}${e >= 4 ? " ×4" : e === .25 ? " ×¼" : ""}</span>`).join("")}</div>` : "";
    root.querySelector("#bMatch").innerHTML = row("Weak to", t.filter(x => x[1] >= 2)) + row("Resists", t.filter(x => x[1] > 0 && x[1] < 1)) + row("Immune", t.filter(x => x[1] === 0)) || `<p class="meta">No weaknesses</p>`;
  };
  const coverage = () => {
    const dm = movesOf(id, num).filter(isDmg).filter(mv => mv[1] !== "???"), el = root.querySelector("#bCov");
    if (!dm.length) { el.innerHTML = `<p class="meta">Pick damaging moves to see what they hit.</p>`; return; }
    const best = d => Math.max(...dm.map(mv => effOf(mv[1], [d])));
    const se = TYPE_ORDER.filter(d => best(d) >= 2), weak = TYPE_ORDER.filter(d => best(d) < 1);
    el.innerHTML = `<div class="mu"><span>Super effective on</span>${se.length ? se.map(a => `<span class="tb" style="${tStyle(a)}">${a}</span>`).join("") : `<span class="meta">nothing</span>`}</div>${weak.length ? `<div class="mu"><span>Walled by</span>${weak.map(a => `<span class="tb dim" style="${tStyle(a)}">${a}</span>`).join("")}</div>` : `<div class="mu"><span class="meta">No type resists all its moves.</span></div>`}`;
  };
  const moves = () => { const mv = movesOf(id, num); root.querySelector("#bMoves").innerHTML = [0, 1, 2, 3].map(i => moveSlot(mv[i], i, mv.length)).join(""); coverage(); };
  const all = () => { desc(); stats(); matchups(); moves(); };
  all();
  if (!LSDATA) loadLearnsets().then(() => { if (!root.isConnected) return;
    const sel = root.querySelector("#bAbil"), cur = M().ability || defaultAbility(num), ha = (LSDATA.HA || {})[String(num)];
    sel.innerHTML = abilitiesOf(num).map(a => `<option value="${esc(a)}" ${cur === a ? "selected" : ""}>${esc(a)}${a === ha ? " (hidden)" : ""}${ABIL_WORKS.has(a) ? "" : " · no effect here"}</option>`).join("");
    root.querySelector("#bMvNote").textContent = `${learnset(num).length} it can learn`; all(); }).catch(() => { if (root.isConnected) root.querySelector("#bMvNote").textContent = "Couldn’t load this Pokémon’s moves."; });
  const setEV = (k, v) => { const X = M(), evs = {...(X.evs || {})}; const others = STATS6.filter(x => x !== k).reduce((a, x) => a + (evs[x] || 0), 0); evs[k] = Math.max(0, Math.min(252, EV_TOTAL - others, Math.round(+v || 0))); setMember(id, num, {evs}); stats(); changed(); };
  const setIV = (k, v) => { const ivs = {...(M().ivs || {})}; ivs[k] = Math.max(0, Math.min(31, Math.round(+v || 0))); setMember(id, num, {ivs}); stats(); changed(); };
  root.addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.ev) setEV(t.dataset.ev, t.value);
    else if (t.dataset.evn && t.value !== "") setEV(t.dataset.evn, t.value);
  });
  root.addEventListener("change", e => {
    const t = e.target;
    if (t.dataset.iv) setIV(t.dataset.iv, t.value);
    else if (t.dataset.evn) setEV(t.dataset.evn, t.value);
    else if (t.id === "bAbil") { setMember(id, num, {ability:t.value}); desc(); changed(); }
    else if (t.id === "bNature") { setMember(id, num, {nature:t.value}); stats(); changed(); }
    else if (t.id === "bLevel") { const L = Math.max(1, Math.min(100, Math.round(+t.value || 50))); t.value = L; setMember(id, num, {level:L}); root.querySelector("#bStats").dataset.built = ""; stats(); changed(); }
    else if (t.id === "bPreset") { if (t.value === "clear") setMember(id, num, {evs:{}}); else if (t.value !== "") setMember(id, num, {evs:{...EV_PRESETS[+t.value][1]}}); t.value = ""; stats(); changed(); Sound.play("select"); }
  });
  root.addEventListener("click", e => {
    if (e.target.closest("#bIvMax")) { setMember(id, num, {ivs:{}}); stats(); changed(); Sound.play("select"); return; }
    if (e.target.closest("#bItemBtn")) { openItemPicker(num, id); return; }
    const sl = e.target.closest("[data-mslot]"); if (sl) { openMovePicker(num, +sl.dataset.mslot, id); return; }
    const mvs = movesOf(id, num).map(x => x[0]);
    const up = e.target.closest("[data-mup]"), dn = e.target.closest("[data-mdn]"), rm = e.target.closest("[data-mrm]");
    if (up || dn) { const k = +(up || dn).dataset[up ? "mup" : "mdn"], j = k + (up ? -1 : 1); if (j < 0 || j >= mvs.length) return; [mvs[k], mvs[j]] = [mvs[j], mvs[k]]; setMember(id, num, {moves:mvs}); moves(); changed(); Sound.play("select"); return; }
    if (rm) { mvs.splice(+rm.dataset.mrm, 1); setMember(id, num, {moves:mvs}); moves(); changed(); Sound.play("select"); }
  });
}
// after a picker closes: back to wherever it was opened (the sheet, or the View team panel)
function sheetBack(num, id){ if (!$("view").hidden && viewSel === num) { closeModal(); renderViewPanel(); } else openSheet(num, "battle"); }

// ---- move picker ----
let mpState = {sort:"rec", dir:-1, type:"", cat:"", how:"", stab:false, cov:false, q:""};
function moveScore(num, mv, have){
  const sp = NAT_BY.get(num), phys = sp.stats[1] >= sp.stats[3], fx = mv[8] || {}, nm = mv[0];
  if (!moveWorks(mv)) return 0;
  if (isDmg(mv)) {
    let p = mv[3] || (fx.fd || ["Super Fang", "Ruination", "Final Gambit", "Endeavor"].includes(nm) ? 70 : ["Low Kick", "Grass Knot", "Heavy Slam", "Heat Crash", "Gyro Ball", "Electro Ball"].includes(nm) ? 80 : ["Eruption", "Water Spout", "Dragon Energy"].includes(nm) ? 150 : 50);
    const h = fx.mh ? (Array.isArray(fx.mh) ? 3.1 : nm === "Triple Axel" ? 5 : fx.mh) : 1;
    let sc = p*h*(mv[4] ? mv[4]/100 : 1.05);
    if (sp.types.includes(mv[1])) sc *= 1.5;
    sc *= (mv[2] === "P") === phys ? 1.15 : .7;
    if (fx.sv === "mustrecharge" || fl(mv, "2")) sc *= .55; if (fx.sd) sc *= .3; if (fx.ohko) sc = 45; if (fx.r) sc *= .92;
    if (fx.sb && Object.values(fx.sb).some(v => v < 0)) sc *= .9; if (mv[6] > 0) sc += 18;
    if (fx.sec) sc += 6;
    const cur = have.filter(isDmg), gain = TYPE_ORDER.filter(d => effOf(mv[1], [d]) >= 2 && !cur.some(x => effOf(x[1], [d]) >= 2)).length;
    return sc + gain*7 + (fx.ss ? 8 : 0);
  }
  const top = phys ? "atk" : "spa", b = fx.b || {};
  if (fx.t === "self" && b[top] > 0) return 92 + b[top]*6 + (b.spe > 0 ? 8 : 0);
  if (fx.h || ["Synthesis", "Moonlight", "Morning Sun", "Shore Up", "Roost", "Strength Sap", "Wish"].includes(nm)) return 84;
  if (fx.st === "slp") return mv[4] && mv[4] < 80 ? 70 : 88; if (fx.st) return 74;
  if (fx.sc === "stealthrock") return 80; if (fx.sc) return 60;
  if (fx.v && PROTECTS.has(fx.v)) return 58; if (fx.v === "substitute" || fx.v === "leechseed" || fx.v === "taunt") return 62;
  if (fx.ss || fx.w || fx.ter) return 55;
  if (fx.b) return fx.t === "self" ? 50 : 40;
  return 25;
}
function openMovePicker(num, slot, id = state.team){
  const m = NAT_BY.get(num), md = openModal(`<div class="mp" id="mpRoot"><div class="pk-head"><button class="btn sm" type="button" id="mpBack">← Back</button><h3 class="mt" id="modalTitle">${esc(nickOf(id, num))}: move ${slot + 1}</h3></div><p class="meta" id="mpLoad">Loading moves…</p></div>`, {wide:true, sheet:true});
  md.querySelector("#mpBack").onclick = () => sheetBack(num, id);
  loadLearnsets().then(() => { if (md.querySelector("#mpRoot")) drawPicker(); }).catch(() => { md.querySelector("#mpLoad").textContent = "Couldn’t load the move list. Check your connection and try again."; });
  function drawPicker(){
    const how = learnInfo(num), all = learnset(num), have = movesOf(id, num), known = new Set(have.map(x => x[0]));
    const types = [...new Set(all.map(x => x[1]))].sort((a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b));
    const S = mpState; let sel = have[slot] ? have[slot][0] : null;
    md.querySelector("#mpRoot").innerHTML = `<div class="pk-head"><button class="btn sm" type="button" id="mpBack">← Back</button><h3 class="mt" id="modalTitle">${esc(nickOf(id, num))}: move ${slot + 1}</h3></div>
      <div class="mp-tools">
        <input class="search" id="mpQ" type="search" placeholder="Search ${all.length} moves" value="${esc(S.q)}" autocomplete="off" aria-label="Search moves">
        <select class="select" id="mpType" aria-label="Type"><option value="">All types</option>${types.map(t => `<option ${S.type === t ? "selected" : ""}>${t}</option>`).join("")}</select>
        <div class="segrow" id="mpCat" role="group" aria-label="Category">${[["", "All"], ["P", "Physical"], ["S", "Special"], ["X", "Status"]].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${S.cat === v}">${v ? catIcon(["", "", v]) : ""}${l}</button>`).join("")}</div>
        <select class="select" id="mpHow" aria-label="How it’s learned"><option value="">Any way to learn</option>${["L", "M", "E", "T", "P", "S", "V"].map(c => `<option value="${c}" ${S.how === c ? "selected" : ""}>${LEARN_LBL[c]}</option>`).join("")}</select>
        <label class="chk"><input type="checkbox" id="mpStab" ${S.stab ? "checked" : ""}> Same type (STAB)</label>
        <label class="chk"><input type="checkbox" id="mpCov" ${S.cov ? "checked" : ""}> Hits new types</label>
      </div>
      <div class="mp-body"><div class="mp-list" id="mpList" role="listbox" tabindex="0" aria-label="Moves"></div><aside class="mp-detail" id="mpDetail" aria-live="polite"></aside></div>`;
    md.querySelector("#mpBack").onclick = () => sheetBack(num, id);
    const sortB = (k, l, t) => `<button type="button" class="mp-sort${S.sort === k ? " on" : ""}" data-sort="${k}" title="Sort by ${t}" aria-label="Sort by ${t}">${l}${S.sort === k ? (S.dir === -1 ? " ▼" : " ▲") : ""}</button>`;
    const key = {rec:mv => moveScore(num, mv, have), name:mv => mv[0], type:mv => TYPE_ORDER.indexOf(mv[1]), cat:mv => "PSX".indexOf(mv[2]), pow:mv => mv[3] || 0, acc:mv => mv[4] || 101, pp:mv => mv[5]};
    let rows = [];
    const list = md.querySelector("#mpList"), det = md.querySelector("#mpDetail");
    const filter = () => {
      const q = S.q.trim().toLowerCase(), curDm = have.filter((x, k) => k !== slot && isDmg(x));
      rows = all.filter(mv => (!q || mv[0].toLowerCase().includes(q) || mv[1].toLowerCase() === q) && (!S.type || mv[1] === S.type) && (!S.cat || mv[2] === S.cat)
        && (!S.how || (how.get(mv[0]) || "")[0] === S.how) && (!S.stab || (isDmg(mv) && m.types.includes(mv[1])))
        && (!S.cov || (isDmg(mv) && TYPE_ORDER.some(d => effOf(mv[1], [d]) >= 2 && !curDm.some(x => effOf(x[1], [d]) >= 2)))));
      const k = key[S.sort] || key.rec, ks = new Map(rows.map(mv => [mv[0], k(mv)]));
      rows.sort((a, b) => { const x = ks.get(a[0]), y = ks.get(b[0]); return (x < y ? -1 : x > y ? 1 : a[0].localeCompare(b[0]))*(S.sort === "rec" ? -1 : S.dir); });
      if (S.sort === "rec" && S.dir === 1) rows.reverse();
      list.innerHTML = `<div class="mp-row hdr" role="presentation">${sortB("type", "Type", "Type")}${sortB("cat", "Cat", "Category")}<span class="mp-hn">${sortB("name", "Move", "Name")}${sortB("rec", "★ Best", "Recommended")}</span>${sortB("pow", "Pow", "Power")}${sortB("acc", "Acc", "Accuracy")}${sortB("pp", "PP", "PP")}</div>`
        + rows.map(mv => { const c = how.get(mv[0]), kn = known.has(mv[0]) && have[slot] && have[slot][0] !== mv[0], cur = have[slot] && have[slot][0] === mv[0];
          return `<div class="mp-row${sel === mv[0] ? " sel" : ""}${!moveWorks(mv) ? " off" : ""}" role="option" aria-selected="${sel === mv[0]}" data-mv="${esc(mv[0])}" id="mpo-${MOVE_IDX.get(mv[0])}">
            <span class="mp-ty tb" style="${tStyle(mv[1])}">${ABBR(mv[1])}</span>${catIcon(mv)}
            <span class="mp-nm"><b>${esc(mv[0])}</b>${cur ? ` <span class="pill">Current</span>` : kn ? ` <span class="pill mute">Known</span>` : ""}${c ? ` <span class="lt">${learnTag(c)}</span>` : ""}${mv[6] ? ` <span class="lt pr">Priority ${mv[6] > 0 ? "+" : ""}${mv[6]}</span>` : ""}<small>${esc(moveDesc(mv))}</small></span>
            <span class="mp-n">${mv[3] || "—"}</span><span class="mp-n">${mv[4] || "—"}</span><span class="mp-n">${maxPP(mv)}</span></div>`; }).join("")
        + (rows.length ? "" : `<p class="meta" style="padding:12px">No move matches these filters.</p>`);
      detail();
    };
    const detail = () => {
      const mv = sel && MOVE_BY.get(sel);
      if (!mv) { det.innerHTML = `<p class="meta">Pick a move to see what it does. Double-click (or press Enter) to teach it.</p>`; return; }
      const fx = mv[8] || {}, sec = (fx.sec || []).find(x => x.st || x.v || x.b), c = how.get(mv[0]), cur = have[slot] && have[slot][0] === mv[0], other = have.findIndex((x, k) => k !== slot && x[0] === mv[0]);
      det.innerHTML = `<div class="mpd-h" style="${tStyle(mv[1])}"><b>${esc(mv[0])}</b><span>${catIcon(mv)}${mv[1]} · ${catName(mv)}</span></div>
        <dl class="mpd"><dt>Power</dt><dd>${mv[3] || "—"}</dd><dt>Accuracy</dt><dd>${mv[4] ? mv[4] + "%" : "Never misses"}</dd><dt>PP</dt><dd>${mv[5]} (max ${maxPP(mv)})</dd><dt>Priority</dt><dd>${mv[6] > 0 ? "+" : ""}${mv[6]}</dd><dt>Contact</dt><dd>${fl(mv, "c") ? "Yes" : "No"}</dd>${sec ? `<dt>Effect chance</dt><dd>${sec.c}%</dd>` : ""}${c ? `<dt>Learned by</dt><dd>${learnTag(c)}</dd>` : ""}</dl>
        <p class="mpd-d">${esc(moveDesc(mv, true) || moveDesc(mv))}</p>${moveWorks(mv) ? "" : `<p class="note">This move has no effect in these battles.</p>`}
        <button class="btn primary mpd-go" type="button" id="mpTeach" ${cur ? "disabled" : ""}>${cur ? "Already in this slot" : other >= 0 ? `Move it to slot ${slot + 1}` : `Teach ${esc(mv[0])}`}</button>`;
    };
    const teach = name => {
      const mvs = movesOf(id, num).map(x => x[0]), o = mvs.indexOf(name);
      if (o >= 0) { if (o === slot) return; mvs.splice(o, 1); }
      const at = Math.min(slot, mvs.length); if (mvs[at] && o < 0) mvs[at] = name; else mvs.splice(at, 0, name);
      setMember(id, num, {moves:[...new Set(mvs)].slice(0, 4)}); renderTeam(); Sound.play("confirm"); toast(`${nickOf(id, num)} learned ${name}!`); sheetBack(num, id);
    };
    const pickRow = (name, scroll) => { sel = name; list.querySelectorAll(".mp-row.sel").forEach(r => { r.classList.remove("sel"); r.setAttribute("aria-selected", "false"); }); const r = name && list.querySelector(`[data-mv="${CSS.escape(name)}"]`); if (r) { r.classList.add("sel"); r.setAttribute("aria-selected", "true"); list.setAttribute("aria-activedescendant", r.id); if (scroll) r.scrollIntoView({block:"nearest"}); } detail(); };
    md.querySelector("#mpQ").addEventListener("input", e => { S.q = e.target.value; filter(); });
    md.querySelector("#mpQ").addEventListener("keydown", e => { if (e.key === "ArrowDown") { e.preventDefault(); list.focus(); if (rows[0]) pickRow(rows[0][0], true); } else if (e.key === "Enter" && rows[0]) { e.preventDefault(); pickRow(rows[0][0], true); list.focus(); } });
    md.querySelector("#mpType").onchange = e => { S.type = e.target.value; filter(); };
    md.querySelector("#mpHow").onchange = e => { S.how = e.target.value; filter(); };
    md.querySelector("#mpStab").onchange = e => { S.stab = e.target.checked; filter(); };
    md.querySelector("#mpCov").onchange = e => { S.cov = e.target.checked; filter(); };
    md.querySelector("#mpCat").onclick = e => { const b = e.target.closest("[data-v]"); if (!b) return; S.cat = b.dataset.v; md.querySelectorAll("#mpCat [data-v]").forEach(x => x.setAttribute("aria-pressed", x === b)); filter(); };
    list.addEventListener("click", e => {
      const so = e.target.closest("[data-sort]"); if (so) { const k = so.dataset.sort; if (S.sort === k) S.dir = -S.dir; else { S.sort = k; S.dir = k === "name" || k === "type" || k === "cat" ? 1 : -1; } filter(); return; }
      const r = e.target.closest("[data-mv]"); if (r) pickRow(r.dataset.mv);
    });
    list.addEventListener("dblclick", e => { const r = e.target.closest("[data-mv]"); if (r) teach(r.dataset.mv); });
    list.addEventListener("keydown", e => {
      const i = rows.findIndex(x => x[0] === sel);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const j = Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1))); if (rows[j]) pickRow(rows[j][0], true); }
      else if (e.key === "Home" || e.key === "End") { e.preventDefault(); const r = e.key === "Home" ? rows[0] : rows[rows.length - 1]; if (r) pickRow(r[0], true); }
      else if (e.key === "Enter" && sel) { e.preventDefault(); teach(sel); }
      else if (e.key === "/") { e.preventDefault(); md.querySelector("#mpQ").focus(); }
    });
    det.addEventListener("click", e => { if (e.target.closest("#mpTeach") && sel) teach(sel); });
    filter(); if (sel) pickRow(sel, true);
    md.querySelector("#mpQ").focus();
  }
}

// ---- item picker (a pop-up like the trainer picker) ----
const ITEM_TABS = [["pop", "Popular"], ["battle", "Works in battle"], ["berry", "Berries"], ["type", "Type boosters"], ["plate", "Plates, Memories & Gems"], ["z", "Z-Crystals"], ["other", "No battle effect"], ["all", "Everything"]];
let ipTab = "pop";
function openItemPicker(num, id = state.team){
  const cur = memberOf(id, num).item || "", pool = ITEMS.filter(it => it[2] !== "ball");
  let sel = cur, q = "";
  const md = openModal(`<div class="ip"><div class="pk-head"><button class="btn sm" type="button" id="ipBack">← Back</button><h3 class="mt" id="modalTitle">Held item for ${esc(nickOf(id, num))}</h3></div>
    <input class="search tsearch" id="ipQ" type="search" placeholder="Search ${pool.length} items" autocomplete="off" aria-label="Search items">
    <div class="segrow ip-tabs" id="ipTabs" role="group">${ITEM_TABS.map(([k, l]) => `<button type="button" data-ipt="${k}" aria-pressed="${ipTab === k}">${l}</button>`).join("")}</div>
    <div class="ip-body"><div class="ip-grid" id="ipGrid"></div><aside class="ip-detail" id="ipDet" aria-live="polite"></aside></div></div>`, {wide:true, sheet:true});
  const inTab = it => { const [nm, , cat] = it;
    switch (ipTab) {
      case "pop": return POPULAR_ITEMS.includes(nm);
      case "battle": return itemWorks(nm) && cat === "held";
      case "berry": return cat === "berry";
      case "type": return cat === "type";
      case "plate": return cat === "plate" || cat === "memory" || cat === "drive" || cat === "gem";
      case "z": return cat === "z";
      case "other": return !itemWorks(nm);
      default: return true;
    } };
  const draw = () => {
    const qq = q.trim().toLowerCase();
    let list = pool.filter(it => qq ? it[0].toLowerCase().includes(qq) : inTab(it));
    if (ipTab === "pop" && !qq) list.sort((a, b) => POPULAR_ITEMS.indexOf(a[0]) - POPULAR_ITEMS.indexOf(b[0]));
    md.querySelector("#ipGrid").innerHTML = list.map(it => `<button class="ip-it${it[0] === sel ? " sel" : ""}${it[0] === cur ? " cur" : ""}${itemWorks(it[0]) ? "" : " off"}" type="button" data-it="${esc(it[0])}" aria-pressed="${it[0] === sel}" title="${esc(it[0])}">${itemIcon(it[0])}<span>${esc(it[0])}</span></button>`).join("") || `<p class="meta">No item matches “${esc(q)}”.</p>`;
    detail();
  };
  const detail = () => {
    const d = md.querySelector("#ipDet");
    if (!sel) { d.innerHTML = `<p class="meta">${cur ? "" : "No item held. "}Pick an item to see what it does.</p>${cur ? `<button class="btn" type="button" id="ipRemove">Remove ${esc(cur)}</button>` : ""}`; return; }
    const works = itemWorks(sel);
    d.innerHTML = `<div class="ipd-h">${itemIcon(sel, true)}<div><b>${esc(sel)}</b><span class="badge ${works ? "ok" : "no"}">${works ? "Works in battle" : "No battle effect here"}</span></div></div>
      <p class="mpd-d">${esc(itemDesc(sel))}</p>
      <div class="actions"><button class="btn primary" type="button" id="ipGive" ${sel === cur ? "disabled" : ""}>${sel === cur ? "Holding it now" : `Give ${esc(sel)}`}</button>${cur ? `<button class="btn" type="button" id="ipRemove">Remove item</button>` : ""}</div>`;
  };
  const done = (it, msg) => { setMember(id, num, {item:it}); renderTeam(); Sound.play("confirm"); toast(msg); sheetBack(num, id); };
  md.querySelector("#ipBack").onclick = () => sheetBack(num, id);
  md.querySelector("#ipQ").addEventListener("input", e => { q = e.target.value; draw(); });
  md.querySelector("#ipTabs").onclick = e => { const b = e.target.closest("[data-ipt]"); if (!b) return; ipTab = b.dataset.ipt; md.querySelectorAll("[data-ipt]").forEach(x => { x.setAttribute("aria-pressed", x === b); x.setAttribute("aria-selected", x === b); }); Sound.play("select"); draw(); };
  md.querySelector("#ipGrid").addEventListener("click", e => { const b = e.target.closest("[data-it]"); if (!b) return; sel = b.dataset.it; md.querySelectorAll(".ip-it.sel").forEach(x => { x.classList.remove("sel"); x.setAttribute("aria-pressed", "false"); }); b.classList.add("sel"); b.setAttribute("aria-pressed", "true"); detail(); });
  md.querySelector("#ipGrid").addEventListener("dblclick", e => { const b = e.target.closest("[data-it]"); if (b && b.dataset.it !== cur) done(b.dataset.it, `${nickOf(id, num)} is now holding ${b.dataset.it}.`); });
  md.querySelector("#ipDet").addEventListener("click", e => {
    if (e.target.closest("#ipGive") && sel) done(sel, `${nickOf(id, num)} is now holding ${sel}.`);
    if (e.target.closest("#ipRemove")) done("", `${nickOf(id, num)} isn’t holding an item now.`);
  });
  if (cur && !pool.some(it => it[0] === cur && inTab(it))) ipTab = "all";
  md.querySelectorAll("[data-ipt]").forEach(x => { x.setAttribute("aria-pressed", x.dataset.ipt === ipTab); x.setAttribute("aria-selected", x.dataset.ipt === ipTab); });
  draw();
  const s = md.querySelector(".ip-it.sel"); if (s) s.scrollIntoView({block:"nearest"});
}

// ---- the Personalize tab: looks only (nickname, Poké Ball, shiny) ----
function personalHTML(num, id = state.team){
  const M = memberOf(id, num), m = NAT_BY.get(num), sh = isShinyMember(id, num);
  return `<div class="build" id="buildRoot">
    <label class="field">Nickname<input id="bNick" maxlength="12" placeholder="${esc(m.name)}" value="${esc(M.nick || "")}" autocomplete="off" spellcheck="false"></label>
    <div class="cov-h">Poké Ball <span class="meta" id="bBallName">${ballName(M.ball || "poke")}</span></div>
    <div class="ball-grid" role="radiogroup" aria-label="Poké Ball">${BALL_IDS.filter(b => owns("ball", b) || !isExclusive(unlockOf("ball", b)) || (M.ball || "poke") === b).map(b => { const ok = owns("ball", b) || (M.ball || "poke") === b;
      return `<button type="button" class="ball-opt${ok ? "" : " locked"}" role="radio" data-ball="${b}" aria-checked="${(M.ball || "poke") === b}" title="${ballName(b)}${ok ? "" : " (locked)"}" aria-label="${ballName(b)}${ok ? "" : ", locked"}">${ballImg(b)}</button>`; }).join("")}${BALL_IDS.some(b => !owns("ball", b) && isExclusive(unlockOf("ball", b))) ? `<button type="button" class="ball-opt mystery" data-ballmore title="More from Gym Leaders" aria-label="More Poké Balls come from Gym Leaders">?</button>` : ""}</div>
    <div class="cov-h">Colors</div>
    <div class="actions" style="margin-top:4px"><button class="btn" type="button" id="bShiny" aria-pressed="${sh}" ${state.shiny ? 'disabled title="Shiny is on for every sprite"' : ""}>${sh ? "✦ Shiny on" : "✦ Make shiny"}</button></div>
    <p class="note">Nothing here changes how it battles. Moves, ability, item, nature and stats are on the Battle tab.</p>
  </div>`;
}
function wirePersonal(md, num, id = state.team, onChange){
  const root = md.querySelector("#buildRoot");
  const refresh = () => { renderTeam(); if (onChange) { onChange(); return; } const h = md.querySelector("#modalTitle"); if (h) h.innerHTML = ballImg(ballOf(id, num), "ball-ic lg") + esc(nickOf(id, num)); };
  let nt = 0;
  root.querySelector("#bNick").addEventListener("input", e => { clearTimeout(nt); const v = e.target.value; nt = setTimeout(() => { setMember(id, num, {nick:v}); refresh(); }, 250); });
  root.addEventListener("click", e => {
    const nmEl = root.querySelector("#bBallName");
    if (e.target.closest("#bShiny")) { toggleMemberShiny(num); const sh = isShinyMember(id, num), b = root.querySelector("#bShiny"); b.setAttribute("aria-pressed", sh); b.textContent = sh ? "✦ Shiny on" : "✦ Make shiny"; paintAll(md); if (onChange) onChange(); return; }
    if (e.target.closest("[data-ballmore]")) { nmEl.textContent = "Rare Poké Balls are Gym Leader rewards"; return; }
    const bb = e.target.closest("[data-ballbuy]"); if (bb) { const it = unlockOf("ball", bb.dataset.ballbuy); if (buy(it)) { const o = root.querySelector(`[data-ball="${it.id}"]`); if (o) { o.classList.remove("locked"); o.click(); } } return; }
    const b = e.target.closest("[data-ball]"); if (!b) return;
    if (b.classList.contains("locked")) { const it = unlockOf("ball", b.dataset.ball); nmEl.innerHTML = `${esc(it.name)} <button class="btn sm primary" type="button" data-ballbuy="${it.id}">Unlock · ${fmtPP(it.price)}</button>`; Sound.play("select"); return; }
    setMember(id, num, {ball:b.dataset.ball});
    root.querySelectorAll("[data-ball]").forEach(x => x.setAttribute("aria-checked", x === b));
    root.querySelector("#bBallName").textContent = ballName(b.dataset.ball); refresh();
  });
}

const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/*ENGINE*/
const monFromTeam = (id, n, level = 50) => { const M = memberOf(id, n); return mkMon(n, {level, nick:M.nick, moves:movesOf(id, n), ability:M.ability, item:M.item, nature:M.nature, evs:M.evs, ivs:M.ivs, sh:isShinyMember(id, n) || state.shiny, ball:ballOf(id, n)}); };

