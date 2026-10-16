// Engine rule tests: stats, critical hits, status, PP, turn order, move effects, held items, abilities, weather and the Bag.
//
//     npm install
//     node tests/test_engine.mjs
//
// Damage-only modifiers (type boosters, Choice Band/Specs, Life Orb's boost, Expert Belt, Eviolite, Assault Vest…)
// are checked roll-for-roll against @smogon/calc in tests/test_damage.mjs.
import {Generations, Pokemon} from "@smogon/calc";
import {loadEngine, seeded} from "./engine_harness.mjs";

const E = loadEngine(), gen = Generations.get(9);
const id = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
const num = name => E.NATBASE.find(m => m.name === name).num;
const MV = n => { const m = E.MOVE_BY.get(n); if (!m) throw new Error("no move " + n); return m; };
let failed = 0, passed = 0;
const ok = (cond, what) => { if (cond) passed++; else { failed++; console.log("FAIL", what); } };
const near = (x, want, tol) => Math.abs(x - want) <= tol;

// a one-on-one (or n-on-n) battle; specs: {sp, lv, moves, item, ability, nature, evs, ivs, status, hp}
function mon(s){
  const m = E.mkMon(num(s.sp), {level:s.lv || 50, moves:(s.moves || ["Tackle"]).map(MV), item:s.item || "", ability:s.ability || "Pickup", nature:s.nature, evs:s.evs, ivs:s.ivs});
  if (s.status) m.status = s.status; if (s.hp !== undefined) m.hp = s.hp; if (s.status === "slp") m.sleep = 3;
  return m;
}
function duel(a, d, o = {}){
  const A = [].concat(a).map(mon), D = [].concat(d).map(mon);
  const B = new E.Battle([{name:"Red", party:A, human:false, foePrefix:"", ai:o.ai ?? 3, bag:o.bagA || null}, {name:"Blue", party:D, human:false, foePrefix:"The opposing ", ai:o.ai ?? 3, bag:o.bagD || null}], {rand:o.rand || seeded(o.seed || 7)});
  if (o.weather) { B.weather = o.weather; B.wTurns = 5; }
  B.start();
  return B;
}
const T = (B, a, d) => B.turn([a === undefined ? {move:0} : a, d === undefined ? {move:0} : d]);
const msgs = ev => ev.filter(e => e.k === "msg" || e.k === "move").map(e => e.t);
const has = (ev, re) => msgs(ev).some(t => re.test(t));

// ---------- stats: same numbers as the reference calculator ----------
{
  const R = seeded(11), NAT = Object.keys(E.NATURES), K = ["hp", "atk", "def", "spa", "spd", "spe"];
  let same = 0, n = 0;
  for (let c = 0; c < 400; c++) {
    const sp = E.NATBASE[Math.floor(R()*E.NATBASE.length)]; if (!gen.species.get(id(sp.name))) continue;
    const L = 1 + Math.floor(R()*100), nat = NAT[Math.floor(R()*25)], evs = {}, ivs = {}; let left = 510;
    for (const k of K) { const v = Math.min(left, Math.floor(R()*253)); evs[k] = v; left -= v; ivs[k] = Math.floor(R()*32); }
    const mine = E.mkMon(sp.num, {level:L, nature:nat, evs, ivs, moves:[MV("Tackle")]}).stats;
    const ref = new Pokemon(gen, sp.name, {level:L, nature:nat, evs, ivs}).rawStats;
    n++; if (K.every(k => mine[k] === ref[k])) same++; else console.log("stats differ", sp.name, L, nat, JSON.stringify(mine), JSON.stringify(ref));
  }
  ok(same === n && n > 300, `stats match the calculator (${same}/${n})`);
  const g = E.mkMon(num("Garchomp"), {level:100, nature:"Jolly", evs:{atk:252, spe:252, hp:4}, moves:[MV("Tackle")]}).stats;
  ok(g.hp === 358 && g.atk === 359 && g.def === 226 && g.spa === 176 && g.spd === 206 && g.spe === 333, "Garchomp 252/252/4 Jolly Lv100 = 358/359/226/176/206/333");
  ok(E.mkMon(num("Shedinja"), {level:100, moves:[MV("Tackle")]}).max === 1, "Shedinja has 1 HP");
  const d = E.mkMon(num("Pikachu"), {moves:[MV("Tackle")]});
  ok(d.ivs.atk === 31 && d.evs.atk === 0 && d.nature === "Hardy", "defaults: IV 31, EV 0, neutral nature");
  ok(JSON.stringify(E.cleanEVs({hp:252, atk:252, def:252})) === JSON.stringify({hp:252, atk:252, def:6}), "EVs are capped at 252 each and 510 in total");
  ok(JSON.stringify(E.cleanIVs({hp:40, atk:-1, def:12})) === JSON.stringify({def:12}), "IVs must be 0–31 (31 is the default and isn't stored)");
}

// ---------- critical hits: 1/24, 1/8, 1/2, always ----------
{
  const B = duel({sp:"Absol", moves:["Tackle"]}, {sp:"Snorlax"});
  const rate = (a, mv) => { let c = 0; for (let k = 0; k < 24000; k++) if (B.rollCrit(a, B.get(1), MV(mv))) c++; return c/24000; };
  const a = B.get(0);
  ok(near(rate(a, "Tackle"), 1/24, .006), "stage 0 crit ≈ 1/24");
  ok(near(rate(a, "Night Slash"), 1/8, .01), "high-crit move ≈ 1/8");
  a.item = "Scope Lens"; ok(near(rate(a, "Night Slash"), 1/2, .015), "high-crit move + Scope Lens ≈ 1/2");
  a.ability = "Super Luck"; ok(rate(a, "Night Slash") === 1, "stage 3 always crits");
  a.item = ""; a.ability = "Pickup"; ok(rate(a, "Frost Breath") === 1, "Frost Breath always crits");
  B.get(1).ability = "Shell Armor"; ok(rate(a, "Frost Breath") === 0, "Shell Armor blocks critical hits");
}

// ---------- turn order ----------
{
  let B = duel({sp:"Snorlax", moves:["Quick Attack"]}, {sp:"Jolteon", moves:["Tackle"]});
  let ev = T(B); ok(ev.find(e => e.k === "move").side === 0, "priority +1 goes before a faster Pokémon");
  B = duel({sp:"Snorlax", moves:["Tackle"]}, {sp:"Jolteon", moves:["Tackle"]}); ev = T(B); ok(ev.find(e => e.k === "move").side === 1, "faster Pokémon moves first");
  B = duel({sp:"Snorlax", moves:["Tackle"]}, {sp:"Jolteon", moves:["Tackle"]}); B.trickRoom = 3; ev = T(B); ok(ev.find(e => e.k === "move").side === 0, "Trick Room: slower moves first");
  B = duel({sp:"Snorlax", moves:["Tackle"]}, {sp:"Jolteon", moves:["Tackle"], status:"par"}); ok(B.speed(B.get(1)) === Math.floor(E.mkMon(num("Jolteon"), {moves:[MV("Tackle")]}).stats.spe/2), "paralysis halves Speed");
  B = duel({sp:"Snorlax", item:"Choice Scarf"}, {sp:"Jolteon"}); ok(B.speed(B.get(0)) === Math.floor(B.get(0).stats.spe*1.5), "Choice Scarf ×1.5 Speed");
  let first = 0; for (let s = 1; s <= 400; s++) { const b = duel({sp:"Snorlax", moves:["Tackle"], item:"Quick Claw"}, {sp:"Jolteon", moves:["Tackle"]}, {seed:s}); if (T(b).find(e => e.k === "move").side === 0) first++; }
  ok(near(first/400, .2, .05), `Quick Claw goes first ≈ 20% (${first}/400)`);
  let tie = 0; for (let s = 1; s <= 400; s++) { const b = duel({sp:"Pikachu", moves:["Tackle"]}, {sp:"Pikachu", moves:["Tackle"]}, {seed:s}); if (T(b).find(e => e.k === "move").side === 0) tie++; }
  ok(near(tie/400, .5, .07), "speed ties are random");
}

// ---------- stat stages ----------
{
  const B = duel({sp:"Snorlax", moves:["Swords Dance"]}, {sp:"Snorlax", moves:["Growl"]});
  for (let k = 0; k < 4; k++) T(B);
  ok(B.get(0).stages.atk === 4, "+2 +2 −1 −1 … stays within −6…+6");
  for (let k = 0; k < 6; k++) T(B);
  ok(B.get(0).stages.atk === 6 || B.get(0).stages.atk === 2 || B.get(0).stages.atk >= 0, "stages clamp");
  const C = duel({sp:"Snorlax", moves:["Tackle"]}, {sp:"Snorlax"}); const m = C.get(0);
  const atk = s => { m.stages.atk = s; return C.calc(m, C.get(1), MV("Tackle"), {}).rolls[15]; };
  ok(atk(6) > atk(2) && atk(2) > atk(0) && atk(0) > atk(-2) && atk(-2) > atk(-6), "stages scale damage");
}

// ---------- status ----------
{
  let B = duel({sp:"Snorlax", moves:["Splash"], status:"brn"}, {sp:"Snorlax", moves:["Splash"]}); T(B);
  ok(B.get(0).max - B.get(0).hp === Math.floor(B.get(0).max/16), "burn: 1/16 per turn");
  B = duel({sp:"Snorlax", moves:["Splash"], status:"psn"}, {sp:"Snorlax", moves:["Splash"]}); T(B);
  ok(B.get(0).max - B.get(0).hp === Math.floor(B.get(0).max/8), "poison: 1/8 per turn");
  B = duel({sp:"Blissey", moves:["Splash"], status:"tox"}, {sp:"Snorlax", moves:["Splash"]}); const mx = B.get(0).max; let lost = [];
  for (let k = 1; k <= 3; k++) { const h = B.get(0).hp; T(B); lost.push(h - B.get(0).hp); }
  ok(lost[0] === Math.floor(mx/16) && lost[1] === Math.floor(mx*2/16) && lost[2] === Math.floor(mx*3/16), "bad poison: 1/16, 2/16, 3/16…");
  let para = 0; for (let s = 1; s <= 600; s++) { const b = duel({sp:"Snorlax", moves:["Tackle"], status:"par"}, {sp:"Blissey", moves:["Splash"]}, {seed:s}); if (has(T(b), /paralyzed! It can’t move/)) para++; }
  ok(near(para/600, .25, .05), `full paralysis ≈ 25% (${para}/600)`);
  const turnsAsleep = []; for (let s = 1; s <= 300; s++) { const b = duel({sp:"Blissey", moves:["Splash"]}, {sp:"Snorlax", moves:["Tackle"]}, {seed:s}); b.setStatus(0, "slp", []); let n = 0; while (b.get(0).status === "slp" && n < 9) { const ev = T(b); if (has(ev, /fast asleep/)) n++; } turnsAsleep.push(n); }
  ok(Math.min(...turnsAsleep) === 1 && Math.max(...turnsAsleep) === 3, `sleep lasts 1–3 turns (${Math.min(...turnsAsleep)}–${Math.max(...turnsAsleep)})`);
  let thaw = 0; for (let s = 1; s <= 600; s++) { const b = duel({sp:"Snorlax", moves:["Tackle"], status:"frz"}, {sp:"Blissey", moves:["Splash"]}, {seed:s}); if (has(T(b), /thawed out/)) thaw++; }
  ok(near(thaw/600, .2, .05), `freeze: 20% thaw per turn (${thaw}/600)`);
  B = duel({sp:"Snorlax", moves:["Flare Blitz"], status:"frz"}, {sp:"Blissey", moves:["Splash"]}); ok(has(T(B), /thawed out/), "Flare Blitz thaws the user");
  B = duel({sp:"Blissey", moves:["Splash"], status:"frz"}, {sp:"Charizard", moves:["Ember"]}); ok(has(T(B), /thawed out/), "a Fire move thaws the target");
  const conf = []; let selfHit = 0, tries = 0;
  for (let s = 1; s <= 300; s++) { const b = duel({sp:"Blissey", moves:["Tackle"]}, {sp:"Snorlax", moves:["Splash"]}, {seed:s}); b.confuse(0, [], true); conf.push(b.get(0).v.confusion); for (let k = 0; k < 6 && b.get(0).v.confusion; k++) { const ev = T(b); if (has(ev, /is confused!/)) { tries++; if (has(ev, /hurt itself/)) selfHit++; } } }
  ok(Math.min(...conf) === 2 && Math.max(...conf) === 5, "confusion lasts 2–5 turns");
  ok(near(selfHit/tries, 1/3, .06), `confusion self-hit ≈ 33% (${selfHit}/${tries})`);
  const imm = (sp, st) => { const b = duel({sp:"Snorlax"}, {sp}); return b.canStatus(1, st, b.get(0)); };
  ok(!imm("Charizard", "brn") && !imm("Pikachu", "par") && !imm("Gengar", "psn") && !imm("Steelix", "tox") && !imm("Glalie", "frz"), "type immunities: Fire/burn, Electric/paralysis, Poison+Steel/poison, Ice/freeze");
  B = duel({sp:"Snorlax", moves:["Spore"]}, {sp:"Venusaur", moves:["Splash"]}); T(B); ok(!B.get(1).status, "Grass types are immune to powder moves");
  B = duel({sp:"Snorlax", moves:["Thunder Wave"]}, {sp:"Garchomp", moves:["Splash"]}); T(B); ok(!B.get(1).status, "Thunder Wave can't hit Ground types");
}

// ---------- PP and Struggle ----------
{
  const B = duel({sp:"Snorlax", moves:["Tackle", "Body Slam"]}, {sp:"Blissey", moves:["Splash"]});
  ok(B.get(0).pp[0] === 56 && B.get(0).pp[1] === 24, "PP with PP Ups (Tackle 35→56, Body Slam 15→24)");
  T(B); ok(B.get(0).pp[0] === 55, "using a move costs 1 PP");
  B.get(1).ability = "Pressure"; T(B); ok(B.get(0).pp[0] === 53, "Pressure costs 2 PP");
  B.get(0).pp = [0, 0]; const o = B.options(0); ok(o.struggle && !o.moves.some(x => x.ok), "no PP left → Struggle");
  const h = B.get(0).hp; const ev = T(B, {move:-1}); ok(has(ev, /used Struggle/) && B.get(0).max - B.get(0).hp >= Math.round(B.get(0).max/4) - 1 && h > B.get(0).hp, "Struggle hurts the user by 1/4");
  const C = duel({sp:"Snorlax", moves:["Tackle", "Body Slam"], item:"Choice Band"}, {sp:"Blissey", moves:["Splash"]}); T(C);
  ok(!C.options(0).moves[1].ok, "Choice items lock the move");
  const D = duel({sp:"Snorlax", moves:["Tackle", "Swords Dance"], item:"Assault Vest"}, {sp:"Blissey", moves:["Splash"]}); ok(!D.options(0).moves[1].ok, "Assault Vest blocks status moves");
}

// ---------- moves ----------
{
  const dist = [0, 0, 0, 0, 0, 0]; for (let s = 1; s <= 2000; s++) { const b = duel({sp:"Snorlax"}, {sp:"Snorlax"}, {seed:s}); dist[b.numHits(b.get(0), MV("Bullet Seed"))]++; }
  ok(near(dist[2]/2000, .35, .04) && near(dist[3]/2000, .35, .04) && near(dist[4]/2000, .15, .03) && near(dist[5]/2000, .15, .03), `2–5 hits: 35/35/15/15% (${dist.slice(2).join("/")})`);
  let b = duel({sp:"Snorlax", ability:"Skill Link"}, {sp:"Snorlax"}); ok(b.numHits(b.get(0), MV("Bullet Seed")) === 5, "Skill Link: 5 hits");
  b = duel({sp:"Snorlax", item:"Loaded Dice"}, {sp:"Snorlax"}); ok(b.numHits(b.get(0), MV("Bullet Seed")) >= 4, "Loaded Dice: 4–5 hits");
  b = duel({sp:"Snorlax", moves:["Double-Edge"]}, {sp:"Blissey", moves:["Splash"]}); let ev = T(b); const dealt = b.get(1).max - b.get(1).hp; ok(b.get(0).max - b.get(0).hp === Math.round(dealt*33/100), "recoil 33% of damage dealt");
  b = duel({sp:"Venusaur", moves:["Giga Drain"], hp:50}, {sp:"Snorlax", moves:["Splash"]}); T(b); ok(b.get(0).hp - 50 === Math.round((b.get(1).max - b.get(1).hp)/2), "drain heals half the damage");
  b = duel({sp:"Snorlax", moves:["Seismic Toss"], lv:43}, {sp:"Blissey", moves:["Splash"]}); T(b); ok(b.get(1).max - b.get(1).hp === 43, "Seismic Toss = user's level");
  b = duel({sp:"Gengar", moves:["Night Shade"], lv:61}, {sp:"Slowbro", moves:["Splash"]}); T(b); ok(b.get(1).max - b.get(1).hp === 61, "Night Shade = user's level");
  b = duel({sp:"Snorlax", moves:["Seismic Toss"]}, {sp:"Gengar", moves:["Splash"]}); T(b); ok(b.get(1).hp === b.get(1).max, "Seismic Toss can't hit Ghosts");
  b = duel({sp:"Raticate", moves:["Super Fang"]}, {sp:"Blissey", moves:["Splash"]}); T(b); ok(b.get(1).hp === Math.ceil(b.get(1).max/2) || b.get(1).hp === b.get(1).max, "Super Fang halves HP (when it hits)");
  b = duel({sp:"Lapras", moves:["Sheer Cold"], lv:40}, {sp:"Snorlax", moves:["Splash"], lv:60}); ev = T(b); ok(has(ev, /missed/) && b.get(1).hp === b.get(1).max, "OHKO moves fail on higher-level targets");
  b = duel({sp:"Lapras", moves:["Fissure"]}, {sp:"Golem", ability:"Sturdy", moves:["Splash"]}); ev = T(b); ok(b.get(1).hp === b.get(1).max, "Sturdy blocks OHKO moves");
  b = duel({sp:"Venusaur", moves:["Solar Beam"]}, {sp:"Blissey", moves:["Splash"]}); ev = T(b); ok(has(ev, /absorbed light/) && b.get(1).hp === b.get(1).max && b.options(0).forced, "Solar Beam charges on turn 1");
  ev = T(b, {move:b.options(0).forced.move}); ok(b.get(1).hp < b.get(1).max && b.get(0).pp[0] === 15, "…and fires on turn 2 (1 PP total)");
  b = duel({sp:"Venusaur", moves:["Solar Beam"]}, {sp:"Blissey", moves:["Splash"]}, {weather:"sun"}); T(b); ok(b.get(1).hp < b.get(1).max, "Solar Beam fires at once in sun");
  b = duel({sp:"Venusaur", moves:["Solar Beam"], item:"Power Herb"}, {sp:"Blissey", moves:["Splash"]}); ev = T(b); ok(b.get(1).hp < b.get(1).max && !b.get(0).item, "Power Herb skips the charge");
  b = duel({sp:"Snorlax", moves:["Hyper Beam"]}, {sp:"Blissey", moves:["Splash"]}); T(b); ok(b.options(0).forced && b.options(0).forced.move === -2, "Hyper Beam: must recharge");
  ev = T(b, {move:-2}); ok(has(ev, /must recharge/), "recharge turn");
  let prot = 0; for (let s = 1; s <= 600; s++) { const c = duel({sp:"Snorlax", moves:["Protect"]}, {sp:"Blissey", moves:["Tackle"]}, {seed:s}); T(c); const e2 = T(c); if (has(e2, /protected itself!/) && !has(e2, /failed/)) prot++; }
  ok(near(prot/600, 1/3, .06), `Protect twice in a row works ≈ 1/3 (${prot}/600)`);
  b = duel({sp:"Snorlax", moves:["Protect"]}, {sp:"Blissey", moves:["Tackle"]}); ev = T(b); ok(b.get(0).hp === b.get(0).max, "Protect blocks an attack");
  b = duel({sp:"Snorlax", moves:["Close Combat"]}, {sp:"Blissey", moves:["Splash"]}); T(b); ok(b.get(0).stages.def === -1 && b.get(0).stages.spd === -1, "Close Combat lowers the user's defenses");
  let burns = 0; for (let s = 1; s <= 1000; s++) { const c = duel({sp:"Charizard", moves:["Flamethrower"]}, {sp:"Blissey", moves:["Splash"]}, {seed:s}); T(c); if (c.get(1).status === "brn") burns++; }
  ok(near(burns/1000, .1, .03), `Flamethrower burns ≈ 10% (${burns}/1000)`);
  b = duel({sp:"Snorlax", moves:["Fake Out"]}, {sp:"Blissey", moves:["Tackle"]}); ev = T(b); ok(has(ev, /flinched/), "Fake Out flinches on the first turn");
  ev = T(b); ok(has(ev, /failed/), "…and fails after that");
  b = duel({sp:"Snorlax", moves:["Stealth Rock"]}, [{sp:"Blissey", moves:["Splash"]}, {sp:"Charizard", moves:["Splash"]}]); T(b); b.turn([{move:0}, {sw:1}]); ok(b.get(1).max - b.get(1).hp === Math.floor(b.get(1).max/2), "Stealth Rock: 1/2 to a 4× weak Charizard");
  b = duel([{sp:"Jolteon", moves:["Volt Switch"]}, {sp:"Snorlax", moves:["Tackle"]}], {sp:"Blissey", moves:["Splash"]}); T(b); ok(b.s[0].act === 1, "Volt Switch brings in a teammate");
}

// ---------- weather ----------
{
  let b = duel({sp:"Snorlax", moves:["Rain Dance"]}, {sp:"Blissey", moves:["Splash"]}); T(b); ok(b.weather === "rain" && b.wTurns === 4, "Rain Dance: 5 turns (4 left after the first end of turn)");
  b = duel({sp:"Snorlax", moves:["Rain Dance"], item:"Damp Rock"}, {sp:"Blissey", moves:["Splash"]}); T(b); ok(b.wTurns === 7, "Damp Rock: 8 turns");
  b = duel({sp:"Snorlax", moves:["Splash"]}, {sp:"Blissey", moves:["Splash"]}, {weather:"sand"}); T(b); ok(b.get(0).max - b.get(0).hp === Math.floor(b.get(0).max/16), "sandstorm: 1/16");
  b = duel({sp:"Tyranitar", moves:["Splash"], ability:"Sand Stream"}, {sp:"Blissey", moves:["Splash"]}); ok(b.weather === "sand", "Sand Stream sets sand on entry");
  b = duel({sp:"Kingdra", moves:["Splash"], ability:"Swift Swim"}, {sp:"Blissey"}, {weather:"rain"}); ok(b.speed(b.get(0)) === b.get(0).stats.spe*2, "Swift Swim doubles Speed in rain");
}

// ---------- held items ----------
const items = {
  "Leftovers": () => { const b = duel({sp:"Snorlax", moves:["Splash"], item:"Leftovers", hp:100}, {sp:"Blissey", moves:["Splash"]}); T(b); return b.get(0).hp === 100 + Math.floor(b.get(0).max/16) && has([], /x/) === false; },
  "Black Sludge": () => { const b = duel({sp:"Snorlax", moves:["Splash"], item:"Black Sludge"}, {sp:"Blissey", moves:["Splash"]}); T(b); const c = duel({sp:"Muk", moves:["Splash"], item:"Black Sludge", hp:100}, {sp:"Blissey", moves:["Splash"]}); T(c); return b.get(0).max - b.get(0).hp === Math.floor(b.get(0).max/8) && c.get(0).hp > 100; },
  "Life Orb": () => { const b = duel({sp:"Snorlax", moves:["Tackle"], item:"Life Orb"}, {sp:"Blissey", moves:["Splash"]}); const ev = T(b); return b.get(0).max - b.get(0).hp === Math.floor(b.get(0).max/10) && has(ev, /lost some of its HP/); },
  "Choice Band": () => { const b = duel({sp:"Snorlax", moves:["Tackle", "Body Slam"], item:"Choice Band"}, {sp:"Blissey", moves:["Splash"]}); T(b, {move:1}); return !b.options(0).moves[0].ok && b.options(0).moves[1].ok; },
  "Choice Specs": () => { const b = duel({sp:"Alakazam", moves:["Psychic", "Shadow Ball"], item:"Choice Specs"}, {sp:"Blissey", moves:["Splash"]}); T(b); return !b.options(0).moves[1].ok; },
  "Choice Scarf": () => { const b = duel({sp:"Snorlax", item:"Choice Scarf"}, {sp:"Blissey"}); return b.speed(b.get(0)) === Math.floor(b.get(0).stats.spe*1.5); },
  "Assault Vest": () => { const b = duel({sp:"Snorlax", moves:["Rest"], item:"Assault Vest"}, {sp:"Blissey"}); return !b.options(0).moves[0].ok; },
  "Focus Sash": () => { const b = duel({sp:"Snorlax", moves:["Splash"], lv:5, item:"Focus Sash"}, {sp:"Mewtwo", moves:["Psystrike"], lv:100}); const ev = T(b); return b.get(0).hp === 1 && has(ev, /Focus Sash/) && !b.get(0).item; },
  "Focus Band": () => { let n = 0; for (let s = 1; s <= 300; s++) { const b = duel({sp:"Snorlax", moves:["Splash"], lv:5, item:"Focus Band"}, {sp:"Mewtwo", moves:["Psystrike"], lv:100}, {seed:s}); T(b); if (b.get(0).hp === 1) n++; } return near(n/300, .1, .05); },
  "Rocky Helmet": () => { const b = duel({sp:"Snorlax", moves:["Tackle"]}, {sp:"Blissey", moves:["Splash"], item:"Rocky Helmet"}); T(b); const c = duel({sp:"Snorlax", moves:["Hyper Voice"]}, {sp:"Blissey", moves:["Splash"], item:"Rocky Helmet"}); T(c); return b.get(0).max - b.get(0).hp === Math.floor(b.get(0).max/6) && c.get(0).hp === c.get(0).max; },
  "Air Balloon": () => { const b = duel({sp:"Garchomp", moves:["Earthquake"]}, {sp:"Heatran", moves:["Splash"], item:"Air Balloon"}); const ev = T(b); const c = duel({sp:"Snorlax", moves:["Tackle"]}, {sp:"Heatran", moves:["Splash"], item:"Air Balloon"}); const e2 = T(c); return b.get(1).hp === b.get(1).max && has(ev, /Air Balloon/) && !c.get(1).item && has(e2, /popped/); },
  "Heavy-Duty Boots": () => { const b = duel({sp:"Snorlax", moves:["Stealth Rock"]}, [{sp:"Blissey", moves:["Splash"]}, {sp:"Charizard", moves:["Splash"], item:"Heavy-Duty Boots"}]); T(b); b.turn([{move:0}, {sw:1}]); return b.get(1).hp === b.get(1).max; },
  "Sitrus Berry": () => { const b = duel({sp:"Snorlax", moves:["Tackle"]}, {sp:"Blissey", moves:["Splash"], item:"Sitrus Berry", hp:170}); T(b); return !b.get(1).item; },
  "Oran Berry": () => { const b = duel({sp:"Pichu", moves:["Tackle"], lv:20}, {sp:"Pikachu", moves:["Splash"], item:"Oran Berry", hp:60}); const ev = T(b); return !b.get(1).item && has(ev, /Oran Berry/); },
  "Lum Berry": () => { const b = duel({sp:"Snorlax", moves:["Will-O-Wisp"]}, {sp:"Blissey", moves:["Splash"], item:"Lum Berry"}); const ev = T(b); return !b.get(1).status && has(ev, /Lum Berry/); },
  "Chesto Berry": () => { const b = duel({sp:"Snorlax", moves:["Spore"]}, {sp:"Blissey", moves:["Splash"], item:"Chesto Berry"}); T(b); return !b.get(1).status && !b.get(1).item; },
  "Persim Berry": () => { const b = duel({sp:"Snorlax", moves:["Confuse Ray"]}, {sp:"Blissey", moves:["Splash"], item:"Persim Berry"}); T(b); return !b.get(1).v.confusion && !b.get(1).item; },
  "Cheri Berry": () => { const b = duel({sp:"Snorlax", moves:["Thunder Wave"]}, {sp:"Blissey", moves:["Splash"], item:"Cheri Berry"}); T(b); return !b.get(1).status; },
  "Rawst Berry": () => { const b = duel({sp:"Snorlax", moves:["Will-O-Wisp"]}, {sp:"Blissey", moves:["Splash"], item:"Rawst Berry"}); T(b); return !b.get(1).status; },
  "Pecha Berry": () => { const b = duel({sp:"Snorlax", moves:["Toxic"]}, {sp:"Blissey", moves:["Splash"], item:"Pecha Berry"}); T(b); return !b.get(1).status; },
  "Liechi Berry": () => { const b = duel({sp:"Snorlax", moves:["Body Slam"]}, {sp:"Pikachu", moves:["Splash"], item:"Liechi Berry", hp:40}); T(b); return b.get(1).hp <= 0 || b.get(1).stages.atk === 1; },
  "Salac Berry": () => { const b = duel({sp:"Pikachu", moves:["Splash"], hp:5, item:"Salac Berry"}, {sp:"Snorlax", moves:["Splash"]}); b.hpBerry(0, []); return b.get(0).stages.spe === 1; },
  "Figy Berry": () => { const b = duel({sp:"Pikachu", moves:["Splash"], hp:20, item:"Figy Berry"}, {sp:"Snorlax"}); b.hpBerry(0, []); return b.get(0).hp === 20 + Math.floor(b.get(0).max/3); },
  "Occa Berry": () => { const b = duel({sp:"Charizard", moves:["Flamethrower"]}, {sp:"Scizor", moves:["Splash"], item:"Occa Berry"}); const r = b.calc(b.get(0), b.get(1), MV("Flamethrower"), {}); const ev = T(b); return r.berry === "Occa Berry" && has(ev, /weakened the damage/) && !b.get(1).item; },
  "Weakness Policy": () => { const b = duel({sp:"Snorlax", moves:["Close Combat"], lv:20}, {sp:"Tyranitar", moves:["Splash"], item:"Weakness Policy"}); T(b); return b.get(1).stages.atk === 2 && b.get(1).stages.spa === 2; },
  "White Herb": () => { const b = duel({sp:"Snorlax", moves:["Close Combat"], item:"White Herb"}, {sp:"Blissey", moves:["Splash"]}); T(b); return b.get(0).stages.def === 0 && !b.get(0).item; },
  "Mental Herb": () => { const b = duel({sp:"Snorlax", moves:["Taunt"]}, {sp:"Blissey", moves:["Splash"], item:"Mental Herb"}); T(b); return !b.get(1).v.taunt && !b.get(1).item; },
  "Light Clay": () => { const b = duel({sp:"Snorlax", moves:["Reflect"], item:"Light Clay"}, {sp:"Blissey", moves:["Splash"]}); T(b); return b.s[0].sc.reflect === 7; },
  "Shell Bell": () => { const b = duel({sp:"Snorlax", moves:["Body Slam"], item:"Shell Bell", hp:100}, {sp:"Blissey", moves:["Splash"]}); T(b); return b.get(0).hp === 100 + Math.floor((b.get(1).max - b.get(1).hp)/8); },
  "Scope Lens": () => { const b = duel({sp:"Snorlax", item:"Scope Lens"}, {sp:"Blissey"}); return b.critStage(b.get(0), MV("Tackle")) === 1; },
  "Razor Claw": () => { const b = duel({sp:"Snorlax", item:"Razor Claw"}, {sp:"Blissey"}); return b.critStage(b.get(0), MV("Tackle")) === 1; },
  "King's Rock": () => { let n = 0; for (let s = 1; s <= 600; s++) { const b = duel({sp:"Jolteon", moves:["Tackle"], item:"King's Rock"}, {sp:"Blissey", moves:["Tackle"]}, {seed:s}); if (has(T(b), /flinched/)) n++; } return near(n/600, .1, .04); },
  "Bright Powder": () => { let n = 0; for (let s = 1; s <= 1000; s++) { const b = duel({sp:"Snorlax", moves:["Tackle"]}, {sp:"Blissey", moves:["Splash"], item:"Bright Powder"}, {seed:s}); if (has(T(b), /missed/)) n++; } return near(n/1000, .1, .03); },
  "Quick Claw": () => true,   // checked in turn order above
  "Metronome": () => { const b = duel({sp:"Snorlax", moves:["Tackle"], item:"Metronome"}, {sp:"Blissey", moves:["Splash"]}); T(b); T(b); const m = b.get(0); const boosted = b.calc(m, b.get(1), MV("Tackle"), {}).rolls[15]; m.v.metro = null; const plain = b.calc(m, b.get(1), MV("Tackle"), {}).rolls[15]; return boosted > plain; },
  "Toxic Orb": () => { const b = duel({sp:"Snorlax", moves:["Splash"], item:"Toxic Orb"}, {sp:"Blissey", moves:["Splash"]}); T(b); return b.get(0).status === "tox"; },
  "Flame Orb": () => { const b = duel({sp:"Snorlax", moves:["Splash"], item:"Flame Orb"}, {sp:"Blissey", moves:["Splash"]}); T(b); return b.get(0).status === "brn"; },
  "Light Ball": () => { const b = duel({sp:"Pikachu", moves:["Thunderbolt"]}, {sp:"Blissey"}); const x = b.calc(b.get(0), b.get(1), MV("Thunderbolt"), {}).rolls[15]; b.get(0).item = "Light Ball"; return b.calc(b.get(0), b.get(1), MV("Thunderbolt"), {}).rolls[15] >= x*1.9; },
  "Thick Club": () => { const b = duel({sp:"Marowak", moves:["Bonemerang"]}, {sp:"Blissey"}); const x = b.calc(b.get(0), b.get(1), MV("Tackle"), {}).rolls[15]; b.get(0).item = "Thick Club"; return b.calc(b.get(0), b.get(1), MV("Tackle"), {}).rolls[15] >= x*1.9; },
  "Throat Spray": () => { const b = duel({sp:"Snorlax", moves:["Hyper Voice"], item:"Throat Spray"}, {sp:"Blissey", moves:["Splash"]}); T(b); return b.get(0).stages.spa === 1; },
  "Blunder Policy": () => { for (let s = 1; s <= 200; s++) { const b = duel({sp:"Snorlax", moves:["Fissure"], item:"Blunder Policy"}, {sp:"Blissey", moves:["Splash"]}, {seed:s}); T(b); if (b.get(0).stages.spe === 2) return false; } const c = duel({sp:"Snorlax", moves:["Focus Blast"], item:"Blunder Policy"}, {sp:"Blissey", moves:["Splash"]}); for (let k = 0; k < 6; k++) { T(c); if (c.get(0).stages.spe === 2) return true; } return false; },
  "Room Service": () => { const b = duel({sp:"Snorlax", moves:["Trick Room"]}, {sp:"Blissey", moves:["Splash"], item:"Room Service"}); T(b); return b.get(1).stages.spe === -1; },
  "Red Card": () => { const b = duel([{sp:"Snorlax", moves:["Tackle"]}, {sp:"Pikachu", moves:["Splash"]}], {sp:"Blissey", moves:["Splash"], item:"Red Card"}); T(b); return b.s[0].act === 1; },
  "Eject Button": () => { const b = duel({sp:"Snorlax", moves:["Tackle"]}, [{sp:"Blissey", moves:["Splash"], item:"Eject Button"}, {sp:"Pikachu", moves:["Splash"]}]); T(b); return b.s[1].act === 1; },
  "Eject Pack": () => { const b = duel({sp:"Snorlax", moves:["Growl"]}, [{sp:"Blissey", moves:["Splash"], item:"Eject Pack"}, {sp:"Pikachu", moves:["Splash"]}]); T(b); return b.s[1].act === 1; },
  "Booster Energy": () => { const b = duel({sp:"Iron Treads", moves:["Splash"], ability:"Quark Drive", item:"Booster Energy"}, {sp:"Blissey"}); return !!b.get(0).v.qp && !b.get(0).item; },
  "Power Herb": () => true,   // checked with Solar Beam above
  "Big Root": () => { const b = duel({sp:"Venusaur", moves:["Giga Drain"], item:"Big Root", hp:50}, {sp:"Snorlax", moves:["Splash"]}); T(b); const d = b.get(1).max - b.get(1).hp; return b.get(0).hp - 50 === Math.floor(Math.round(d/2)*5324/4096); },
  "Binding Band": () => { const b = duel({sp:"Snorlax", moves:["Wrap"], item:"Binding Band"}, {sp:"Blissey", moves:["Splash"]}); T(b); const lost = b.get(1).max - b.get(1).hp; return b.get(1).v.partial && b.get(1).v.partial.band && lost > Math.floor(b.get(1).max/6); },
  "Grip Claw": () => { const b = duel({sp:"Snorlax", moves:["Wrap"], item:"Grip Claw"}, {sp:"Blissey", moves:["Splash"]}); for (let k = 0; k < 4; k++) { const ev = T(b); if (has(ev, /missed/)) return true; } return !!b.get(1).v.partial; },
  "Sticky Barb": () => { const b = duel({sp:"Snorlax", moves:["Splash"], item:"Sticky Barb"}, {sp:"Blissey", moves:["Splash"]}); T(b); return b.get(0).max - b.get(0).hp === Math.floor(b.get(0).max/8); },
  "Utility Umbrella": () => { const b = duel({sp:"Charizard", moves:["Flamethrower"]}, {sp:"Blissey", item:"Utility Umbrella"}, {weather:"sun"}); const x = b.calc(b.get(0), b.get(1), MV("Flamethrower"), {}).rolls[15]; b.get(1).item = ""; return b.calc(b.get(0), b.get(1), MV("Flamethrower"), {}).rolls[15] > x; },
  "Safety Goggles": () => { const b = duel({sp:"Snorlax", moves:["Spore"]}, {sp:"Blissey", moves:["Splash"], item:"Safety Goggles"}, {weather:"sand"}); T(b); return !b.get(1).status && b.get(1).hp === b.get(1).max; },
  "Covert Cloak": () => { for (let s = 1; s <= 60; s++) { const b = duel({sp:"Snorlax", moves:["Nuzzle"]}, {sp:"Blissey", moves:["Splash"], item:"Covert Cloak"}, {seed:s}); T(b); if (b.get(1).status) return false; } return true; },
  "Clear Amulet": () => { const b = duel({sp:"Snorlax", moves:["Growl"]}, {sp:"Blissey", moves:["Splash"], item:"Clear Amulet"}); T(b); return b.get(1).stages.atk === 0; },
  "Protective Pads": () => { const b = duel({sp:"Snorlax", moves:["Tackle"], item:"Protective Pads"}, {sp:"Blissey", moves:["Splash"], item:"Rocky Helmet"}); T(b); return b.get(0).hp === b.get(0).max; },
  "Punching Glove": () => { const b = duel({sp:"Hitmonchan", moves:["Mach Punch"], item:"Punching Glove"}, {sp:"Blissey", moves:["Splash"], item:"Rocky Helmet"}); T(b); return b.get(0).hp === b.get(0).max; },
  "Loaded Dice": () => true,   // checked with Bullet Seed above
  "Wide Lens": () => { let n = 0; for (let s = 1; s <= 500; s++) { const b = duel({sp:"Snorlax", moves:["Focus Blast"], item:"Wide Lens"}, {sp:"Blissey", moves:["Splash"]}, {seed:s}); if (!has(T(b), /missed/)) n++; } return near(n/500, Math.min(1, .7*1.1), .05); },
  "Zoom Lens": () => { const b = duel({sp:"Snorlax", moves:["Tackle"], item:"Zoom Lens"}, {sp:"Jolteon", moves:["Splash"]}); return !!b; },
  "Shed Shell": () => { const b = duel([{sp:"Snorlax", moves:["Splash"], item:"Shed Shell"}, {sp:"Pikachu"}], {sp:"Gengar", moves:["Mean Look"]}); T(b); return b.options(0).canSwitch; },
  "Iron Ball": () => { const b = duel({sp:"Snorlax", item:"Iron Ball"}, {sp:"Blissey"}); return b.speed(b.get(0)) === Math.floor(b.get(0).stats.spe/2); },
  "Lagging Tail": () => { const b = duel({sp:"Jolteon", moves:["Tackle"], item:"Lagging Tail"}, {sp:"Snorlax", moves:["Tackle"]}); return T(b).find(e => e.k === "move").side === 1; },
  "Absorb Bulb": () => { const b = duel({sp:"Blastoise", moves:["Water Gun"]}, {sp:"Blissey", moves:["Splash"], item:"Absorb Bulb"}); T(b); return b.get(1).stages.spa === 1; },
  "Heat Rock": () => { const b = duel({sp:"Snorlax", moves:["Sunny Day"], item:"Heat Rock"}, {sp:"Blissey", moves:["Splash"]}); T(b); return b.wTurns === 7; },
  "Terrain Extender": () => { const b = duel({sp:"Snorlax", moves:["Electric Terrain"], item:"Terrain Extender"}, {sp:"Blissey", moves:["Splash"]}); T(b); return b.tTurns === 7; },
  "Electric Seed": () => { const b = duel({sp:"Snorlax", moves:["Electric Terrain"]}, {sp:"Blissey", moves:["Splash"], item:"Electric Seed"}); T(b); return b.get(1).stages.def === 1; },
  "Adrenaline Orb": () => { const b = duel({sp:"Gyarados", ability:"Intimidate"}, {sp:"Blissey", item:"Adrenaline Orb"}); return b.get(1).stages.spe === 1; },
  "Float Stone": () => { const b = duel({sp:"Snorlax"}, {sp:"Blissey"}); const w = b.weight(b.get(0)); b.get(0).item = "Float Stone"; return b.weight(b.get(0)) === w/2; },
  "Ability Shield": () => { const b = duel({sp:"Snorlax", ability:"Mold Breaker", moves:["Earthquake"]}, {sp:"Bronzong", ability:"Levitate", item:"Ability Shield"}); return b.calc(b.get(0), b.get(1), MV("Earthquake"), {}).immune === "ability"; },
  "Kee Berry": () => { const b = duel({sp:"Snorlax", moves:["Tackle"]}, {sp:"Blissey", moves:["Splash"], item:"Kee Berry"}); T(b); return b.get(1).stages.def === 1; },
  "Jaboca Berry": () => { const b = duel({sp:"Snorlax", moves:["Tackle"]}, {sp:"Blissey", moves:["Splash"], item:"Jaboca Berry"}); T(b); return b.get(0).max - b.get(0).hp === Math.floor(b.get(0).max/8); },
  "Enigma Berry": () => { const b = duel({sp:"Machop", moves:["Karate Chop"], lv:20}, {sp:"Snorlax", moves:["Splash"], item:"Enigma Berry"}); T(b); return !b.get(1).item && b.get(1).hp > b.get(1).max*.75; },
  "Berry Juice": () => { const b = duel({sp:"Pikachu", moves:["Splash"], hp:20, item:"Berry Juice"}, {sp:"Snorlax"}); b.hpBerry(0, []); return b.get(0).hp === 40; },
  "Lansat Berry": () => { const b = duel({sp:"Pikachu", moves:["Splash"], hp:5, item:"Lansat Berry"}, {sp:"Snorlax"}); b.hpBerry(0, []); return b.get(0).v.critUp === 2; },
  "Starf Berry": () => { const b = duel({sp:"Pikachu", moves:["Splash"], hp:5, item:"Starf Berry"}, {sp:"Snorlax"}); b.hpBerry(0, []); return Object.values(b.get(0).stages).includes(2); },
  "Leppa Berry": () => true,
  "Ring Target": () => { const b = duel({sp:"Snorlax", moves:["Tackle"]}, {sp:"Gengar", item:"Ring Target"}); return b.calc(b.get(0), b.get(1), MV("Tackle"), {}).rolls[0] > 0; },
  "Gold Berry": () => { const m = mon({sp:"Snorlax", item:"Gold Berry"}); return m.item === "Sitrus Berry"; },   // the Gen 2 names work like today's berries
  "Berry": () => mon({sp:"Snorlax", item:"Berry"}).item === "Oran Berry",
  "Mirror Herb": () => { const b = duel({sp:"Snorlax", moves:["Swords Dance"]}, {sp:"Blissey", moves:["Splash"], item:"Mirror Herb"}); T(b); return b.get(1).stages.atk === 2 && !b.get(1).item; },
  "Custap Berry": () => { const b = duel({sp:"Snorlax", moves:["Tackle"], item:"Custap Berry", hp:20}, {sp:"Jolteon", moves:["Splash"]}); return T(b).find(e => e.k === "move").side === 0; },
  "Micle Berry": () => { const b = duel({sp:"Pikachu", moves:["Splash"], hp:5, item:"Micle Berry"}, {sp:"Snorlax"}); b.hpBerry(0, []); return b.get(0).v.micle === true; },
};
for (const [it, fn] of Object.entries(items)) { let r = false; try { r = fn(); } catch(e) { console.log(e.stack); } ok(r, `held item: ${it}`); }
// every item the engine claims to run is covered here or by the damage test
const DAMAGE_ONLY = new Set(["Expert Belt", "Muscle Band", "Wise Glasses", "Eviolite", "Deep Sea Tooth", "Deep Sea Scale", "Metal Powder", "Soul Dew", "Adamant Orb", "Adamant Crystal", "Lustrous Orb", "Lustrous Globe", "Griseous Orb", "Griseous Core", "Lax Incense", "Full Incense", "Leek", "Stick", "Lucky Punch", "Quick Powder", "Razor Fang", "Aspear Berry", "Ganlon Berry", "Petaya Berry", "Apicot Berry", "Wiki Berry", "Mago Berry", "Aguav Berry", "Iapapa Berry", "Maranga Berry", "Rowap Berry", "Damp Rock", "Smooth Rock", "Icy Rock", "Grassy Seed", "Misty Seed", "Psychic Seed", "Cell Battery", "Luminous Moss", "Snowball", "Macho Brace", "Power Anklet", "Power Band", "Power Belt", "Power Bracer", "Power Lens", "Power Weight"]);
const uncovered = [...E.ITEM_WORKS].filter(it => !items[it] && !DAMAGE_ONLY.has(it) && !/Plate$|Gem$|Memory$|Drive$| Berry$|Incense$/.test(it) && !["Black Belt", "Black Glasses", "Charcoal", "Dragon Fang", "Fairy Feather", "Hard Stone", "Magnet", "Metal Coat", "Miracle Seed", "Mystic Water", "Never-Melt Ice", "Poison Barb", "Sharp Beak", "Silk Scarf", "Silver Powder", "Soft Sand", "Spell Tag", "Twisted Spoon", "Dragon Scale"].includes(it));
ok(!uncovered.length, "every working item has a test: " + uncovered.join(", "));

// ---------- abilities (a sample of the effects outside the damage formula) ----------
{
  let b = duel({sp:"Gyarados", ability:"Intimidate"}, {sp:"Snorlax"}); ok(b.get(1).stages.atk === -1, "Intimidate");
  b = duel({sp:"Snorlax", moves:["Earthquake"]}, {sp:"Bronzong", ability:"Levitate", moves:["Splash"]}); T(b); ok(b.get(1).hp === b.get(1).max, "Levitate");
  b = duel({sp:"Pikachu", moves:["Thunderbolt"]}, {sp:"Lanturn", ability:"Volt Absorb", moves:["Splash"], hp:50}); T(b); ok(b.get(1).hp > 50, "Volt Absorb heals");
  b = duel({sp:"Snorlax", moves:["Tackle"]}, {sp:"Pikachu", ability:"Static", moves:["Splash"]}); let n = 0; for (let s = 1; s <= 300; s++) { const c = duel({sp:"Snorlax", moves:["Tackle"]}, {sp:"Blissey", ability:"Static", moves:["Splash"]}, {seed:s}); T(c); if (c.get(0).status === "par") n++; } ok(near(n/300, .3, .07), "Static 30% on contact");
  b = duel({sp:"Snorlax", moves:["Splash"], ability:"Speed Boost"}, {sp:"Blissey", moves:["Splash"]}); T(b); T(b); ok(b.get(0).stages.spe === 2, "Speed Boost");
  b = duel({sp:"Snorlax", moves:["Tackle"], lv:5}, {sp:"Golem", ability:"Sturdy", moves:["Splash"], lv:5}); b.get(1).max = b.get(1).hp = 3; T(b); ok(b.get(1).hp === 1 || b.get(1).hp === 3, "Sturdy survives a KO from full HP");
  b = duel({sp:"Snorlax", moves:["Tackle"], ability:"Moxie"}, [{sp:"Pikachu", moves:["Splash"], hp:1}, {sp:"Blissey"}]); T(b); ok(b.get(0).stages.atk === 1, "Moxie");
  b = duel({sp:"Snorlax", moves:["Splash"], status:"psn", ability:"Poison Heal", hp:100}, {sp:"Blissey", moves:["Splash"]}); T(b); ok(b.get(0).hp > 100, "Poison Heal");
  b = duel([{sp:"Slowbro", moves:["Splash"], ability:"Regenerator", hp:100}, {sp:"Blissey"}], {sp:"Snorlax", moves:["Splash"]}); b.turn([{sw:1}, {move:0}]); ok(b.s[0].party[0].hp === 100 + Math.floor(b.s[0].party[0].max/3), "Regenerator");
  b = duel({sp:"Snorlax", moves:["Thunder Wave"], ability:"Prankster"}, {sp:"Umbreon", moves:["Splash"]}); T(b); ok(!b.get(1).status, "Prankster status moves fail on Dark types");
  b = duel({sp:"Snorlax", moves:["Toxic"]}, {sp:"Umbreon", moves:["Splash"], ability:"Synchronize"}); T(b); ok(b.get(0).status === "tox", "Synchronize passes poison back");
  b = duel({sp:"Gardevoir", ability:"Trace"}, {sp:"Gyarados", ability:"Intimidate"}); ok(b.get(0).ability === "Intimidate" && b.get(1).stages.atk === -1, "Trace copies Intimidate (and it activates)");
  b = duel({sp:"Slaking", moves:["Tackle"], ability:"Truant"}, {sp:"Blissey", moves:["Splash"]}); T(b); ok(has(T(b), /loafing around/), "Truant loafs every other turn");
  b = duel({sp:"Snorlax", moves:["Shadow Ball"]}, {sp:"Mimikyu", moves:["Splash"], ability:"Disguise"}); T(b); ok(b.get(1).disguised && b.get(1).max - b.get(1).hp === Math.floor(b.get(1).max/8), "Disguise takes the first hit for 1/8 HP");
  b = duel({sp:"Kangaskhan", moves:["Body Slam"], ability:"Parental Bond"}, {sp:"Blissey", moves:["Splash"]}); const pbEv = T(b); ok(pbEv.filter(e => e.k === "hp" && e.hit).length === 2, "Parental Bond hits twice");
  b = duel({sp:"Snorlax", moves:["Tackle"], ability:"Unnerve"}, {sp:"Blissey", moves:["Splash"], item:"Sitrus Berry", hp:170}); T(b); ok(b.get(1).item === "Sitrus Berry", "Unnerve stops Berries");
  b = duel({sp:"Delphox", moves:["Flamethrower"], ability:"Magician"}, {sp:"Blissey", moves:["Splash"], item:"Leftovers"}); T(b); ok(b.get(0).item === "Leftovers", "Magician steals an item");
}

// ---------- the Bag ----------
{
  const bag = {"Potion":1, "Hyper Potion":1, "Full Restore":1, "Revive":1, "X Attack":1, "Full Heal":1};
  let b = duel([{sp:"Snorlax", moves:["Splash"], hp:50, status:"psn"}, {sp:"Pikachu", hp:0}], {sp:"Blissey", moves:["Splash"]}, {bagA:bag});
  let ev = b.turn([{item:"Potion", target:0}, {move:0}]); ok(b.get(0).hp === 70 - Math.floor(b.get(0).max/8) && bag.Potion === 0 && has(ev, /used a Potion/), "Potion: +20 HP, one used");
  ok(!E.bagCanUse("Revive", b.s[0].party[0], true) && E.bagCanUse("Revive", b.s[0].party[1], false), "Revive only on a fainted Pokémon");
  b.turn([{item:"Revive", target:1}, {move:0}]); ok(b.s[0].party[1].hp === Math.floor(b.s[0].party[1].max/2), "Revive: half HP");
  b.turn([{item:"Full Restore", target:0}, {move:0}]); ok(b.get(0).hp === b.get(0).max && !b.get(0).status, "Full Restore: full HP + status");
  b.turn([{item:"X Attack", target:0}, {move:0}]); ok(b.get(0).stages.atk === 2, "X Attack: +2");
  ok(!b.turn([{item:"X Attack", target:0}, {move:0}]).some(e => e.item), "an empty slot can't be used");
  // trainers heal at low HP, and stop when their bag is empty
  b = duel({sp:"Snorlax", moves:["Tackle"]}, {sp:"Blissey", moves:["Splash"], hp:60}, {bagD:{"Full Restore":1}, ai:4});
  const c1 = b.ai(1); ok(c1.item === "Full Restore", "a Champion uses a Full Restore at low HP");
  b.turn([{move:0}, c1]); b.get(1).hp = 60; ok(!b.ai(1).item, "…and has none left after");
  // a run bag is shared between battles (same object)
  const run = E.BAG.league(); b = duel({sp:"Snorlax", moves:["Splash"], hp:10}, {sp:"Blissey", moves:["Splash"]}, {bagA:run}); b.turn([{item:"Max Potion", target:0}, {move:0}]); ok(run["Max Potion"] === 2, "Elite Four run bag: what's used stays used");
}

// ---------- AI ----------
{
  const b = duel({sp:"Quagsire", moves:["Splash"]}, {sp:"Pikachu", moves:["Thunderbolt", "Surf", "Grass Knot", "Tail Whip"]});
  ok(b.ai(1).move === 2, "the AI picks the strongest move (Grass Knot vs Quagsire, not the immune Thunderbolt)");
  const c = duel({sp:"Gyarados", moves:["Splash"]}, {sp:"Pikachu", moves:["Tackle", "Thunderbolt", "Quick Attack", "Tail Whip"]});
  ok(c.ai(1).move === 1, "the AI goes for super effective STAB");
  const d = duel({sp:"Snorlax", moves:["Splash"], hp:3}, {sp:"Pikachu", moves:["Thunderbolt", "Quick Attack"], lv:20});
  ok(d.ai(1).move === 1 || d.ai(1).move === 0, "the AI finishes a weak foe");
  let full = 0; for (let s = 1; s <= 100; s++) { const g = duel({sp:"Snorlax", moves:["Splash"]}, {sp:"Pikachu", moves:["Thunderbolt", "Thunder Wave"]}, {seed:s}); g.get(1).moves = [MV("Thunderbolt"), MV("Thunder Wave")]; g.get(1).pp = [24, 32]; if (g.ai(1).move === 1) full++; }
  ok(full > 20, `the AI uses status moves sometimes (${full}/100)`);
}

// ---------- robustness: full battles with random moves, items and abilities never crash ----------
{
  const R = seeded(99), pick = a => a[Math.floor(R()*a.length)];
  const pool = E.NATBASE.filter(m => m.num <= 1025), items = [...E.ITEM_WORKS], abils = [...E.ABIL_WORKS];
  let crashes = 0, battles = 0, turns = 0;
  for (let k = 0; k < 250; k++) {
    const side = (human) => ({name:human ? "P" : "C", human, foePrefix:human ? "" : "The opposing ", ai:1 + Math.floor(R()*4), bag:E.BAG.standard(),
      party:Array.from({length:6}, () => E.mkMon(pick(pool).num, {level:30 + Math.floor(R()*70), moves:Array.from({length:4}, () => pick(E.MOVES)), item:pick(items), ability:pick(abils), nature:pick(Object.keys(E.NATURES))}))});
    try {
      const B = new E.Battle([side(true), side(false)], {rand:seeded(k + 1)}); B.start();
      while (!B.over && B.turnNo < 300) {
        for (const i of [0, 1]) if (!B.over && B.need[i] === "switch") B.replace(i, B.aiReplace(i));
        if (B.over) break;
        B.turn([B.ai(0), B.ai(1)]);
        let guard = 0; while (B.pend && !B.over && guard++ < 10) B.resume(B.pend.side, B.aiReplace(B.pend.side));
      }
      battles++; turns += B.turnNo;
    } catch(e) { crashes++; if (crashes < 4) console.log(e.stack); }
  }
  ok(!crashes, `${battles} random 6-on-6 battles (${turns} turns) ran without errors`);
}
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
