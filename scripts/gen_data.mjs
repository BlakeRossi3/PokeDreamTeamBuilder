#!/usr/bin/env node
// Regenerate battle data from Pokémon Showdown's data (@pkmn/dex + @pkmn/data, MIT).
//
//     npm install                 # once
//     node scripts/gen_data.mjs   # rewrites the files below, then prints what changed
//
// Writes (keeping every field the app already uses):
//   data/data.json        base stats + types (per generation, and the National list), Gen 9 / latest data
//   data/forms.json       base stats + types of Megas and regional forms (+ fully evolved flag)
//   data/fe.json          1 = fully evolved, per National Dex number
//   data/moves_data.json  MOVES  [name, type, cat, power, accuracy, pp, priority, flags, effects]
//                         ITEMS  [name, short description, category, Showdown sprite number, fling power]
//                         ABIL   {ability: short description}
//   packs/learnsets.json  LS {num: [move index]} · LM {num: [how learned]} · AB {num: [abilities]} · HA {num: hidden ability}
//                         WT {num: weight kg} · MD [move short description] · MF [move full description] · ID [item description]
// The build itself only needs Python; run this by hand when the data should change.
import {readFileSync, writeFileSync} from "node:fs";
import {Dex} from "@pkmn/dex";
const toID = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
import {Generations} from "@pkmn/data";

const ROOT = new URL("..", import.meta.url).pathname;
const read = f => JSON.parse(readFileSync(ROOT + f, "utf8"));
const write = (f, v, pretty) => writeFileSync(ROOT + f, JSON.stringify(v, null, pretty ? 1 : undefined) + (pretty ? "\n" : ""));
const gens = new Generations(Dex, () => true);   // keep Past / Future data too
const log = [];

// ---------------- species ----------------
const OK_STD = new Set([null, undefined, "Past", "Future", "Unobtainable"]);
const NAT = new Map();   // national number -> base species
for (const s of Dex.species.all()) if (s.num > 0 && s.num <= 1025 && s.name === s.baseSpecies && OK_STD.has(s.isNonstandard)) NAT.set(s.num, s);
const statStr = s => [s.baseStats.hp, s.baseStats.atk, s.baseStats.def, s.baseStats.spa, s.baseStats.spd, s.baseStats.spe].join(",");

const data = read("data/data.json");
let nStat = 0, nType = 0;
for (const row of data.all) {
  const s = NAT.get(row[0]); if (!s) { log.push(`no species for #${row[0]} ${row[1]}`); continue; }
  const ty = s.types.join("/"), st = statStr(s);
  if (row[2] !== ty) { nType++; log.push(`types #${row[0]} ${row[1]}: ${row[2]} -> ${ty}`); row[2] = ty; }
  if (row[3] !== st) { nStat++; log.push(`stats #${row[0]} ${row[1]}: ${row[3]} -> ${st}`); row[3] = st; }
}
// per-generation lists use that generation's numbers (Gen I has one Special stat, no Steel/Dark/Fairy)
for (const g of data.gens) {
  const G = gens.get(g.g);
  for (const row of g.mons) {
    const base = NAT.get(row[0]); if (!base) continue;
    const s = G.species.get(base.name); if (!s) continue;
    const ty = s.types.join("/"), st = statStr(s);
    if (row[2] !== ty) { nType++; log.push(`gen ${g.g} types ${row[1]}: ${row[2]} -> ${ty}`); row[2] = ty; }
    if (row[3] !== st) { nStat++; log.push(`gen ${g.g} stats ${row[1]}: ${row[3]} -> ${st}`); row[3] = st; }
  }
}

// forms: "Mega Charizard X" -> Charizard-Mega-X, "Alolan Raichu" -> Raichu-Alola, ...
const REGION = {Alolan:"Alola", Galarian:"Galar", Hisuian:"Hisui", Paldean:"Paldea"};
function formSpecies(name, baseNum){
  const base = NAT.get(baseNum).name, m = name.match(/^(Mega|Primal|Alolan|Galarian|Hisuian|Paldean) (.+?)(?: ([XYZ]))?(?: \((.+)\))?$/);
  if (!m) return null;
  const [, kind, , xyz, paren] = m, tries = [];
  if (kind === "Mega") {
    const sub = paren ? {"Male":"M", "Female":"F", "Original Color":"Original"}[paren] || paren : "";
    if (sub) tries.push(`${base}-${sub}-Mega`, `${base}-Mega-${sub}`);
    tries.push(xyz ? `${base}-Mega-${xyz}` : `${base}-Mega`);
  } else if (kind === "Primal") tries.push(`${base}-Primal`);
  else {
    const r = REGION[kind], sub = paren ? (paren === "Zen Mode" ? "Zen" : paren) : "";
    tries.push(sub ? `${base}-${r}-${sub}` : `${base}-${r}`);
  }
  for (const t of tries) { const s = Dex.species.get(t); if (s && s.exists) return s; }
  return null;
}
const forms = read("data/forms.json"), FORM_SP = new Map();
for (const f of forms) {
  const s = formSpecies(f[2], f[1]); if (!s) { log.push(`no species for form ${f[2]}`); continue; }
  FORM_SP.set(f[0], s);
  const ty = s.types.join("/"), st = statStr(s);
  if (f[3] !== ty) { nType++; log.push(`form types ${f[2]}: ${f[3]} -> ${ty}`); f[3] = ty; }
  if (f[4] !== st) { nStat++; log.push(`form stats ${f[2]}: ${f[4]} -> ${st}`); f[4] = st; }
}
const spOf = n => n > 1025 ? FORM_SP.get(n) : NAT.get(n);
// fully evolved = no evolution in the data (fe.json, and the last column of forms.json; Eviolite and the "Fully evolved" filter use it)
const isFE = s => !(s.evos || []).some(e => { const x = Dex.species.get(e); return x && x.exists && OK_STD.has(x.isNonstandard); });
const fe = data.all.map(row => NAT.get(row[0]) ? +isFE(NAT.get(row[0])) : 1);
const oldFE = read("data/fe.json"); let nFE = 0;
fe.forEach((v, i) => { if (v !== oldFE[i]) { nFE++; log.push(`fully evolved #${i + 1} ${data.all[i][1]}: ${oldFE[i]} -> ${v}`); } });
for (const f of forms) { const s = FORM_SP.get(f[0]); if (!s) continue; const v = +isFE(s); if (f[9] !== v) { nFE++; log.push(`fully evolved form ${f[2]}: ${f[9]} -> ${v}`); f[9] = v; } }

// ---------------- moves ----------------
const MOVE_OK = m => m.exists && !m.isZ && !m.isMax && OK_STD.has(m.isNonstandard) && m.num > 0;
const FLAG = {contact:"c", punch:"p", bite:"b", slicing:"s", sound:"o", powder:"w", bullet:"l", pulse:"u", protect:"x", heal:"h", charge:"2", recharge:"r", defrost:"f", wind:"i", dance:"d", reflectable:"m", bypasssub:"y"};
const SC = {reflect:"reflect", lightscreen:"lightscreen", auroraveil:"auroraveil", stealthrock:"stealthrock", spikes:"spikes", toxicspikes:"toxicspikes", stickyweb:"stickyweb", tailwind:"tailwind", safeguard:"safeguard", mist:"mist"};
const WEATHER = {sunnyday:"sun", raindance:"rain", sandstorm:"sand", snowscape:"snow", hail:"snow"};
const TERRAIN = {electricterrain:"electric", grassyterrain:"grassy", mistyterrain:"misty", psychicterrain:"psychic"};
const frac = a => Array.isArray(a) ? a : null;
function effects(m){
  const fx = {};
  const sec = (m.secondaries || []).map(s => {
    const o = {c:s.chance || 100};
    if (s.status) o.st = s.status;
    if (s.volatileStatus) o.v = s.volatileStatus;
    if (s.boosts) o.b = s.boosts;
    if (s.self && s.self.boosts) o.sb = s.self.boosts;
    return o;
  }).filter(o => o.st || o.v || o.b || o.sb);
  if (sec.length) fx.sec = sec;
  if ((m.secondaries && m.secondaries.length) || m.hasSheerForceBoost) fx.sf = 1;   // Sheer Force boosts it
  if (m.category === "Status") {
    if (m.status) fx.st = m.status;
    if (m.volatileStatus) fx.v = m.volatileStatus;
    if (m.boosts) fx.b = m.boosts;
  }
  if (m.self && m.self.boosts && m.category !== "Status") fx.sb = m.self.boosts;
  if (m.self && m.self.boosts && m.category === "Status") fx.sb = m.self.boosts;
  if (m.self && m.self.volatileStatus) fx.sv = m.self.volatileStatus;
  if (m.volatileStatus && m.category !== "Status") fx.dv = m.volatileStatus;
  if (m.drain) fx.d = m.drain;
  if (m.recoil) fx.r = m.recoil;
  if (m.hasCrashDamage) fx.crash = 1;
  if (m.mindBlownRecoil) fx.mbr = 1;
  if (m.struggleRecoil) fx.sr = 1;
  if (m.multihit) fx.mh = m.multihit;
  if (m.multiaccuracy) fx.ma = 1;
  if (m.critRatio && m.critRatio > 1) fx.cr = m.critRatio;
  if (m.willCrit) fx.wc = 1;
  if (m.heal) fx.h = frac(m.heal);
  if (m.ohko) fx.ohko = m.ohko === true ? 1 : m.ohko;
  if (m.selfdestruct) fx.sd = 1;
  if (m.selfSwitch) fx.ss = m.selfSwitch === true ? 1 : m.selfSwitch;
  if (m.forceSwitch) fx.fs = 1;
  if (m.damage) fx.fd = m.damage;
  if (m.weather && WEATHER[toID(m.weather)]) fx.w = WEATHER[toID(m.weather)];
  if (m.terrain && TERRAIN[m.terrain]) fx.ter = TERRAIN[m.terrain];
  if (m.sideCondition && SC[m.sideCondition]) fx.sc = SC[m.sideCondition];
  if (m.pseudoWeather) fx.pw = m.pseudoWeather;
  if (m.stallingMove) fx.stall = 1;
  if (m.breaksProtect) fx.bp = 1;
  if (m.ignoreDefensive) fx.igd = 1;
  if (m.ignoreEvasion) fx.ige = 1;
  if (m.ignoreAbility) fx.iga = 1;
  if (m.overrideOffensiveStat) fx.oos = m.overrideOffensiveStat;
  if (m.overrideOffensivePokemon) fx.oop = m.overrideOffensivePokemon;
  if (m.overrideDefensiveStat) fx.ods = m.overrideDefensiveStat;
  if (m.sleepUsable) fx.su = 1;
  if (m.thawsTarget) fx.tt = 1;
  if (m.target && !["normal", "any", "adjacentFoe", "randomNormal"].includes(m.target)) fx.t = m.target;
  if (m.basePowerCallback || m.onBasePower || m.damageCallback) fx.var = 1;
  if (m.condition && m.condition.duration && m.volatileStatus) fx.dur = m.condition.duration;
  return fx;
}
const moves = Dex.moves.all().filter(MOVE_OK).sort((a, b) => a.name.localeCompare(b.name));
const MOVES = moves.map(m => {
  const flags = Object.keys(m.flags).map(k => FLAG[k] || "").join("");
  const cat = m.category === "Physical" ? "P" : m.category === "Special" ? "S" : "X";
  const fx = effects(m);
  return [m.name, m.type, cat, m.basePower, m.accuracy === true ? 0 : m.accuracy, m.pp, m.priority, flags, fx];
});
const MOVE_IDX = new Map(moves.map((m, i) => [m.id, i]));
const oldMoves = read("data/moves_data.json");
const oldNames = new Set(oldMoves.MOVES.map(m => m[0])), newNames = new Set(MOVES.map(m => m[0]));
const lost = [...oldNames].filter(n => !newNames.has(n));
if (lost.length) log.push("moves no longer listed: " + lost.join(", "));
let nMv = 0;
for (const om of oldMoves.MOVES) { const nm = MOVES.find(m => m[0] === om[0]); if (nm && (nm[1] !== om[1] || nm[3] !== om[3] || nm[4] !== om[4] || (nm[2] === "P") !== (om[2] === "P"))) { nMv++; log.push(`move ${om[0]}: ${om.join("/")} -> ${nm.slice(0, 5).join("/")}`); } }

// ---------------- abilities ----------------
const ABIL = {};
for (const a of Dex.abilities.all().filter(a => a.exists && a.num > 0 && OK_STD.has(a.isNonstandard)).sort((a, b) => a.name.localeCompare(b.name))) ABIL[a.name] = a.shortDesc || a.desc;

// ---------------- items ----------------
function itemCat(it){
  const d = it.shortDesc || it.desc || "";
  if (it.isBerry) return "berry";
  if (it.zMove) return "z";
  if (it.onPlate) return "plate";
  if (it.onMemory) return "memory";
  if (it.onDrive) return "drive";
  if (it.isGem) return "gem";
  if (/Tera Shard$/.test(it.name)) return "tera";
  if (it.isPokeball) return "ball";
  if (/^Holder's \w+-type attacks have 1\.2x power/.test(d)) return "type";
  // no effect in a battle (evolution items, fossils, valuables, Hyper Training)
  if (/^Evolves |^Can (be )?revive|Hyper Training|no competitive use|has no effect|^A big nugget|^Can be sold/i.test(d)) return "evo";
  return "held";
}
// Mega Stones and the Primal orbs are left out on purpose: Megas are picked as their own team members and hold no item
const items = Dex.items.all().filter(it => it.exists && it.num > 0 && OK_STD.has(it.isNonstandard) && !/^TR\d|^TM\d|^HM\d/.test(it.name) && !it.megaStone && !["Red Orb", "Blue Orb"].includes(it.name)).sort((a, b) => a.name.localeCompare(b.name));
const ITEMS = items.map(it => [it.name, it.shortDesc || it.desc || "", itemCat(it), it.spritenum || 0, it.fling ? it.fling.basePower : 0]);
// ---------------- learnsets + abilities + weights ----------------
async function learnOf(s){
  // merge the species' own learnset with its pre-evolutions (moves carry over when a Pokémon evolves)
  const out = new Map();
  for (let sp = s, seen = 0; sp && sp.exists && seen < 4; sp = sp.prevo ? Dex.species.get(sp.prevo) : null, seen++) {
    let ls = await Dex.learnsets.get(sp.id);
    if ((!ls || !ls.learnset) && sp.changesFrom) ls = await Dex.learnsets.get(toID(sp.changesFrom));
    if ((!ls || !ls.learnset) && sp.baseSpecies !== sp.name) ls = await Dex.learnsets.get(toID(sp.baseSpecies));
    if (!ls || !ls.learnset) continue;
    for (const [id, src] of Object.entries(ls.learnset)) {
      if (!MOVE_IDX.has(id)) continue;
      const best = src.map(x => [+x[0], x[1], x.slice(2)]).sort((a, b) => b[0] - a[0] || "LMTESV".indexOf(a[1]) - "LMTESV".indexOf(b[1]))[0];
      const how = best[1] === "L" ? "L" + (+best[2] || 1) : best[1];
      if (!out.has(id) || seen === 0 && !out.get(id).own) out.set(id, {how: seen ? (how[0] === "L" ? "P" : how) : how, own: seen === 0});
    }
  }
  return out;
}
const old = read("packs/learnsets.json");
const LS = {}, LM = {}, AB = {}, HA = {}, WT = {};
const allNums = [...NAT.keys(), ...FORM_SP.keys()].sort((a, b) => a - b);
for (const n of allNums) {
  const s = spOf(n); if (!s) continue;
  const ab = Object.entries(s.abilities).filter(([k]) => k !== "S").map(([, v]) => v);
  AB[n] = [...new Set(ab)]; if (s.abilities.H) HA[n] = s.abilities.H;
  WT[n] = s.weightkg;
  // Megas and Primals learn what their base form learns (the app falls back to the base number)
  if (n > 1025 && /-(Mega|Primal)/.test(s.name)) continue;
  const ls = await learnOf(s); if (!ls.size) continue;
  const rows = [...ls].map(([id, v]) => [MOVE_IDX.get(id), v.how]).sort((a, b) => a[0] - b[0]);
  LS[n] = rows.map(r => r[0]); LM[n] = rows.map(r => r[1]);
}
const MD = moves.map(m => m.shortDesc || m.desc || ""), MF = moves.map(m => m.desc || m.shortDesc || "");
const ID = items.map(it => it.desc || it.shortDesc || "");
let nLs = 0; for (const k of Object.keys(old.LS)) if (!LS[k]) nLs++;

write("data/data.json", data);
write("data/forms.json", forms);
write("data/fe.json", fe);
write("data/moves_data.json", {MOVES, ABIL, ITEMS});
write("packs/learnsets.json", {LS, LM, AB, HA, WT, MD, MF, ID});
console.log(log.join("\n"));
console.log(`\n${MOVES.length} moves (was ${oldMoves.MOVES.length}, ${nMv} changed), ${ITEMS.length} items (was ${oldMoves.ITEMS.length}), ${Object.keys(ABIL).length} abilities`);
console.log(`${nStat} stat lines, ${nType} typings and ${nFE} "fully evolved" flags corrected; learnsets for ${Object.keys(LS).length} Pokémon (${nLs} old entries without one now fall back to their base form)`);
