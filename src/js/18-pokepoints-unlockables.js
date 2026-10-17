// ================= POKÉPOINTS + UNLOCKABLES =================
// Everything you can collect: Hall of Fame backgrounds, Home furniture and rooms, profile icons, Poké Balls and
// trainer card designs. Most are bought in the Shop with PokéPoints; Gym Leaders and Champions hand out exclusives
// that the Shop never sells.
const ppIc = `<span class="pp-ic" aria-hidden="true">P</span>`;
const fmtPP = n => `${ppIc}${Math.max(0, Math.round(n)).toLocaleString()}`;
const CAT = {
  bg:{name:"Hall of Fame backgrounds", one:"background"},
  furn:{name:"Home furniture", one:"furniture"},
  exp:{name:"Home rooms", one:"room"},
  house:{name:"Houses", one:"house"},
  icon:{name:"Profile icons", one:"profile icon"},
  ball:{name:"Poké Balls", one:"Poké Ball"},
  card:{name:"Trainer card designs", one:"card design"},
};
const CAT_ORDER = ["furn", "exp", "house", "bg", "icon", "ball", "card"];
const ITEMS_ALL = [];   // {cat, id, name, price?, free?, gym?:[g,k], champ?:g, ...extra}
const ITEM_BY = new Map();
const addItem = it => { ITEMS_ALL.push(it); ITEM_BY.set(it.cat + ":" + it.id, it); };
const unlockOf = (cat, id) => ITEM_BY.get(cat + ":" + id);

// --- Hall of Fame backgrounds ---
[["route",0],["league",0],["pokecenter",0],["beach",0],["forest",400],["summit",500],["city",600],["safari",600],["gym",800],["cave",900],["volcano",1000],["blossom",1000],["reef",1100],["lavender",1200],["skypillar",1300],["stadium",1500]]
  .forEach(([id, p]) => addItem({cat:"bg", id, name:SCENE_BY.get(id).name, price:p, free:!p}));
// --- Poké Balls ---
const BALL_FREE = ["poke", "great", "ultra", "premier"];
// Gym Leaders hand out the rare Poké Balls that fit them (see data/rewards.json); the rest are sold in the Shop
const REWARDS = /*REWARDS*/;
const BALL_SHOP = {heal:200, luxury:500, nest:300, quick:400, timer:300, repeat:300};
BALL_IDS.forEach(id => addItem({cat:"ball", id, name:ballName(id), price:BALL_SHOP[id] || 0, free:BALL_FREE.includes(id)}));
// --- trainer card designs ---
const CARD_DESIGNS = {
  red:{name:"Classic red", c:["#d8423a","#a82a24","#fff3e6"], free:true}, blue:{name:"Classic blue", c:["#2f6fd6","#1c4ea3","#eef5ff"], free:true},
  gold:{name:"Gold", c:["#e2b13c","#b5841b","#fffbea"], price:400}, black:{name:"Onyx", c:["#2a2d36","#14161c","#f2f3f7"], price:400},
  green:{name:"Forest", c:["#2f9e62","#1d7244","#effbf3"], price:400}, pink:{name:"Blossom", c:["#e15b9a","#b73b75","#fff0f6"], price:400},
  sunset:{name:"Sunset", c:["#ff8a3d","#c2306b","#fff4ec"], price:900, pat:"glow"}, ocean:{name:"Deep sea", c:["#1aa3c9","#173c8f","#ecfaff"], price:900, pat:"wave"},
  grid:{name:"Pixel grid", c:["#5b5fe0","#2b2f9e","#f1f1ff"], price:800, pat:"grid"}, aurora:{name:"Aurora", c:["#29c7a3","#6a3fd6","#effffb"], price:1200, pat:"glow"},
  galaxy:{name:"Galaxy", c:["#2a1d5c","#0b0a1f","#f4f1ff"], price:1500, pat:"stars"}, holo:{name:"Holo foil", c:["#9fd8ff","#ffb3e6","#fbfbff"], price:1800, pat:"holo"},
};
const REGION_COL = {1:["#d8423a","#7a1a14"], 2:["#c9a227","#6b5310"], 3:["#2f9e62","#164e33"], 4:["#5b6fd6","#25307a"], 5:["#3a3a44","#111116"], 6:["#2f8fd6","#174a7a"], 7:["#ff8a3d","#a23c16"], 8:["#9c3fd6","#4a1670"], 9:["#e2413b","#6a2bd6"], 10:["#8a96ad","#3e4656"]};
for (let g = 1; g <= 9; g++) CARD_DESIGNS["champ" + g] = {name:`${GENS[g - 1].region} Champion`, c:[...REGION_COL[g], "#fffaf0"], pat:"champ", champ:g};
Object.entries(CARD_DESIGNS).forEach(([id, d]) => addItem({cat:"card", id, name:d.name, price:d.price || 0, free:!!d.free, champ:d.champ}));
// --- profile icons (a Pokémon in a coloured badge) ---
[25, 133, 1, 4, 7].forEach(n => addItem({cat:"icon", id:"p" + n, num:n, name:monName(n), free:true}));
[[152,300],[155,300],[158,300],[252,300],[255,300],[258,300],[39,300],[52,300],[54,300],[129,200],[175,400],[143,500],[147,500],[94,600],[131,600],[196,700],[197,700],
 [282,700],[359,700],[448,800],[445,900],[658,900],[700,700],[778,800],[887,1000],[149,1000],[248,1000],[373,1000],[384,2500],[150,2500],[151,2000],[249,2500],[250,2500],[493,3500]]
  .forEach(([n, p]) => addItem({cat:"icon", id:"p" + n, num:n, name:monName(n), price:p}));
// --- Gym Leader, Elite Four and Champion exclusives (data/rewards.json, docs/rewards.md) ---
// Gym Leader: badge + one themed exclusive + a bonus icon of their ace (+ the region's Badge Case with the first badge).
// Elite Four member: an elite profile icon (animated border) + a signature statue (+ a background for three of them).
// Champion: the region's card design, Champion's Hall background, trophy and title, plus an icon of their ace.
const GYM_REWARD = {}, GYM_BONUS = {}, E4_REWARD = {}, BADGE_CASE = {};
LEAGUES.forEach(L => {
  const g = L.g, R = GENS[g - 1].region;
  L.gyms.forEach(([nm, ty, ace], k) => {
    const r = REWARDS.gyms[g][k]; let it;
    if (r.cat === "ball") it = unlockOf("ball", r.id);
    else { it = {cat:"furn", id:r.id, name:r.name, kind:r.kind, var:r.var, w:r.w, d:r.d, ty:ty.split("/")[0]}; addItem(it); }
    Object.assign(it, {gym:[g, k], price:0, free:false, from:nm});
    GYM_REWARD[g + "-" + k] = it;
    let ic = unlockOf("icon", `g${g}-${k}`); if (!ic) { ic = {cat:"icon", id:`g${g}-${k}`, num:ace, name:`${nm}’s ${monName(ace)}`}; addItem(ic); }
    Object.assign(ic, {gym:[g, k], price:0, free:false, bonus:true, from:nm});
    GYM_BONUS[g + "-" + k] = ic;
  });
  const bc = {cat:"furn", id:"badgecase" + g, name:`${R} Badge Case`, kind:"badgecase", w:2, d:1, region:g, gym:[g, -1], price:0, free:false, from:`${R} Gyms`}; addItem(bc); BADGE_CASE[g] = bc;
  L.e4.forEach(([nm, ty, ace], k) => {
    const out = [{cat:"icon", id:`e${g}-${k}`, num:ace, name:`${nm}’s ${monName(ace)}`, elite:true}, {cat:"furn", id:`e4s${g}-${k}`, name:`${nm}’s statue`, kind:"statue", var:ty.split("/")[0], w:2, d:2, elite:true}];
    const bg = REWARDS.e4.bg[g + "-" + k]; if (bg) out.push({cat:"bg", id:bg, name:SCENE_BY.get(bg).name});
    out.forEach(it => { Object.assign(it, {e4:[g, k], price:0, free:false, from:nm}); addItem(it); });
    E4_REWARD[g + "-" + k] = out;
  });
  const champAce = L.champ[1][L.champ[1].length - 1], who = L.champ[0];
  const icon = {cat:"icon", id:"c" + g, num:champAce, name:`${who}’s ${monName(champAce)}`}; addItem(icon);
  const card = unlockOf("card", "champ" + g);
  const hall = {cat:"bg", id:"hall" + g, name:SCENE_BY.get("hall" + g).name}; addItem(hall);
  const trophy = {cat:"furn", id:"trophy" + g, name:`${R} trophy`, kind:"trophy", w:1, d:1, region:g}; addItem(trophy);
  const extra = (REWARDS.champ.extra || {})[g], ex = extra ? unlockOf(extra.cat, extra.id) : null;
  const set = [card, hall, trophy, icon, ...(ex ? [ex] : [])];
  set.forEach(it => Object.assign(it, {champ:g, price:0, free:false, from:`Champion ${who}`}));
  GYM_REWARD["champ" + g] = set;
});
// --- Battle Tower exclusives: win streaks of 21 and 49 ---
const TOWER_REWARD = {21:[{cat:"icon", id:"tw1", num:350, name:"Tower Tycoon’s Milotic", elite:true}, {cat:"bg", id:"tower", name:"Battle Tower"}],
  49:[{cat:"furn", id:"trophytower", name:"Battle Tower trophy", kind:"trophy", w:1, d:1, region:10}, {cat:"icon", id:"tw2", num:486, name:"Tower Tycoon’s Regigigas", elite:true}]};
Object.entries(TOWER_REWARD).forEach(([at, list]) => list.forEach(it => { Object.assign(it, {tower:+at, price:0, free:false, from:`${at} Battle Tower wins in a row`}); addItem(it); }));
const isExclusive = it => !!(it.gym || it.champ || it.e4 || it.tower);
const TITLES = () => LEAGUES.filter(L => state.games.leagues[L.g]).map(L => ({id:"champ" + L.g, name:`${GENS[L.g - 1].region} Champion`}));
const myTitle = () => { const t = TITLES().find(x => x.id === state.games.title); return t ? t.name : ""; };
// a team's own default backdrop is always free to use for that team
const bgUsable = (id, teamId) => owns("bg", id) || id === (DEFAULT_BG[teamId] || DEFAULT_BG[(TEAM_BY.get(teamId) || {}).base] || "route");

// --- Home furniture (drawn by the Home renderer from simple shapes) ---
const FURN = [
  // id, name, price, w, d, kind, colours
  ["bed", "Cozy bed", 0, 2, 3, "bed", ["#e2413b","#f6f1e7","#8a5a3c"]], ["rug", "Round rug", 0, 2, 2, "rugr", ["#d8423a","#f3d27a"]],
  ["plant", "Potted plant", 0, 1, 1, "plant", ["#3fae5a","#b9643a"]], ["table", "Round table", 0, 1, 1, "tabler", ["#a8754c","#7b5234"]],
  ["sofa", "Sofa", 600, 3, 1, "sofa", ["#4f7bd6","#2f4f99"]], ["chair", "Armchair", 350, 1, 1, "chair", ["#d6874f","#9a5a2c"]],
  ["shelf", "Bookshelf", 500, 2, 1, "shelf", ["#8a5a3c","#5e3c24"]], ["tv", "Big TV", 800, 2, 1, "tv", ["#22252e","#59c2ff"]],
  ["lamp", "Floor lamp", 250, 1, 1, "lamp", ["#f6e7b4","#4a4a52"]], ["palm", "Big palm", 450, 1, 1, "palm", ["#2f9e62","#c98a4a"]],
  ["bean", "Beanbag", 300, 1, 1, "bean", ["#8a55f0","#5a2fb0"]], ["desk", "PC desk", 700, 2, 1, "desk", ["#c9c9d2","#3a3f52"]],
  ["rugb", "Long rug", 400, 3, 2, "rug", ["#2f6fd6","#cfe3ff"]], ["rugp", "Poké Ball rug", 900, 2, 2, "rugball", ["#e2413b","#ffffff"]],
  ["tank", "Aquarium", 1100, 2, 1, "tank", ["#4cb3d6","#1d6f8a"]], ["fire", "Fireplace", 1200, 2, 1, "fire", ["#a35a3a","#ffb84a"]],
  ["piano", "Piano", 1400, 2, 1, "piano", ["#1d1f26","#ffffff"]], ["arcade", "Arcade cabinet", 1000, 1, 1, "arcade", ["#e2413b","#5af0ff"]],
  ["fountain", "Fountain", 1500, 2, 2, "fountain", ["#b9c3d6","#5ab4ff"]], ["tree", "Berry tree", 900, 2, 2, "tree", ["#3a9e4f","#e2413b"]],
  ["flowers", "Flower bed", 400, 2, 1, "flowers", ["#f39ac7","#ffd43b"]], ["bench", "Garden bench", 450, 2, 1, "bench", ["#9a6a3c","#5e3c24"]],
  ["tramp", "Trampoline", 1300, 2, 2, "tramp", ["#2f6fd6","#1d1f26"]], ["cushion", "Floor cushion", 200, 1, 1, "cushion", ["#ffd43b","#d9a412"]],
  ["globe", "Desk globe", 350, 1, 1, "globe", ["#3aa0d6","#c9a227"]], ["clock", "Grandfather clock", 750, 1, 1, "clock", ["#6b4226","#f6e7b4"]],
  ["hammock", "Hammock", 700, 3, 1, "hammock", ["#c9423a","#f3dfb0","#7a4a2a"]],
  ["stove", "Kitchen stove", 900, 2, 1, "stove", ["#f1e6c8","#2a2a30","#e2413b"]], ["fridge", "Retro fridge", 800, 1, 1, "fridge", ["#a8dcc4","#d9dde2"]],
  ["counter", "Kitchen counter", 600, 2, 1, "counter", ["#f4f1ea","#b9875a","#e2413b"]],
];
FURN.forEach(([id, name, price, w, d, kind, col]) => addItem({cat:"furn", id, name, price, free:!price, w, d, kind, col}));
// seasonal furniture: sold only while its event runs (see EVENTS); players keep what they bought
[["pumpkin", "Jack-o’-lantern", 300, 1, 1, "pumpkin", ["#f08a24", "#3a7a2a"], "halloween"], ["cobweb", "Spooky cobweb", 150, 1, 1, "cobweb", ["#e8e8f0", "#5a5a6a"], "halloween"],
 ["holtree", "Holiday tree", 900, 1, 1, "holtree", ["#2f8a4a", "#e2413b"], "winter"], ["giftpile", "Holiday gifts", 350, 1, 1, "giftpile", ["#e2413b", "#2f8a4a"], "winter"]].forEach(([id, name, price, w, d, kind, col, event]) => addItem({cat:"furn", id, name, price, w, d, kind, col, event}));
// --- Home rooms (each adds space and room for more Pokémon) ---
// In house order: the front yard, the rooms inside, then the back garden and pond. `row` is where the room lies, north
// to south: the garden and pond behind the house (0), the house (1) and the front yard (2); the front and back doors
// join the rows, and rooms in the same row are side by side.
const ROOMS = [
  {id:"yard", name:"Front yard", free:true, w:9, floor:"grass", wall:null, cap:2, row:2},
  {id:"bedroom", name:"Bedroom", free:true, w:11, floor:"wood", wall:"#f2d7b4", cap:4, row:1},
  {id:"living", name:"Living room", price:1500, w:11, floor:"carpet", wall:"#cfe3f7", cap:4, row:1},
  {id:"kitchen", name:"Kitchen", price:2500, w:10, floor:"tile", wall:"#d9efe4", cap:3, row:1},
  {id:"hall", name:"Grand hall", price:8000, w:13, floor:"marble", wall:"#e7e2f7", cap:5, row:1},
  {id:"garden", name:"Garden", price:3000, w:12, floor:"grass", wall:null, cap:4, row:0},
  {id:"pond", name:"Pond", price:4000, w:11, floor:"grass", wall:null, cap:3, pond:true, row:0},
];
ROOMS.forEach(r => addItem({cat:"exp", id:r.id, name:r.name, price:r.price || 0, free:!!r.free, room:r}));
// --- house designs: how the house looks from the yard (roof, walls, windows); door: where the front door goes in the 2D
// front wall picture (house/<id>_front, x of its middle in px), between the windows ---
const HOUSES = [
  {id:"cottage", door:128, name:"Cozy cottage", free:true, roof:"#c8553a", roof2:"#8e3524", wall:"#f1e6c8", trim:"#4f8a4a", base:"#9a9aa2"},
  {id:"brick", door:106, name:"Brick townhouse", price:2500, roof:"#4f5f7d", roof2:"#2c3850", wall:"#a8442f", trim:"#f4f4f4", base:"#8a8a92"},
  {id:"cabin", door:66, name:"Log cabin", price:3000, roof:"#4f6b3a", roof2:"#2f4424", wall:"#8a5a34", trim:"#c9423a", base:"#7a7a6a"},
  {id:"villa", door:13, name:"Seaside villa", price:3500, roof:"#2f8fd6", roof2:"#1a5a96", wall:"#f6f4ee", trim:"#2ab0a8", base:"#d8c49a"},
];
HOUSES.forEach(h => addItem({cat:"house", id:h.id, name:h.name, price:h.price || 0, free:!!h.free, house:h}));

// --- ownership ---
const ownList = cat => state.games.own[cat] || (state.games.own[cat] = cat === "furn" ? {} : []);
function owns(cat, id){ const it = unlockOf(cat, id); if (it && it.free) return true; const o = ownList(cat); return cat === "furn" ? (o[id] | 0) > 0 : o.includes(id); }
const furnCount = id => { const it = unlockOf("furn", id); return (state.games.own.furn[id] | 0) + (it && it.free ? 1 : 0); };
function grant(it){
  const o = ownList(it.cat);
  if (it.cat === "furn") o[it.id] = (o[it.id] | 0) + 1; else if (!o.includes(it.id)) o.push(it.id);
}
function earn(n, why, quiet){
  if (!n || !profile || VISIT) return;
  const G = state.games; G.pp += n; G.ppTotal += n; save();
  if (!quiet) ppChip(`+${n.toLocaleString()}`, why);
  if (document.documentElement.dataset.view === "hub") renderHub();
  const b = $("shopBal"); if (b) { b.innerHTML = fmtPP(G.pp); $("scPP").innerHTML = fmtPP(G.pp); }
}
function ppChip(amount, why){
  let box = $("ppChips"); if (!box) { box = document.createElement("div"); box.id = "ppChips"; box.className = "pp-chips"; box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
  const c = document.createElement("div"); c.className = "pp-chip"; c.innerHTML = `${ppIc}<b>${esc(amount)}</b>${why ? `<span>${esc(why)}</span>` : ""}`;
  box.appendChild(c); setTimeout(() => c.classList.add("out"), 2400); setTimeout(() => c.remove(), 3000);
  while (box.children.length > 4) box.firstElementChild.remove();
}
function buy(it){
  const G = state.games;
  if (isExclusive(it) || it.free || (it.cat !== "furn" && owns(it.cat, it.id))) return false;
  if (G.pp < it.price) { Sound.play("wrong"); toast(`You need ${(it.price - G.pp).toLocaleString()} more PokéPoints.`); return false; }
  G.pp -= it.price; G.spent += it.price; grant(it); save(); Sound.play("confirm");
  toast(`Bought ${it.name}!`); checkAch();
  return true;
}
// a small picture of any unlockable, for the Shop and reward pop-ups
function itemThumb(it){
  if (it.cat === "ball") return `<span class="it-thumb">${ballImg(it.id, "ball-ic xl")}</span>`;
  if (it.cat === "icon") return `<span class="it-thumb">${iconHTML(it.id)}</span>`;
  if (it.cat === "card") { const d = CARD_DESIGNS[it.id]; return `<span class="it-thumb"><span class="card-sw ${d.pat || ""}" style="--a:${d.c[0]};--b:${d.c[1]};--c:${d.c[2]}"><i></i></span></span>`; }
  return `<span class="it-thumb"><canvas width="160" height="96" data-ithumb="${it.cat}:${it.id}"></canvas></span>`;
}
function paintThumbs(root){
  root.querySelectorAll("canvas[data-ithumb]").forEach(c => {
    const it = ITEM_BY.get(c.dataset.ithumb), two = state.mode === "2d", x = c.getContext("2d"); if (!it) return;
    if (it.cat === "bg") { const tod = SCENE_BY.get(it.id).tod ? (it.id === "city" ? "night" : "day") : "day";
      if (two) { const img = paintBg(it.id, tod, {W:80, H:48}, {x:0, y:0, w:80, h:48}, true); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, 160, 96); }
      else x.drawImage(paintBg(it.id, tod, {W:160, H:96}, {x:0, y:0, w:160, h:96}, false), 0, 0); }
    else if (it.cat === "furn") homeItemThumb(x, it, two);
    else if (it.cat === "exp") homeRoomThumb(x, it.room, two);
    else if (it.cat === "house") houseThumb(x, it.house, two);
  });
  paintAll(root);
}
// ask to unlock something you tried to use; offers to buy it right there
function offerUnlock(it, onDone){
  const G = state.games, ex = isExclusive(it), can = !ex && G.pp >= it.price;
  const md = openModal(`<h3 class="mt" id="modalTitle">${esc(it.name)}</h3><div class="unlock-hero">${itemThumb(it)}</div>
    <p class="note">${ex ? "This one is a Gym Leader’s reward and isn’t sold in the Shop. Keep earning badges to find it." : `Unlock this ${CAT[it.cat].one} for <b>${it.price.toLocaleString()}</b> PokéPoints. You have ${G.pp.toLocaleString()}.`}</p>
    <div class="actions">${ex ? "" : `<button class="btn primary" type="button" id="unBuy" ${can ? "" : "disabled"}>${can ? `Unlock · ${fmtPP(it.price)}` : `Need ${(it.price - G.pp).toLocaleString()} more`}</button>`}<button class="btn" type="button" id="unShop">Open the Shop</button></div>`);
  paintThumbs(md);
  const b = md.querySelector("#unBuy"); if (b) b.onclick = () => { if (buy(it)) { closeModal(); if (onDone) onDone(); } };
  md.querySelector("#unShop").onclick = () => { closeModal(); shopCat = it.cat; openScreen("shop"); };
}
// celebrate rewards (gym exclusives, first-time bonuses)
function showRewards(title, items, pts){
  if (!items.length && !pts) return;
  const md = openModal(`<h3 class="mt" id="modalTitle">${esc(title)}</h3>
    <div class="reward-list">${items.map(it => `<div class="reward">${itemThumb(it)}<div><b>${esc(it.name)}</b><span class="meta">${isExclusive(it) ? "Exclusive · " : ""}${CAT[it.cat].one}</span></div></div>`).join("")}
    ${pts ? `<div class="reward pts"><span class="it-thumb pp-big">${ppIc}</span><div><b>${pts.toLocaleString()} PokéPoints</b><span class="meta">Spend them in the Shop</span></div></div>` : ""}</div>
    <div class="actions"><button class="btn primary" type="button" data-close>Awesome!</button>${items.some(it => it.cat === "furn" || it.cat === "exp") ? `<button class="btn" type="button" id="rwHome">Go to my Home</button>` : ""}</div>`);
  paintThumbs(md); Sound.play("up");
  const h = md.querySelector("#rwHome"); if (h) h.onclick = () => { closeModal(); openScreen("home"); };
}
// called when a Gym Leader is beaten for the first time: their exclusive, the bonus icon, and the region's Badge Case
function gymRewards(g, k){
  const got = [];
  for (const it of [GYM_REWARD[g + "-" + k], GYM_BONUS[g + "-" + k], BADGE_CASE[g]]) if (it && !owns(it.cat, it.id)) { grant(it); got.push(it); }
  return got;
}
function e4Rewards(g, k){ const got = []; for (const it of E4_REWARD[g + "-" + k] || []) if (!owns(it.cat, it.id)) { grant(it); got.push(it); } return got; }
function champRewards(g){ const got = []; for (const it of GYM_REWARD["champ" + g] || []) if (!owns(it.cat, it.id)) { grant(it); got.push(it); } return got; }
// first run of a new save version: points for progress so far, rewards for what was already won, and keep anything already in use
function ecoMigrate(){
  const G = state.games;
  if (!G.eco) {
    let pts = 500 + 100*Object.keys(G.ach).filter(id => ACH.some(a => a.id === id)).length + 150*Object.keys(G.wins).length;
    for (const L of LEAGUES) { for (let k = 0; k < 8; k++) if (hasBadge(L.g, k)) pts += 200; if (G.leagues[L.g]) pts += 1000; }
    for (const o of Object.values(state.members)) for (const M of Object.values(o || {})) if (M && M.ball && !owns("ball", M.ball)) grant(unlockOf("ball", M.ball));
    for (const s of Object.values(state.scenes)) if (s && s.bg && unlockOf("bg", s.bg) && !owns("bg", s.bg)) grant(unlockOf("bg", s.bg));
    if (G.card && unlockOf("card", G.card) && !owns("card", G.card)) grant(unlockOf("card", G.card));
    G.pp += pts; G.ppTotal += pts; G.eco = 1; G.ecoNew = pts;
  }
  // v2: the new reward table. Players keep everything they own and get the new rewards for leaders they already beat.
  if (G.eco < 2) {
    let n = 0;
    for (const L of LEAGUES) {
      for (let k = 0; k < 8; k++) if (hasBadge(L.g, k)) n += gymRewards(L.g, k).length;
      if (G.leagues[L.g]) { G.e4[L.g] = 15; for (let k = 0; k < 4; k++) n += e4Rewards(L.g, k).length; n += champRewards(L.g).length; }
    }
    G.eco = 2; G.rw2 = n;
  }
}
const ownedCount = () => ITEMS_ALL.filter(it => !it.free && owns(it.cat, it.id)).length;
const exclusivesOwned = () => ITEMS_ALL.filter(it => isExclusive(it) && owns(it.cat, it.id)).length;

// ---- profile icons ----
function iconHTML(id, cls = ""){
  const it = unlockOf("icon", id); if (!it) return "";
  const m = NAT_BY.get(it.num), ty = m ? m.types[0] : "Normal";
  return `<span class="picon${isExclusive(it) ? " ex" : ""}${it.elite ? " elite" : ""} ${cls}" style="--tc:${TC[ty]}"><img class="spr" data-num="${it.num}" data-mode="2d" alt="" draggable="false"></span>`;
}
const myIcon = () => state.games.icon && unlockOf("icon", state.games.icon) && owns("icon", state.games.icon) ? state.games.icon : null;

