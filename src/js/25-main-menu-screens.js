// ================= MAIN MENU + SCREENS =================
const ICON = {
  friends:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.6 14.2c2.6-.4 4.5 1.1 5 4.3"/></svg>',
  builder:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h6m6 0h6"/><circle cx="12" cy="12" r="3"/></svg>',
  battle:'<svg viewBox="0 0 24 24"><path d="M5 4l9 9M5 4H4v1M5 4v3M5 4h3M19 4l-9 9M19 4h1v1M19 4v3M19 4h-3M7.5 14.5l-3 3 2 2 3-3M16.5 14.5l3 3-2 2-3-3"/></svg>',
  quiz:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.1 1-1.1 1.8v.4"/><path d="M12 17h.01"/></svg>',
  home:'<svg viewBox="0 0 24 24"><path d="M3.5 11.5L12 4.5l8.5 7"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5.5h4V20"/></svg>',
  shop:'<svg viewBox="0 0 24 24"><path d="M4.5 8.5h15l-1.3 11.5H5.8z"/><path d="M9 11V7.5a3 3 0 0 1 6 0V11"/></svg>',
  frame:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16.5l5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8.5" r="1.6"/></svg>',
  card:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16.5c.7-1.5 1.8-2.1 3.2-2.1s2.5.6 3.2 2.1M14.5 10h4M14.5 13.5h4"/></svg>',
  trophy:'<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3.2 4M16 6h3a3 3 0 0 1-3.2 4M12 13v4M8 20h8M9.5 17h5"/></svg>',
  gear:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  sound:'<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  mute:'<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  paw:'<svg viewBox="0 0 24 24"><ellipse cx="12" cy="16" rx="4.6" ry="3.8"/><circle cx="6" cy="10.5" r="1.9"/><circle cx="9.6" cy="6.6" r="1.9"/><circle cx="14.4" cy="6.6" r="1.9"/><circle cx="18" cy="10.5" r="1.9"/></svg>',
  sofa:'<svg viewBox="0 0 24 24"><path d="M5 11V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V11"/><path d="M3.5 12.5a1.5 1.5 0 0 1 3 0V14h11v-1.5a1.5 1.5 0 0 1 3 0V18h-17z"/><path d="M5.5 18v1.5M18.5 18v1.5"/></svg>',
  person:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.6-3.8 3.4-6 7-6s6.4 2.2 7 6"/></svg>',
  camera:'<svg viewBox="0 0 24 24"><path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.6l1.6-2h5.6l1.6 2H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/><circle cx="12" cy="13" r="3.6"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};
const ic = k => `<span class="ic" aria-hidden="true">${ICON[k]}</span>`;
const nav = {screen:null, sub:null, back:null, onClick:null, onChange:null, onInput:null, cleanup:null};
function leaveScreen(){ if (nav.cleanup) { const f = nav.cleanup; nav.cleanup = null; try { f(); } catch(e){} } nav.onClick = nav.onChange = nav.onInput = null; }
function renderSoundBtns(){ document.querySelectorAll("[data-snd]").forEach(b => { b.innerHTML = state.ui.sound ? ICON.sound : ICON.mute; b.setAttribute("aria-pressed", !state.ui.sound); b.setAttribute("aria-label", state.ui.sound ? "Mute sound" : "Turn sound on"); b.title = state.ui.sound ? "Sound on" : "Sound off"; }); }
document.addEventListener("click", e => { if (!e.target.closest("[data-snd]")) return; state.ui.sound = !state.ui.sound; applyUI(); save(); renderSoundBtns(); Sound.refresh(); if (state.ui.sound) { Sound.init(); Sound.play("select"); } if (nav.screen === "settings") renderSettings(); });

// ---- menu (sits over the title-screen scene) ----
const HUB = [
  {go:"app", icon:"builder", name:"Team Builder", sub:"Build, personalize and stage your dream teams", big:true},
  {go:"battle", icon:"battle", name:"Battle", sub:"Gyms, Elite Four, rivals and Versus"},
  {go:"home", icon:"home", name:"Pokémon Home", sub:"Walk around and play with your favorites"},
  {go:"shop", icon:"shop", name:"Shop", sub:"Spend PokéPoints on unlockables"},
  {go:"hofgal", icon:"frame", name:"Hall of Fame", sub:"All of your Hall of Fame cards"},
  {go:"quiz", icon:"quiz", name:"Quiz", sub:"Silhouettes, matchups, stats and types"},
  {go:"card", icon:"card", name:"Trainer card", sub:"Your journey on one card"},
  {go:"friends", icon:"friends", name:"Friends", sub:"Visit friends’ Homes and see their teams"},
  {go:"ach", icon:"trophy", name:"Achievements", sub:""},
];
function showHub(){
  if (!profile) { showSignIn(); return; }
  { const rl = ss.get(RPLINK); if (rl) { ss.del(RPLINK); setTimeout(() => rpOpenCode(rl), 300); } }
  leaveScreen(); hideTip(); closeModal(); hideSignIn();
  if (!$("hof").hidden) closeHof(); if (!$("view").hidden) closeView();
  document.documentElement.dataset.view = "hub"; document.documentElement.dataset.mode = state.mode;
  $("app").hidden = true; $("screen").hidden = true; $("start").hidden = false;
  nav.screen = null; loginTick(); renderStartUI(); renderHub(); renderSoundBtns();
  if (!startStage.running) startStage.start(); else startStage.load();
  setMusic("title");
  if (!state.games.intro && $("modalWrap").hidden) setTimeout(() => { if (document.documentElement.dataset.view === "hub" && $("modalWrap").hidden && !state.games.intro) showWelcome(); }, 700);
  else if (state.games.ecoNew && $("modalWrap").hidden) setTimeout(() => { if (document.documentElement.dataset.view === "hub" && $("modalWrap").hidden && state.games.ecoNew) showEcoNews(); }, 700);
  else if (state.games.rw2 && $("modalWrap").hidden) setTimeout(() => { if (document.documentElement.dataset.view === "hub" && $("modalWrap").hidden && state.games.rw2) showRewardNews(); }, 700);
}
function renderHub(){
  const done = achDone();
  const meta = {battle:`${totalBadges()}/72 badges`, ach:`${done}/${ACH.length} unlocked`, home:`${homeMons().length}/${homeCap()} Pokémon`, shop:fmtPP(state.games.pp), hofgal:`${nonEmptyTeams().length} cards`, card:esc(profile && !profile.guest ? profile.name : "Guest"), friends:friendsOn() ? (FR.list ? `${FR.list.filter(f => f.status === "accepted").length} friends` : "Online") : "Sign in online", quiz:dailyState().i >= 10 ? `Daily done · ${dailyState().s}/10` : "Daily 10 ready"};
  $("hubGrid").style.setProperty("--hub-n", HUB.filter(h => !h.big).length);
  $("hubGrid").innerHTML = HUB.map(h => `<button class="hub-tile${h.big ? " big" : ""}" type="button" data-go="${h.go}" title="${esc(h.sub || h.name)}">${ic(h.icon)}<span class="ht"><b>${h.name}</b>${h.big ? `<span>${state.sample ? h.sub : `Continue · ${esc(G().card)} team ${team().length}/${sizeOf(state.team)}`}</span>` : meta[h.go] ? `<span class="hm">${meta[h.go]}</span>` : ""}</span></button>`).join("");
  const ico = myIcon(); $("hubWho").innerHTML = profile ? `${ico ? iconHTML(ico, "sm") : ""}<span>${profile.guest ? "Playing as guest" : `Trainer ${esc(profile.name)}`}</span><span class="hub-pp">${fmtPP(state.games.pp)}</span>` : "";
  paintAll($("hubWho"));
  renderHubToday();
}
$("hubGrid").addEventListener("click", e => {
  const b = e.target.closest("[data-go]"); if (!b) return; Sound.play("select");
  if (b.dataset.go === "app") enterApp(state.mode); else openScreen(b.dataset.go);
});
$("hubBack").addEventListener("click", () => { Sound.play("back"); showStart(); });
$("hubToday").addEventListener("click", () => { Sound.play("select"); openMissions(); });
$("hubHelp").addEventListener("click", () => { Sound.play("select"); showWelcome(); });
// ---- first-run welcome (also under "How to play") ----
function showWelcome(){
  const row = (icon, t, d) => `<div class="wl-row">${ic(icon)}<div><b>${t}</b><p>${d}</p></div></div>`;
  const md = openModal(`<h3 class="mt" id="modalTitle">Welcome to Dream Team Dex</h3>
    <p class="note">Pick your favourite Pokémon, build dream teams and take them into battle.</p>
    <div class="wl">
      ${row("builder", "Build dream teams", "Choose six for every region and collection, or make custom teams with your own rules: one type, Megas only, up to 12 Pokémon. Give each one a nickname, Poké Ball, moves and an item.")}
      ${row("frame", "Stage your Hall of Fame", "Every team gets an animated scene, with separate 2D and 3D cards. Drag your Pokémon around, pick a backdrop and save it as a GIF.")}
      ${row("battle", "Battle and play", "Take on 72 Gym Leaders, clear the Elite Four, beat rivals and play the Daily 10 quiz. Everything earns PokéPoints, and Gym Leaders hand out exclusive rewards.")}
      ${row("home", "Pokémon Home", "Invite your favorites to your own house, walk around as your trainer and play with them. Decorate it and open new rooms.")}
      ${row("shop", "Shop", `Spend PokéPoints on furniture, rooms, backgrounds, Poké Balls, profile icons and card designs. You start with ${(state.games.ecoNew || 500).toLocaleString()}.`)}
      ${row("gear", "Make it yours", "Switch between 2D pixel art and 3D at any time. Settings has themes, colours, sound and text size.")}
    </div>
    <div class="actions"><button class="btn primary" type="button" id="wlGo">Start building</button><button class="btn" type="button" id="wlClose">Look around first</button></div>`, {onClose:() => { if (!state.games.intro || state.games.ecoNew) { state.games.intro = 1; state.games.ecoNew = 0; save(); } }});
  md.querySelector("#wlGo").onclick = () => { closeModal(); Sound.play("confirm"); enterApp(state.mode); };
  md.querySelector("#wlClose").onclick = () => closeModal();
}
document.querySelectorAll("[data-gear]").forEach(b => { if (!b.textContent.trim()) b.innerHTML = ICON.gear; b.addEventListener("click", () => { Sound.play("select"); openScreen("settings"); }); });
function setMusic(name){ Sound._want = name; Sound.music(name); }
// shown once to players who started before PokéPoints existed
function showEcoNews(){
  const row = (icon, t, d) => `<div class="wl-row">${ic(icon)}<div><b>${t}</b><p>${d}</p></div></div>`;
  const md = openModal(`<h3 class="mt" id="modalTitle">New: PokéPoints, Shop and Pokémon Home</h3>
    <div class="unlock-hero"><span class="eco-gift">${fmtPP(state.games.ecoNew)}</span></div>
    <p class="note">Here are <b>${state.games.ecoNew.toLocaleString()} PokéPoints</b> for everything you’ve done so far, plus the Gym Leader rewards for badges you already have. Backgrounds, Poké Balls and card colours you were using are yours to keep.</p>
    <div class="wl">${row("home", "Pokémon Home", "Invite your favorites, walk around and play with them.")}${row("shop", "Shop", "Furniture, rooms, backgrounds, Poké Balls, profile icons and card designs.")}${row("frame", "Hall of Fame", "All your scenes in one place, with separate 2D and 3D cards.")}</div>
    <div class="actions"><button class="btn primary" type="button" id="ecoShop">Visit the Shop</button><button class="btn" type="button" id="ecoHome">Go to my Home</button></div>`, {onClose:() => { state.games.ecoNew = 0; save(); }});
  md.querySelector("#ecoShop").onclick = () => { closeModal(); openScreen("shop"); };
  md.querySelector("#ecoHome").onclick = () => { closeModal(); openScreen("home"); };
}

// shown once to players who beat leaders before the new reward table
function showRewardNews(){
  const n = state.games.rw2, owned = ITEMS_ALL.filter(it => isExclusive(it) && owns(it.cat, it.id) && it.cat === "furn").slice(0, 8);
  const md = openModal(`<h3 class="mt" id="modalTitle">New: Gym, Elite Four and Champion rewards</h3>
    <p class="note">Every Gym Leader now gives a reward that fits them and their type, every Elite Four member gives an elite reward, and Champions give a full set. You already beat some of them, so <b>${n} new reward${n === 1 ? " is" : "s are"}</b> waiting for you. You keep everything you had.</p>
    <div class="reward-list">${owned.map(it => `<div class="reward">${itemThumb(it)}<div><b>${esc(it.name)}</b><span class="meta">From ${esc(it.from || "")}</span></div></div>`).join("")}</div>
    <div class="actions"><button class="btn primary" type="button" id="rwnHome">Go to my Home</button><button class="btn" type="button" data-close>Later</button></div>`, {onClose:() => { state.games.rw2 = 0; save(); }});
  paintThumbs(md);
  md.querySelector("#rwnHome").onclick = () => { closeModal(); openScreen("home"); };
}

// ---- generic screen shell ----
const SCREEN_TITLE = {friends:"Friends", battle:"Battle", quiz:"Quiz", home:"Pokémon Home", shop:"Shop", hofgal:"Hall of Fame", card:"Trainer card", ach:"Achievements", settings:"Settings"};
function openScreen(kind, sub = null){
  leaveScreen(); hideTip(); closeModal(); startStage.stop();
  if (!$("hof").hidden) closeHof(); if (!$("view").hidden) closeView();
  document.documentElement.dataset.view = "screen";
  $("start").hidden = true; $("app").hidden = true; $("screen").hidden = false;
  nav.screen = kind; nav.sub = sub;
  $("screen").dataset.kind = kind;
  renderSoundBtns(); renderScreen(); scrollTo(0, 0);
}
function renderScreen(){
  leaveScreen();
  const k = nav.screen; $("scTitle").textContent = k === "battle" && nav.sub === "fight" ? "Battle" : SCREEN_TITLE[k] || "";
  ({battle:renderBattleScreen, quiz:renderQuiz, home:renderHome, shop:renderShop, hofgal:renderHofGallery, card:renderCard, ach:renderAch, settings:renderSettings, friends:renderFriends})[k]();
}
$("scBody").addEventListener("click", e => nav.onClick && nav.onClick(e));
$("scBody").addEventListener("change", e => nav.onChange && nav.onChange(e));
$("scBody").addEventListener("input", e => nav.onInput && nav.onInput(e));
async function screenBack(){
  if (!$("modalWrap").hidden) return;
  if (nav.screen === "battle" && nav.sub === "fight" && F.b && !F.b.over) {
    const ok = await askConfirm("Leave this battle?", F.cfg.leaveNote || "Leaving now counts as a loss.", "Leave battle"); if (!ok) return;
    if (F.cfg.onLeave) F.cfg.onLeave();
  }
  Sound.play("back");
  if (nav.screen === "battle" && nav.sub === "fight" && F.cfg && F.cfg.backFn) { F.cfg.backFn(); return; }
  if (nav.screen === "battle" && nav.sub && nav.sub !== "menu") { const to = nav.sub === "fight" ? (F.cfg && F.cfg.back) || "menu" : "menu"; openScreen("battle", to); return; }
  showHub();
}
$("scBack").addEventListener("click", screenBack);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !e.defaultPrevented && !$("screen").hidden && $("modalWrap").hidden) { e.preventDefault(); screenBack(); } });   // (Decorate mode uses Esc to cancel first)
function askConfirm(title, text, yes){
  return new Promise(res => {
    let done = false; const fin = v => { if (done) return; done = true; res(v); };
    const md = openModal(`<h3 class="mt" id="modalTitle">${esc(title)}</h3><p>${esc(text)}</p><div class="actions"><button class="btn primary" type="button" id="cfYes">${esc(yes)}</button><button class="btn" type="button" id="cfNo">Stay</button></div>`, {onClose:() => fin(false)});
    md.querySelector("#cfYes").onclick = () => { fin(true); closeModal(); };
    md.querySelector("#cfNo").onclick = () => closeModal();
  });
}

