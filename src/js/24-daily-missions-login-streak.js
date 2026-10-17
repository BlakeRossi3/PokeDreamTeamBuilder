// ================= DAILY MISSIONS + LOGIN STREAK =================
// Three missions a day, picked to fit the save (no Home missions without Pokémon at home…), each worth PokéPoints,
// plus a bonus for all three. Visiting on consecutive days builds a streak: a little each day, more every 7th day and
// on day 30; missing days keeps half the streak.
const MISSIONS = {
  win:{g:"battle", goal:2, pts:60, t:() => "Win 2 battles"},
  wintype:{g:"battle", goal:1, pts:80, t:a => `Win a battle with ${/^[AEIOU]/.test(a) ? "an" : "a"} ${a} type on your team`},
  gym:{g:"battle", goal:1, pts:80, t:() => "Beat a Gym Leader or Elite Four member (rematches count)"},
  tower:{g:"battle", goal:1, pts:80, t:() => "Win a Battle Tower battle"},
  daily10:{g:"quiz", goal:1, pts:60, t:() => "Finish today’s Daily 10 quiz", ok:() => !(state.games.daily && state.games.daily.d === todayKey() && state.games.daily.i >= 10)},
  feed:{g:"home", goal:3, pts:70, t:() => "Feed 3 berries to your Pokémon", ok:() => homeMons().length > 0 && (bagTotal() >= 3 || homeData().items.some(p => p.id === "tree"))},
  pet:{g:"home", goal:3, pts:60, t:() => "Play with 3 Pokémon in your Home", ok:() => homeMons().length >= 3},
  catch:{g:"home", goal:1, pts:60, t:() => "Play a round of Berry Catch", ok:() => homeMons().length > 0},
  seek:{g:"home", goal:1, pts:70, t:() => "Find a Pokémon in Hide-and-seek", ok:() => homeMons().length > 0 && homeData().items.length >= 2},
  photo:{g:"home", goal:1, pts:50, t:() => "Save a photo of your Home", ok:() => homeMons().length > 0},
};
const MISSION_BONUS = 150;
function missionsToday(){
  const G = state.games, day = todayKey();
  if (G.missions && G.missions.d === day) return G.missions;
  const R = rng([...day + (profile ? profile.name : "")].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0);
  const can = Object.entries(MISSIONS).filter(([k, M]) => (!M.ok || M.ok()) && (M.g !== "battle" || nonEmptyTeams().length)), pick = [], used = new Set();
  const take = list => { if (!list.length) return; const [k] = list[Math.floor(R()*list.length)]; used.add(k); used.add("g:" + MISSIONS[k].g); pick.push(k); };
  for (const g of ["battle", "home", "quiz"]) take(can.filter(([k, M]) => M.g === g && !used.has(k)));
  while (pick.length < 3) { const rest = can.filter(([k]) => !used.has(k)); if (!rest.length) break; take(rest); }
  const types = [...new Set(nonEmptyTeams().flatMap(t => teamOf(t.id).flatMap(n => NAT_BY.get(n).types)))];
  G.missions = {d:day, bonus:0, list:pick.slice(0, 3).map(k => ({k, a:k === "wintype" && types.length ? types[Math.floor(R()*types.length)] : "", n:0, goal:MISSIONS[k].goal, done:0}))};
  for (const x of G.missions.list) if (x.k === "wintype" && !x.a) { x.k = "win"; x.goal = MISSIONS.win.goal; }
  save(); return G.missions;
}
function missionBump(k, test){
  if (VISIT || !profile) return; const T = missionsToday(); let changed = false;
  for (const x of T.list) if (x.k === k && !x.done && (!test || test(x))) {
    x.n++; changed = true;
    if (x.n >= x.goal) { x.done = 1; const M = MISSIONS[x.k]; earn(M.pts, `Mission: ${M.t(x.a)}`); Sound.play("up"); }
  }
  if (changed && !T.bonus && T.list.length && T.list.every(x => x.done)) { T.bonus = 1; setTimeout(() => { earn(MISSION_BONUS, "All of today’s missions!"); checkAch(); }, 900); }
  if (changed) { save(); if (document.documentElement.dataset.view === "hub") renderHubToday(); }
}
function missionWin(cfg, side){
  const types = new Set(side.party.flatMap(m => (NAT_BY.get(m.n) || {types:[]}).types));
  missionBump("win"); missionBump("wintype", x => types.has(x.a));
  if (cfg.back === "gym") missionBump("gym"); if (cfg.back === "tower") missionBump("tower");
}
const dayDiff = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z"))/864e5);
const LOGIN_PTS = cur => cur % 30 === 0 ? 1000 : cur % 7 === 0 ? 200 : 25;
function loginTick(){
  if (VISIT || !profile) return;
  const L = state.games.login, day = todayKey(); if (L.last === day) return;
  const gap = L.last ? dayDiff(L.last, day) : 1; if (gap < 0) { L.last = day; save(); return; }   // the clock went back: just note today
  const before = L.cur; L.cur = gap === 1 ? L.cur + 1 : Math.floor(L.cur/2) + 1; L.best = Math.max(L.best, L.cur); L.days++; L.last = day;
  const cur = L.cur, pts = LOGIN_PTS(cur); save();
  setTimeout(() => { earn(pts, cur > 1 ? `Day ${cur} in a row` : "Daily visit"); if (gap > 1 && before > 1) toast(`You missed a day, so your ${before}-day streak is now ${cur}. Come back tomorrow to grow it!`); checkAch(); }, 1200);
}
function renderHubToday(){
  const b = $("hubToday"); if (!b) return; if (!profile) { b.hidden = true; return; }
  const T = missionsToday(), L = state.games.login, done = T.list.filter(x => x.done).length;
  b.hidden = false;
  b.innerHTML = `<span class="ht-streak" title="Days in a row">🔥 <b>${L.cur}</b> ${L.cur === 1 ? "day" : "days"}</span><span class="ht-m"><b>Daily missions</b> ${done}/${T.list.length}${T.bonus ? " ★" : ""}</span><span class="ht-bar" aria-hidden="true"><i style="width:${T.list.length ? done/T.list.length*100 : 0}%"></i></span><span class="ht-go" aria-hidden="true">▸</span>`;
  b.setAttribute("aria-label", `Daily missions: ${done} of ${T.list.length} done. Streak: ${L.cur} days.`);
}
function openMissions(){
  const T = missionsToday(), L = state.games.login, next = L.cur + 1;
  const row = x => { const M = MISSIONS[x.k]; return `<div class="ms-row${x.done ? " done" : ""}"><span class="ms-ck" aria-hidden="true">${x.done ? "✓" : ""}</span><div><b>${esc(M.t(x.a))}</b><span class="ms-bar"><i style="width:${Math.min(1, x.n/x.goal)*100}%"></i></span><small>${Math.min(x.n, x.goal)} / ${x.goal}</small></div><span class="ms-pts">${fmtPP(M.pts)}</span></div>`; };
  openModal(`<h3 class="mt" id="modalTitle">Today</h3>
    <div class="ms-streak"><span class="ms-fire" aria-hidden="true">🔥</span><div><b>${L.cur} ${L.cur === 1 ? "day" : "days"} in a row</b><span>Best ${L.best}. Tomorrow: ${fmtPP(LOGIN_PTS(next))}${LOGIN_PTS(next) > 25 ? " (a big day!)" : ""}. Every 7th day gives more, and day 30 the most. Missing a day keeps half your streak.</span></div></div>
    <div class="cov-h">Daily missions</div>
    <div class="ms-list">${T.list.map(row).join("")}</div>
    <p class="note">${T.bonus ? "All done for today. New missions tomorrow!" : `Finish all three for a bonus of ${MISSION_BONUS} PokéPoints.`}</p>
    <div class="actions"><button class="btn primary" type="button" data-close>OK</button></div>`);
}

