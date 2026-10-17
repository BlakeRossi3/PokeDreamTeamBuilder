// ================= BATTLE TOWER =================
// Battles in a row with one team at level 50 (3 on 3 or 6 on 6), healed between battles, no Bag on either side.
// Every 7 wins the trainers get smarter (better natures, items, then EVs); every 7th battle is Tower Tycoon Palmer.
// Points grow with the streak; streaks of 21 and 49 give Tower-only rewards (TOWER_REWARD, never sold).
const TYCOON = {name:"Palmer", silver:[464, 350, 149, 486, 485, 488], gold:[486, 485, 488, 350, 464, 149]};
const towerTier = cur => Math.floor(cur/7);
const towerTycoon = cur => cur % 7 === 6;
const towerPts = cur => 30 + 10*Math.min(5, towerTier(cur)) + (towerTycoon(cur) ? 150 : 0);
let towerPick = null;
function towerFoe(cur, size){
  const T = state.games.tower, tier = towerTier(cur), ai = Math.min(4, 2 + tier), seed = (T.won*131 + cur*17 + Math.floor(Math.random()*1e6)) | 0;
  if (towerTycoon(cur)) { const nums = (cur >= 20 ? TYCOON.gold : TYCOON.silver).slice(0, size);
    return {foe:{name:`Tycoon ${TYCOON.name}`, title:`Tower Tycoon · ${cur >= 20 ? "Gold" : "Silver"} challenge`, bg:"tower", trIdx:TR_BY_NAME.get(TYCOON.name)}, side:foeSide(TYCOON.name, nums, {level:50, ai:4, seed}), ai:4}; }
  // anyone from the rivals and leagues; Elite Four and Champions only once the streak gets going
  const pool = [...RIVALS.map(r => ({name:r.tr, title:r.title, nums:r.team}))];
  LEAGUES.forEach(L => { L.gyms.forEach(([nm, ty, ace], k) => pool.push({name:nm, title:`${GENS[L.g - 1].region} Gym Leader`, type:ty, nums:() => leagueTeam(L.g, nm, ty, ace, 6, L.g*100 + k)}));
    if (tier >= 1) L.e4.forEach(([nm, ty, ace], k) => pool.push({name:nm, title:`${GENS[L.g - 1].region} ${L.e4label || "Elite Four"}`, type:ty, nums:() => leagueTeam(L.g, nm, ty, ace, 6, L.g*1000 + k)}));
    if (tier >= 2) pool.push({name:L.champ[0], title:`${GENS[L.g - 1].region} Champion`, nums:L.champ[1]}); });
  const o = pool[Math.floor(Math.random()*pool.length)], all = (typeof o.nums === "function" ? o.nums() : o.nums).filter(n => NAT_BY.has(n));
  const nums = [...all].sort(() => Math.random() - .5).slice(0, size);
  return {foe:{name:o.name, title:`Battle ${cur + 1} · ${o.title}`, type:o.type, bg:"tower"}, side:foeSide(o.name, nums, {level:50, ai, seed}), ai};
}
function renderTower(){
  if (needTeam()) return;
  const T = state.games.tower, ts = nonEmptyTeams(), live = T.cur > 0 && TEAM_BY.has(T.team);
  if (!ts.some(t => t.id === towerPick)) towerPick = live ? T.team : ts.some(t => t.id === "all") ? "all" : ts[0].id;
  const next = T.cur, tyc = towerTycoon(next), steps = [21, 49];
  const reward = at => { const got = (T.rw & (at === 21 ? 1 : 2)) > 0; return `<div class="tw-rw${got ? " got" : ""}"><b>${at} in a row</b><span>${TOWER_REWARD[at].map(it => got ? esc(it.name) : it.cat === "furn" ? "A trophy" : it.cat === "bg" ? "A background" : "A profile icon").join(" · ")}</span><small>${got ? "★ Earned" : `${Math.min(T.best, at)} / ${at}`}</small></div>`; };
  $("scBody").innerHTML = `<div class="sc-narrow wide tw">
    <div class="tw-head"><div class="tw-stat"><small>Streak</small><b>${T.cur}</b></div><div class="tw-stat"><small>Best</small><b>${T.best}</b></div><div class="tw-stat"><small>Wins</small><b>${T.won}</b></div></div>
    <div class="tw-next${tyc ? " tyc" : ""}">${tyc ? `${trOrEmblem(TYCOON.name)}<div><b>Battle ${next + 1}: Tower Tycoon ${TYCOON.name}</b><span>The Tower’s boss. Beat him for ${towerPts(next)} PokéPoints.</span></div>`
      : `<div><b>Battle ${next + 1}</b><span>${7 - next % 7 - 1 ? `${7 - next % 7 - 1} more until Tycoon ${TYCOON.name}.` : ""} A win is worth ${towerPts(next)} PokéPoints.${towerTier(next) ? ` Trainers are ${towerTier(next) >= 2 ? "at their toughest" : "tougher now"}.` : ""}</span></div>`}</div>
    ${live ? `<div class="gym-team"><div><b>Your Tower team</b><span class="note" style="margin:0">${T.size} on ${T.size} · locked until the streak ends</span></div><div class="gt-mons">${T.nums.map(n => spr(n)).join("")}</div></div>
      <div class="actions"><button class="btn primary" type="button" id="twGo">Battle ${next + 1} ▸</button><button class="btn" type="button" id="twQuit">End streak</button></div>`
    : `${teamSelect("twTeam", towerPick)}
      <div class="set-row"><span>Format</span><div class="segrow" data-twsize><button type="button" data-v="3" aria-pressed="${T.size === 3}">3 on 3</button><button type="button" data-v="6" aria-pressed="${T.size === 6}">6 on 6</button></div></div>
      <div class="actions"><button class="btn primary" type="button" id="twGo">Start a streak</button></div>`}
    <div class="cov-h">Tower rewards</div><div class="tw-rws">${steps.map(reward).join("")}</div>
    <p class="note">Everyone battles at level 50 with no Bag. Your team is fully healed after every win. Losing, or leaving a battle, ends the streak. Tower rewards can’t be bought in the Shop.</p></div>`;
  paintAll($("scBody"));
  nav.onChange = e => { if (e.target.id === "twTeam") towerPick = e.target.value; };
  nav.onClick = e => {
    const sz = e.target.closest("[data-twsize] [data-v]"); if (sz) { T.size = +sz.dataset.v; save(); Sound.play("select"); renderTower(); return; }
    if (e.target.closest("#twQuit")) { askConfirm("End this streak?", `Your streak of ${T.cur} ends here. Your best stays ${T.best}.`, "End streak").then(ok => { if (ok) { towerEnd(); renderTower(); } }); return; }
    if (e.target.closest("#twGo")) {
      if (live) { towerBattle(); return; }
      pickForBattle(towerPick, T.size, `Your team for the Battle Tower`, nums => { if (nums.length < T.size) { toast(`The ${T.size} on ${T.size} Tower needs ${T.size} Pokémon on your team.`); return; } Object.assign(T, {team:towerPick, nums:nums.slice(0, T.size), cur:0}); save(); towerBattle(); });
    }
  };
}
function towerEnd(){ const T = state.games.tower; T.best = Math.max(T.best, T.cur); T.cur = 0; T.nums = []; T.team = ""; save(); }
async function towerBattle(){
  const T = state.games.tower, tid = T.team, nums = T.nums.filter(n => teamOf(tid).includes(n));
  if (nums.length < T.size) { toast("Your Tower team changed, so this streak is over. Start a new one!"); towerEnd(); openScreen("battle", "tower"); return; }
  await withMoves();
  const cur = T.cur, F2 = towerFoe(cur, T.size), me = {...playerSide(tid, 50, {}), party:nums.map(n => monFromTeam(tid, n, 50))};
  startBattle({back:"tower", foe:F2.foe, sides:[me, F2.side], humans:[true, false],
    leaveNote:`Leaving ends your streak of ${cur}.`, onLeave:() => { towerEnd(); },
    onEnd:win => {
      if (!win) { const was = T.cur; towerEnd(); return {text:`${esc(F2.foe.name)} ended your streak at <b>${was}</b>.${was >= T.best && was ? " That’s your best yet!" : ""}`, buttons:[["Back to the Tower", () => openScreen("battle", "tower"), true]]}; }
      const pts = towerPts(cur); T.cur++; T.won++; T.best = Math.max(T.best, T.cur);
      const got = [];
      for (const [at, bit] of [[21, 1], [49, 2]]) if (T.cur >= at && !(T.rw & bit)) { T.rw |= bit; for (const it of TOWER_REWARD[at]) if (!owns(it.cat, it.id)) { grant(it); got.push(it); } }
      save(); checkAch();
      if (got.length) { earn(pts, `Battle Tower win ${T.cur}`, true); setTimeout(() => showRewards(`${T.cur} wins in a row!`, got, pts), 1700); } else earn(pts, `Battle Tower win ${T.cur}`);
      return {text:`${towerTycoon(cur) ? `You beat <b>Tower Tycoon ${TYCOON.name}</b>!` : `You beat <b>${esc(F2.foe.name)}</b>!`} Streak: <b>${T.cur}</b>.${towerTycoon(T.cur) ? ` Next up: Tycoon ${TYCOON.name}.` : ""}`,
        buttons:[[`Next: battle ${T.cur + 1}`, () => towerBattle(), true], ["Take a break", () => openScreen("battle", "tower")]]};
    }});
}

