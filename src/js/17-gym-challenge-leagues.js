// ================= GYM CHALLENGE + LEAGUES =================
// [leader, types, signature ace]; teams are built from the ace + same-type Pokémon from that era
const LEAGUES = [
  {g:1, gyms:[["Brock","Rock",95],["Misty","Water",121],["Lt. Surge","Electric",26],["Erika","Grass",45],["Koga","Poison",110],["Sabrina","Psychic",65],["Blaine","Fire",59],["Giovanni","Ground",112]],
    e4:[["Lorelei","Ice/Water",131],["Bruno","Fighting/Rock",68],["Agatha","Ghost/Poison",94],["Lance","Dragon/Flying",149]], champ:["Blue",[18,65,112,130,59,3]]},
  {g:2, gyms:[["Falkner","Flying",17],["Bugsy","Bug",123],["Whitney","Normal",241],["Morty","Ghost",94],["Chuck","Fighting",62],["Jasmine","Steel",208],["Pryce","Ice",221],["Clair","Dragon",230]],
    e4:[["Will","Psychic",178],["Koga","Poison",169],["Bruno","Fighting",68],["Karen","Dark",229]], champ:["Lance",[130,149,6,142,148,149]]},
  {g:3, gyms:[["Roxanne","Rock",299],["Brawly","Fighting",297],["Wattson","Electric",310],["Flannery","Fire",324],["Norman","Normal",289],["Winona","Flying",334],["Tate & Liza","Psychic",338],["Wallace","Water",350]],
    e4:[["Sidney","Dark",359],["Phoebe","Ghost",356],["Glacia","Ice",365],["Drake","Dragon",373]], champ:["Steven",[227,344,306,346,348,376]]},
  {g:4, gyms:[["Roark","Rock",409],["Gardenia","Grass",407],["Maylene","Fighting",448],["Crasher Wake","Water",419],["Fantina","Ghost",429],["Byron","Steel",411],["Candice","Ice",478],["Volkner","Electric",405]],
    e4:[["Aaron","Bug",452],["Bertha","Ground",450],["Flint","Fire",392],["Lucian","Psychic",437]], champ:["Cynthia",[442,407,468,448,350,445]]},
  {g:5, gyms:[["Cilan","Grass",512],["Lenora","Normal",505],["Burgh","Bug",542],["Elesa","Electric",523],["Clay","Ground",530],["Skyla","Flying",581],["Brycen","Ice",614],["Drayden","Dragon",612]],
    e4:[["Shauntal","Ghost",609],["Grimsley","Dark",625],["Caitlin","Psychic",576],["Marshal","Fighting",534]], champ:["Iris",[635,621,306,567,131,612]]},
  {g:6, gyms:[["Viola","Bug",666],["Grant","Rock",697],["Korrina","Fighting",448],["Ramos","Grass",673],["Clemont","Electric",695],["Valerie","Fairy",700],["Olympia","Psychic",678],["Wulfric","Ice",713]],
    e4:[["Malva","Fire",663],["Siebold","Water",689],["Wikstrom","Steel",681],["Drasna","Dragon",715]], champ:["Diantha",[701,697,699,711,706,282]]},
  {g:7, label:"Island challenge", badge:"stamp", gyms:[["Ilima","Normal",735],["Lana","Water",752],["Kiawe","Fire",758],["Mallow","Grass",763],["Sophocles","Electric",777],["Acerola","Ghost",778],["Mina","Fairy",743],["Nanu","Dark",553]],
    e4:[["Hala","Fighting",740],["Olivia","Rock",745],["Molayne","Steel",376],["Kahili","Flying",733]], champ:["Hau",[26,128,715,740,134,730]]},
  {g:8, gyms:[["Milo","Grass",830],["Nessa","Water",834],["Kabu","Fire",851],["Bea","Fighting",68],["Opal","Fairy",869],["Gordie","Rock",839],["Piers","Dark",862],["Raihan","Dragon",884]],
    e4:[["Marnie","Dark",861],["Hop","Normal",832],["Bede","Fairy",858],["Allister","Ghost",94]], e4label:"Champion Cup", champ:["Leon",[681,887,612,537,464,6]]},
  {g:9, gyms:[["Katy","Bug",920],["Brassius","Grass",185],["Iono","Electric",939],["Kofu","Water",740],["Larry","Normal",982],["Ryme","Ghost",849],["Tulip","Psychic",671],["Grusha","Ice",334]],
    e4:[["Rika","Ground",980],["Poppy","Steel",959],["Larry","Flying",973],["Hassel","Dragon",998]], champ:["Geeta",[956,673,976,713,983,970]]},
];
const GYM_SIZE = [2, 3, 3, 4, 4, 5, 5, 6], GYM_LV = [36, 38, 40, 42, 44, 46, 48, 50];
function leagueTeam(g, name, types, ace, size, seed){
  const T = types.split("/"), R = rng(seed);
  const pool = NATBASE.filter(m => GEN_OF[m.num] <= g && m.num !== ace && !isLegend(m.num) && m.types.some(t => T.includes(t)));
  const ranked = pool.sort((a, b) => bst(a) - bst(b));
  const need = size - 1, out = [];
  if (ranked.length) {
    const q = Math.min(.92, .25 + size*.11), centre = Math.floor(q*(ranked.length - 1));
    const band = ranked.slice(Math.max(0, centre - 10), centre + 10).filter(m => size < 4 || isFE(m.num));
    const src = band.length >= need ? band : ranked;
    const pick = [...src].sort(() => R() - .5);
    for (const m of pick) { if (out.length >= need) break; if (!out.includes(m.num)) out.push(m.num); }
  }
  return [...out, ace];
}
const badgeOf = g => state.games.badges[g] | 0;
const hasBadge = (g, k) => !!(badgeOf(g) & (1 << k));
const badgeCount = g => { let c = 0; for (let k = 0; k < 8; k++) if (hasBadge(g, k)) c++; return c; };
const totalBadges = () => GENS.reduce((s, g) => s + badgeCount(g.g), 0);
const leaguesCleared = () => Object.keys(state.games.leagues).length;

