// ================= BATTLE SCREENS =================
const BADGE_NAMES = {1:["Boulder","Cascade","Thunder","Rainbow","Soul","Marsh","Volcano","Earth"], 2:["Zephyr","Hive","Plain","Fog","Storm","Mineral","Glacier","Rising"], 3:["Stone","Knuckle","Dynamo","Heat","Balance","Feather","Mind","Rain"], 4:["Coal","Forest","Cobble","Fen","Relic","Mine","Icicle","Beacon"], 5:["Trio","Basic","Insect","Bolt","Quake","Jet","Freeze","Legend"], 6:["Bug","Cliff","Rumble","Plant","Voltage","Fairy","Psychic","Iceberg"]};
const badgeName = (g, k) => { const L = LEAGUES[g - 1]; if (L.badge === "stamp") return `${L.gyms[k][1].split("/")[0]} trial stamp`; return `${(BADGE_NAMES[g] || [])[k] || L.gyms[k][1].split("/")[0]} Badge`; };
const trOrEmblem = (name, type) => { const ti = TR_BY_NAME.get(name), li = LEADER_BY.get(name); return ti !== undefined ? `<div class="stage medal"><img class="tr" data-tr="${ti}" alt="" draggable="false"></div>` : li !== undefined ? `<div class="stage medal px"><img class="tr" data-ltr="${li}" alt="" draggable="false"></div>` : `<div class="emblem-tr" style="${tStyle((type || "Normal").split("/")[0])}"><span>${esc(name[0])}</span></div>`; };
const nonEmptyTeams = () => orderedTeams().filter(t => teamOf(t.id).length);
let gymRegion = 1, rivalTeam = null, vsSel = null, e4run = null;
function renderBattleScreen(){
  const sub = nav.sub || "menu";
  if (sub === "fight") { renderFight(); return; }
  setMusic("title");
  if (sub === "menu") {
    const ng = LEAGUES.find(L => badgeCount(L.g) < 8 || !state.games.leagues[L.g]) || LEAGUES[0], nk = [...Array(8).keys()].find(k => !hasBadge(ng.g, k));
    const nextTxt = nk !== undefined ? `Next: ${ng.gyms[nk][0]} · ${GENS[ng.g - 1].region}` : !state.games.leagues[ng.g] ? `Next: ${GENS[ng.g - 1].region} ${ng.e4label || "Elite Four"}` : "Every league cleared ★";
    const ex = ITEMS_ALL.filter(isExclusive), exGot = ex.filter(it => owns(it.cat, it.id)).length;
    $("scBody").innerHTML = `<div class="bmenu">
      <button class="bm-card bm-main" type="button" data-bsub="gym" data-greg-go="${ng.g}">
        <span class="bm-l">${ic("trophy")}<b>Gym challenge</b><span>Beat eight Gym Leaders in each of the nine regions, then take on the Elite Four and Champion with no healing in between.</span>
          <span class="bm-prog"><span class="ach-bar"><i style="width:${totalBadges()/72*100}%"></i></span><span>${totalBadges()} / 72 badges · ${leaguesCleared()} / 9 leagues · ${exGot} / ${ex.length} exclusives</span></span>
          <span class="bm-cta">${esc(nextTxt)} ▸</span></span>
        <span class="bm-r"><span class="bm-rh">${esc(GENS[ng.g - 1].region)} ${ng.label || "Gym Leaders"}</span><span class="bm-leaders">${ng.gyms.map(([nm, ty], k) => `<span class="bm-ld${hasBadge(ng.g, k) ? " won" : ""}">${trOrEmblem(nm, ty)}<small>${esc(nm)}</small></span>`).join("")}</span>
          <span class="bm-rw">Gym Leaders give PokéPoints and exclusive rewards you can’t buy in the Shop.</span></span>
      </button>
      <button class="bm-card" type="button" data-bsub="rival">${ic("battle")}<b>Rival battle</b><span>Take on ${RIVALS.length} famous trainers with any of your teams.</span><span class="meta">${Object.keys(state.games.wins).length} of ${RIVALS.length} beaten</span></button>
      <button class="bm-card" type="button" data-bsub="tower">${ic("trophy")}<b>Battle Tower</b><span>Win as many battles in a row as you can. Healed between battles, tougher every 7 wins.</span><span class="meta">${state.games.tower.cur ? `Streak ${state.games.tower.cur} · ` : ""}Best ${state.games.tower.best}</span></button>
      <button class="bm-card" type="button" data-bsub="replays">${ic("frame")}<b>Replays</b><span>Watch your last battles again, share them, or pin one to your trainer card.</span><span class="meta">${rpList().length} saved</span></button>
      <button class="bm-card" type="button" data-bsub="vs">${ic("card")}<b>Versus</b><span>Battle another save file on this device. Pass the device and pick moves in secret.</span><span class="meta">${state.games.vs.w} wins · ${state.games.vs.l} losses</span></button>
    </div>
    <div class="set-row bm-style"><span>Battle style</span><div class="segrow" data-bmode><button type="button" data-v="manual" aria-pressed="${state.ui.bmode === "manual"}">You choose moves</button><button type="button" data-v="auto" aria-pressed="${state.ui.bmode === "auto"}">Auto battle</button></div></div>
    <p class="note">Battles follow the main games’ rules: real stats (level, nature, EVs and IVs), damage, accuracy, PP, status, weather, terrain, abilities and held items. You bring a Bag of Potions, Revives and X items. Pokémon without moves use the strongest ones they can learn. Wins earn PokéPoints to spend in the Shop.</p>`;
    paintAll($("scBody"));
    nav.onClick = e => { const b = e.target.closest("[data-bsub]"); if (b) { Sound.play("select"); if (b.dataset.gregGo) gymRegion = +b.dataset.gregGo; openScreen("battle", b.dataset.bsub); return; } const m = e.target.closest("[data-bmode] [data-v]"); if (m) { state.ui.bmode = m.dataset.v; save(); Sound.play("select"); renderBattleScreen(); } };
    return;
  }
  if (sub === "rival") return renderRivals();
  if (sub === "gym") return renderGym();
  if (sub === "vs") return renderVersus();
  if (sub === "replays") return renderReplays();
  if (sub === "tower") return renderTower();
}
const teamSelect = (id, sel, label = "Your team") => { const ts = nonEmptyTeams(); return `<label class="field">${label}<select class="select" id="${id}">${ts.map(t => `<option value="${t.id}" ${t.id === sel ? "selected" : ""}>${esc(t.dex)} · ${teamOf(t.id).length} Pokémon</option>`).join("")}</select></label>`; };
const playerSide = (teamId, level = 50, bag = BAG.standard()) => ({name: profile && !profile.guest ? profile.name : "You", party: teamOf(teamId).slice(0, MAX).map(n => monFromTeam(teamId, n, level)), human:true, foePrefix:"", bag, ai:3});
// trainers' Pokémon: smarter natures, items and EVs the further you go (ai: 1 early gyms … 4 Champions)
const TYPE_BOOST = {}; for (const it of ITEMS) if (it[2] === "type" && ITEM_TYPE[it[0]] && !/Incense/.test(it[0]) && !TYPE_BOOST[ITEM_TYPE[it[0]]]) TYPE_BOOST[ITEM_TYPE[it[0]]] = it[0];
function foeMon(n, o){
  const R = rng(o.seed || n), sp = NAT_BY.get(n), st = sp.stats, phys = st[1] >= st[3], fast = st[5] >= 85, ai = o.ai || 2;
  const nature = ai >= 3 ? (phys ? (fast ? "Jolly" : "Adamant") : (fast ? "Timid" : "Modest")) : ai >= 2 ? NATURE_NAMES[Math.floor(R()*25)] : "Hardy";
  const evs = ai >= 4 ? {hp:84, atk:84, def:84, spa:84, spd:84, spe:84} : {};
  const moves = autoMoves(n, sp.types, ai >= 2, R);
  let item = "";
  if (!isMega(n)) {
    if (o.ace && ai <= 2) item = "Sitrus Berry";
    else if (ai >= 3) {
      const stab = sp.types.find(t => moves.some(mv => isDmg(mv) && mv[1] === t));
      const pool = !isFE(n) ? ["Eviolite"] : ["Sitrus Berry", "Leftovers", stab && TYPE_BOOST[stab], "Expert Belt", ai >= 4 && "Life Orb", ai >= 4 && st[0] + st[2] + st[4] < 230 && "Focus Sash", ai >= 4 && moves.every(isDmg) && "Assault Vest"].filter(Boolean);
      item = pool[Math.floor(R()*pool.length)];
    }
  }
  return mkMon(n, {level:o.level, nature, evs, moves, item});
}
const foeSide = (name, nums, o) => ({name, human:false, foePrefix:"The opposing ", ai:o.ai, bag:o.bag || null,
  party:nums.filter(n => NAT_BY.has(n)).map((n, k, a) => foeMon(n, {level:o.level, ai:o.ai, seed:(o.seed || 1)*31 + k, ace:k === a.length - 1}))});
// rivals: how strong, and what's in their bag
const rivalTier = r => /Champion|Legend/.test(r.title) ? {ai:4, bag:{"Full Restore":3}} : /Elite Four|Boss|King|President/.test(r.title) ? {ai:3, bag:{"Full Restore":2}} : /Gym Leader/.test(r.title) ? {ai:2, bag:{"Hyper Potion":2}} : {ai:2, bag:{"Super Potion":2}};
function needTeam(){ if (nonEmptyTeams().length) return false; $("scBody").innerHTML = `<div class="sc-narrow"><p>Build a team first, then come back to battle.</p><div class="actions"><button class="btn primary" type="button" id="goBuild">Open Team Builder</button></div></div>`; nav.onClick = e => { if (e.target.closest("#goBuild")) enterApp(state.mode); }; return true; }
function renderRivals(){
  if (needTeam()) return;
  const ts = nonEmptyTeams(); if (!ts.some(t => t.id === rivalTeam)) rivalTeam = ts.some(t => t.id === "all") ? "all" : ts[0].id;
  const W = state.games.wins;
  $("scBody").innerHTML = `<div class="sc-narrow wide">${teamSelect("rvTeam", rivalTeam)}
    <div class="cov-h">Choose a rival</div>
    <div class="rv-grid">${RIVALS.map((r, i) => `<button class="tcard rv" type="button" data-rv="${i}">${trOrEmblem(r.tr)}<span class="rv-t"><b>${esc(r.tr)}</b><small>${esc(r.title)}</small>${W[r.tr] ? `<small class="won">★ Beaten${W[r.tr] > 1 ? " ×" + W[r.tr] : ""}</small>` : ""}</span></button>`).join("")}</div></div>`;
  paintAll($("scBody"));
  nav.onChange = e => { if (e.target.id === "rvTeam") rivalTeam = e.target.value; };
  nav.onClick = e => { const b = e.target.closest("[data-rv]"); if (b) startRival(+b.dataset.rv); };
}
async function withMoves(){ try { await loadLearnsets(); } catch(e){} }
async function startRival(i){
  const r = RIVALS[i]; await withMoves();
  const tier = rivalTier(r), foe = foeSide(r.tr, r.team, {level:50, ai:tier.ai, bag:{...tier.bag}, seed:i + 7});
  startBattle({back:"rival", foe:{name:r.tr, title:r.title, bg:r.bg}, sides:[playerSide(rivalTeam), foe], humans:[true, false],
    onEnd:win => { if (win) { const first = !state.games.wins[r.tr]; state.games.wins[r.tr] = (state.games.wins[r.tr] || 0) + 1; save(); earn(first ? 150 : 40, `Beat ${r.tr}${first ? " for the first time" : ""}`); } return {text: win ? `You defeated <b>${esc(r.tr)}</b>!` : `You lost to <b>${esc(r.tr)}</b>. Tweak your team and try again!`, buttons:[["Rematch", () => startRival(i), true], ["Choose another rival", () => openScreen("battle", "rival")]]}; }});
}
const gymTeamFor = g => "g" + g;   // each region's challenge is taken on with that region's team…
// …until you beat its Elite Four and Champion: then any of your teams can take on its Gyms and League again
const gymTeamsOpen = g => !!state.games.leagues[g];
let gymTeam = {};
function renderGym(){
  if (needTeam()) return;
  const g = gymRegion, L = LEAGUES[g - 1], R = GENS[g - 1].region, nb = badgeCount(g), next = [...Array(8).keys()].find(k => !hasBadge(g, k));
  const open = gymTeamsOpen(g), choices = open ? visibleTeams().filter(t => teamOf(t.id).length) : [];
  if (!open || !choices.some(t => t.id === gymTeam[g])) gymTeam[g] = gymTeamFor(g);
  const lbl = L.label || "Gym challenge", e4l = L.e4label || "Elite Four", ok = teamOf(gymTeam[g]).length > 0, TT = TEAM_BY.get(gymTeam[g]), tName = gymTeam[g] === gymTeamFor(g) ? `${R} team` : `${(TT && TT.title || "team").replace(/ dream team$/, "")} team`;
  $("scBody").innerHTML = `<div class="sc-narrow wide">
    <div class="segrow gym-tabs" role="group">${GENS.map(x => `<button type="button" data-greg="${x.g}" aria-pressed="${x.g === g}" title="${x.region}">${ROMAN[x.g]} <span>${x.region}</span>${state.games.leagues[x.g] ? " ★" : ""}</button>`).join("")}</div>
    <div class="gym-head"><h3>${R} ${lbl}</h3><span class="meta">${nb} / 8 ${L.badge === "stamp" ? "stamps" : "badges"}${state.games.leagues[g] ? " · League cleared ★" : ""}</span></div>
    <div class="gym-team"><div><b>Your ${esc(tName)}</b><span class="note" style="margin:0">${open ? `League cleared: bring any of your teams.` : ok ? `Only ${R} Pokémon can take on the ${R} ${esc(lbl)}. Beat its ${esc(e4l)} and Champion to bring any team.` : `Build it first: only ${R} Pokémon can take on the ${R} ${esc(lbl)}.`}</span>
      ${open && choices.length > 1 ? `<label class="gt-pick"><span class="meta">Team</span><select class="select" id="gTeamSel" aria-label="Team for the ${esc(R)} ${esc(lbl)}">${choices.map(t => `<option value="${t.id}"${t.id === gymTeam[g] ? " selected" : ""}>${esc(t.title.replace(/ dream team$/, ""))}</option>`).join("")}</select></label>` : ""}</div>
      ${ok ? `<div class="gt-mons">${teamOf(gymTeam[g]).map(n => spr(n)).join("")}</div>` : ""}
      <button class="btn${ok ? "" : " primary"}" type="button" id="gEdit">${ok ? `✎ Edit ${esc(tName)}` : `Build the ${R} team`}</button></div>
    <p class="note">Every battle is even: you bring as many Pokémon as the leader, and both sides battle at the leader’s level.</p>
    <div class="badge-case">${L.gyms.map(([nm, ty], k) => { const on = hasBadge(g, k), isNext = k === next;
      return `<div class="gym-card${on ? " on" : ""}${isNext ? " next" : ""}">${trOrEmblem(nm, ty)}<div class="gc-t"><b>${esc(nm)}</b><span>${ty.split("/").map(t => `<span class="tb" style="${tStyle(t)}">${t}</span>`).join("")}</span><small>${GYM_SIZE[k]} on ${GYM_SIZE[k]} · Lv ${GYM_LV[k]}</small><small class="gc-rw">${on ? `★ ${esc(GYM_REWARD[g + "-" + k].name)}` : "Reward: ?"}</small></div>
        ${badgeArt(g, k) ? `<img class="bdg" src="${badgeArt(g, k).src}" title="${esc(badgeName(g, k))}" alt="${esc(badgeName(g, k))}${on ? " earned" : ""}">` : `<span class="bdg b${k}" style="--bc:${TC[ty.split("/")[0]]}" title="${esc(badgeName(g, k))}" aria-label="${esc(badgeName(g, k))}${on ? " earned" : ""}"></span>`}
        <button class="btn sm${isNext ? " primary" : ""}" type="button" data-gym="${k}" ${ok ? "" : "disabled"}>${on ? "Rematch" : "Challenge"}</button></div>`; }).join("")}</div>
    <div class="e4-box${nb >= 8 ? "" : " locked"}"><div><h3>${e4l} + Champion</h3><p class="meta e4-rw">${L.e4.map(([x], k) => `<span class="${(state.games.e4[g] | 0) & (1 << k) ? "won" : ""}">${(state.games.e4[g] | 0) & (1 << k) ? "★" : "☆"} ${esc(x)}</span>`).join(" ")} <span class="${state.games.leagues[g] ? "won" : ""}">${state.games.leagues[g] ? "★" : "☆"} ${esc(L.champ[0])}</span> · Elite Four members give elite rewards; the Champion gives a full set.</p><p class="note" style="margin:4px 0 0">${L.e4.map(x => esc(x[0])).join(" · ")} · then Champion <b>${esc(L.champ[0])}</b>. Five battles in a row with no healing. You get one bag for the whole run (${bagLine(BAG.league())}), and what you use stays used. Your team battles at each opponent’s level (Lv 48–51, Champion Lv 54).</p></div>
      <button class="btn${nb >= 8 ? " primary" : ""}" type="button" id="e4Go" ${nb >= 8 && ok ? "" : "disabled"}>${nb >= 8 ? (state.games.leagues[g] ? "Challenge again" : "Begin") : `Earn all 8 ${L.badge === "stamp" ? "stamps" : "badges"} first`}</button></div></div>`;
  paintAll($("scBody"));
  nav.onChange = e => { if (e.target.id === "gTeamSel") { gymTeam[g] = e.target.value; Sound.play("select"); renderGym(); } };
  nav.onClick = e => {
    const t = e.target.closest("[data-greg]"); if (t) { gymRegion = +t.dataset.greg; Sound.play("select"); renderGym(); return; }
    const b = e.target.closest("[data-gym]"); if (b) { const k = +b.dataset.gym; if (k > 0 && !hasBadge(g, k - 1) && !hasBadge(g, k)) { toast(`Beat ${L.gyms[k - 1][0]} first.`); return; } startGym(g, k); return; }
    if (e.target.closest("#gEdit")) { enterApp(null, gymTeam[g] || gymTeamFor(g)); return; }
    if (e.target.closest("#e4Go")) startE4(g);
  };
}
// ---- even battles: Gyms are N on N at the leader's level; the Elite Four set your level to theirs ----
const gymPicks = {};   // the last line-up chosen per team and battle size (for this visit)
function pickForBattle(teamId, size, title, go){
  const team = teamOf(teamId).slice(0, MAX);
  if (team.length <= size) { go(team); return; }
  const key = teamId + ":" + size, sel = new Set((gymPicks[key] || team.slice(0, size)).filter(n => team.includes(n)).slice(0, size));
  const md = openModal(`<h3 class="mt" id="modalTitle">${esc(title)}</h3>
    <p class="note">This is a <b>${size} on ${size}</b> battle. Choose ${size} Pokémon to bring.</p>
    <div class="hm-pick">${team.map(n => `<button type="button" class="hm-pk" data-gpk="${n}" aria-pressed="${sel.has(n)}">${spr(n)}<span>${esc(nickOf(teamId, n))}</span></button>`).join("")}</div>
    <div class="actions"><button class="btn primary" type="button" id="gpkGo">Start battle</button><span class="meta" id="gpkN"></span></div>`, {wide:true});
  const upd = () => { $("gpkN").textContent = `${sel.size} / ${size} chosen`; $("gpkGo").disabled = sel.size !== size; };
  paintAll(md); upd();
  md.onclick = e => {
    const b = e.target.closest("[data-gpk]");
    if (b) { const n = +b.dataset.gpk; if (sel.has(n)) sel.delete(n); else { if (sel.size >= size) { toast(`Only ${size} can battle here. Tap one to take it out first.`); return; } sel.add(n); } b.setAttribute("aria-pressed", sel.has(n)); Sound.play("select"); upd(); return; }
    if (e.target.closest("#gpkGo") && sel.size === size) { const pick = team.filter(n => sel.has(n)); gymPicks[key] = pick; closeModal(); go(pick); }
  };
}
function startGym(g, k){
  const L = LEAGUES[g - 1], [nm] = L.gyms[k], tid = gymTeam[g] || gymTeamFor(g);
  pickForBattle(tid, GYM_SIZE[k], `Your team for ${nm}`, nums => runGym(g, k, tid, nums));
}
async function runGym(g, k, tid, nums){
  const L = LEAGUES[g - 1], [nm, ty, ace] = L.gyms[k], lv = GYM_LV[k]; await withMoves();
  const foe = foeSide(nm, leagueTeam(g, nm, ty, ace, GYM_SIZE[k], g*100 + k), {level:lv, ai:k < 4 ? 1 : k < 7 ? 2 : 3, bag:{"Hyper Potion":k < 4 ? 1 : 2}, seed:g*100 + k});
  const me = {...playerSide(tid, lv), party:nums.map(n => monFromTeam(tid, n, lv))};
  startBattle({back:"gym", foe:{name:nm, title:`${GENS[g - 1].region} ${L.badge === "stamp" ? "trial" : "Gym Leader"} · ${ty}`, type:ty, bg:"gym"}, sides:[me, foe], humans:[true, false],
    onEnd:win => { let text;
      if (win) { const had = hasBadge(g, k); state.games.badges[g] = badgeOf(g) | (1 << k); save(); if (!had) setTimeout(() => Sound.play("badge"), 900);
        if (had) earn(40, `Beat ${nm} again`); else { const got = gymRewards(g, k); earn(200, `${badgeName(g, k)}`, true); setTimeout(() => showRewards(`${nm} gave you a reward!`, got, 200), 1700); } text = had ? `You beat <b>${esc(nm)}</b> again!` : `You defeated <b>${esc(nm)}</b> and earned the <b>${esc(badgeName(g, k))}</b>!`; }
      else text = `${esc(nm)} won this time. Rework your team and try again!`;
      return {text, buttons:[win && k < 7 && !hasBadge(g, k + 1) ? [`Next: ${L.gyms[k + 1][0]}`, () => startGym(g, k + 1), true] : win && k === 7 ? [`On to the ${L.e4label || "Elite Four"}`, () => openScreen("battle", "gym"), true] : [win ? "Battle again" : "Try again", () => startGym(g, k), !win], ["Back to the badge case", () => openScreen("battle", "gym")]]}; }});
}
async function startE4(g){
  await withMoves();
  const tid = gymTeam[g] || gymTeamFor(g);
  e4run = {g, step:0, team:tid, party:playerSide(tid).party, bag:BAG.league()};
  e4Battle();
}
// between Elite Four battles: no free healing, but the run's one bag can be used, and the team can be put in any order
// (the first one able to fight leads)
const bagLine = bag => BAG_ORDER.filter(k => bag[k] > 0).map(k => `${esc(k)} ×${bag[k]}`).join(" · ") || "Empty";
function e4Prep(){
  const P = e4run.party, L = LEAGUES[e4run.g - 1], who = e4run.step === 4 ? `Champion ${L.champ[0]}` : L.e4[e4run.step][0], bag = e4run.bag;
  let use = null;   // a bag item waiting for a Pokémon
  const md = openModal(`<h3 class="mt" id="modalTitle">Get ready for ${esc(who)}</h3>
    <p class="note" id="prepNote"></p><div class="prep-bag" id="prepBag"></div><div class="prep-list" id="prepList"></div>
    <div class="actions"><button class="btn primary" type="button" id="prepGo">Battle ${esc(who)}</button></div>`, {wide:true});
  const draw = () => {
    const lead = P.findIndex(m => m.hp > 0);
    $("prepNote").innerHTML = use ? `Use the <b>${esc(use)}</b> on which Pokémon? <button class="btn sm" type="button" id="prepCancel">Cancel</button>` : `No healing between battles: only what’s left in your bag for this run. Use the arrows to change the order; the first Pokémon that can fight leads.`;
    $("prepBag").innerHTML = BAG_ORDER.filter(k => bag[k] > 0).map(k => { const can = P.some(m => bagCanUse(k, m, false)); return `<button class="bag-chip${use === k ? " on" : ""}" type="button" data-pbag="${esc(k)}" ${can ? "" : "disabled"} title="${esc(BAG_ITEMS[k].d)}${can ? "" : " (can’t be used right now)"}">${itemIcon(k)}${esc(k)} <b>×${bag[k]}</b></button>`; }).join("") || `<span class="meta">Your bag is empty.</span>`;
    $("prepList").innerHTML = P.map((m, k) => `<div class="prep-row${m.hp <= 0 ? " out" : ""}">${spr(m.n, {sh:m.sh})}
      <div class="prep-t"><b>${esc(m.name)}${k === lead ? ` <span class="prep-lead">Leads</span>` : ""}</b><span class="meta">${m.hp <= 0 ? "Fainted" : `${m.hp} / ${m.max} HP${m.status ? ` · ${ST_TAG[m.status]}` : ""}`}</span></div>
      ${use && bagCanUse(use, m, false) ? `<button class="btn sm primary" type="button" data-puse="${k}">Use ${esc(use)}</button>` : ""}
      <button class="btn sm" type="button" data-pmv="${k}" data-d="-1" ${k === 0 ? "disabled" : ""} aria-label="Move ${esc(m.name)} up">▲</button>
      <button class="btn sm" type="button" data-pmv="${k}" data-d="1" ${k === P.length - 1 ? "disabled" : ""} aria-label="Move ${esc(m.name)} down">▼</button></div>`).join("");
    paintAll($("prepList"));
  };
  draw();
  md.onclick = e => {
    const pb = e.target.closest("[data-pbag]"); if (pb) { use = use === pb.dataset.pbag ? null : pb.dataset.pbag; Sound.play("select"); draw(); return; }
    if (e.target.closest("#prepCancel")) { use = null; draw(); return; }
    const pu = e.target.closest("[data-puse]");
    if (pu && use) { const m = P[+pu.dataset.puse], B = BAG_ITEMS[use];
      if (B.revive) { m.hp = Math.max(1, Math.floor(m.max*B.revive)); m.status = null; toast(`${m.name} was revived!`); }
      else { if (B.heal) m.hp = B.heal === "full" ? m.max : Math.min(m.max, m.hp + B.heal); if (B.cure && (B.cure === "all" || B.cure.includes(m.status))) m.status = null; toast(`${use} used on ${m.name}.`); }
      m.sleep = m.status ? m.sleep : 0; m.toxN = 0; bag[use]--; use = null; Sound.play("heal"); draw(); return; }
    const mv = e.target.closest("[data-pmv]");
    if (mv) { const k = +mv.dataset.pmv, j = k + +mv.dataset.d; if (j >= 0 && j < P.length) { [P[k], P[j]] = [P[j], P[k]]; Sound.play("select"); draw(); } return; }
    if (e.target.closest("#prepGo")) { closeModal(); e4Battle(); }
  };
}
function e4Battle(){
  const {g, step} = e4run, L = LEAGUES[g - 1], champ = step === 4;
  const [nm, ty, ace] = champ ? [L.champ[0], "", 0] : L.e4[step];
  const lv = champ ? 54 : 48 + step;
  const nums = champ ? L.champ[1] : leagueTeam(g, nm, ty, ace, 5, g*1000 + step);
  // Elite Four: two Max Potions (the first two) or two Full Restores; Champions: Full Restores
  const foe = foeSide(nm, nums, {level:lv, ai:champ ? 4 : 3, seed:g*1000 + step, bag: champ ? {"Full Restore":g <= 4 ? 3 : 4} : step < 2 ? {"Max Potion":2} : {"Full Restore":2}});
  e4run.party.forEach(m => setLevel(m, lv));   // you battle at their level
  const me = {name: profile && !profile.guest ? profile.name : "You", party:e4run.party, human:true, foePrefix:"", bag:e4run.bag, ai:3};
  startBattle({back:"gym", foe:{name:nm, title: champ ? `${GENS[g - 1].region} Champion` : `${L.e4label || "Elite Four"} · ${step + 1} of 4`, type:ty || "Dragon", bg: champ ? "league" : "league"}, sides:[me, foe], humans:[true, false],
    leaveNote:"Leaving ends your run. You’ll start again from the first member.", onLeave:() => { e4run = null; },
    onEnd:win => {
      if (!win) { e4run = null; return {text:`Your run ends here. ${esc(nm)} was too strong this time. The ${esc(L.e4label || "Elite Four")} will be waiting.`, buttons:[["Back to the badge case", () => openScreen("battle", "gym"), true]]}; }
      if (!champ) {
        const G2 = state.games, first = !((G2.e4[g] | 0) & (1 << step));
        if (first) { G2.e4[g] = (G2.e4[g] | 0) | (1 << step); const got = e4Rewards(g, step); save(); earn(REWARDS.e4.points, `Beat ${nm}`, true); setTimeout(() => showRewards(`${nm} gave you an elite reward!`, got, REWARDS.e4.points), 1700); }
        e4run.step++; const nx = e4run.step === 4 ? L.champ[0] : L.e4[e4run.step][0]; const left = e4run.party.filter(m => m.hp > 0).length;
        // no healing between battles: only the run's bag
        const who = e4run.step === 4 ? `Champion ${nx}` : nx;
        return {text:`You defeated <b>${esc(nm)}</b>! ${e4run.step === 4 ? `Only Champion <b>${esc(nx)}</b> is left. ` : ""}${left} of ${e4run.party.length} Pokémon can still fight. Bag: ${bagLine(e4run.bag)}.`,
          buttons:[[`Get ready for ${who}`, e4Prep, true]]}; }
      const firstClear = !state.games.leagues[g];
      state.games.leagues[g] = true; save(); e4run = null; setTimeout(() => Sound.play("badge"), 900);
      if (firstClear) { const got = champRewards(g); earn(1000, "League champion", true); setTimeout(() => showRewards(`${L.champ[0]} crowned you Champion!`, got, 1000), 1700); } else earn(250, "League cleared again");
      return {text:`<b>You’re the new ${esc(GENS[g - 1].region)} Champion!</b> Your team has entered the Hall of Fame.`, buttons:[["Stage the Hall of Fame scene", () => { enterApp(null, gymTeam[g] || gymTeamFor(g)); openHof(); }, true], ["Back to the badge case", () => openScreen("battle", "gym")]]};
    }});
}
// ---- Versus: two save files on this device ----
function readSave(id){ try { const raw = JSON.parse(ls.get(PKEY(id)) || "null"); if (!raw || typeof raw !== "object") return null; const defs = cleanCustom(raw.custom).map(buildCustom), has = new Set([...BUILTIN.map(t => t.id), ...defs.map(t => t.id)]);
  const rm = o => { const r = {}; if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) if (has.has(legacyId(k))) r[legacyId(k)] = v; return r; };
  const teams = rm(raw.teams), members = rm(raw.members), shiny = rm(raw.teamShiny), tr = rm(raw.trainers); return {teams, members, shiny, tr, defs:[...BUILTIN, ...defs]}; } catch(e){ return null; } }
function renderVersus(){
  if (needTeam()) return;
  const others = accounts.list.filter(p => !profile || p.id !== profile.id);
  if (!others.length) { $("scBody").innerHTML = `<div class="sc-narrow"><div class="empty-grid">${ic("card")}<h3>Versus needs two save files</h3><p>Pass the device and pick moves in secret against another save file on this device. Make a second save file, build a team there, then come back.</p><div class="actions"><button class="btn primary" type="button" id="vsNew">Account &amp; save files</button></div></div></div>`; nav.onClick = e => { if (e.target.closest("#vsNew")) openAccountMenu(); }; return; }
  if (!vsSel || !others.some(p => p.id === vsSel.id)) vsSel = {id:null, ok:false, mine:null, theirs:null, mode:state.ui.bmode};
  const opp = others.find(p => p.id === vsSel.id), data = opp && vsSel.ok ? readSave(opp.id) : null;
  const theirTeams = data ? data.defs.filter(t => (data.teams[t.id] || []).some(n => t.byNum.has(n))) : [];
  if (data && (!vsSel.theirs || !theirTeams.some(t => t.id === vsSel.theirs))) vsSel.theirs = theirTeams.some(t => t.id === "all") ? "all" : (theirTeams[0] || {}).id;
  const mine = nonEmptyTeams(); if (!vsSel.mine || !mine.some(t => t.id === vsSel.mine)) vsSel.mine = mine.some(t => t.id === "all") ? "all" : mine[0].id;
  $("scBody").innerHTML = `<div class="sc-narrow wide">
    <div class="cov-h">Who are you battling?</div>
    <div class="vs-list">${others.map(p => `<button class="tcard rv" type="button" data-vs="${p.id}" aria-pressed="${p.id === vsSel.id}">${p.avatar !== null && p.avatar !== undefined && TRAINERS[p.avatar] !== undefined ? `<div class="stage medal"><img class="tr" data-tr="${p.avatar}" alt=""></div>` : `<div class="emblem-tr"><span>${esc(p.name[0])}</span></div>`}<span class="rv-t"><b>${esc(p.name)}</b><small>${p.teams || 0} teams${p.pin ? " · 🔒 PIN" : ""}</small></span></button>`).join("")}</div>
    ${opp && !vsSel.ok ? `<form class="pin-row" id="vsPin"><input id="vsPinIn" inputmode="numeric" maxlength="4" placeholder="${esc(opp.name)}’s PIN" aria-label="PIN for ${esc(opp.name)}"><button class="btn primary sm" type="submit">Unlock</button><span class="acc-err" id="vsErr" hidden></span></form>` : ""}
    ${data ? (theirTeams.length ? `<div class="vs-pick">${teamSelect("vsMine", vsSel.mine, `${esc(profile && !profile.guest ? profile.name : "Your")} team`)}
      <label class="field">${esc(opp.name)}’s team<select class="select" id="vsTheirs">${theirTeams.map(t => `<option value="${t.id}" ${t.id === vsSel.theirs ? "selected" : ""}>${esc(t.dex)} · ${(data.teams[t.id] || []).filter(n => t.byNum.has(n)).length} Pokémon</option>`).join("")}</select></label></div>
      <div class="set-row"><span>How to play</span><div class="segrow" data-vsmode><button type="button" data-v="manual" aria-pressed="${vsSel.mode === "manual"}">Both pick moves</button><button type="button" data-v="auto" aria-pressed="${vsSel.mode === "auto"}">Watch it play out</button></div></div>
      <div class="set-row"><span>Bag</span><div class="segrow" data-vsbag><button type="button" data-v="on" aria-pressed="${state.ui.vsbag !== "off"}">Same bag for both</button><button type="button" data-v="off" aria-pressed="${state.ui.vsbag === "off"}">No items</button></div></div>
      <p class="note">${vsSel.mode === "manual" ? "Pass the device between turns. Each player picks in secret." : "The battle plays itself using each Pokémon’s best moves."} ${state.ui.vsbag !== "off" ? `Each player gets ${bagLine(BAG.standard())}.` : "Neither player can use items."}</p>
      <div class="actions"><button class="btn primary" type="button" id="vsGo">Start battle</button></div>` : `<p class="note">${esc(opp.name)} hasn’t built any teams yet.</p>`) : ""}</div>`;
  paintAll($("scBody"));
  nav.onChange = e => { if (e.target.id === "vsMine") vsSel.mine = e.target.value; if (e.target.id === "vsTheirs") vsSel.theirs = e.target.value; };
  nav.onClick = e => {
    const p = e.target.closest("[data-vs]"); if (p) { const m = profileMeta(p.dataset.vs); vsSel = {...vsSel, id:m.id, ok:!m.pin, theirs:null}; Sound.play("select"); renderVersus(); const pi = $("vsPinIn"); if (pi) pi.focus(); return; }
    const md = e.target.closest("[data-vsmode] [data-v]"); if (md) { vsSel.mode = md.dataset.v; renderVersus(); return; }
    const vb = e.target.closest("[data-vsbag] [data-v]"); if (vb) { state.ui.vsbag = vb.dataset.v; save(); Sound.play("select"); renderVersus(); return; }
    if (e.target.closest("#vsGo")) startVersus();
  };
  const f = $("vsPin"); if (f) f.addEventListener("submit", async ev => { ev.preventDefault(); const m = profileMeta(vsSel.id); if (await hashPin($("vsPinIn").value.trim(), m.pin.salt) === m.pin.hash) { vsSel.ok = true; Sound.play("confirm"); renderVersus(); } else { const er = $("vsErr"); er.textContent = "That PIN doesn’t match."; er.hidden = false; Sound.play("wrong"); } });
}
async function startVersus(){
  const opp = profileMeta(vsSel.id), data = readSave(opp.id); if (!data) return; await withMoves();
  const T = data.defs.find(t => t.id === vsSel.theirs) || TEAM_BY.get("all"), nums = (data.teams[vsSel.theirs] || []).filter(n => T.byNum.has(n)).slice(0, MAX);
  const theirMon = n => { const M = cleanMember((data.members[vsSel.theirs] || {})[n], n) || {}; return mkMon(n, {level:M.level || 50, nick:M.nick, moves:(M.moves || []).map(x => MOVE_BY.get(x)), ability:M.ability, item:M.item, nature:M.nature, evs:M.evs, ivs:M.ivs, sh:(data.shiny[vsSel.theirs] || []).includes(n), ball:M.ball}); };
  const meName = profile && !profile.guest ? profile.name : "Guest", manual = vsSel.mode === "manual";
  const bags = state.ui.vsbag !== "off";   // a mirrored bag for both players, unless turned off
  const A = {...playerSide(vsSel.mine, 50, bags ? BAG.standard() : null), name:meName, foePrefix:`${meName}’s `}; A.party.forEach(m => setLevel(m, memberLevel(vsSel.mine, m.n)));   // Versus uses each Pokémon's own level
  const B = {name:opp.name, party:nums.map(theirMon), human:manual, foePrefix:`${opp.name}’s `, bag:bags ? BAG.standard() : null, ai:3};
  const trI = Number.isInteger(data.tr.all) && TRAINERS[data.tr.all] ? data.tr.all : (opp.avatar ?? null);
  startBattle({back:"vs", foe:{name:opp.name, title:`Versus · ${T.dex}`, trIdx:trI, bg:"league"}, sides:[A, B], humans:[manual, manual], hotseat:manual, force:manual ? "manual" : "auto",
    onEnd:win => { if (win) state.games.vs.w++; else state.games.vs.l++; save(); if (win) earn(60, "Versus win"); return {text: win ? `<b>${esc(meName)}</b> wins!` : `<b>${esc(opp.name)}</b> wins!`, buttons:[["Rematch", startVersus, true], ["Back to Versus", () => openScreen("battle", "vs")]]}; }});
}

// ---- the battle view ----
const F = {b:null, cfg:null, auto:false, fast:false, timer:0, resolve:null, tok:0};
const WEATHER_LBL = {sun:"☀ Harsh sunlight", rain:"☂ Rain", sand:"≋ Sandstorm", snow:"❄ Snow"};
const TERRAIN_LBL = {electric:"⚡ Electric Terrain", grassy:"✿ Grassy Terrain", misty:"✧ Misty Terrain", psychic:"◎ Psychic Terrain"};
function startBattle(cfg){
  F.cfg = cfg; F.me = cfg.me || 0; F.b = new Battle(cfg.sides); F.speed = 1;
  F.seed = Number.isInteger(cfg.seed) ? cfg.seed : (cfg.live ? (cfg.live.seed + cfg.live.round*7919) | 0 : (Math.random()*2147483647) | 0); F.R = rng(F.seed);
  F.rec = cfg.replay ? null : rpNew(cfg, F.seed); F.auto = cfg.force ? cfg.force === "auto" : state.ui.bmode === "auto"; F.fast = false; F.tok++;
  if (nav.screen === "battle" && nav.sub === "fight") renderScreen(); else openScreen("battle", "fight");
}
function renderFight(){
  const cfg = F.cfg; if (!cfg) { openScreen("battle", "menu"); return; }
  const two = state.mode === "2d", f = cfg.foe;
  const hp = side => `<div class="bt-hp ${side}"><div class="bt-row"><b class="bt-nm"></b><span class="bt-st" hidden></span><span class="bt-lv"></span></div><span class="bt-bar"><i></i></span>${side === "you" || cfg.hotseat ? `<span class="bt-num"></span>` : ""}</div>`;
  const mon = side => `<div class="bt-mon ${side}"><div class="stage"><img class="spr" alt="" draggable="false"${two ? ' data-zoom="2"' : ""}></div></div>`;
  const party = (side, P) => `<div class="bt-party ${side}">${P.map((m, k) => `<span data-pk="${k}">${ballImg(m.ball)}</span>`).join("")}</div>`;
  const trHtml = f.trIdx !== undefined && f.trIdx !== null ? `<div class="stage medal"><img class="tr" data-tr="${f.trIdx}" alt="" draggable="false"></div>` : trOrEmblem(f.name, f.type);
  $("scBody").innerHTML = `<div class="bt2">
    <div class="bt-head">${trHtml}<div><span class="meta">${esc(f.title || "")}</span><h3>vs ${esc(f.name)}</h3></div>
      ${cfg.live ? `<span class="bt-timer" id="btTimer" hidden></span>` : cfg.hotseat ? "" : `<button class="btn sm bt-skip" type="button" data-bt="fast" title="The rest of the battle plays itself out instantly and jumps straight to the result">⏭ Skip to the result</button>`}</div>
    <div class="bt-main"><div class="bt-field"><canvas class="bt-bg" aria-hidden="true"></canvas><span class="bt-weather" id="btWeather" hidden></span>${mon("foe")}${mon("you")}<canvas class="bt-fx" aria-hidden="true"></canvas>${hp("foe")}${hp("you")}${party("foe", cfg.sides[1 - F.me].party)}${party("you", cfg.sides[F.me].party)}</div><div class="bt-side idle" id="btSide"></div></div>
    <div class="bt-bottom"><div class="bt-log" id="btLog" role="log" aria-live="polite"></div><div class="bt-cmd" id="btCmd"></div></div></div>`;
  const cv = $("scBody").querySelector(".bt-bg"), V = two ? {W:320, H:180} : {W:960, H:540}; cv.width = V.W; cv.height = V.H;
  cv.getContext("2d").drawImage(paintBg(f.bg || "league", f.bg === "city" ? "night" : "day", V, {x:0, y:0, w:V.W, h:V.H}, two), 0, 0);
  paintAll($("scBody").querySelector(".bt-head"));
  // restore persisted HP for gauntlet parties
  cfg.sides[F.me].party.forEach((m, k) => { if (m.hp <= 0) { const pk = $("scBody").querySelector(`.bt-party.you [data-pk="${k}"]`); if (pk) pk.classList.add("out"); } });
  nav.onClick = e => onFightClick(e);
  nav.cleanup = () => { const B = F.b; F.tok++; clearTimeout(F.timer); if (F.wake) F.wake(); if (F.resolve) { const r = F.resolve; F.resolve = null; r(null); }
    if (cfg.live) { clearInterval(cfg.live.tick); if (B && !B.over && FB.m === cfg.live) fbDrop(); } };   // leaving a live battle forfeits it
  setMusic("battle");
  // first alive Pokémon leads (gauntlet)
  for (const s of F.b.s) { const k = s.party.findIndex(m => m.hp > 0); s.act = k < 0 ? 0 : k; }
  if (F.rec) F.rec.s = F.b.s.map(sideOut);   // the record starts from the sides as they begin (after the lead fix above)
  (cfg.replay ? runReplay : cfg.live ? runLive : runBattle)(F.tok);
}
const sideEl = i => { const root = $("scBody"), s = i === F.me ? "you" : "foe"; return {mon:root.querySelector(`.bt-mon.${s}`), hp:root.querySelector(`.bt-hp.${s}`), party:root.querySelector(`.bt-party.${s}`)}; };
const wait = ms => new Promise(r => { F.wake = r; F.timer = setTimeout(r, F.fast ? 0 : (state.ui.bspeed === "fast" ? ms*.5 : ms)/(F.speed || 1)); });
function logLine(t){ const log = $("btLog"); if (!log) return; log.insertAdjacentHTML("beforeend", `<p>${t}</p>`); while (log.children.length > 3) log.firstElementChild.remove(); }
function setHP(i, hp, max, instant){
  const s = sideEl(i); if (!s.hp) return; const pct = Math.max(0, hp/max*100), bar = s.hp.querySelector(".bt-bar i");
  bar.style.transition = instant || F.fast ? "none" : ""; bar.style.width = pct + "%"; bar.dataset.l = pct <= 20 ? "r" : pct <= 50 ? "y" : "g";
  const num = s.hp.querySelector(".bt-num"); if (num) num.textContent = `${Math.ceil(hp)} / ${max}`;
}
function setSt(i, st){ const s = sideEl(i), t = s.hp && s.hp.querySelector(".bt-st"); if (!t) return; t.hidden = !st; t.textContent = st ? ST_TAG[st] : ""; t.dataset.st = st || ""; }
function anim(el, cls){ if (!el || F.fast) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
async function showEv(e, evs, idx){
  const B = F.b;
  switch (e.k) {
    case "send": {
      const s = sideEl(e.side), m = B.s[e.side].party[e.idx], img = s.mon.querySelector("img");
      img.dataset.num = m.n; if (m.sh) img.dataset.sh = "1"; else delete img.dataset.sh;
      if (e.side === F.me) { img.dataset.back = "1"; img.classList.toggle("back", imgMode(img) === "3d" && hasBack(m.n, !!m.sh || state.shiny)); }   // 3D: a real back sprite, else the mirrored front
      paintImg(img);
      s.mon.classList.remove("faint", "hit", "lunge", "recall"); anim(s.mon, "enter");
      s.hp.querySelector(".bt-nm").textContent = m.name; s.hp.querySelector(".bt-lv").textContent = "Lv" + m.level; setHP(e.side, m.hp, m.max, true); setSt(e.side, e.st);
      s.party.querySelectorAll("[data-pk]").forEach(x => x.classList.toggle("act", +x.dataset.pk === e.idx));
      const S0 = B.s[e.side]; logLine(e.side === F.me && !F.cfg.hotseat ? `Go! <b>${esc(m.name)}</b>!` : `${esc(S0.name)} sent out <b>${esc(m.name)}</b>!`);
      if (!F.fast) Sound.play("send"); await wait(750); break;
    }
    case "st": { setSt(e.side, e.st); if (e.st && !F.fast) Sound.play("down"); break; }
    case "recall": { const s = sideEl(e.side); s.mon.classList.remove("hit", "lunge", "enter"); anim(s.mon, "recall"); logLine(esc(e.t)); await wait(450); break; }
    case "move": {   // the move's animation; a contact move lunges first. A move that misses or fails plays without its hit
      const s = sideEl(e.side), mv = MOVE_BY.get(e.mv) || null;
      if (!mv || fl(mv, "c")) anim(s.mon, "lunge"); else anim(s.mon, "cast");
      logLine(esc(e.t));
      if (F.fast || !mv) { await wait(500); break; }
      let miss = false;
      for (let k = (idx ?? -1) + 1; evs && k < evs.length; k++) { const x = evs[k]; if (x.k === "move") break; if (x.k === "hp" && x.hit) break; if (x.k === "msg" && /missed|avoided|But it failed|doesn’t affect|didn’t work|protected itself|had no effect/i.test(x.t || "")) { miss = true; break; } }
      await wait(160); await playMoveFx(mv, e.side, 1 - e.side, {miss, type:e.type}); break;
    }
    case "hp": {
      setHP(e.side, e.hp, e.max); const s = sideEl(e.side);
      if (e.hit) { anim(s.mon, "hit"); if (!F.fast) Sound.play(e.eff >= 2 ? "super" : e.eff < 1 ? "weak" : "hit"); } else if (e.heal && !F.fast) Sound.play("heal");
      await wait(650); break;
    }
    case "msg": {
      logLine(e.item ? `<span class="bt-itemlog">${esc(e.t)}</span>` : esc(e.t)); if (e.stat && !F.fast) Sound.play(e.stat.up ? "up" : "down"); if (e.item && !F.fast) Sound.play("heal");
      if (e.w !== undefined || e.ter !== undefined) { const w = $("btWeather"), B = F.b; if (w) { const t = [B.weather && WEATHER_LBL[B.weather], B.terrain && TERRAIN_LBL[B.terrain]].filter(Boolean); w.hidden = !t.length; w.textContent = t.join(" · "); } }
      await wait(e.se ? 500 : 800); break;
    }
    case "party": { const s = sideEl(e.side), pk = s.party && s.party.querySelector(`[data-pk="${e.idx}"]`); if (pk) pk.classList.toggle("out", e.hp <= 0); if (e.revived && !F.fast) Sound.play("heal"); break; }
    case "faint": { const s = sideEl(e.side); s.mon.classList.remove("hit", "lunge", "enter"); s.mon.classList.add("faint"); const pk = s.party.querySelector(`[data-pk="${e.idx}"]`); if (pk) pk.classList.add("out"); logLine(esc(e.t)); if (!F.fast) Sound.play("faint"); await wait(900); break; }
  }
}
async function playEv(evs, tok){ let n = 0; for (let i = 0; i < evs.length; i++) { const e = evs[i]; if (tok !== F.tok) return; await showEv(e, evs, i); if (F.fast && ++n % 25 === 0) await new Promise(r => setTimeout(r, 0)); } }
const humanFor = i => F.cfg.humans[i] && !F.auto;
function ask(render){ return new Promise(res => { F.resolve = res; render(); }); }
function resolveAsk(v){ const r = F.resolve; F.resolve = null; if (r) r(v); }
const rpStep = (B, fn) => { B.rand = F.R; try { return fn(); } finally { B.rand = Math.random; } };
const rpLog = x => { if (F.rec) F.rec.st.push(JSON.parse(JSON.stringify(x))); };   // a copy: the engine may change choice objects as the turn runs
async function runBattle(tok){
  const B = F.b;
  await playEv(rpStep(B, () => B.start()), tok);
  while (!B.over && tok === F.tok) {
    for (const i of [0, 1]) if (!B.over && B.need[i] === "switch") {
      let k = humanFor(i) ? await askSwitch(i, true) : B.aiReplace(i);
      if (tok !== F.tok) return; if (k === null || k === undefined) k = B.aiReplace(i);
      rpLog(["r", i, k]); await playEv(rpStep(B, () => B.replace(i, k)), tok);
    }
    if (B.over || tok !== F.tok) break;
    const ch = [null, null];
    for (const i of [0, 1]) {
      if (!humanFor(i)) { ch[i] = B.ai(i); continue; }
      if (F.cfg.hotseat) { await ask(() => renderCurtain(i)); if (tok !== F.tok) return; }
      for (;;) {
        if (F.auto) { ch[i] = B.ai(i); break; }
        const c = await ask(() => renderMoves(i)); if (tok !== F.tok) return;
        if (c && c.forfeit) { rpLog(["f", i]); await playEv(B.forfeit(i), tok); break; }
        if (c && c.auto) { ch[i] = B.ai(i); break; }
        if (c && c.sw === "menu") { const k = await askSwitch(i, false); if (tok !== F.tok) return; if (k === null) continue; ch[i] = {sw:k}; break; }
        if (c && c.bag === "menu") { const u = await askBag(i); if (tok !== F.tok) return; if (!u) continue; ch[i] = u; break; }
        ch[i] = c; break;
      }
      if (B.over) break;
    }
    if (B.over || tok !== F.tok) break;
    renderWait();
    rpLog(["c", ch]); await playEv(rpStep(B, () => B.turn(ch)), tok);
    // U-turn, Volt Switch, Baton Pass, Eject Button…: someone picks who comes in, then the turn carries on
    while (B.pend && !B.over && tok === F.tok) {
      const i = B.pend.side; let k = humanFor(i) ? await askSwitch(i, true, true) : B.aiReplace(i);
      if (tok !== F.tok) return; if (k === null || k === undefined) k = B.aiReplace(i);
      rpLog(["u", i, k]); await playEv(rpStep(B, () => B.resume(i, k)), tok);
    }
  }
  if (tok === F.tok) finishBattle();
}
// a replay: the same steps with the same dice; choices are checked the same way as a friend's (links can't break it)
async function runReplay(tok){
  const B = F.b, R = F.cfg.replay; renderReplayBar();
  await playEv(rpStep(B, () => B.start()), tok);
  for (const x of R.st) {
    if (tok !== F.tok || B.over) break;
    if (x[0] === "c" && Array.isArray(x[1])) { const ch = [fbValid(B, 0, "c", x[1][0]), fbValid(B, 1, "c", x[1][1])]; await playEv(rpStep(B, () => B.turn(ch)), tok); }
    else if ((x[0] === "r" || x[0] === "u") && (x[1] === 0 || x[1] === 1)) { if (x[0] === "u" && !(B.pend && B.pend.side === x[1])) continue; if (x[0] === "r" && B.need[x[1]] !== "switch") continue; const k = fbValid(B, x[1], x[0], x[2]); await playEv(rpStep(B, () => x[0] === "r" ? B.replace(x[1], k) : B.resume(x[1], k)), tok); }
    else if (x[0] === "f" && (x[1] === 0 || x[1] === 1)) await playEv(B.forfeit(x[1]), tok);
  }
  if (tok === F.tok && !B.over) { B.over = true; B.winner = R.w; }   // a cut-off record still ends cleanly
  if (tok === F.tok) finishBattle();
}
function renderReplayBar(){
  const c = $("btCmd"); if (!c) return;
  c.innerHTML = `<div class="bt-acts rp-bar"><span class="meta">Replay</span><button class="btn sm" type="button" data-bt="speed">Speed ${F.speed}×</button></div>`;
  toSide(c);
}
// choices (moves, who to switch in) go in the panel beside the battlefield; the other buttons stay under the text box
function toSide(c){
  const side = $("btSide"); if (!side || !c) return;
  const items = [...c.querySelectorAll(":scope > .bt-q, :scope > .bt-moves, :scope > .bt-sw")];
  side.replaceChildren(...items); side.classList.toggle("idle", !items.length);
  side.parentElement.classList.toggle("sw", items.some(n => n.classList.contains("bt-sw")));   // the switch list gets a wider panel
  if (!items.length) side.innerHTML = `<p class="bt-idle">Your moves appear here on your turn.</p>`;
}
function renderWait(){
  if (F.cfg.replay) { renderReplayBar(); return; }
  const c = $("btCmd"); if (!c) return;
  c.innerHTML = `<div class="bt-acts">${F.cfg.humans.some(Boolean) && !F.cfg.live ? `<button class="btn sm" type="button" data-bt="autotog" aria-pressed="${F.auto}">${F.auto ? "Auto: on" : "Auto: off"}</button>` : ""}</div>`;
  toSide(c);
}
function renderCurtain(i){
  const c = $("btCmd"), S = F.b.s[i];
  c.innerHTML = `<div class="bt-curtain"><p>Pass the device to <b>${esc(S.name)}</b>.</p><button class="btn primary" type="button" data-bt="ready">I’m ${esc(S.name)}, show my moves</button></div>`;
  c.querySelector("button").focus();
  toSide(c);
}
function renderMoves(i){
  const B = F.b, me = B.get(i), foe = B.get(1 - i), c = $("btCmd"), S = B.s[i], O = B.options(i);
  const card = (mv, j, pp, max, ok, why) => {
    const dmg = isDmg(mv), t = mv[1] === "???" ? "Normal" : B.moveType(me, mv), fx = mv[8] || {};
    const e = dmg && foe && foe.hp > 0 ? B.typeMul(me, foe, mv, t) : 1;
    const hint = !dmg ? (fx.st ? (foe && B.canStatus(1 - i, fx.st, me) ? ST_HINT[fx.st] : "Won’t work now") : moveHint(mv) || "Status move") : e === 0 ? "No effect" : e >= 2 ? "Super effective" : e < 1 ? "Not very effective" : "";
    const sec = dmg && fx.sec && fx.sec.find(x => x.st);
    const extra = sec && sec.c < 100 ? ` · ${sec.c}% ${({brn:"burn", par:"paralysis", psn:"poison", tox:"poison", slp:"sleep", frz:"freeze"})[sec.st]}` : "";
    const tip = why || `${mv[0]} · ${t} · ${catName(mv)}${mv[3] ? " · Power " + mv[3] : ""} · ${mv[4] ? "Accuracy " + mv[4] + "%" : "Never misses"}${mv[6] ? " · Priority " + (mv[6] > 0 ? "+" : "") + mv[6] : ""}${moveDesc(mv) ? "\n" + moveDesc(mv) : ""}`;
    return `<button class="bt-move" type="button" data-mv="${j}" style="${tStyle(t === "???" ? "Normal" : t)}" ${ok ? "" : "disabled"} title="${esc(tip)}" data-tip="${esc(tip)}">
      <b>${esc(mv[0])}</b><span>${catIcon(mv)}${t} · ${catName(mv)}${mv[3] ? " " + mv[3] : ""}${extra}</span><span class="bt-pp${pp === 0 ? " none" : pp <= max/4 ? " low" : ""}">PP ${pp}/${max}</span>${!ok && why ? `<em>${esc(why)}</em>` : hint ? `<em>${hint}</em>` : ""}</button>`; };
  let body;
  if (O.forced) body = `<div class="bt-moves one">${O.forced.move === -2 ? `<button class="bt-move" type="button" data-mv="-2" style="${tStyle("Normal")}"><b>Recharge</b><span>${esc(me.name)} must rest this turn</span></button>` : card(me.moves[O.forced.move], O.forced.move, me.pp[O.forced.move], maxPP(me.moves[O.forced.move]), true, "")}</div>`;
  else if (O.struggle) body = `<div class="bt-moves one"><button class="bt-move" type="button" data-mv="-1" style="${tStyle("Normal")}"><b>Struggle</b><span>No moves left to use · hurts ${esc(me.name)} too</span></button></div>`;
  else body = `<div class="bt-moves">${O.moves.map(x => card(x.mv, x.j, x.pp, x.max, x.ok, x.why)).join("")}</div>`;
  c.innerHTML = `<p class="bt-q">${F.cfg.hotseat ? `<b>${esc(S.name)}:</b> ` : ""}${O.forced ? `<b>${esc(me.name)}</b> keeps going…` : `What will <b>${esc(me.name)}</b> do?`}</p>${body}
    <div class="bt-acts"><button class="btn sm" type="button" data-bt="switch" ${O.canSwitch ? "" : "disabled"} ${O.trapped ? `title="${esc(me.name)} can’t escape!"` : ""}>${O.trapped ? "Trapped" : "Switch"}</button>${S.bag ? `<button class="btn sm" type="button" data-bt="bag" ${O.bag ? "" : "disabled"}>Bag</button>` : ""}${F.cfg.hotseat || F.cfg.live ? "" : `<button class="btn sm" type="button" data-bt="auto">Auto battle</button>`}<button class="btn sm" type="button" data-bt="run">Forfeit</button></div>`;
  toSide(c);
}
// the Bag: pick an item, then (for Potions, Revives, status heals) who it’s for
function askBag(i){
  const B = F.b, S = B.s[i];
  let item = null;
  return ask(() => {
    const draw = () => {
      const c = $("btCmd");
      if (!item) {
        const rows = BAG_ORDER.filter(k => S.bag[k] > 0).map(k => { const can = S.party.some((m, x) => bagCanUse(k, m, x === S.act)); return `<button class="bt-bagb" type="button" data-bagit="${esc(k)}" ${can ? "" : "disabled"}>${itemIcon(k)}<b>${esc(k)}</b><span class="bag-n">×${S.bag[k]}</span><small>${esc(BAG_ITEMS[k].d)}${can ? "" : " Nobody needs it right now."}</small></button>`; }).join("");
        c.innerHTML = `<p class="bt-q">${F.cfg.hotseat ? `<b>${esc(S.name)}:</b> ` : ""}Use which item? <span class="meta">Using an item takes your turn.</span></p><div class="bt-sw bt-bag">${rows || `<p class="note">The bag is empty.</p>`}</div><div class="bt-acts"><button class="btn sm" type="button" data-bt="cancel">Back</button></div>`;
      } else {
        c.innerHTML = `<p class="bt-q">Use the <b>${esc(item)}</b> on which Pokémon?</p><div class="bt-sw">${S.party.map((m, k) => { const ok = bagCanUse(item, m, k === S.act);
          return `<button class="bt-swb${ok ? " good" : ""}" type="button" data-bagto="${k}" ${ok ? "" : "disabled"}><span class="sw-id"><span class="sw-top">${ballImg(m.ball)}<b class="sw-n">${esc(m.name)}</b>${m.status && m.hp > 0 ? `<span class="bt-st" data-st="${m.status}">${ST_TAG[m.status]}</span>` : ""}<span class="sw-hp">${m.hp <= 0 ? "Fainted" : `${m.hp}/${m.max}`}</span></span>${m.hp > 0 ? `<span class="bt-bar sm"><i style="width:${m.hp/m.max*100}%" data-l="${m.hp/m.max <= .2 ? "r" : m.hp/m.max <= .5 ? "y" : "g"}"></i></span>` : ""}</span></button>`; }).join("")}</div><div class="bt-acts"><button class="btn sm" type="button" data-bagback>Back</button></div>`;
      }
      toSide(c);
    };
    F.bagPick = v => {
      if (v === "back") { item = null; draw(); return; }
      if (typeof v === "string") { const it = BAG_ITEMS[v]; if (it.boost || it.crit || it.mist) { resolveAsk({item:v, target:S.act}); return; } const ok = S.party.map((m, k) => bagCanUse(v, m, k === S.act) ? k : -1).filter(k => k >= 0); item = v; if (ok.length === 1 && it.revive === undefined && ok[0] === S.act) { resolveAsk({item:v, target:S.act}); return; } draw(); return; }
      resolveAsk({item, target:v});
    };
    draw();
  });
}
// one switch choice, one row: who (name, HP, types) on the left, their moves rated against the foe on the right
function swButton(B, i, m, k, active){
  const foe = B.get(1 - i), vs = !!foe && foe.hp > 0, out = m.hp <= 0;
  const top = `<span class="sw-top">${ballImg(m.ball)}<b class="sw-n" title="${esc(m.name)}">${esc(m.name)}</b>${m.status && !out ? `<span class="bt-st" data-st="${m.status}">${ST_TAG[m.status]}</span>` : ""}<span class="sw-hp">${out ? "Fainted" : `${m.hp}/${m.max}`}</span></span>`;
  if (out) return `<button class="bt-swb out" type="button" data-sw="${k}" disabled>${top}</button>`;
  let best = -1;
  const mv = m.moves.map(mv => { const dmg = isDmg(mv), t = mv[1] === "???" ? "Normal" : B.moveType(m, mv);
    const e = vs && dmg ? B.typeMul(m, foe, mv, t) : null;
    if (e !== null) best = Math.max(best, e);
    const c = e === null ? "s" : e === 0 ? "0" : e >= 4 ? "4" : e >= 2 ? "2" : e < 1 ? "h" : "1";
    const word = {s: dmg ? "fixed damage" : "status move", 0:"no effect", 4:"super effective (×4)", 2:"super effective", h:"not very effective", 1:"normal damage"}[c];
    return `<span class="sw-m${c === "h" || c === "0" ? " dim" : ""}" style="${tStyle(t)}" title="${esc(mv[0])} · ${t} · ${word}${vs && e !== null ? ` on ${esc(foe.name)}` : ""}"><span>${esc(mv[0])}</span><i data-e="${c}">${{0:"✕", 4:"×4", 2:"×2", h:"½", 1:"", s:""}[c]}</i></span>`; }).join("");
  const weak = vs && foe.types.some(t => effOf(t, m.types) >= 2);
  return `<button class="bt-swb${active ? " cur" : best >= 2 ? " good" : ""}" type="button" data-sw="${k}" ${active ? "disabled" : ""}>
    <span class="sw-id">${top}<span class="bt-bar sm"><i style="width:${m.hp/m.max*100}%" data-l="${m.hp/m.max <= .2 ? "r" : m.hp/m.max <= .5 ? "y" : "g"}"></i></span>
      <span class="sw-tags">${m.types.map(t => `<span class="tb" style="${tStyle(t)}">${t}</span>`).join("")}${m.item ? `<span class="sw-flag item" title="Held item: ${esc(m.item)}">${itemIcon(m.item)}${esc(m.item)}</span>` : ""}${active ? `<span class="sw-flag cur">In battle</span>` : weak ? `<span class="sw-flag warn">Weak to foe</span>` : ""}</span></span>
    <span class="sw-mv">${mv}</span></button>`;
}
function askSwitch(i, forced, mid){
  return ask(() => {
    const B = F.b, S = B.s[i], c = $("btCmd");
    c.innerHTML = `<p class="bt-q">${F.cfg.hotseat ? `<b>${esc(S.name)}:</b> ` : ""}${mid ? "Who comes in?" : forced ? "Choose your next Pokémon." : "Switch to which Pokémon?"}</p>
      <div class="bt-sw">${(() => { const foe = B.get(1 - i); return foe && foe.hp > 0 ? `<p class="sw-key">Moves rated against <b>${esc(foe.name)}</b>: ×2 super effective · ½ not very effective · ✕ no effect. Green edge = has a super-effective move.</p>` : ""; })()}${S.party.map((m, k) => swButton(B, i, m, k, k === S.act)).join("")}</div>
      <div class="bt-acts">${forced ? (F.cfg.hotseat || F.cfg.live || mid ? "" : `<button class="btn sm" type="button" data-bt="autosw">Auto battle</button>`) : `<button class="btn sm" type="button" data-bt="cancel">Back</button>`}</div>`;
    toSide(c);
  });
}
document.addEventListener("keydown", e => {
  if (nav.screen !== "battle" || nav.sub !== "fight" || !$("modalWrap").hidden || e.target.closest("input, select, textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[1-6]$/.test(e.key)) { const b = $("scBody").querySelectorAll(".bt-move:not([disabled]), .bt-swb:not([disabled])"), all = $("scBody").querySelectorAll(".bt-move, .bt-swb"), t = all[+e.key - 1]; if (t && !t.disabled && b.length) { e.preventDefault(); t.click(); } }
  else if (e.key === "s" || e.key === "S") { const b = $("scBody").querySelector('[data-bt="switch"]:not([disabled])'); if (b) { e.preventDefault(); b.click(); } }
  else if (e.key === "b" || e.key === "B") { const b = $("scBody").querySelector('[data-bt="bag"]:not([disabled])'); if (b) { e.preventDefault(); b.click(); } }
});
// long-press a move card (touch screens) to read power, accuracy and what it does
let lpTimer = 0, lpShown = false;
document.addEventListener("pointerdown", e => {
  const b = e.target.closest && e.target.closest(".bt-move[data-tip]"); if (!b || e.pointerType === "mouse") return;
  lpShown = false; clearTimeout(lpTimer);
  lpTimer = setTimeout(() => { lpShown = true; const r = b.getBoundingClientRect(), t = $("tip"); t.textContent = b.dataset.tip; t.hidden = false; t.style.left = Math.max(8, Math.min(innerWidth - 268, r.left)) + "px"; t.style.top = Math.max(8, r.top - t.offsetHeight - 8) + "px"; }, 450);
});
["pointerup", "pointercancel", "pointerleave"].forEach(k => document.addEventListener(k, () => { clearTimeout(lpTimer); if (lpShown) setTimeout(() => { $("tip").hidden = true; }, 1600); }, true));
document.addEventListener("click", e => { if (lpShown && e.target.closest && e.target.closest(".bt-move")) { e.stopPropagation(); e.preventDefault(); lpShown = false; } }, true);
document.addEventListener("contextmenu", e => { if (e.target.closest && e.target.closest(".bt-move")) e.preventDefault(); });
function onFightClick(e){
  const b = e.target.closest("[data-mv], [data-sw], [data-bt], [data-res], [data-bagit], [data-bagto], [data-bagback]"); if (!b) return;
  if (b.dataset.bagit !== undefined) { Sound.play("select"); if (F.bagPick) F.bagPick(b.dataset.bagit); return; }
  if (b.dataset.bagto !== undefined) { Sound.play("select"); if (F.bagPick) F.bagPick(+b.dataset.bagto); return; }
  if (b.hasAttribute("data-bagback")) { if (F.bagPick) F.bagPick("back"); return; }
  if (b.dataset.res !== undefined) { const fn = F.result && F.result[+b.dataset.res]; if (fn) { Sound.play("select"); fn(); } return; }
  if (b.dataset.mv !== undefined) { Sound.play("select"); resolveAsk({move:+b.dataset.mv}); return; }
  if (b.dataset.sw !== undefined) { Sound.play("select"); resolveAsk(+b.dataset.sw); return; }
  const a = b.dataset.bt;
  if (a === "switch") resolveAsk({sw:"menu"});
  else if (a === "bag") resolveAsk({bag:"menu"});
  else if (a === "cancel") resolveAsk(null);
  else if (a === "ready") resolveAsk(true);
  else if (a === "auto") { F.auto = true; resolveAsk({auto:true}); }
  else if (a === "autosw") { F.auto = true; resolveAsk(null); }
  else if (a === "autotog") { F.auto = !F.auto; renderWait(); }
  else if (a === "speed") { F.speed = F.speed >= 4 ? 1 : F.speed*2; renderReplayBar(); }
  else if (a === "fast") { F.fast = true; F.auto = true; b.disabled = true; b.textContent = "⏭ Skipping to the result…"; clearTimeout(F.timer); if (F.wake) F.wake(); if (F.resolve) resolveAsk(document.querySelector("#btSide .bt-moves, #btCmd .bt-moves") ? {auto:true} : null); else renderWait(); }   // the choices may sit in the side panel
  else if (a === "run") askConfirm("Forfeit this battle?", "It counts as a loss.", "Forfeit").then(ok => { if (ok) resolveAsk({forfeit:true}); });
}
function finishBattle(){
  const B = F.b; rpFinish(B); const rec = rpList()[0], fresh = rec && !F.cfg.replay && Date.now() - rec.at < 864e5 && rec.seed === F.seed;
  B.cleanup(); const win = B.winner === F.me, res = F.cfg.onEnd ? F.cfg.onEnd(win, B) : {text: win ? "You won!" : "You lost.", buttons:[]};
  if (fresh && !F.cfg.hotseat) res.buttons = [...res.buttons, ["▶ Replay", () => rpPlay(rec, () => openScreen("battle", "replays"))]];
  F.fast = false; setMusic(null);
  const sk = $("scBody").querySelector(".bt-skip"); if (sk) sk.hidden = true;
  setTimeout(() => Sound.play(win || F.cfg.hotseat ? "victory" : "lose"), 150);
  const log = $("btLog"); if (log) { log.classList.toggle("win", win); log.classList.toggle("loss", !win && !F.cfg.hotseat); logLine(res.text); }
  if (win && !F.cfg.replay && !F.cfg.hotseat) missionWin(F.cfg, B.s[F.me]);
  F.result = res.buttons.map(x => x[1]);
  const c = $("btCmd"); if (c) c.innerHTML = `<div class="bt-acts end">${res.buttons.map(([l, , p], k) => `<button class="btn${p ? " primary" : ""}" type="button" data-res="${k}">${esc(l)}</button>`).join("")}</div>`;
  toSide(c);
  checkAch();
}

// ---------- full screen (covers the taskbar, browser and Claude UI) ----------
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
function renderFs(){
  const on = !!fsEl();
  document.querySelectorAll("[data-fs]").forEach(b => { b.setAttribute("aria-pressed", on); b.setAttribute("aria-label", on ? "Exit full screen" : "Full screen"); b.title = on ? "Exit full screen (Esc)" : "Full screen"; });
  document.documentElement.classList.toggle("is-fs", on);
}
async function toggleFs(){
  try {
    if (fsEl()) { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) throw new Error("unsupported");
    await req.call(el, {navigationUI:"hide"});
  } catch(e){
    toast("Full screen isn’t allowed here. Open the page in its own browser tab and press F11, or use the browser’s full-screen option.");
  }
}
document.addEventListener("click", e => { if (e.target.closest("[data-fs]")) toggleFs(); });
document.addEventListener("fullscreenchange", renderFs); document.addEventListener("webkitfullscreenchange", renderFs);
document.addEventListener("keydown", e => { if ((e.key === "f" || e.key === "F") && !e.target.closest("input, textarea, select") && !e.ctrlKey && !e.metaKey && !e.altKey) toggleFs(); });
renderFs();

// ---------- boot ----------
// a friendly note instead of a silently broken screen; at most once every 30 seconds
let errNoteAt = 0;
function noteError(e){
  const msg = String((e && (e.message || e.reason && e.reason.message || e.reason)) || "");
  if (/ResizeObserver|Script error|AbortError|NotAllowedError/.test(msg)) return;
  console.error(e && (e.error || e.reason) || e);
  if (Date.now() - errNoteAt < 30000) return; errNoteAt = Date.now();
  try { toast("Something went wrong there. If it keeps happening, reload the page — your progress is saved."); } catch(_){}
}
addEventListener("error", e => { if (e.target === window || !e.target || !e.target.tagName) noteError(e); });
addEventListener("unhandledrejection", noteError);
loadAccounts(); migrateLegacy();
{
  const cur = accounts.current || ss.get(SESSKEY);
  if (cur && profileMeta(cur) && !profileMeta(cur).pin) { signIn(cur, !!accounts.current); showStart(); }
  else if (cur && profileMeta(cur) && accounts.current === cur) { signIn(cur, true); showStart(); }
  else { document.documentElement.dataset.mode = state.mode; showSignIn(); }
}
achReady = true; renderSoundBtns();
{ // a replay link: ?replay=CODE (watched once a save file is open; it never touches the save)
  const q = new URLSearchParams(location.search), code = q.get("replay") || "";
  if (q.has("replay")) { q.delete("replay"); history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash); }
  if (/^[zj][A-Za-z0-9_-]{20,30000}$/.test(code)) { ss.set(RPLINK, code); if (profile) setTimeout(() => { if (ss.get(RPLINK)) { ss.del(RPLINK); rpOpenCode(code); } }, 900); }
}
{ // a friend's share link: ?friend=CODE
  const q = new URLSearchParams(location.search), code = (q.get("friend") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (q.has("friend")) { q.delete("friend"); history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash); }
  if (/^[A-HJ-NP-Z2-9]{8}$/.test(code)) { ss.set(FRLINK, code); if (!(profile && profile.sb)) setTimeout(() => toast(CLOUD_ON ? "Sign in online to add your friend." : "Friends aren’t available on this copy of the app."), 1200); }
}
sbBoot();
