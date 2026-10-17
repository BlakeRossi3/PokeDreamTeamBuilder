// ================= DATA (filled in at build time) =================
const DATA = /*DATA*/;
const IDX = /*IDX*/;
const TRAINERS = /*TRAINERS*/;
const OLD_TRAINERS = /*OLDTRAINERS*/;
const TAGS = /*TAGS*/;
const CH = 16, MAX = 6;
const MIME = ["image/png", "image/gif", "image/webp"];
const HOFD = /*HOFD*/;
const FORMDATA = /*FORMS*/;
const FE = /*FE*/;
const MOVEDATA = /*MOVES*/;
const BALLS = /*BALLS*/;
const RIVALS = /*RIVALS*/;
const LEADERS = /*LEADERS*/; // pixel portraits for Gym Leaders, Elite Four and Champions without full trainer art
const LEADER_BY = new Map(LEADERS.map((n, i) => [n, i]));

const ROMAN = ["","I","II","III","IV","V","VI","VII","VIII","IX"];
const TYPE_ORDER = ["Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison","Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"];
const TC = {Normal:"#A8A77A",Fire:"#EE8130",Water:"#6390F0",Electric:"#F7D02C",Grass:"#7AC74C",Ice:"#96D9D6",Fighting:"#C22E28",Poison:"#A33EA1",Ground:"#E2BF65",Flying:"#A98FF3",Psychic:"#F95587",Bug:"#A6B91A",Rock:"#B6A136",Ghost:"#735797",Dragon:"#6F35FC",Dark:"#705746",Steel:"#B7B7CE",Fairy:"#D685AD"};
const DARK_TEXT = new Set(["Normal","Electric","Grass","Ice","Ground","Flying","Bug","Rock","Steel","Fairy","Fire","Water"]);
const ABBR = t => t.slice(0,3).toUpperCase();
const tStyle = t => `--tc:${TC[t]};--tt:${DARK_TEXT.has(t)?"#1a1a1a":"#ffffff"}`;
const fmtNo = n => "#" + String(n > 1025 ? ((FORMDATA.find(f => f[0] === n) || [0, n])[1]) : n).padStart(3,"0");
const PROTAG = ["Red","Leaf","Ethan","Kris","Lyra","Brendan","May","Lucas","Dawn","Hilbert","Hilda","Nate","Rosa","Calem","Serena","Elio","Selene","Victor","Gloria","Florian","Juliana","Ash"];
const TR_BY_NAME = new Map(TRAINERS.map((n,i) => [n,i]));

// ---------- data + teams ----------
const mk = ([num,name,ty,st]) => ({num, name, types: ty.split("/"), stats: st.split(",").map(Number)});
const GENS = DATA.gens.map(g => {
  const types = TYPE_ORDER.filter(t => g.types.includes(t));
  const mons = g.mons.map(mk);
  return {...g, types, mons};
});
const NATBASE = DATA.all.map(mk);
NATBASE.forEach((m, i) => { m.fe = !!FE[i]; });
const FORMS = FORMDATA.map(([num, base, name, ty, st, ht, gen, kind, fl, fe]) => ({num, base, name, types: ty.split("/"), stats: st.split(",").map(Number), ht, gen, form:kind, fl:!!fl, fe:!!fe}));
const FORM_BY = new Map(FORMS.map(f => [f.num, f])), FORM_IDX = new Map(FORMS.map((f, i) => [f.num, i]));
const formsOf = base => FORMS.filter(f => f.base === base);
const withForms = list => list.flatMap(m => [m, ...formsOf(m.num)]);
const NAT = withForms(NATBASE), NAT_BY = new Map(NAT.map(m => [m.num, m]));
const GEN_OF = new Uint8Array(1026);
GENS.forEach(g => { for (let n = g.range[0]; n <= g.range[1]; n++) GEN_OF[n] = g.g; });
const genOf = n => n > 1025 ? (FORM_BY.get(n) || {gen:9}).gen : GEN_OF[n];
const baseOf = n => n > 1025 ? (FORM_BY.get(n) || {base:n}).base : n;
const REGION = g => GENS[g-1].region;
const modern = {types: GENS[8].types, chart: GENS[8].chart, rules: "Gen IX"};
function mkTeam(o, mons){ return {...o, mons, byNum:new Map(mons.map(m => [m.num, m]))}; }
const THEMES = [
  {id:"starters", label:"Starters", name:"First Partners", tr:"Hop", blurb:"The 27 first-stage starters", nums:[1,4,7,152,155,158,252,255,258,387,390,393,495,498,501,650,653,656,722,725,728,810,813,816,906,909,912]},
  {id:"pseudo", label:"Pseudo-legends", name:"Pseudo-Legendaries", tr:"Lance", blurb:"The 600-total dragons and their kin", nums:[149,248,373,376,445,635,706,784,887,998]},
  {id:"legend", label:"Legendary", name:"Legendaries", tr:"Cynthia", blurb:"Box legends, trios and guardians", nums:TAGS.legend},
  {id:"myth", label:"Mythical", name:"Mythicals", tr:"N", blurb:"Event-only Mythical Pokémon", nums:TAGS.myth},
  {id:"ub", label:"Ultra Beasts", name:"Ultra Beasts", tr:"Lusamine", blurb:"Visitors from Ultra Space", nums:TAGS.ub},
  {id:"paradox", label:"Paradox", name:"Paradox Pokémon", tr:"Arven", blurb:"Ancient and Future forms from Area Zero", nums:[...new Set([...TAGS.paradox, 1020,1021,1022,1023])].sort((a,b)=>a-b)},
  {id:"fossil", label:"Fossils", name:"Fossil Pokémon", tr:"Brock", blurb:"Revived from fossils", nums:[138,139,140,141,142,345,346,347,348,408,409,410,411,564,565,566,567,696,697,698,699,880,881,882,883]},
  {id:"baby", label:"Babies", name:"Baby Pokémon", tr:"Lillie", blurb:"Pre-evolutions that hatch from Eggs", nums:[172,173,174,175,236,238,239,240,298,360,406,433,438,439,440,446,447,458,848]},
  {id:"eevee", label:"Eeveelutions", name:"Eevee & Evolutions", tr:"Juliana", blurb:"Eevee and all eight evolutions", nums:[133,134,135,136,196,197,470,471,700]},
];
const BUILTIN = [
  ...GENS.map((g,i) => mkTeam({id:"g"+g.g, hasForms:g.g >= 6, kind:"gen", g:g.g, small:"Gen " + ROMAN[g.g], big:g.region, title:`${g.region} dream team`, dex:`${g.region} Pokédex`, card:g.region, sub:`Gen ${ROMAN[g.g]} · ${g.region}`, types:g.types, chart:g.chart, rules:"Gen " + ROMAN[g.g], range:g.range,
    tr:["Red","Ethan","Brendan","Lucas","Hilbert","Calem","Elio","Gloria","Florian"][i]}, [...g.mons, ...FORMS.filter(f => f.gen === g.g)])),
  mkTeam({id:"all", kind:"all", small:"All gens", big:"National", title:"All-gen dream team", dex:"National Pokédex", card:"All-gen", sub:"All generations", ...modern, range:[1,1025], tr:"Cynthia"}, NAT),
  ...THEMES.map(t => { const bases = t.nums.map(n => NAT_BY.get(n)).filter(Boolean); return mkTeam({id:t.id, kind:"theme", small:"Collection", big:t.label, title:`${t.label} dream team`, dex:t.name, card:t.label, sub:t.name, blurb:t.blurb, ...modern, tr:t.tr}, ["starters","baby","eevee"].includes(t.id) ? bases : withForms(bases)); }),
];
const TEAMS = [...BUILTIN];
const TEAM_BY = new Map(TEAMS.map(t => [t.id, t]));
// ---------- custom teams: made by the player, each with its own rules and size ----------
const MAXSIZE = 12;
const CT_FORMS = ["show", "mega", "regional", "only", "hide"];
const CT_BASES = () => BUILTIN.map(t => t.id);
function cleanCustom(list){
  if (!Array.isArray(list)) return [];
  const out = [], seen = new Set(), bases = CT_BASES();
  for (const d of list.slice(0, 60)) {
    if (!d || typeof d !== "object" || typeof d.id !== "string" || !/^c[0-9a-z]{1,14}$/.test(d.id) || seen.has(d.id)) continue;
    seen.add(d.id);
    out.push({id:d.id, name:(typeof d.name === "string" && d.name.trim() ? d.name.trim() : "My team").slice(0, 24),
      base:bases.includes(d.base) ? d.base : "all",
      types:Array.isArray(d.types) ? [...new Set(d.types.filter(t => TYPE_ORDER.includes(t)))].slice(0, 2) : [],
      both:d.both === true || d.both === "true", forms:CT_FORMS.includes(d.forms) ? d.forms : "show",
      leg:["all", "only", "hide"].includes(d.leg) ? d.leg : "all", fe:d.fe === true || d.fe === "true",
      bst:BST_R[d.bst] ? d.bst : "any",
      gens:Array.isArray(d.gens) ? [...new Set(d.gens.filter(g => Number.isInteger(g) && g >= 1 && g <= 9))].sort((a, b) => a - b) : [],
      size:Number.isInteger(d.size) && d.size >= 1 && d.size <= MAXSIZE ? d.size : MAX});
  }
  return out;
}
function ctPool(d){
  const B = BUILTIN.find(t => t.id === d.base) || BUILTIN.find(t => t.id === "all"), r = BST_R[d.bst] || BST_R.any;
  const gens = B.kind !== "gen" && d.gens.length ? new Set(d.gens) : null;
  return B.mons.filter(m => {
    const n = m.num, f = isForm(n) ? (FORM_BY.get(n) || {}).form : null;
    if (d.types.length && !(d.both && d.types.length === 2 ? d.types.every(t => m.types.includes(t)) : d.types.some(t => m.types.includes(t)))) return false;
    if (d.forms === "mega" && f !== "Mega") return false;
    if (d.forms === "regional" && !(f && f !== "Mega" && f !== "Primal")) return false;
    if (d.forms === "only" && !f) return false;
    if (d.forms === "hide" && f) return false;
    if (d.leg !== "all" && (d.leg === "only") !== isLegend(n)) return false;
    if (d.fe && !isFE(n)) return false;
    const b = bst(m); if (b < r[0] || b > r[1]) return false;
    return !gens || gens.has(genOf(baseOf(n)));
  });
}
const baseShort = id => { const B = BUILTIN.find(t => t.id === id); return !B || B.kind === "all" ? "National" : B.kind === "gen" ? B.big : B.card; };
const CT_FORM_LBL = {mega:"Megas only", regional:"Regional forms only", only:"Forms only", hide:"No forms"};
const CT_BST_LBL = {lo:"BST under 400", mid:"BST 400s", hi:"BST 500s", top:"BST 600+"};
function ctSummary(d, withSize = true){
  const p = [baseShort(d.base)];
  if (d.types.length) p.push(d.types.join(d.both && d.types.length === 2 ? " + " : " or "));
  if (CT_FORM_LBL[d.forms]) p.push(CT_FORM_LBL[d.forms]);
  if (d.leg === "only") p.push("Legendaries only"); else if (d.leg === "hide") p.push("No legendaries");
  if (d.fe) p.push("Fully evolved");
  if (CT_BST_LBL[d.bst]) p.push(CT_BST_LBL[d.bst]);
  if (d.gens.length && (BUILTIN.find(t => t.id === d.base) || {}).kind !== "gen") p.push("Gen " + d.gens.map(g => ROMAN[g]).join(", "));
  if (withSize) p.push(d.size + " Pokémon");
  return p.join(" · ");
}
function ctAutoName(d){
  const p = [];
  if (d.types.length) p.push(d.types.join("/"));
  if (d.forms === "mega") p.push("Mega"); else if (d.forms === "regional") p.push("Regional");
  if (d.leg === "only") p.push("Legendary");
  if (d.base !== "all") p.push(baseShort(d.base));
  return p.length ? p.join(" ") + " team" : d.size > MAX ? "Big team" : "My team";
}
function buildCustom(d){
  const B = BUILTIN.find(t => t.id === d.base) || BUILTIN.find(t => t.id === "all"), mons = ctPool(d), sum = ctSummary(d, false);
  const card = d.name.replace(/\s+team$/i, "") || d.name;
  return mkTeam({id:d.id, kind:"custom", custom:true, def:d, base:d.base, small:"Custom", big:d.name, title:d.name, dex:d.name, card, sub:`Custom · ${baseShort(d.base)}`, blurb:sum, ...modern,
    chipTypes:TYPE_ORDER.filter(t => mons.some(m => m.types.includes(t))), tr:B.tr, size:d.size}, mons);
}
function rebuildTeams(){
  TEAMS.length = 0; TEAMS.push(...BUILTIN, ...(state.custom || []).map(buildCustom));
  TEAM_BY.clear(); for (const t of TEAMS) TEAM_BY.set(t.id, t);
}
const sizeOf = id => (TEAM_BY.get(id) || {}).size || MAX;
const eff = (atk, defTypes, chart) => defTypes.reduce((m,d) => m * chart[d][atk], 1);
const bst = m => m.stats.reduce((a,b) => a+b, 0);
const LEGENDS = new Set([...TAGS.legend, ...TAGS.myth, ...TAGS.ub, ...TAGS.paradox, 1020, 1021, 1022, 1023]);
const isLegend = n => LEGENDS.has(baseOf(n));
const FE_SET = new Set(NATBASE.filter(m => m.fe).map(m => m.num));
const isFE = n => n > 1025 ? !!(FORM_BY.get(n) || {}).fe : FE_SET.has(n);
const isForm = n => n > 1025;
const monName = n => (NAT_BY.get(n) || {name:"?"}).name;
const htOf = n => n > 1025 ? ((FORM_BY.get(n) || {}).ht || 1) : (HOFD.h[n] || 1);
const floatsOf = n => n > 1025 ? !!(FORM_BY.get(n) || {}).fl : HOFD.fl.includes(n);

// ---------- moves, abilities, items, Poké Balls ----------
const MOVES = MOVEDATA.MOVES, MOVE_BY = new Map(MOVES.map(m => [m[0], m]));
const ITEMS = MOVEDATA.ITEMS, ITEM_LC = new Map(ITEMS.map(i => [i[0].toLowerCase(), i])), ABIL = MOVEDATA.ABIL;
// Megas and Primal forms hold no item (no Mega Stones in this app)
const isMega = n => n > 1025 && /^(Mega|Primal)$/.test((FORM_BY.get(n) || {}).form || "");
const BALL_IDS = BALLS.order;
const ballName = id => id === "poke" ? "Poké Ball" : id[0].toUpperCase() + id.slice(1) + " Ball";
const ballImg = (id, cls = "ball-ic") => `<img class="${cls}" src="${BALLS.img[id] || BALLS.img.poke}" alt="" draggable="false">`;
const BALL_EL = {};
const ballEl = id => BALL_EL[id] || (BALL_EL[id] = Object.assign(new Image(), {src: BALLS.img[id] || BALLS.img.poke}));
BALL_IDS.forEach(ballEl);

// learnsets + abilities are a separate 400 KB file, fetched the first time they're needed
let LSDATA = null, lsP = null;
function loadLearnsets(){
  if (LSDATA) return Promise.resolve(LSDATA);
  if (!lsP) lsP = fetch(packUrl("learnsets.json")).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => (LSDATA = d)).catch(e => { lsP = null; throw e; });
  return lsP;
}
const learnset = n => LSDATA ? (LSDATA.LS[String(n)] || LSDATA.LS[String(baseOf(n))] || []).map(i => MOVES[i]).filter(Boolean) : [];
const abilitiesOf = n => LSDATA ? (LSDATA.AB[String(n)] || LSDATA.AB[String(baseOf(n))] || []) : [];
const weightOf = n => (LSDATA && (LSDATA.WT[String(n)] ?? LSDATA.WT[String(baseOf(n))])) || 50;

// ---------- per-member details: nickname, ball, ability, item, moves, nature, EVs, IVs ----------
// n (optional) is the Pokémon's number: Megas and Primals never keep an item
function cleanMember(v, n){
  if (!v || typeof v !== "object") return null;
  const r = {};
  if (typeof v.nick === "string" && v.nick.trim()) r.nick = v.nick.trim().slice(0, 12);
  if (BALL_IDS.includes(v.ball) && v.ball !== "poke") r.ball = v.ball;
  if (typeof v.ability === "string" && v.ability) r.ability = v.ability.slice(0, 40);
  if (typeof v.item === "string" && ITEM_LC.has(v.item.toLowerCase()) && !(n && isMega(n))) r.item = ITEM_LC.get(v.item.toLowerCase())[0];
  if (typeof v.nature === "string" && NATURES[v.nature] && v.nature !== "Hardy") r.nature = v.nature;
  if (Number.isInteger(v.level) && v.level >= 1 && v.level <= 100 && v.level !== 50) r.level = v.level;
  const ev = cleanEVs(v.evs); if (Object.keys(ev).length) r.evs = ev;
  const iv = cleanIVs(v.ivs); if (Object.keys(iv).length) r.ivs = iv;
  if (Array.isArray(v.moves)) { const mv = [...new Set(v.moves.filter(x => typeof x === "string" && MOVE_BY.has(x)))].slice(0, 4); if (mv.length) r.moves = mv; }
  return Object.keys(r).length ? r : null;
}
const memberOf = (id, n) => (state.members[id] || {})[n] || {};
const nickOf = (id, n) => memberOf(id, n).nick || monName(n);
const ballOf = (id, n) => memberOf(id, n).ball || "poke";
const movesOf = (id, n) => (memberOf(id, n).moves || []).map(x => MOVE_BY.get(x)).filter(Boolean);
function setMember(id, n, patch){
  const all = state.members[id] = state.members[id] || {};
  const c = cleanMember({...(all[n] || {}), ...patch}, n);
  if (c) all[n] = c; else delete all[n];
  touched(); save();
}
const F0 = () => ({fav:false, free:false, fe:false, leg:"all", bst:"any", forms:"show", gens:[]});
const BST_R = {any:[0, 9999], lo:[0, 399], mid:[400, 499], hi:[500, 599], top:[600, 9999]};

// ---------- per-save settings + game progress ----------
const UI_OPTS = {t3:["midnight","daylight","carbon","ultra"], t2:["classic","gameboy","night","pocket"], accent:["default","red","blue","green","purple","pink","gold","teal"], text:["normal","large"], motion:["full","reduced"], bmode:["manual","auto"], bspeed:["normal","fast"], vsbag:["on","off"]};
const freshUI = () => ({t3:"midnight", t2:"classic", accent:"default", text:"normal", motion:matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full", sound:true, music:55, sfx:70, bmode:"manual", bspeed:"normal", vsbag:"on"});
function cleanUI(u){
  const o = freshUI(); if (!u || typeof u !== "object") return o;
  for (const [k, opts] of Object.entries(UI_OPTS)) if (opts.includes(u[k])) o[k] = u[k];
  if (typeof u.sound === "boolean") o.sound = u.sound;
  for (const k of ["music", "sfx"]) if (Number.isFinite(u[k])) o[k] = Math.max(0, Math.min(100, Math.round(u[k])));
  return o;
}
const QUIZ_MODES = ["sil", "type", "stat", "typing"];
const freshOwn = () => ({bg:[], furn:{}, exp:[], icon:[], ball:[], card:[], house:[]});
const freshHome = () => ({tr:null, mons:[], items:[{id:"bed", x:1, y:0, f:0}, {id:"rug", x:4, y:3, f:0}, {id:"plant", x:9, y:0, f:0}, {id:"table", x:7, y:3, f:0}], fr:{}, pet:{}, gain:{}, bag:{}, trees:{}, feed:{}, gifts:[], giftDay:{}, fedN:0, photos:0, games:{d:"", catchN:0, seekN:0, catchBest:0, found:0}, lay:"", house:"cottage"});
const freshGames = () => ({quizBest:0, qbest:{sil:0, type:0, stat:0, typing:0}, wins:{}, badges:{}, leagues:{}, vs:{w:0, l:0}, gifs:0, cards:0, ach:{}, since:0, card:"red", intro:0, daily:null, dailyN:0, dailyBest:0, pp:0, ppTotal:0, spent:0, own:freshOwn(), icon:null, eco:0, ecoNew:0, home:freshHome(), e4:{}, title:"", rw2:0, showcase:{team:"all", style:"3d"}, social:{vis:[], likes:0, friends:0, likeAt:"", fbN:0, fbW:0}, botw:null, tower:{cur:0, best:0, won:0, team:"", size:3, nums:[], rw:0}, missions:null, login:{last:"", cur:0, best:0, days:0}});
function cleanGames(g){
  const o = freshGames(); if (!g || typeof g !== "object") return o;
  const int = v => Number.isInteger(v) && v > 0 ? v : 0;
  o.quizBest = int(g.quizBest);
  for (const k of QUIZ_MODES) o.qbest[k] = int((g.qbest || {})[k]);
  o.qbest.sil = Math.max(o.qbest.sil, o.quizBest);
  const obj = x => x && typeof x === "object" && !Array.isArray(x) ? x : {};
  for (const [k, v] of Object.entries(obj(g.wins))) if (int(v)) o.wins[k] = v;
  for (const [k, v] of Object.entries(obj(g.badges))) if (/^[1-9]$/.test(k) && Number.isInteger(v)) o.badges[k] = v & 255;
  for (const k of Object.keys(obj(g.leagues))) if (/^[1-9]$/.test(k) && g.leagues[k]) o.leagues[k] = true;
  o.vs = {w:int(obj(g.vs).w), l:int(obj(g.vs).l)};
  for (const k of ["gifs", "cards", "since", "intro", "dailyN", "pp", "ppTotal", "spent", "ecoNew", "rw2"]) o[k] = int(g[k]);
  o.ppTotal = Math.max(o.ppTotal, o.pp); o.eco = g.eco === 1 || g.eco === 2 ? g.eco : 0;
  for (const [k, v] of Object.entries(obj(g.e4))) if (/^[1-9]$/.test(k) && Number.isInteger(v)) o.e4[k] = v & 15;   // Elite Four members beaten (first wins)
  if (typeof g.title === "string" && /^champ[1-9]$/.test(g.title)) o.title = g.title;
  const own = obj(g.own);
  for (const c of ["bg", "exp", "icon", "ball", "card", "house"]) o.own[c] = Array.isArray(own[c]) ? [...new Set(own[c].filter(id => typeof id === "string" && unlockOf(c, id)))] : [];
  for (const [k, v] of Object.entries(obj(own.furn))) if (unlockOf("furn", k) && int(v)) o.own.furn[k] = Math.min(99, v);
  if (typeof g.icon === "string" && unlockOf("icon", g.icon)) o.icon = g.icon;
  const h = obj(g.home), num = v => Number.isFinite(v) ? v : 0;
  if (g.home) {
    o.home.mons = Array.isArray(h.mons) ? [...new Set(h.mons.filter(n => Number.isInteger(n) && NAT_BY.has(n)))].slice(0, 40) : [];
    o.home.items = Array.isArray(h.items) ? h.items.filter(p => p && unlockOf("furn", p.id)).slice(0, 300).map(p => ({id:p.id, x:Math.max(0, Math.round(num(p.x))), y:Math.max(0, Math.round(num(p.y))), f:p.f ? 1 : 0, ...(p.r ? {r:1} : {}), ...(p.s ? {s:1} : {})})) : [];
    const day = v => typeof v === "string" && /^\d{4}-\d\d-\d\d$/.test(v);
    for (const [k, v] of Object.entries(obj(h.bag))) if (/^[a-z]{3,8}$/.test(k) && int(v)) o.home.bag[k] = Math.min(99, v);
    for (const [k, v] of Object.entries(obj(h.trees))) if (/^\d+,\d+$/.test(k) && v && day(v.d)) o.home.trees[k] = {d:v.d, n:Math.min(3, int(v.n))};
    for (const [k, v] of Object.entries(obj(h.feed))) if (NAT_BY.has(+k) && v && day(v.d)) o.home.feed[k] = {d:v.d, n:Math.min(3, int(v.n))};
    for (const [k, v] of Object.entries(obj(h.giftDay))) if (NAT_BY.has(+k) && day(v)) o.home.giftDay[k] = v;
    o.home.gifts = Array.isArray(h.gifts) ? h.gifts.filter(x => x && NAT_BY.has(x.n) && ["pp", "berry", "furn"].includes(x.k) && (x.k !== "furn" || unlockOf("furn", x.v)) && (x.k !== "pp" || (int(x.v) && x.v <= 100)) && (x.k !== "berry" || /^[a-z]{3,8}$/.test(x.v)))
      .slice(0, 6).map(x => ({n:x.n, x:Math.max(0, num(x.x)), y:Math.max(0, num(x.y)), k:x.k, v:x.v})) : [];
    o.home.fedN = int(h.fedN); o.home.photos = int(h.photos);
    const hg = obj(h.games); o.home.games = {d:day(hg.d) ? hg.d : "", catchN:Math.min(9, int(hg.catchN)), seekN:Math.min(9, int(hg.seekN)), catchBest:Math.min(999, int(hg.catchBest)), found:int(hg.found)};
    for (const [k, v] of Object.entries(obj(h.fr))) if (NAT_BY.has(+k) && int(v)) o.home.fr[k] = Math.min(100, v);
    for (const [k, v] of Object.entries(obj(h.pet))) if (NAT_BY.has(+k) && /^\d{4}-\d\d-\d\d$/.test(v)) o.home.pet[k] = v;
    o.home.lay = typeof h.lay === "string" && h.lay.length < 200 && h.lay.split(",").every(id => ROOMS.some(r => r.id === id)) ? h.lay : "";   // the room order item positions refer to ("" = before the front yard)
    o.home.house = typeof h.house === "string" && HOUSES.some(x => x.id === h.house) ? h.house : "cottage";
    o.home.tr = Number.isInteger(h.tr) && h.tr >= 0 && h.tr < TRAINERS.length ? h.tr : null;   // who walks around the Home (null = the "All" team's trainer)
    for (const [k, v] of Object.entries(obj(h.gain))) if (NAT_BY.has(+k) && v && /^\d{4}-\d\d-\d\d$/.test(v.d)) o.home.gain[k] = {d:v.d, n:Math.min(25, int(v.n))};
  }
  o.dailyBest = Math.min(10, int(g.dailyBest));
  const dl = obj(g.daily); if (/^\d{4}-\d\d-\d\d$/.test(dl.d)) o.daily = {d:dl.d, i:Math.min(10, int(dl.i)), s:Math.min(10, int(dl.s)), r:String(dl.r || "").replace(/[^01]/g, "").slice(0, 10)};
  for (const [k, v] of Object.entries(obj(g.ach))) if (int(v)) o.ach[k] = v;
  if (typeof g.card === "string" && unlockOf("card", g.card)) o.card = g.card;
  const sc = obj(g.showcase); o.showcase = {team:typeof sc.team === "string" && /^[a-z0-9]{1,16}$/.test(sc.team) ? sc.team : "all", style:sc.style === "2d" ? "2d" : "3d"};
  const bw = obj(g.botw); o.botw = typeof bw.code === "string" && /^[zj][A-Za-z0-9_-]{20,16000}$/.test(bw.code) ? {code:bw.code, ti:String(bw.ti || "Battle").slice(0, 60), w:bw.w ? 1 : 0, at:Number.isFinite(bw.at) ? bw.at : 0} : null;
  const tw = obj(g.tower);   // Battle Tower: current and best streak, total wins, the locked team of a streak in progress, rewards given (bits)
  o.tower = {cur:int(tw.cur), best:Math.max(int(tw.best), int(tw.cur)), won:int(tw.won), team:typeof tw.team === "string" ? tw.team.slice(0, 40) : "", size:tw.size === 6 ? 6 : 3,
    nums:Array.isArray(tw.nums) ? [...new Set(tw.nums.filter(n => NAT_BY.has(n)))].slice(0, 6) : [], rw:int(tw.rw) & 7};
  const ms = obj(g.missions);   // today's three missions
  if (/^\d{4}-\d\d-\d\d$/.test(ms.d) && Array.isArray(ms.list)) o.missions = {d:ms.d, bonus:ms.bonus ? 1 : 0, list:ms.list.filter(x => x && MISSIONS[x.k]).slice(0, 3).map(x => ({k:x.k, a:typeof x.a === "string" && TYPE_ORDER.includes(x.a) ? x.a : "", n:Math.min(99, int(x.n)), goal:Math.max(1, Math.min(9, int(x.goal) || 1)), done:x.done ? 1 : 0}))};
  const lg = obj(g.login); o.login = {last:/^\d{4}-\d\d-\d\d$/.test(lg.last) ? lg.last : "", cur:int(lg.cur), best:Math.max(int(lg.best), int(lg.cur)), days:int(lg.days)};
  const so = obj(g.social);
  o.social = {vis:Array.isArray(so.vis) ? [...new Set(so.vis.filter(v => typeof v === "string" && /^[0-9a-f-]{36}$/.test(v)))].slice(-200) : [], likes:int(so.likes), friends:int(so.friends), fbN:int(so.fbN), fbW:int(so.fbW),
    likeAt:typeof so.likeAt === "string" && !isNaN(Date.parse(so.likeAt)) ? so.likeAt : ""};
  return o;
}
function applyUI(){
  const u = state.ui, r = document.documentElement.dataset;
  r.t3 = u.t3; r.t2 = u.t2; r.accent = u.accent; r.text = u.text; r.motion = u.motion;
  if (typeof Sound !== "undefined") Sound.vol();
}
