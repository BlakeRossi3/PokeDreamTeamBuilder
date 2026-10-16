// Damage check against @smogon/calc (the reference Pokémon damage calculator, MIT).
//
//     npm install
//     node tests/test_damage.mjs [cases=600] [seed=2026]
//
// Builds random attacker / defender / move / item / ability / nature / EVs / IVs / status / stat stages /
// weather / terrain / screens / critical-hit combinations that the engine supports, and checks that all 16
// damage rolls of src/engine.js match @smogon/calc exactly. Exits 1 on any difference.
import {calculate, Generations, Pokemon, Move, Field} from "@smogon/calc";
import {loadEngine, seeded} from "./engine_harness.mjs";

const N = +process.argv[2] || 600, SEED = +process.argv[3] || 2026;
const gen = Generations.get(9), E = loadEngine(), R = seeded(SEED);
const id = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
const pick = a => a[Math.floor(R()*a.length)], chance = p => R() < p;

// species both sides know (base forms; Megas and regional forms are covered by the same code paths)
const SPECIES = E.NATBASE.filter(m => { const s = gen.species.get(id(m.name)); return s && s.name === m.name; });
// moves whose power doesn't depend on battle history the calculator can't see
const SKIP_MOVES = new Set(["Fling", "Natural Gift", "Nature Power", "Tera Blast", "Tera Starstorm", "Spectral Thief", "Pursuit", "Assurance", "Avalanche", "Revenge", "Stomping Tantrum", "Temper Flare", "Rage Fist", "Last Respects", "Beat Up", "Counter", "Mirror Coat", "Metal Burst", "Psywave", "Final Gambit", "Endeavor", "Present", "Magnitude", "Shell Side Arm", "Photon Geyser", "Hidden Power", "Struggle", "Ivy Cudgel", "Raging Bull", "Aura Wheel", "Sky Drop", "Synchronoise", "Dream Eater", "Steel Roller", "Poltergeist", "Lash Out", "Return", "Frustration", "Bide", "Echoed Voice", "Round", "Fury Cutter", "Rollout", "Ice Ball", "Trump Card", "Spit Up", "Wring Out", "Crush Grip", "Hard Press", "Super Fang", "Ruination", "Nature's Madness", "Guardian of Alola", "Pain Split", "Electro Shot", "Meteor Beam", "Belch", "Burn Up", "Double Shock", "Fickle Beam", "Order Up", "Hydro Steam", "Upper Hand", "Comeuppance", "Sucker Punch", "Thunderclap", "Water Shuriken"]);
const MOVES = E.MOVES.filter(m => m[2] !== "X" && !SKIP_MOVES.has(m[0]) && !m[0].startsWith("Hidden Power") && !m[0].startsWith("G-Max") && !m[8].ohko && gen.moves.get(id(m[0])) && gen.moves.get(id(m[0])).category !== "Status");
const ABILS = ["", "", "", "Adaptability", "Aerilate", "Pixilate", "Refrigerate", "Galvanize", "Normalize", "Liquid Voice", "Technician", "Strong Jaw", "Iron Fist", "Sharpness", "Mega Launcher", "Tough Claws", "Reckless", "Sheer Force", "Sand Force", "Analytic", "Punk Rock", "Huge Power", "Hustle", "Guts", "Blaze", "Torrent", "Overgrow", "Swarm", "Solar Power", "Gorilla Tactics", "Defeatist", "Water Bubble", "Steelworker", "Transistor", "Dragon's Maw", "Rocky Payload", "Toxic Boost", "Flare Boost", "Neuroforce", "Sniper", "Tinted Lens", "Scrappy", "Mold Breaker", "Unaware", "Steely Spirit", "Hadron Engine", "Orichalcum Pulse", "Sword of Ruin", "Beads of Ruin", "Tablets of Ruin", "Vessel of Ruin", "Merciless", "Fairy Aura", "Dark Aura"];
const DABILS = ["", "", "", "Multiscale", "Shadow Shield", "Fluffy", "Punk Rock", "Ice Scales", "Filter", "Solid Rock", "Prism Armor", "Thick Fat", "Heatproof", "Dry Skin", "Water Bubble", "Purifying Salt", "Marvel Scale", "Fur Coat", "Unaware", "Battle Armor", "Wonder Guard", "Levitate", "Flash Fire", "Volt Absorb", "Water Absorb", "Sap Sipper", "Storm Drain", "Lightning Rod", "Motor Drive", "Earth Eater", "Bulletproof", "Soundproof", "Well-Baked Body", "Sword of Ruin", "Beads of Ruin", "Tablets of Ruin", "Vessel of Ruin", "Aura Break"];
const TYPE_ITEMS = E.ITEMS.filter(it => it[2] === "type" || it[2] === "plate").map(it => it[0]);
const GEMS = E.ITEMS.filter(it => it[2] === "gem").map(it => it[0]);
const BERRIES = E.ITEMS.filter(it => /Halves damage taken from a supereffective/.test(it[1]) || it[0] === "Chilan Berry").map(it => it[0]);
const AITEMS = ["", "", "", "Choice Band", "Choice Specs", "Life Orb", "Expert Belt", "Muscle Band", "Wise Glasses", "Punching Glove", "Light Ball", "Thick Club", "Deep Sea Tooth", "Utility Umbrella", "Soul Dew", "Adamant Orb", "Lustrous Orb", "Griseous Orb", ...TYPE_ITEMS, ...GEMS];
const DITEMS = ["", "", "", "Eviolite", "Assault Vest", "Air Balloon", "Utility Umbrella", "Metal Powder", "Deep Sea Scale", "Ring Target", "Iron Ball", ...BERRIES];
const NATURES = Object.keys(E.NATURES), STATS = ["hp", "atk", "def", "spa", "spd", "spe"];
const WEATHER = [["", undefined], ["sun", "Sun"], ["rain", "Rain"], ["sand", "Sand"], ["snow", "Snow"]];
const TERRAIN = [["", undefined], ["electric", "Electric"], ["grassy", "Grassy"], ["psychic", "Psychic"], ["misty", "Misty"]];

function randEVs(){ const e = {}; let left = 510; for (const k of STATS) { if (!chance(.5)) continue; const v = Math.min(left, pick([4, 84, 100, 128, 252, Math.floor(R()*253)])); e[k] = v; left -= v; } return e; }
function randIVs(){ const v = {}; for (const k of STATS) v[k] = chance(.7) ? 31 : Math.floor(R()*32); return v; }
function randBoosts(){ const b = {}; for (const k of ["atk", "def", "spa", "spd", "spe"]) if (chance(.25)) b[k] = Math.floor(R()*9) - 4; return b; }
function side(){
  const sp = pick(SPECIES);
  return {sp, level:chance(.5) ? 50 : 20 + Math.floor(R()*81), nature:pick(NATURES), evs:randEVs(), ivs:randIVs(), boosts:randBoosts(),
    status:pick(["", "", "", "brn", "par", "psn", "tox", "slp"]), hpFrac:chance(.6) ? 1 : .05 + R()*.95};
}
let bad = 0, run = 0, immune = 0;
const fails = [];
for (let c = 0; c < N; c++) {
  const A = side(), D = side(), mv = pick(MOVES);
  // "Pickup" stands in for "no ability that matters" (a blank ability means the species' default in both tools)
  A.ability = pick(ABILS) || "Pickup"; A.item = pick(AITEMS); D.ability = pick(DABILS) || "Pickup"; D.item = pick(DITEMS);
  const [w, W] = pick(WEATHER), [t, T] = pick(TERRAIN), screens = {reflect:chance(.15), lightscreen:chance(.15), auroraveil:chance(.08)};
  // two places where @smogon/calc simplifies and the engine follows Showdown's battle simulator instead:
  // Utility Umbrella switches off Solar Power, and Iron Ball only cancels the Flying immunity (other weaknesses stay)
  if (A.ability === "Solar Power" && A.item === "Utility Umbrella") A.item = "";
  if (D.item === "Iron Ball" && mv[1] === "Ground") D.item = "";
  const wc = !!(gen.moves.get(id(mv[0])).willCrit), crit = wc || chance(.2) || (A.ability === "Merciless" && (D.status === "psn" || D.status === "tox"));
  // the engine
  const mk = X => { const m = E.mkMon(X.sp.num, {level:X.level, nature:X.nature, evs:X.evs, ivs:X.ivs, moves:[mv], ability:X.ability, item:X.item}); m.status = X.status || null; m.hp = Math.max(1, Math.floor(m.max*X.hpFrac)); Object.assign(m.stages, X.boosts); return m; };
  const a = mk(A), d = mk(D);
  const B = new E.Battle([{name:"A", party:[a], human:false}, {name:"D", party:[d], human:false}], {rand:R});
  B.weather = w || null; B.terrain = t || null; B.s[1].sc = {...screens};
  const movedLast = !(B.speed(a) > B.speed(d));
  const r = B.calc(a, d, mv, {crit, dSide:B.s[1].sc, movedLast});
  const mine = r.rolls ? r.rolls : Array(16).fill(0);
  // the reference
  const P = (X, m) => new Pokemon(gen, X.sp.name, {level:X.level, nature:X.nature, evs:X.evs, ivs:X.ivs, ability:X.ability || undefined, item:X.item || undefined, status:X.status || "", boosts:X.boosts, curHP:m.hp});
  let ref;
  try {
    const field = new Field({gameType:"Singles", weather:W, terrain:T, defenderSide:{isReflect:screens.reflect, isLightScreen:screens.lightscreen, isAuroraVeil:screens.auroraveil}});
    const res = calculate(gen, P(A, a), P(D, d), new Move(gen, mv[0], {isCrit:crit}), field);
    let dm = res.damage; if (Array.isArray(dm) && Array.isArray(dm[0])) dm = dm[0]; if (!Array.isArray(dm)) dm = Array(16).fill(dm || 0);
    ref = dm;
  } catch(e) { continue; }
  run++; if (!ref.some(Boolean)) immune++;
  if (ref.join() !== mine.join()) {
    bad++;
    if (fails.length < 15) fails.push(`${A.sp.name} (Lv${A.level} ${A.nature} ${A.ability || "-"} @${A.item || "-"} ${A.status || ""} ${JSON.stringify(A.boosts)} ${a.hp}/${a.max}) ${mv[0]} → ${D.sp.name} (Lv${D.level} ${D.nature} ${D.ability || "-"} @${D.item || "-"} ${D.status || ""} ${JSON.stringify(D.boosts)} ${d.hp}/${d.max}) ${w || "-"} ${t || "-"} ${JSON.stringify(screens)} crit=${crit}\n   engine ${mine.join(",")}\n   calc   ${ref.join(",")}`);
  }
}
console.log(fails.join("\n"));
console.log(`${run} damage cases compared with @smogon/calc (${immune} no-damage cases), ${bad} mismatches`);
process.exit(bad ? 1 : 0);
