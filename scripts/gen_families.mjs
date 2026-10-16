// Build data/families.json: for every Pokémon in an evolution family, the National Dex number of the family's first
// stage (Pikachu, Raichu -> 172 Pichu). Pokémon that don't evolve are left out. Used by the Home ("play together").
//   node scripts/gen_families.mjs
import {Dex} from "@pkmn/dex";
import {writeFileSync} from "node:fs";
const out = {};
for (const s of Dex.species.all()) {
  if (!s.exists || s.num < 1 || s.num > 1025 || s.forme) continue;
  let r = s; for (let i = 0; i < 4 && r.prevo; i++) r = Dex.species.get(r.prevo);
  if (r.num !== s.num || (s.evos && s.evos.length)) out[s.num] = r.num;
}
writeFileSync(new URL("../data/families.json", import.meta.url), JSON.stringify(out));
console.log(Object.keys(out).length, "Pokémon in evolution families");
