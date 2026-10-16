// Loads src/engine.js in Node with the same data the app uses (data/*.json, packs/learnsets.json).
// Used by tests/test_damage.mjs and tests/test_engine.mjs.  `npm install` first.
import {readFileSync} from "node:fs";
import vm from "node:vm";

const ROOT = new URL("..", import.meta.url).pathname;
const J = f => JSON.parse(readFileSync(ROOT + f, "utf8"));

export function loadEngine(){
  const DATA = J("data/data.json"), FORMDATA = J("data/forms.json"), FE = J("data/fe.json"), MV = J("data/moves_data.json"), LSDATA = J("packs/learnsets.json");
  const mk = ([num, name, ty, st]) => ({num, name, types:ty.split("/"), stats:st.split(",").map(Number)});
  const NATBASE = DATA.all.map(mk); NATBASE.forEach((m, i) => { m.fe = !!FE[i]; });
  const FORMS = FORMDATA.map(([num, base, name, ty, st, , gen, kind, , fe]) => ({num, base, name, types:ty.split("/"), stats:st.split(",").map(Number), gen, form:kind, fe:!!fe}));
  const FORM_BY = new Map(FORMS.map(f => [f.num, f]));
  const NAT_BY = new Map([...NATBASE, ...FORMS].map(m => [m.num, m]));
  const FE_SET = new Set(NATBASE.filter(m => m.fe).map(m => m.num));
  const MOVES = MV.MOVES, MOVE_BY = new Map(MOVES.map(m => [m[0], m]));
  const baseOf = n => n > 1025 ? (FORM_BY.get(n) || {base:n}).base : n;
  const ctx = {
    console, Math, Map, Set, Array, Object, Number, String, JSON,
    GENS: DATA.gens, MOVES, MOVE_BY, NAT_BY, ITEMS: MV.ITEMS, LSDATA,
    learnset: n => (LSDATA.LS[String(n)] || LSDATA.LS[String(baseOf(n))] || []).map(i => MOVES[i]).filter(Boolean),
    abilitiesOf: n => LSDATA.AB[String(n)] || LSDATA.AB[String(baseOf(n))] || [],
    isFE: n => n > 1025 ? !!(FORM_BY.get(n) || {}).fe : FE_SET.has(n),
    baseOf,
    isMega: n => n > 1025 && /^(Mega|Primal)$/.test((FORM_BY.get(n) || {}).form || ""),
    weightOf: n => LSDATA.WT[String(n)] ?? LSDATA.WT[String(baseOf(n))] ?? 50,
  };
  vm.createContext(ctx);
  const src = readFileSync(ROOT + "src/engine.js", "utf8");
  // top-level const/class declarations stay inside the script scope, so hand back the ones the tests need
  vm.runInContext(src + "\n;globalThis.__E = {Battle, mkMon, calcStats, NATURES, BAG_ITEMS, BAG, bagCanUse, effOf, ITEM_WORKS, ABIL_WORKS, STRUGGLE, maxPP, setLevel, cleanEVs, cleanIVs, moveHint, isDmg};", ctx);
  return {...ctx.__E, ctx, NAT_BY, MOVE_BY, MOVES, NATBASE, ITEMS: MV.ITEMS};
}
// a seeded random number generator (mulberry32), so failures can be reproduced
export function seeded(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; }; }
