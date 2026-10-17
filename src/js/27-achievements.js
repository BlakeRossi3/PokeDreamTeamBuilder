// ================= ACHIEVEMENTS =================
const fullTeams = () => TEAMS.filter(t => teamOf(t.id).length >= MAX);
const bestQuiz = () => Math.max(0, ...QUIZ_MODES.map(k => state.games.qbest[k] || 0));
const ACH = [
  {id:"party", name:"Full party", desc:"Fill any team with six Pokémon.", p:() => [Math.max(0, ...TEAMS.map(t => teamOf(t.id).length)), 6]},
  {id:"regions", name:"Region tour", desc:"Fill all nine generation teams.", p:() => [GENS.filter(g => teamOf("g" + g.g).length >= MAX).length, 9]},
  {id:"mono", name:"Monotype master", desc:"Build a team of six that all share a type.", p:() => [fullTeams().some(t => { const ms = teamOf(t.id).map(n => NAT_BY.get(n)); return TYPE_ORDER.some(ty => ms.every(m => m.types.includes(ty))); }) ? 1 : 0, 1]},
  {id:"favs", name:"Fan favorite", desc:"Favorite 25 Pokémon.", p:() => [Math.min(25, state.favs.length), 25]},
  {id:"nick", name:"Name tags", desc:"Nickname all six members of a team.", p:() => [fullTeams().some(t => teamOf(t.id).every(n => memberOf(t.id, n).nick)) ? 1 : 0, 1]},
  {id:"balls", name:"Ball collector", desc:"Use 10 different Poké Balls across your teams.", p:() => [Math.min(10, new Set(TEAMS.flatMap(t => teamOf(t.id).map(n => ballOf(t.id, n)))).size), 10]},
  {id:"shinyteam", name:"Shiny squad", desc:"Make a full team of shinies.", p:() => [fullTeams().some(t => teamOf(t.id).every(n => isShinyMember(t.id, n))) ? 1 : 0, 1]},
  {id:"build", name:"Battle ready", desc:"Give a Pokémon four moves, an ability and an item.", p:() => [TEAMS.some(t => teamOf(t.id).some(n => { const M = memberOf(t.id, n); return M.ability && M.item && (M.moves || []).length === 4; })) ? 1 : 0, 1]},
  {id:"rival", name:"Rival rumble", desc:"Win a Rival battle.", p:() => [Object.keys(state.games.wins).length ? 1 : 0, 1]},
  {id:"champs", name:"Champion slayer", desc:"Beat every Champion in Rival battles.", p:() => { const ch = RIVALS.filter(r => /Champion/.test(r.title)); return [ch.filter(r => state.games.wins[r.tr]).length, ch.length]; }},
  {id:"badge1", name:"Gym rookie", desc:"Earn your first Gym badge.", p:() => [Math.min(1, totalBadges()), 1]},
  {id:"badge8", name:"Badge case", desc:"Earn all eight badges in one region.", p:() => [Math.max(0, ...GENS.map(g => badgeCount(g.g))), 8]},
  {id:"league", name:"Hall of Famer", desc:"Beat an Elite Four and its Champion.", p:() => [Math.min(1, leaguesCleared()), 1]},
  {id:"leagues", name:"League legend", desc:"Clear all nine leagues.", p:() => [leaguesCleared(), 9]},
  {id:"badges", name:"Badge master", desc:"Earn all 72 badges.", p:() => [totalBadges(), 72]},
  {id:"quiz10", name:"Quiz whiz", desc:"Reach a streak of 10 in any quiz.", p:() => [Math.min(10, bestQuiz()), 10]},
  {id:"quiz25", name:"Professor", desc:"Reach a streak of 25 in any quiz.", p:() => [Math.min(25, bestQuiz()), 25]},
  {id:"missions", name:"Mission accomplished", desc:"Finish all three daily missions in one day.", p:() => [state.games.missions && state.games.missions.bonus ? 1 : 0, 1]},
  {id:"streak7", name:"Every day", desc:"Visit seven days in a row.", p:() => [Math.min(7, state.games.login.best), 7]},
  {id:"tower", name:"Tower climber", desc:"Win 7 Battle Tower battles in a row.", p:() => [Math.min(7, state.games.tower.best), 7]},
  {id:"vs", name:"Head to head", desc:"Win a Versus battle against another save file.", p:() => [Math.min(1, state.games.vs.w), 1]},
  {id:"gif", name:"Director", desc:"Save a Hall of Fame GIF.", p:() => [Math.min(1, state.games.gifs), 1]},
  {id:"card", name:"Picture day", desc:"Save your trainer card as an image.", p:() => [Math.min(1, state.games.cards), 1]},
  {id:"custom", name:"Architect", desc:"Create a custom team with your own rules.", p:() => [Math.min(1, state.custom.length), 1]},
  {id:"big", name:"Dream big", desc:"Fill a team of 12.", p:() => [Math.min(12, Math.max(0, ...TEAMS.map(t => teamOf(t.id).length))), 12]},
  {id:"megas", name:"Mega Evolution", desc:"Build a full team of six Megas.", p:() => [fullTeams().some(t => teamOf(t.id).every(n => (FORM_BY.get(n) || {}).form === "Mega")) ? 1 : 0, 1]},
  {id:"daily", name:"Daily habit", desc:"Finish a Daily 10 quiz.", p:() => [Math.min(1, state.games.dailyN), 1]},
  {id:"daily10", name:"Perfect day", desc:"Score 10 out of 10 in a Daily 10.", p:() => [state.games.dailyBest, 10]},
  {id:"daily7", name:"Regular", desc:"Play the Daily 10 on seven different days.", p:() => [Math.min(7, state.games.dailyN), 7]},
  {id:"home3", name:"Homeowner", desc:"Invite three Pokémon to live in your Home.", p:() => [Math.min(3, homeData().mons.length), 3]},
  {id:"decor", name:"Interior designer", desc:"Place 10 pieces of furniture in your Home.", p:() => [Math.min(10, homeData().items.length), 10]},
  {id:"bff", name:"Best friends", desc:"Reach 100 friendship with a Pokémon in your Home.", p:() => [Math.max(0, ...Object.values(homeData().fr)), 100]},
  {id:"rooms", name:"Moving on up", desc:"Open every room in your Home.", p:() => [homeRooms().length, ROOMS.length]},
  {id:"spender", name:"Big spender", desc:"Spend 5,000 PokéPoints in the Shop.", p:() => [Math.min(5000, state.games.spent), 5000]},
  {id:"collector", name:"Collector", desc:"Unlock 30 items from the Shop or Gym Leaders.", p:() => [Math.min(30, ownedCount()), 30]},
  {id:"exclusive", name:"Leader’s favorite", desc:"Collect 10 Gym Leader exclusives.", p:() => [Math.min(10, exclusivesOwned()), 10]},
  {id:"berries", name:"Berry good", desc:"Feed 10 berries to Pokémon in your Home.", p:() => [Math.min(10, homeData().fedN), 10]},
  {id:"ribbons", name:"Ribbon collector", desc:"Earn three friendship ribbons (100 friendship).", p:() => [Math.min(3, Object.values(homeData().fr).filter(v => v >= 100).length), 3]},
  {id:"photo", name:"Home photographer", desc:"Take a photo in your Home.", p:() => [Math.min(1, homeData().photos), 1]},
  {id:"friend1", name:"First friend", desc:"Add a friend with an online account.", p:() => [Math.min(1, state.games.social.friends), 1]},
  {id:"fbattle1", name:"Friendly rivals", desc:"Battle a friend live.", p:() => [Math.min(1, state.games.social.fbN), 1]},
  {id:"fbattle10", name:"Best of friends", desc:"Win 10 live battles against friends.", p:() => [Math.min(10, state.games.social.fbW), 10]},
  {id:"friend5", name:"Social circle", desc:"Have five friends.", p:() => [Math.min(5, state.games.social.friends), 5]},
  {id:"visits", name:"House guest", desc:"Visit 10 friends’ Homes.", p:() => [Math.min(10, state.games.social.vis.length), 10]},
  {id:"likes", name:"Talk of the town", desc:"Get 10 Likes on your Home.", p:() => [Math.min(10, state.games.social.likes), 10]},
];
const achDone = () => ACH.filter(a => state.games.ach[a.id]).length;
let achReady = false;
function checkAch(silent){
  if (!profile || typeof ACH === "undefined" || VISIT) return;
  const now = Date.now(), fresh = [];
  for (const a of ACH) { if (state.games.ach[a.id]) continue; const [c, m] = a.p(); if (c >= m) { state.games.ach[a.id] = now; fresh.push(a); } }
  if (!fresh.length) return;
  const pts = 100*fresh.length; state.games.pp += pts; state.games.ppTotal += pts;   // every achievement is worth 100 PokéPoints
  if (silent || !achReady) return;
  setTimeout(() => { Sound.play("up"); toast(`🏆 Achievement unlocked: ${fresh.map(a => a.name).join(", ")}`); ppChip(`+${pts}`, fresh.length > 1 ? "Achievements" : fresh[0].name); }, 350);
  if (nav.screen === "ach") renderAch();
}
function renderAch(){
  const done = achDone();
  $("scBody").innerHTML = `<div class="ach-wrap">
    <div class="ach-sum"><span><b>${done}</b> of ${ACH.length} unlocked · each one is worth ${fmtPP(100)}</span><span class="ach-bar"><i style="width:${done/ACH.length*100}%"></i></span></div>
    <div class="ach-grid">${ACH.map(a => { const at = state.games.ach[a.id], [c, m] = a.p();
      return `<div class="ach${at ? " on" : ""}"><span class="medal-ic" aria-hidden="true">${ICON.trophy}</span><div><b>${a.name}</b><p>${a.desc}</p>${at ? `<span class="meta">Unlocked ${new Date(at).toLocaleDateString()}</span>` : m > 1 ? `<span class="ach-prog"><i style="width:${Math.min(100, c/m*100)}%"></i></span><span class="meta">${Math.min(c, m)} / ${m}</span>` : `<span class="meta">Locked</span>`}</div></div>`; }).join("")}</div></div>`;
  setMusic("title");
}

