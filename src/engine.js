// ================= BATTLE ENGINE (Gen 9 rules: stats, damage, status, held items, abilities, weather, terrain) =================
// Pure game logic, no DOM. The build inlines this file into src/app.html at /*ENGINE*/; tests/test_damage.mjs loads it in Node.
// It uses these app globals: MOVES, MOVE_BY, NAT_BY, GENS, ITEMS, learnset, abilitiesOf, isFE, baseOf, isMega, weightOf.
// Damage follows the official formula with 4096-based modifiers in the official order (as in @smogon/calc's gen789.js).

// ---- numbers ----
const STATS6 = ["hp", "atk", "def", "spa", "spd", "spe"];
const STAT_NAME = {hp:"HP", atk:"Attack", def:"Defense", spa:"Sp. Atk", spd:"Sp. Def", spe:"Speed", acc:"accuracy", eva:"evasiveness"};
const NATURES = {Hardy:[], Lonely:["atk", "def"], Brave:["atk", "spe"], Adamant:["atk", "spa"], Naughty:["atk", "spd"],
  Bold:["def", "atk"], Docile:[], Relaxed:["def", "spe"], Impish:["def", "spa"], Lax:["def", "spd"],
  Timid:["spe", "atk"], Hasty:["spe", "def"], Serious:[], Jolly:["spe", "spa"], Naive:["spe", "spd"],
  Modest:["spa", "atk"], Mild:["spa", "def"], Quiet:["spa", "spe"], Bashful:[], Rash:["spa", "spd"],
  Calm:["spd", "atk"], Gentle:["spd", "def"], Sassy:["spd", "spe"], Careful:["spd", "spa"], Quirky:[]};
const NATURE_NAMES = Object.keys(NATURES);
const EV_MAX = 252, EV_TOTAL = 510, IV_MAX = 31;
const pokeRound = x => x % 1 > 0.5 ? Math.ceil(x) : Math.floor(x);
const OF16 = x => x > 65535 ? x % 65536 : x, OF32 = x => x > 4294967295 ? x % 4294967296 : x;
const chainMods = (mods, lo, hi) => { let M = 4096; for (const m of mods) if (m !== 4096) M = (M*m + 2048) >> 12; return Math.max(Math.min(M, hi), lo); };
const BOOST_T = [[2, 8], [2, 7], [2, 6], [2, 5], [2, 4], [2, 3], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2]];
const modStat = (v, b) => Math.floor(OF16(v*BOOST_T[6 + b][0])/BOOST_T[6 + b][1]);
const ACC_T = [1, 4/3, 5/3, 2, 7/3, 8/3, 3];
const baseDamage = (L, bp, a, d) => Math.floor(OF32(Math.floor(OF32(OF32(Math.floor(2*L/5 + 2)*bp)*a)/d)/50 + 2));
function finalDamage(base, i, eff, burn, stab, fmod){
  let d = Math.floor(OF32(base*(85 + i))/100);
  if (stab !== 4096) d = OF32(d*stab)/4096;
  d = Math.floor(OF32(pokeRound(d)*eff));
  if (burn) d = Math.floor(d/2);
  return OF16(pokeRound(Math.max(1, OF32(d*fmod)/4096)));
}
const statFull = (o, def) => { const r = {}; for (const k of STATS6) { const v = o && Number.isInteger(o[k]) ? o[k] : def; r[k] = v; } return r; };
// HP = ⌊(2·Base + IV + ⌊EV/4⌋)·Lv/100⌋ + Lv + 10; others = ⌊(⌊(2·Base + IV + ⌊EV/4⌋)·Lv/100⌋ + 5)·Nature⌋; Shedinja has 1 HP
function calcStats(base, L, nature, evs, ivs, shedinja){
  const nat = NATURES[nature] || [], out = {};
  STATS6.forEach((k, i) => {
    const core = Math.floor((2*base[i] + ivs[k] + Math.floor(evs[k]/4))*L/100);
    if (k === "hp") { out.hp = shedinja ? 1 : core + L + 10; return; }
    let v = core + 5; if (nat[0] === k) v = Math.floor(v*110/100); else if (nat[1] === k) v = Math.floor(v*90/100);
    out[k] = v;
  });
  return out;
}
const cleanEVs = o => { const r = {}; let tot = 0; if (o && typeof o === "object") for (const k of STATS6) { let v = Number.isInteger(o[k]) ? Math.max(0, Math.min(EV_MAX, o[k])) : 0; v = Math.min(v, EV_TOTAL - tot); if (v) { r[k] = v; tot += v; } } return r; };
const cleanIVs = o => { const r = {}; if (o && typeof o === "object") for (const k of STATS6) if (Number.isInteger(o[k]) && o[k] >= 0 && o[k] < IV_MAX) r[k] = o[k]; return r; };

// ---- types ----
const CHART9 = GENS[8].chart;
const effOf = (type, defTypes) => defTypes.reduce((x, d) => { const r = (CHART9[d] || {})[type]; return x*(r === undefined ? 1 : r); }, 1);
const STRUGGLE = ["Struggle", "???", "P", 50, 0, 1, 0, "c", {sr:1}];
const fl = (mv, c) => !!mv && (mv[7] || "").includes(c);
const fxOf = mv => (mv && mv[8]) || {};
const isDmg = mv => !!mv && mv[2] !== "X";
const catName = mv => !isDmg(mv) ? "Status" : mv[2] === "P" ? "Physical" : "Special";
// items: type boosters + Plates (1.2x), resist berries, Natural Gift etc. come straight from the item text
const ITEM_TYPE = {}, RESIST_BERRY = {}, ITEM_INFO = new Map();
for (const it of ITEMS) {
  ITEM_INFO.set(it[0], it);
  let m = it[1].match(/^Holder's (\w+)-type attacks have 1\.2x power/); if (m) ITEM_TYPE[it[0]] = m[1];
  m = it[1].match(/Halves damage taken from a supereffective (\w+)-type attack/); if (m) RESIST_BERRY[it[0]] = m[1];
}
RESIST_BERRY["Chilan Berry"] = "Normal";
const PLATE_TYPE = {}, MEMORY_TYPE = {}, DRIVE_TYPE = {"Burn Drive":"Fire", "Chill Drive":"Ice", "Douse Drive":"Water", "Shock Drive":"Electric"};
for (const it of ITEMS) { if (it[2] === "plate") PLATE_TYPE[it[0]] = ITEM_TYPE[it[0]]; if (it[2] === "memory") { const m = it[1].match(/(\w+) type/); if (m) MEMORY_TYPE[it[0]] = m[1]; } }
const GEMS = {}; for (const it of ITEMS) if (it[2] === "gem") GEMS[it[0]] = it[0].replace(" Gem", "");

// ---- abilities this engine runs (everything else is shown as "No battle effect here") ----
const ABIL_WORKS = new Set(["Adaptability","Aerilate","Aftermath","Air Lock","Analytic","Anger Point","Anger Shell","Armor Tail","Battle Armor","Beads of Ruin","Beast Boost","Berserk","Big Pecks","Blaze","Bulletproof","Chilling Neigh","Chlorophyll","Clear Body","Cloud Nine","Competitive","Compound Eyes","Contrary","Corrosion","Cotton Down","Dauntless Shield","Dazzling","Defeatist","Defiant","Download","Dragon's Maw","Dragonize","Drizzle","Drought","Dry Skin","Early Bird","Earth Eater","Effect Spore","Electric Surge","Electromorphosis","Filter","Flame Body","Flare Boost","Flash Fire","Fluffy","Full Metal Body","Fur Coat","Gale Wings","Galvanize","Gooey","Gorilla Tactics","Grassy Surge","Grim Neigh","Guts","Hadron Engine","Heatproof","Huge Power","Hustle","Hydration","Hyper Cutter","Ice Body","Ice Scales","Immunity","Inner Focus","Insomnia","Intimidate","Intrepid Sword","Iron Barbs","Iron Fist","Justified","Keen Eye","Leaf Guard","Levitate","Libero","Lightning Rod","Limber","Liquid Ooze","Liquid Voice","Magic Bounce","Magic Guard","Magma Armor","Marvel Scale","Mega Launcher","Merciless","Mind's Eye","Misty Surge","Mold Breaker","Motor Drive","Moxie","Multiscale","Natural Cure","Neuroforce","No Guard","Normalize","Oblivious","Orichalcum Pulse","Overcoat","Overgrow","Own Tempo","Pastel Veil","Pixilate","Poison Heal","Poison Point","Poison Touch","Prankster","Pressure","Prism Armor","Protean","Protosynthesis","Psychic Surge","Punk Rock","Pure Power","Purifying Salt","Quark Drive","Queenly Majesty","Quick Feet","Rain Dish","Rattled","Reckless","Refrigerate","Regenerator","Ripen","Rock Head","Rocky Payload","Rough Skin","Sand Force","Sand Rush","Sand Spit","Sand Stream","Sand Veil","Sap Sipper","Scrappy","Serene Grace","Shadow Shield","Sharpness","Shed Skin","Sheer Force","Shell Armor","Shield Dust","Simple","Skill Link","Slow Start","Slush Rush","Sniper","Snow Cloak","Snow Warning","Solar Power","Solid Rock","Soundproof","Speed Boost","Stamina","Static","Steadfast","Steam Engine","Steelworker","Steely Spirit","Storm Drain","Strong Jaw","Sturdy","Super Luck","Supreme Overlord","Swarm","Sweet Veil","Swift Swim","Sword of Ruin","Tablets of Ruin","Tangling Hair","Technician","Teravolt","Thermal Exchange","Thick Fat","Tinted Lens","Torrent","Tough Claws","Toxic Boost","Transistor","Triage","Turboblaze","Unaware","Unburden","Vessel of Ruin","Vital Spirit","Volt Absorb","Water Absorb","Water Bubble","Water Compaction","Water Veil","Weak Armor","Well-Baked Body","White Smoke","Wind Rider","Wonder Guard","Comatose","Fire Mane","Seed Sower","Aura Break","Fairy Aura","Dark Aura","Heavy Metal","Light Metal","Gluttony","Infiltrator","Long Reach","Arena Trap","Shadow Tag","Magnet Pull","Suction Cups","Sticky Hold","Unseen Fist","Bad Dreams","Stall","Grass Pelt","Synchronize","Trace","Unnerve","Moody","Truant","Disguise","Mummy","Lingering Aroma","Wandering Spirit","Magician","Pickpocket","Cheek Pouch","Harvest","Toxic Debris","Innards Out","Color Change","Good as Gold","Quick Draw","Screen Cleaner","Stench","Toxic Chain","Supersweet Syrup","Guard Dog","Parental Bond","Wimp Out","Emergency Exit","Propeller Tail","Stalwart","Run Away","Pickup","Honey Gather","Ball Fetch","Illuminate","Telepathy","Friend Guard","Healer","Battery","Power Spot","Plus","Minus","Symbiosis","Receiver","Power of Alchemy","Frisk","Anticipation","Forewarn"]);
// abilities a Mold Breaker attacker ignores
const BREAKABLE = new Set(["Armor Tail","Battle Armor","Big Pecks","Bulletproof","Clear Body","Contrary","Dazzling","Dry Skin","Earth Eater","Filter","Flash Fire","Fluffy","Full Metal Body","Fur Coat","Heatproof","Hyper Cutter","Ice Scales","Immunity","Inner Focus","Insomnia","Keen Eye","Leaf Guard","Levitate","Lightning Rod","Limber","Magic Bounce","Magma Armor","Marvel Scale","Mind's Eye","Motor Drive","Multiscale","Oblivious","Overcoat","Own Tempo","Pastel Veil","Punk Rock","Purifying Salt","Queenly Majesty","Sand Veil","Sap Sipper","Shell Armor","Shield Dust","Simple","Snow Cloak","Solid Rock","Soundproof","Storm Drain","Sturdy","Sweet Veil","Thermal Exchange","Thick Fat","Unaware","Vital Spirit","Volt Absorb","Water Absorb","Water Bubble","Water Veil","Well-Baked Body","White Smoke","Wind Rider","Wonder Guard"]);
const ATE = {Pixilate:"Fairy", Aerilate:"Flying", Refrigerate:"Ice", Galvanize:"Electric", Dragonize:"Dragon"};
const PINCH = {Blaze:"Fire", Torrent:"Water", Overgrow:"Grass", Swarm:"Bug"};
const WEATHER_ABIL = {Drought:"sun", Drizzle:"rain", "Sand Stream":"sand", "Snow Warning":"snow", "Orichalcum Pulse":"sun"};
const TERRAIN_ABIL = {"Electric Surge":"electric", "Grassy Surge":"grassy", "Misty Surge":"misty", "Psychic Surge":"psychic", "Hadron Engine":"electric", "Seed Sower":null};
const WEATHER_ROCK = {sun:"Heat Rock", rain:"Damp Rock", sand:"Smooth Rock", snow:"Icy Rock"};
const WEATHER_TXT = {sun:["The sunlight turned harsh!", "The harsh sunlight faded."], rain:["It started to rain!", "The rain stopped."], sand:["A sandstorm kicked up!", "The sandstorm subsided."], snow:["It started to snow!", "The snow stopped."]};
const TERRAIN_TXT = {electric:["An electric current ran across the battlefield!", "The electricity disappeared from the battlefield."], grassy:["Grass grew to cover the battlefield!", "The grass disappeared from the battlefield."], misty:["Mist swirled around the battlefield!", "The mist disappeared from the battlefield."], psychic:["The battlefield got weird!", "The weirdness disappeared from the battlefield."]};
const ABSORB = {"Volt Absorb":["Electric", "heal"], "Water Absorb":["Water", "heal"], "Dry Skin":["Water", "heal"], "Earth Eater":["Ground", "heal"], "Lightning Rod":["Electric", "spa"], "Storm Drain":["Water", "spa"], "Motor Drive":["Electric", "spe"], "Sap Sipper":["Grass", "atk"], "Flash Fire":["Fire", "flash"], "Well-Baked Body":["Fire", "def2"], "Levitate":["Ground", ""]};

// ---- held items this engine runs (the item picker labels the rest "No battle effect here") ----
const ITEM_WORKS = new Set(["Leftovers","Black Sludge","Life Orb","Choice Band","Choice Specs","Choice Scarf","Assault Vest","Eviolite","Focus Sash","Focus Band","Expert Belt","Muscle Band","Wise Glasses","Rocky Helmet","Air Balloon","Heavy-Duty Boots","Sitrus Berry","Oran Berry","Lum Berry","Chesto Berry","Persim Berry","Cheri Berry","Pecha Berry","Rawst Berry","Aspear Berry","Leppa Berry","Figy Berry","Wiki Berry","Mago Berry","Aguav Berry","Iapapa Berry","Liechi Berry","Ganlon Berry","Salac Berry","Petaya Berry","Apicot Berry","Lansat Berry","Starf Berry","Enigma Berry","Kee Berry","Maranga Berry","Jaboca Berry","Rowap Berry","Berry Juice","Weakness Policy","White Herb","Mental Herb","Power Herb","Light Clay","Shell Bell","Scope Lens","Razor Claw","King's Rock","Razor Fang","Bright Powder","Lax Incense","Quick Claw","Metronome","Toxic Orb","Flame Orb","Light Ball","Thick Club","Leek","Stick","Lucky Punch","Deep Sea Tooth","Deep Sea Scale","Metal Powder","Quick Powder","Soul Dew","Adamant Orb","Adamant Crystal","Lustrous Orb","Lustrous Globe","Griseous Orb","Griseous Core","Heat Rock","Damp Rock","Smooth Rock","Icy Rock","Terrain Extender","Utility Umbrella","Safety Goggles","Covert Cloak","Clear Amulet","Protective Pads","Punching Glove","Loaded Dice","Big Root","Wide Lens","Zoom Lens","Blunder Policy","Throat Spray","Room Service","Booster Energy","Adrenaline Orb","Absorb Bulb","Cell Battery","Luminous Moss","Snowball","Binding Band","Grip Claw","Iron Ball","Lagging Tail","Full Incense","Sticky Barb","Shed Shell","Red Card","Eject Button","Eject Pack","Float Stone","Ability Shield","Macho Brace","Power Anklet","Power Band","Power Belt","Power Bracer","Power Lens","Power Weight","Electric Seed","Grassy Seed","Misty Seed","Psychic Seed","Ring Target","Custap Berry","Micle Berry","Mirror Herb"]);
for (const it of ITEMS) if (ITEM_TYPE[it[0]] || RESIST_BERRY[it[0]] || GEMS[it[0]] || MEMORY_TYPE[it[0]] || DRIVE_TYPE[it[0]]) ITEM_WORKS.add(it[0]);
const EV_ITEMS = new Set(["Macho Brace","Power Anklet","Power Band","Power Belt","Power Bracer","Power Lens","Power Weight"]);
const STATUS_BERRY = {"Lum Berry":"all", "Cheri Berry":"par", "Chesto Berry":"slp", "Rawst Berry":"brn", "Pecha Berry":"psn", "Aspear Berry":"frz"};
const PINCH_BERRY = {"Liechi Berry":"atk", "Ganlon Berry":"def", "Salac Berry":"spe", "Petaya Berry":"spa", "Apicot Berry":"spd"};
const FLAVOR_BERRY = {"Figy Berry":"atk", "Wiki Berry":"spa", "Mago Berry":"spe", "Aguav Berry":"spd", "Iapapa Berry":"def"};
// Gen 2 names of today's berries work like them (they're the same berries)
const GEN2_BERRY = {"Berry":"Oran Berry", "Gold Berry":"Sitrus Berry", "PRZ Cure Berry":"Cheri Berry", "PSN Cure Berry":"Pecha Berry", "Burnt Berry":"Rawst Berry", "Ice Berry":"Aspear Berry", "Mint Berry":"Chesto Berry", "Bitter Berry":"Persim Berry", "Miracle Berry":"Lum Berry", "Mystery Berry":"Leppa Berry"};
for (const k of Object.keys(GEN2_BERRY)) ITEM_WORKS.add(k);
const itemWorks = name => !name || ITEM_WORKS.has(name);

// ---- moves with special handling ----
const PROTECTS = new Set(["protect", "kingsshield", "spikyshield", "banefulbunker", "silktrap", "obstruct", "burningbulwark"]);
const SEMI = {Fly:"sky", Bounce:"sky", "Sky Drop":"sky", Dig:"under", Dive:"water", "Phantom Force":"gone", "Shadow Force":"gone"};
const HITS_SEMI = {sky:["Thunder", "Hurricane", "Gust", "Twister", "Sky Uppercut", "Smack Down", "Thousand Arrows"], under:["Earthquake", "Magnitude", "Fissure"], water:["Surf", "Whirlpool"], gone:[]};
const CHARGE_TXT = {"Solar Beam":"absorbed light!", "Solar Blade":"absorbed light!", Fly:"flew up high!", Bounce:"sprang up!", Dig:"burrowed its way under the ground!", Dive:"hid underwater!", "Phantom Force":"vanished instantly!", "Shadow Force":"vanished instantly!", "Sky Attack":"became cloaked in a harsh light!", "Skull Bash":"tucked in its head!", "Razor Wind":"whipped up a whirlwind!", "Freeze Shock":"became cloaked in a freezing light!", "Ice Burn":"became cloaked in freezing air!", "Meteor Beam":"is overflowing with space power!", "Electro Shot":"absorbed electricity!", Geomancy:"is absorbing power!", "Sky Drop":"flew up high!"};
const TRAP_MOVES = new Set(["Mean Look", "Block", "Spider Web", "Jaw Lock", "Anchor Shot", "Spirit Shackle", "Thousand Waves"]);
// moves this engine doesn't run (they say so in battle and in the move picker)
const NO_EFFECT_MOVES = new Set(["Bide","Snatch","Imprison","Grudge","Telekinesis","Magic Room","Wonder Room","Ion Deluge","Electrify","Powder","Attract","Captivate","Embargo","Transform","Mimic","Sketch","Me First","Assist","Conversion 2","Natural Gift","Instruct","Quash","Rage","Uproar","Pursuit","Beat Up"]);
// moves that only work with a partner, so they fail in a one-on-one battle (as in the games)
const DOUBLES_ONLY = new Set(["After You","Ally Switch","Aromatic Mist","Coaching","Dragon Cheer","Follow Me","Helping Hand","Hold Hands","Rage Powder","Spotlight","Decorate","Wide Guard"]);

// what a move does, in a few words (battle menu, move picker)
const ST_TAG = {brn:"BRN", par:"PAR", psn:"PSN", tox:"PSN", slp:"SLP", frz:"FRZ"};
const ST_GOT = {brn:"was burned!", par:"is paralyzed! It may be unable to move!", psn:"was poisoned!", tox:"was badly poisoned!", slp:"fell asleep!", frz:"was frozen solid!"};
const ST_HINT = {brn:"Burns", par:"Paralyzes", psn:"Poisons", tox:"Badly poisons", slp:"Puts to sleep", frz:"Freezes", tri:"May burn, paralyze or freeze"};
function moveHint(mv){
  if (!mv) return "";
  const fx = fxOf(mv), nm = mv[0];
  if (isDmg(mv)) return "";
  if (fx.st) return ST_HINT[fx.st];
  if (fx.v && PROTECTS.has(fx.v)) return "Protects";
  if (fx.h || ["Synthesis","Moonlight","Morning Sun","Shore Up","Rest","Wish","Strength Sap","Pain Split"].includes(nm)) return "Heals";
  if (fx.w) return "Changes weather"; if (fx.ter) return "Sets terrain";
  if (fx.sc === "reflect" || fx.sc === "lightscreen" || fx.sc === "auroraveil") return "Raises defenses";
  if (["stealthrock", "spikes", "toxicspikes", "stickyweb"].includes(fx.sc)) return "Sets a trap";
  if (fx.b && fx.t === "self") return "Boosts stats";
  if (fx.b) return Object.values(fx.b).some(v => v > 0) ? "Changes stats" : "Lowers foe’s stats";
  if (fx.v === "confusion") return "Confuses";
  if (fx.v === "substitute") return "Makes a decoy";
  if (fx.v === "leechseed") return "Drains HP each turn";
  if (fx.v === "taunt") return "Blocks status moves";
  if (fx.v === "yawn") return "Makes it drowsy";
  if (fx.ss || fx.fs) return "Switches";
  if (NO_EFFECT_MOVES.has(nm)) return "No effect here";
  if (DOUBLES_ONLY.has(nm)) return "Needs a partner";
  return "";
}
const moveWorks = mv => !!mv && !NO_EFFECT_MOVES.has(mv[0]) && !DOUBLES_ONLY.has(mv[0]);

// ---- building a battler ----
function autoMoves(n, types, setup = true, rnd = Math.random){
  const m = NAT_BY.get(n), phys = m.stats[1] >= m.stats[3];
  const ok = mv => isDmg(mv) && mv[3] > 0 && mv[3] <= 130 && mv[4] !== 30 && !fl(mv, "2") && !fl(mv, "r") && !fxOf(mv).sd && !fxOf(mv).ohko && !NO_EFFECT_MOVES.has(mv[0]) && !["Focus Punch","Dream Eater","Last Resort","Tera Blast","Tera Starstorm","Natural Gift","Fling","Spit Up","Steel Roller","Burn Up","Double Shock","Shell Trap","Belch","Fake Out","First Impression","Sucker Punch","Thunderclap","Snore","Hold Back","False Swipe","Synchronoise","Poltergeist","Outrage","Petal Dance","Thrash","Raging Fury","Mind Blown","Steel Beam","Chloroblast","Head Smash","Explosion","Self-Destruct","Misty Explosion","Hyper Beam","Giga Impact"].includes(mv[0]);
  let ls = learnset(n).filter(ok);
  if (!ls.length) ls = MOVES.filter(mv => ok(mv) && types.includes(mv[1]) && mv[3] >= 60 && mv[3] <= 90);
  const hits = mv => { const h = fxOf(mv).mh; return Array.isArray(h) ? 3 : h || 1; };
  const score = mv => mv[3]*hits(mv)*(mv[4] > 0 ? mv[4] : 100)/100*(types.includes(mv[1]) ? 1.5 : 1)*((mv[2] === "P") === phys ? 1.2 : .75)*(fxOf(mv).r || fxOf(mv).sb && Object.values(fxOf(mv).sb).some(v => v < 0) ? .9 : 1);
  const out = [], seen = new Set();
  for (const mv of [...ls].sort((a, b) => score(b) - score(a))) { if (seen.has(mv[1])) continue; seen.add(mv[1]); out.push(mv); if (out.length === 4) break; }
  if (setup && out.length >= 3) {
    const can = new Set(learnset(n).map(x => x[0]));
    const pick = (phys ? ["Swords Dance", "Dragon Dance", "Bulk Up", "Shell Smash"] : ["Nasty Plot", "Quiver Dance", "Calm Mind", "Shell Smash"]).find(w => can.has(w));
    if (pick && rnd() < .5) out[3] = MOVE_BY.get(pick);
    else if (rnd() < .3) { const st = ["Spore", "Will-O-Wisp", "Thunder Wave", "Toxic", "Sleep Powder", "Glare", "Hypnosis", "Stun Spore", "Stealth Rock"].find(w => can.has(w)); if (st) out[3] = MOVE_BY.get(st); }
  }
  return out.length ? out : [MOVE_BY.get("Tackle")];
}
const maxPP = mv => mv === STRUGGLE ? 1 : Math.floor((mv[5] || 5)*8/5);
const defaultAbility = n => { const l = abilitiesOf(n); return l.find(a => ABIL_WORKS.has(a)) || l[0] || ""; };
// o: {level, nick, nature, evs, ivs, moves, ability, item, sh, ball}
function mkMon(n, o = {}){
  const sp = NAT_BY.get(n), L = Math.max(1, Math.min(100, o.level || 50));
  const nature = NATURES[o.nature] ? o.nature : "Hardy", evs = statFull(cleanEVs(o.evs), 0), ivs = statFull(o.ivs, IV_MAX);
  const stats = calcStats(sp.stats, L, nature, evs, ivs, baseOf(n) === 292);
  const moves = (o.moves || []).filter(Boolean).slice(0, 4), mv = (moves.length ? moves : autoMoves(n, sp.types, o.setup !== false)).slice(0, 4);
  return {n, name:o.nick || sp.name, species:sp.name, types:[...sp.types], level:L, nature, evs, ivs, stats, hp:stats.hp, max:stats.hp,
    stages:{atk:0, def:0, spa:0, spd:0, spe:0, acc:0, eva:0}, moves:mv, pp:mv.map(maxPP), ability:o.ability || defaultAbility(n),
    item:isMega(n) ? "" : GEN2_BERRY[o.item] || o.item || "", sh:!!o.sh, ball:o.ball || "poke", fe:isFE(n), status:null, sleep:0, toxN:0, v:{}, timesHit:0};
}
// a battler moved to a new level keeps its share of HP, its status and any item it has left
function setLevel(m, L){
  if (m.level === L) return;
  const sp = NAT_BY.get(m.n), st = calcStats(sp.stats, L, m.nature, m.evs, m.ivs, baseOf(m.n) === 292);
  m.hp = m.hp <= 0 ? 0 : Math.max(1, Math.round(st.hp*m.hp/m.max)); m.max = st.hp; m.stats = st; m.level = L;
}

// ---- the Bag ----
const BAG_ITEMS = {
  "Potion":{heal:20, d:"Restores 20 HP."}, "Super Potion":{heal:60, d:"Restores 60 HP."}, "Hyper Potion":{heal:120, d:"Restores 120 HP."},
  "Max Potion":{heal:"full", d:"Fully restores HP."}, "Full Restore":{heal:"full", cure:"all", d:"Fully restores HP and heals any status problem."},
  "Revive":{revive:.5, d:"Revives a fainted Pokémon with half its HP."}, "Max Revive":{revive:1, d:"Revives a fainted Pokémon with full HP."},
  "Full Heal":{cure:"all", d:"Heals any status problem, including confusion."}, "Antidote":{cure:["psn", "tox"], d:"Cures poison."}, "Burn Heal":{cure:["brn"], d:"Heals a burn."},
  "Ice Heal":{cure:["frz"], d:"Thaws a frozen Pokémon."}, "Awakening":{cure:["slp"], d:"Wakes up a sleeping Pokémon."}, "Paralyze Heal":{cure:["par"], d:"Cures paralysis."},
  "X Attack":{boost:{atk:2}, d:"Sharply raises Attack while it stays in battle."}, "X Defense":{boost:{def:2}, d:"Sharply raises Defense while it stays in battle."},
  "X Sp. Atk":{boost:{spa:2}, d:"Sharply raises Sp. Atk while it stays in battle."}, "X Sp. Def":{boost:{spd:2}, d:"Sharply raises Sp. Def while it stays in battle."},
  "X Speed":{boost:{spe:2}, d:"Sharply raises Speed while it stays in battle."}, "X Accuracy":{boost:{acc:2}, d:"Sharply raises accuracy while it stays in battle."},
  "Dire Hit":{crit:2, d:"Makes critical hits much more likely while it stays in battle."}, "Guard Spec.":{mist:5, d:"Stops stat drops on your side for five turns."},
};
const BAG_ORDER = Object.keys(BAG_ITEMS);
const BAG = {
  standard: () => ({"Hyper Potion":2, "Revive":1, "Full Heal":1, "X Attack":1, "X Sp. Atk":1, "X Speed":1}),
  league: () => ({"Max Potion":3, "Full Restore":2, "Revive":2, "Full Heal":2, "X Attack":1, "X Sp. Atk":1}),
};
// can item `it` be used on party member `m` (which is the active battler if `active`)?
function bagCanUse(it, m, active){
  const B = BAG_ITEMS[it]; if (!B || !m) return false;
  if (B.revive) return m.hp <= 0;
  if (m.hp <= 0) return false;
  if (B.boost || B.crit || B.mist) return !!active;
  const hurt = B.heal && m.hp < m.max, sick = B.cure && (B.cure === "all" ? !!m.status || (active && !!m.v.confusion) : B.cure.includes(m.status));
  return !!(hurt || sick);
}

class Battle {
  // sides: [{name, party, human, foePrefix, bag?, ai?}, …]; opt.rand for tests
  constructor(sides, opt = {}){
    this.rand = opt.rand || Math.random;
    this.s = sides.map(x => ({...x, act:0, sc:{}, wish:null, ai:x.ai === undefined ? 2 : x.ai, bag:x.bag || null, faintedThis:false, lostAllies:0}));
    this.weather = null; this.wTurns = 0; this.terrain = null; this.tTurns = 0; this.trickRoom = 0;
    this.turnNo = 0; this.over = false; this.winner = -1; this.need = [null, null]; this.queue = null; this.pend = null;
  }
  r(n){ return Math.floor(this.rand()*n); }
  chance(p){ return this.rand() < p; }
  get(i){ return this.s[i].party[this.s[i].act]; }
  aliveIdx(i){ return this.s[i].party.map((m, k) => m.hp > 0 ? k : -1).filter(k => k >= 0); }
  bench(i){ return this.aliveIdx(i).filter(k => k !== this.s[i].act); }
  who(i, m){ return (this.s[i].foePrefix || "") + (m || this.get(i)).name; }
  msg(ev, t, x){ ev.push({k:"msg", t, ...(x || {})}); }
  // both leads come out first, then their entry abilities run, fastest first
  start(){ const ev = []; for (const i of [1, 0]) this.enter(i, ev, true); for (const i of this.order([0, 1])) this.entryEffects(i, ev); for (const i of [0, 1]) this.get(i).v.turns = 0; return ev; }
  order(list){ return [...list].sort((a, b) => this.speed(this.get(b)) - this.speed(this.get(a)) || this.rand() - .5); }

  // ---------- helpers ----------
  abil(m, other){ return m.v.noAbil ? "" : m.ability; }   // other: attacker ignoring (Mold Breaker) is handled in calc
  hasItem(m, it){ return m.item === it; }
  grounded(m, ab = m.ability){ return !((m.types.includes("Flying") && !m.v.roost) || ab === "Levitate" || m.item === "Air Balloon" || m.v.magnetRise) || m.item === "Iron Ball" || !!m.v.smackdown || !!this.gravity; }
  umbrella(m){ return m.item === "Utility Umbrella"; }
  wx(){ return this.s.some((s, i) => { const m = this.get(i); return m && m.hp > 0 && (m.ability === "Cloud Nine" || m.ability === "Air Lock"); }) ? null : this.weather; }
  speed(m){
    if (!m) return 0;
    let v = modStat(m.stats.spe, m.stages.spe); const mods = [], w = this.wx(), A = m.ability, side = this.s.find(s => s.party.includes(m));
    if (side && side.sc.tailwind) mods.push(8192);
    if ((A === "Unburden" && m.v.unburden) || (A === "Chlorophyll" && w === "sun") || (A === "Sand Rush" && w === "sand") || (A === "Swift Swim" && w === "rain") || (A === "Slush Rush" && w === "snow")) mods.push(8192);
    else if (A === "Quick Feet" && m.status) mods.push(6144);
    else if (A === "Slow Start" && (m.v.turns || 0) < 5) mods.push(2048);
    else if (m.v.qp === "spe") mods.push(6144);
    if (!(A === "Unburden" && m.v.unburden)) { if (m.item === "Choice Scarf") mods.push(6144); else if (m.item === "Iron Ball" || EV_ITEMS.has(m.item)) mods.push(2048); else if (m.item === "Quick Powder" && baseOf(m.n) === 132) mods.push(8192); }
    v = OF32(pokeRound(v*chainMods(mods, 410, 131172)/4096));
    if (m.status === "par" && A !== "Quick Feet") v = Math.floor(v*50/100);
    return Math.max(0, Math.min(10000, v));
  }
  // the type a move has when `a` uses it
  moveType(a, mv){
    const nm = mv[0], w = this.wx(), A = a.ability;
    if (mv === STRUGGLE) return "???";
    let t = mv[1];
    if (nm === "Weather Ball") t = w === "sun" && !this.umbrella(a) ? "Fire" : w === "rain" && !this.umbrella(a) ? "Water" : w === "sand" ? "Rock" : w === "snow" ? "Ice" : "Normal";
    else if (nm === "Judgment" && PLATE_TYPE[a.item]) t = PLATE_TYPE[a.item];
    else if (nm === "Techno Blast" && DRIVE_TYPE[a.item]) t = DRIVE_TYPE[a.item];
    else if (nm === "Multi-Attack" && MEMORY_TYPE[a.item]) t = MEMORY_TYPE[a.item];
    else if (nm === "Revelation Dance") t = a.types[0];
    else if (nm === "Terrain Pulse" && this.terrain && this.grounded(a)) t = {electric:"Electric", grassy:"Grass", misty:"Fairy", psychic:"Psychic"}[this.terrain];
    else if (nm === "Raging Bull") t = {"Paldean Tauros (Combat)":"Fighting", "Paldean Tauros (Blaze)":"Fire", "Paldean Tauros (Aqua)":"Water"}[a.species] || "Normal";
    const noChange = ["Revelation Dance", "Judgment", "Nature Power", "Techno Blast", "Multi-Attack", "Natural Gift", "Weather Ball", "Terrain Pulse", "Struggle"].includes(nm);
    if (!noChange) { if (ATE[A] && t === "Normal") t = ATE[A]; else if (A === "Liquid Voice" && fl(mv, "o")) t = "Water"; else if (A === "Normalize") t = "Normal"; }
    return t;
  }
  isAte(a, mv){ return !["Revelation Dance", "Judgment", "Nature Power", "Techno Blast", "Multi-Attack", "Natural Gift", "Weather Ball", "Terrain Pulse", "Struggle"].includes(mv[0]) && (ATE[a.ability] && mv[1] === "Normal" || a.ability === "Normalize"); }
  typeMul(a, d, mv, type){
    if (type === "???") return 1;
    const reveal = a.ability === "Scrappy" || a.ability === "Mind's Eye" || d.v.foresight;
    let e = 1;
    for (const dt of d.types) {
      let x;
      if (reveal && dt === "Ghost" && (type === "Normal" || type === "Fighting")) x = 1;
      else if (mv[0] === "Freeze-Dry" && dt === "Water") x = 2;
      else if (mv[0] === "Nihil Light" && dt === "Fairy") x = 1;
      else { x = (CHART9[dt] || {})[type]; if (x === undefined) x = 1; if (mv[0] === "Flying Press") { const y = (CHART9[dt] || {}).Flying; x *= y === undefined ? 1 : y; } }
      if (x === 0 && d.item === "Ring Target") x = 1;
      if (x === 0 && type === "Ground" && dt === "Flying" && (d.item === "Iron Ball" || d.v.smackdown || this.gravity)) x = 1;
      if (x === 0 && type === "Psychic" && dt === "Dark" && d.v.miracleEye) x = 1;
      e *= x;
    }
    if (e === 0 && mv[0] === "Thousand Arrows") e = 1;
    if (d.v.tarShot && type === "Fire") e *= 2;
    return e;
  }
  // ---------- damage (exact Gen 9 formula; returns 16 rolls) ----------
  // o: {crit, hit, dSide, aSide, movedLast, est}
  calc(a, d, mv, o = {}){
    const res = {rolls:null, eff:1, type:mv[1], crit:false};
    if (!isDmg(mv)) return res;
    const nm = mv[0], fx = fxOf(mv), w = this.wx(), aS = o.aSide || {};
    const dS = nm === "Brick Break" || nm === "Psychic Fangs" || nm === "Raging Bull" ? {} : o.dSide || {};   // these break screens first
    let A = a.ability, D = d.ability;
    if ((A === "Mold Breaker" || A === "Teravolt" || A === "Turboblaze" || fx.iga) && BREAKABLE.has(D) && d.item !== "Ability Shield") D = "";
    const crit = !!o.crit && D !== "Battle Armor" && D !== "Shell Armor"; res.crit = crit;
    const type = this.moveType(a, mv); res.type = type;
    const phys = mv[2] === "P", contact = fl(mv, "c") && !(a.item === "Punching Glove" && fl(mv, "p")) && a.ability !== "Long Reach";
    let eff = this.typeMul(a, d, mv, type); res.eff = eff;
    if (eff === 0) { res.immune = "type"; return res; }
    if ((nm === "Dream Eater" && d.status !== "slp" && D !== "Comatose") || (nm === "Steel Roller" && !this.terrain) || (nm === "Poltergeist" && !d.item) || (nm === "Synchronoise" && !d.types.some(t => a.types.includes(t)))) { res.fail = true; return res; }
    // abilities and items that block a move outright
    const pr = o.prio !== undefined ? o.prio : mv[6];
    if ((D === "Wonder Guard" && eff <= 1) || (ABSORB[D] && ABSORB[D][0] === type && !(D === "Levitate" && (nm === "Thousand Arrows" || d.item === "Iron Ball"))) || (fl(mv, "l") && D === "Bulletproof") || (fl(mv, "o") && D === "Soundproof" && nm !== "Clangorous Soul") || (pr > 0 && (D === "Queenly Majesty" || D === "Dazzling" || D === "Armor Tail")) || (fl(mv, "i") && D === "Wind Rider")) { res.immune = "ability"; res.by = D; return res; }
    if (type === "Ground" && nm !== "Thousand Arrows" && d.item === "Air Balloon") { res.immune = "balloon"; return res; }
    if (pr > 0 && this.terrain === "psychic" && this.grounded(d, D)) { res.immune = "terrain"; return res; }
    // fixed damage
    let fixed = 0;
    if (fx.fd === "level") fixed = a.level; else if (typeof fx.fd === "number") fixed = fx.fd;
    else if (nm === "Super Fang" || nm === "Ruination" || nm === "Nature's Madness") fixed = Math.max(1, Math.floor(d.hp/2));
    else if (nm === "Final Gambit") fixed = a.hp;
    else if (nm === "Endeavor") { if (a.hp >= d.hp) { res.fail = true; return res; } fixed = d.hp - a.hp; }
    else if (nm === "Psywave") fixed = Math.max(1, Math.floor(a.level*(o.est ? 100 : 50 + this.r(101))/100));
    else if (nm === "Counter" || nm === "Mirror Coat" || nm === "Metal Burst" || nm === "Comeuppance") {
      const h = a.v.hitBy; if (!h || (nm === "Counter" && h.cat !== "P") || (nm === "Mirror Coat" && h.cat !== "S")) { res.fail = true; return res; }
      fixed = Math.max(1, Math.floor(h.dmg*(nm === "Metal Burst" || nm === "Comeuppance" ? 1.5 : 2)));
    }
    if (fixed) { res.fixed = true; res.rolls = Array(16).fill(fixed); return res; }
    if (fx.ohko) { res.ohko = true; res.rolls = Array(16).fill(d.hp); return res; }
    // base power
    const sA = this.speed(a), sD = this.speed(d), hit = o.hit || 1;
    let bp = mv[3];
    switch (nm) {
      case "Payback": bp *= o.movedLast ? 2 : 1; break;
      case "Bolt Beak": case "Fishious Rend": bp *= o.movedLast ? 1 : 2; break;
      case "Electro Ball": { const r = sD ? Math.floor(sA/sD) : 0; bp = !sD ? 40 : r >= 4 ? 150 : r >= 3 ? 120 : r >= 2 ? 80 : r >= 1 ? 60 : 40; break; }
      case "Gyro Ball": bp = sA ? Math.min(150, Math.floor(25*sD/sA) + 1) : 1; break;
      case "Low Kick": case "Grass Knot": { const wt = this.weight(d); bp = wt >= 200 ? 120 : wt >= 100 ? 100 : wt >= 50 ? 80 : wt >= 25 ? 60 : wt >= 10 ? 40 : 20; break; }
      case "Heavy Slam": case "Heat Crash": { const wr = this.weight(a)/this.weight(d); bp = wr >= 5 ? 120 : wr >= 4 ? 100 : wr >= 3 ? 80 : wr >= 2 ? 60 : 40; break; }
      case "Hex": case "Infernal Parade": bp *= d.status || D === "Comatose" ? 2 : 1; break;
      case "Barb Barrage": bp *= d.status === "psn" || d.status === "tox" ? 2 : 1; break;
      case "Stored Power": case "Power Trip": bp = 20 + 20*["atk", "def", "spa", "spd", "spe", "acc", "eva"].reduce((s, k) => s + Math.max(0, a.stages[k]), 0); break;
      case "Punishment": bp = Math.min(200, 60 + 20*["atk", "def", "spa", "spd", "spe", "acc", "eva"].reduce((s, k) => s + Math.max(0, d.stages[k]), 0)); break;
      case "Acrobatics": bp *= !a.item || a.item === "Flying Gem" ? 2 : 1; break;   // the Gem is used up first
      case "Wake-Up Slap": bp *= d.status === "slp" || D === "Comatose" ? 2 : 1; break;
      case "Smelling Salts": bp *= d.status === "par" ? 2 : 1; break;
      case "Weather Ball": bp *= w ? 2 : 1; if ((w === "sun" || w === "rain") && this.umbrella(a)) bp = mv[3]; break;
      case "Terrain Pulse": bp *= this.terrain && this.grounded(a) ? 2 : 1; break;
      case "Rising Voltage": bp *= this.terrain === "electric" && this.grounded(d, D) ? 2 : 1; break;
      case "Psyblade": bp *= this.terrain === "electric" ? 1.5 : 1; break;
      case "Eruption": case "Water Spout": case "Dragon Energy": bp = Math.max(1, Math.floor(150*a.hp/a.max)); break;
      case "Flail": case "Reversal": { const p = Math.floor(48*a.hp/a.max); bp = p <= 1 ? 200 : p <= 4 ? 150 : p <= 9 ? 100 : p <= 16 ? 80 : p <= 32 ? 40 : 20; break; }
      case "Triple Axel": bp = hit*20; break;
      case "Triple Kick": bp = hit*10; break;
      case "Crush Grip": case "Wring Out": bp = Math.floor(Math.floor((120*100*Math.floor(d.hp*4096/d.max) + 2048 - 1)/4096)/100) || 1; break;
      case "Hard Press": bp = Math.floor(Math.floor((100*100*Math.floor(d.hp*4096/d.max) + 2048 - 1)/4096)/100) || 1; break;
      case "Return": bp = 102; break;
      case "Frustration": bp = 1; break;
      case "Rage Fist": bp = Math.min(350, 50 + 50*(a.timesHit || 0)); break;
      case "Last Respects": bp = Math.min(5050, 50 + 50*(o.lostAllies || 0)); break;
      case "Avalanche": case "Revenge": bp *= a.v.hitBy && a.v.hitBy.turn === this.turnNo ? 2 : 1; break;
      case "Assurance": bp *= d.v.damagedTurn === this.turnNo ? 2 : 1; break;
      case "Stomping Tantrum": case "Temper Flare": bp *= a.v.failed ? 2 : 1; break;
      case "Fling": bp = (ITEM_INFO.get(a.item) || [])[4] || 0; break;
      case "Present": bp = o.est ? 60 : [40, 40, 40, 40, 80, 80, 80, 120][this.r(8)]; break;
      case "Magnitude": { if (o.est) { bp = 71; break; } const x = this.r(100); bp = x < 5 ? 10 : x < 15 ? 30 : x < 35 ? 50 : x < 65 ? 70 : x < 85 ? 90 : x < 95 ? 110 : 150; break; }
      case "Trump Card": { const left = o.ppLeft ?? 4; bp = left >= 4 ? 40 : left === 3 ? 50 : left === 2 ? 60 : left === 1 ? 80 : 200; break; }
      case "Spit Up": bp = 100*(a.v.stockpile || 0); break;
      case "Fury Cutter": bp = Math.min(160, 40*2 ** Math.min(2, a.v.furyCutter || 0)); break;
      case "Echoed Voice": bp = Math.min(200, 40*(1 + (a.v.echo || 0))); break;
      case "Rollout": case "Ice Ball": bp = 30*2 ** ((a.v.roll || 0) + (a.v.curled ? 1 : 0)); break;
      case "Tera Blast": bp = 80; break;
      case "Water Shuriken": bp = 15; break;
    }
    if (!bp) { res.fail = true; return res; }
    const bpm = [];
    if ((nm === "Facade" && ["brn", "par", "psn", "tox"].includes(a.status)) || (nm === "Brine" && d.hp <= d.max/2) || (nm === "Venoshock" && (d.status === "psn" || d.status === "tox")) || (nm === "Lash Out" && a.v.lowered === this.turnNo)) bpm.push(8192);
    else if (nm === "Expanding Force" && this.grounded(a) && this.terrain === "psychic") bpm.push(6144);
    else if ((nm === "Knock Off" && d.item && !(o.hit > 1)) || (nm === "Misty Explosion" && this.grounded(a) && this.terrain === "misty")) bpm.push(6144);
    else if ((nm === "Solar Beam" || nm === "Solar Blade") && (w === "rain" || w === "sand" || w === "snow")) bpm.push(2048);
    else if ((nm === "Collision Course" || nm === "Electro Drift") && eff >= 2) bpm.push(5461);
    if (this.grounded(a) && ((this.terrain === "electric" && type === "Electric") || (this.terrain === "grassy" && type === "Grass") || (this.terrain === "psychic" && type === "Psychic"))) bpm.push(5325);
    if (this.grounded(d, D) && ((this.terrain === "misty" && type === "Dragon") || (this.terrain === "grassy" && (nm === "Earthquake" || nm === "Bulldoze")))) bpm.push(2048);
    if ((A === "Technician" && bp <= 60) || (A === "Flare Boost" && a.status === "brn" && !phys) || (A === "Toxic Boost" && (a.status === "psn" || a.status === "tox") && phys) || (A === "Mega Launcher" && fl(mv, "u")) || (A === "Strong Jaw" && fl(mv, "b")) || (A === "Steely Spirit" && type === "Steel") || (A === "Sharpness" && fl(mv, "s"))) bpm.push(6144);
    if (a.v.charge && type === "Electric") bpm.push(8192);
    const aura = type + " Aura";
    if (A === aura || D === aura) bpm.push(A === "Aura Break" || D === "Aura Break" ? 3072 : 5448);
    const hasSec = !!(fx.sf || fx.sec);
    if ((A === "Sheer Force" && hasSec) || (A === "Sand Force" && w === "sand" && ["Rock", "Ground", "Steel"].includes(type)) || (A === "Analytic" && o.movedLast) || (A === "Tough Claws" && contact) || (A === "Punk Rock" && fl(mv, "o"))) bpm.push(5325);
    if (this.isAte(a, mv)) bpm.push(4915);
    if ((A === "Reckless" && (fx.r || fx.crash)) || (A === "Iron Fist" && fl(mv, "p"))) bpm.push(4915);
    if (D === "Dry Skin" && type === "Fire") bpm.push(5120);
    if ((this.mudSport && type === "Electric") || (this.waterSport && type === "Fire")) bpm.push(1352);
    if (A === "Supreme Overlord" && o.lostAllies) bpm.push([4096, 4506, 4915, 5325, 5734, 6144][Math.min(5, o.lostAllies)]);
    const bn = baseOf(a.n);
    if (GEMS[a.item] === type) bpm.push(5325);
    else if (((a.item === "Adamant Crystal" || a.item === "Adamant Orb") && bn === 483 && (type === "Steel" || type === "Dragon")) || ((a.item === "Lustrous Orb" || a.item === "Lustrous Globe") && bn === 484 && (type === "Water" || type === "Dragon")) || ((a.item === "Griseous Orb" || a.item === "Griseous Core") && bn === 487 && (type === "Ghost" || type === "Dragon")) || (a.item === "Soul Dew" && (bn === 380 || bn === 381) && (type === "Psychic" || type === "Dragon")) || (ITEM_TYPE[a.item] && ITEM_TYPE[a.item] === type)) bpm.push(4915);
    else if ((a.item === "Muscle Band" && phys) || (a.item === "Wise Glasses" && !phys)) bpm.push(4505);
    else if (a.item === "Punching Glove" && fl(mv, "p")) bpm.push(4506);
    bp = OF16(Math.max(1, pokeRound(bp*chainMods(bpm, 41, 2097152)/4096)));
    // attack
    const src = fx.oop === "target" ? d : a, aStat = fx.oos === "def" ? "def" : phys ? "atk" : "spa", ab = src.stages[aStat];
    let atk = src.stats[aStat];
    if (ab !== 0 && !(crit && ab < 0) && D !== "Unaware") atk = modStat(atk, ab);
    if (A === "Hustle" && phys) atk = pokeRound(atk*3/2);
    const atm = [];
    if ((A === "Slow Start" && (a.v.turns || 0) < 5 && phys) || (A === "Defeatist" && a.hp <= a.max/2)) atm.push(2048);
    else if (A === "Solar Power" && w === "sun" && !this.umbrella(a) && !phys) atm.push(6144);
    else if (A === "Gorilla Tactics" && phys) atm.push(6144);
    else if ((A === "Guts" && a.status && phys) || (a.hp <= a.max/3 && PINCH[A] === type)) atm.push(6144);
    else if (A === "Flash Fire" && a.v.flash && type === "Fire") atm.push(6144);
    else if ((A === "Steelworker" && type === "Steel") || (A === "Dragon's Maw" && type === "Dragon") || (A === "Rocky Payload" && type === "Rock") || (A === "Fire Mane" && type === "Fire")) atm.push(6144);
    else if (A === "Transistor" && type === "Electric") atm.push(5325);
    else if ((A === "Water Bubble" && type === "Water") || ((A === "Huge Power" || A === "Pure Power") && phys)) atm.push(8192);
    if (((D === "Thick Fat") && (type === "Fire" || type === "Ice")) || (D === "Water Bubble" && type === "Fire") || (D === "Purifying Salt" && type === "Ghost")) atm.push(2048);
    if (D === "Heatproof" && type === "Fire") atm.push(2048);
    if (((D === "Tablets of Ruin" && A !== "Tablets of Ruin") && phys) || ((D === "Vessel of Ruin" && A !== "Vessel of Ruin") && !phys)) atm.push(3072);
    if ((phys && a.v.qp === "atk") || (!phys && a.v.qp === "spa")) atm.push(5325);
    if ((A === "Hadron Engine" && !phys && this.terrain === "electric") || (A === "Orichalcum Pulse" && phys && w === "sun" && !this.umbrella(a))) atm.push(5461);
    if ((a.item === "Thick Club" && (bn === 104 || bn === 105) && phys) || (a.item === "Deep Sea Tooth" && bn === 366 && !phys) || (a.item === "Light Ball" && bn === 25)) atm.push(8192);
    else if ((a.item === "Choice Band" && phys) || (a.item === "Choice Specs" && !phys)) atm.push(6144);
    atk = OF16(Math.max(1, pokeRound(atk*chainMods(atm, 410, 131072)/4096)));
    // defense
    const hitsPhys = fx.ods === "def" || phys, dStat = hitsPhys ? "def" : "spd", db = d.stages[dStat];
    let def = d.stats[dStat];
    if (db !== 0 && !(crit && db > 0) && !fx.igd && A !== "Unaware" && nm !== "Nihil Light") def = modStat(def, db);
    if (w === "sand" && d.types.includes("Rock") && !hitsPhys) def = pokeRound(def*3/2);
    if (w === "snow" && d.types.includes("Ice") && hitsPhys) def = pokeRound(def*3/2);
    const dfm = [];
    if (D === "Marvel Scale" && d.status && hitsPhys) dfm.push(6144);
    else if (D === "Grass Pelt" && this.terrain === "grassy" && hitsPhys) dfm.push(6144);
    else if (D === "Fur Coat" && hitsPhys) dfm.push(8192);
    if (((A === "Sword of Ruin" && D !== "Sword of Ruin") && hitsPhys) || ((A === "Beads of Ruin" && D !== "Beads of Ruin") && !hitsPhys)) dfm.push(3072);
    if ((hitsPhys && d.v.qp === "def") || (!hitsPhys && d.v.qp === "spd")) dfm.push(5324);
    const dn = baseOf(d.n);
    if ((d.item === "Eviolite" && !d.fe) || (!hitsPhys && d.item === "Assault Vest")) dfm.push(6144);
    else if ((d.item === "Metal Powder" && dn === 132 && hitsPhys) || (d.item === "Deep Sea Scale" && dn === 366 && !hitsPhys)) dfm.push(8192);
    def = OF16(Math.max(1, pokeRound(def*chainMods(dfm, 410, 131072)/4096)));
    // base damage, weather, crit
    let base = baseDamage(a.level, bp, atk, def);
    if (o.child) base = pokeRound(OF32(base*1024)/4096);   // Parental Bond's second hit
    if (w === "sun" && nm === "Hydro Steam" && !this.umbrella(a)) base = pokeRound(OF32(base*6144)/4096);
    else if (!this.umbrella(d)) {
      if ((w === "sun" && type === "Fire") || (w === "rain" && type === "Water")) base = pokeRound(OF32(base*6144)/4096);
      else if ((w === "sun" && type === "Water") || (w === "rain" && type === "Fire")) base = pokeRound(OF32(base*2048)/4096);
    }
    if (crit) base = Math.floor(OF32(base*1.5));
    // STAB, burn, final modifiers
    let stab = 4096;
    if (a.types.includes(type)) stab += 2048; else if ((A === "Protean" || A === "Libero") && type !== "???") stab += 2048;
    if (A === "Adaptability" && a.types.includes(type)) stab += 2048;
    const burn = a.status === "brn" && phys && A !== "Guts" && nm !== "Facade";
    const fm = [];
    if (dS.reflect && phys && !crit && !dS.auroraveil) fm.push(2048);
    else if (dS.lightscreen && !phys && !crit && !dS.auroraveil) fm.push(2048);
    if (dS.auroraveil && !crit) fm.push(2048);
    if (A === "Neuroforce" && eff > 1) fm.push(5120); else if (A === "Sniper" && crit) fm.push(6144); else if (A === "Tinted Lens" && eff < 1) fm.push(8192);
    if ((D === "Multiscale" || D === "Shadow Shield") && d.hp === d.max && hit === 1) fm.push(2048);
    if (D === "Fluffy" && contact) fm.push(2048); else if ((D === "Punk Rock" && fl(mv, "o")) || (D === "Ice Scales" && !phys)) fm.push(2048);
    if ((D === "Solid Rock" || D === "Filter" || D === "Prism Armor") && eff > 1) fm.push(3072);
    if (D === "Fluffy" && type === "Fire") fm.push(8192);
    if (a.item === "Expert Belt" && eff > 1) fm.push(4915);
    else if (a.item === "Life Orb") fm.push(5324);
    else if (a.item === "Metronome" && a.v.metro && a.v.metro.name === nm && a.v.metro.n >= 1) fm.push(a.v.metro.n <= 4 ? 4096 + a.v.metro.n*819 : 8192);
    if (RESIST_BERRY[d.item] === type && (eff > 1 || type === "Normal") && hit === 1 && !o.child && A !== "Unnerve") { fm.push(D === "Ripen" ? 1024 : 2048); res.berry = d.item; }
    const fmod = chainMods(fm, 41, 131072);
    res.rolls = Array.from({length:16}, (_, i) => finalDamage(base, i, eff, burn, stab, fmod));
    void aS;
    return res;
  }
  weight(m){ let w = weightOf(m.n)*10; if (m.ability === "Heavy Metal") w *= 2; else if (m.ability === "Light Metal") w = Math.max(1, Math.trunc(w/2)); if (m.item === "Float Stone") w = Math.max(1, Math.trunc(w/2)); return w/10; }
  critStage(a, mv){
    const fx = fxOf(mv); let s = (fx.cr || 1) - 1;
    if (a.v.critUp) s += a.v.critUp;
    if (a.item === "Scope Lens" || a.item === "Razor Claw") s += 1;
    if (a.ability === "Super Luck") s += 1;
    if ((a.item === "Leek" || a.item === "Stick") && [83, 865].includes(baseOf(a.n))) s += 2;
    if (a.item === "Lucky Punch" && baseOf(a.n) === 113) s += 2;
    return s;
  }
  rollCrit(a, d, mv){
    if (d.ability === "Battle Armor" || d.ability === "Shell Armor" || this.s.some(S => S.sc.luckychant && S.party.includes(d))) return false;
    if (a.v.laserFocus) return true;
    if (fxOf(mv).wc || (a.ability === "Merciless" && (d.status === "psn" || d.status === "tox"))) return true;
    return this.r([24, 8, 2, 1][Math.min(3, this.critStage(a, mv))]) === 0;
  }
  // expected damage of one use (for the AI and hints): average roll, expected hits and crit chance
  estimate(a, d, mv, dSide, o = {}){
    if (!isDmg(mv)) return 0;
    const r = this.calc(a, d, mv, {dSide, est:true, ...o}); if (!r.rolls) return 0;
    const avg = r.rolls.reduce((s, x) => s + x, 0)/16;
    if (r.fixed || r.ohko) return avg;
    const st = this.critStage(a, mv), cc = fxOf(mv).wc ? 1 : 1/[24, 8, 2, 1][Math.min(3, st)];
    return avg*(1 + .5*cc)*this.expHits(a, mv);
  }
  expHits(a, mv){ const h = fxOf(mv).mh; if (!h) return 1; if (!Array.isArray(h)) return mv[0] === "Triple Axel" ? 6 : mv[0] === "Triple Kick" ? 6 : mv[0] === "Population Bomb" ? (a.item === "Loaded Dice" ? 7 : 6) : h; if (a.ability === "Skill Link") return h[1]; if (a.item === "Loaded Dice") return 4.5; return h[1] === 5 ? 3.1 : (h[0] + h[1])/2; }
  numHits(a, mv){
    const h = fxOf(mv).mh; if (!h) return 1;
    if (!Array.isArray(h)) return mv[0] === "Population Bomb" && a.item === "Loaded Dice" ? 4 + this.r(7) : h;
    if (a.ability === "Skill Link") return h[1];
    if (h[1] === 5) { if (a.item === "Loaded Dice") return 4 + this.r(2); const x = this.r(20); return x < 7 ? 2 : x < 14 ? 3 : x < 17 ? 4 : 5; }
    return h[0] + this.r(h[1] - h[0] + 1);
  }

  // ---------- switching in ----------
  enter(i, ev, only){
    const S = this.s[i], m = this.get(i);
    m.stages = {atk:0, def:0, spa:0, spd:0, spe:0, acc:0, eva:0}; m.toxN = 0;
    const keep = S.passing; S.passing = null;
    m.v = {turns:0}; if (keep) { m.stages = keep.stages; if (keep.sub) m.v.sub = keep.sub; if (keep.critUp) m.v.critUp = keep.critUp; if (keep.confusion) m.v.confusion = keep.confusion; }
    ev.push({k:"send", side:i, idx:S.act, n:m.n, sh:m.sh, name:m.name, hp:m.hp, max:m.max, st:m.status, lv:m.level});
    if (S.healWish && m.hp > 0) { S.healWish = false; m.hp = m.max; m.status = null; m.sleep = 0; this.msg(ev, `The healing wish came true for ${this.who(i)}!`); ev.push({k:"hp", side:i, hp:m.hp, max:m.max, heal:true}); ev.push({k:"st", side:i, st:null}); }
    if (S.shedSub) { m.v.sub = S.shedSub; S.shedSub = 0; ev.push({k:"sub", side:i, on:true}); }
    if (!only) this.entryEffects(i, ev);
  }
  entryEffects(i, ev){
    const m = this.get(i), foe = this.get(1 - i);
    this.hazards(i, ev); if (m.hp <= 0) return;
    if (m.item === "Air Balloon") this.msg(ev, `${this.who(i)} floats in the air with its Air Balloon!`);
    if (m.ability === "Trace" && foe && foe.hp > 0 && !["Trace", "Multitype", "Stance Change", "Schooling", "Comatose", "Disguise", "Zen Mode", "Imposter", "Illusion", "Power Construct", "RKS System", "Shields Down", "Ice Face", "Neutralizing Gas"].includes(foe.ability)) { m.ability = foe.ability; this.msg(ev, `${this.who(i)} traced ${this.who(1 - i)}’s ${foe.ability}!`); }
    const A = m.ability;
    if (A === "Screen Cleaner") for (const S of this.s) { if (S.sc.reflect || S.sc.lightscreen || S.sc.auroraveil) { S.sc.reflect = S.sc.lightscreen = S.sc.auroraveil = 0; this.msg(ev, "The screens were removed!"); } }
    if (A === "Supersweet Syrup" && foe && foe.hp > 0 && !m.syrup) { m.syrup = true; this.msg(ev, `A supersweet aroma is wafting from ${this.who(i)}!`); this.boost(1 - i, {eva:-1}, ev, {foe:true}); }
    if (A === "Unnerve") this.msg(ev, `${this.s[1 - i].human === false ? "The opposing team" : "Your team"} is too nervous to eat Berries!`);
    if (A === "Intimidate" && foe && foe.hp > 0 && foe.ability === "Guard Dog") { this.msg(ev, `${this.who(i)}’s Intimidate!`); this.boost(1 - i, {atk:1}, ev, {by:"Guard Dog"}); }
    else if (A === "Intimidate" && foe && foe.hp > 0) {
      this.msg(ev, `${this.who(i)}’s Intimidate!`);
      if (["Inner Focus", "Oblivious", "Own Tempo", "Scrappy"].includes(foe.ability)) this.msg(ev, `${this.who(1 - i)}’s ${foe.ability} kept its Attack from dropping!`);
      else { this.boost(1 - i, {atk:-1}, ev, {foe:true}); if (foe.ability === "Rattled") this.boost(1 - i, {spe:1}, ev); if (foe.item === "Adrenaline Orb" && foe.hp > 0) { foe.item = ""; this.boost(1 - i, {spe:1}, ev, {by:"Adrenaline Orb"}); } }
    }
    if (A === "Intrepid Sword") this.boost(i, {atk:1}, ev, {by:"Intrepid Sword"});
    if (A === "Dauntless Shield") this.boost(i, {def:1}, ev, {by:"Dauntless Shield"});
    if (A === "Download" && foe && foe.hp > 0) this.boost(i, modStat(foe.stats.def, foe.stages.def) < modStat(foe.stats.spd, foe.stages.spd) ? {atk:1} : {spa:1}, ev, {by:"Download"});
    if (A === "Pressure") this.msg(ev, `${this.who(i)} is exerting its Pressure!`);
    if (A === "Mold Breaker" || A === "Teravolt" || A === "Turboblaze") this.msg(ev, `${this.who(i)} breaks the mold!`);
    if (A === "Air Lock" || A === "Cloud Nine") this.msg(ev, "The effects of the weather disappeared.");
    if (["Sword of Ruin", "Beads of Ruin", "Tablets of Ruin", "Vessel of Ruin"].includes(A)) this.msg(ev, `${this.who(i)}’s ${A} weakens the ${{"Sword of Ruin":"Defense", "Beads of Ruin":"Sp. Def", "Tablets of Ruin":"Attack", "Vessel of Ruin":"Sp. Atk"}[A]} of all surrounding Pokémon!`);
    if (WEATHER_ABIL[A]) this.setWeather(WEATHER_ABIL[A], m, ev);
    if (TERRAIN_ABIL[A]) this.setTerrain(TERRAIN_ABIL[A], m, ev);
    this.seed(i, ev); this.checkQP(i, ev);
  }
  hazards(i, ev){
    const S = this.s[i], m = this.get(i), sc = S.sc; if (m.item === "Heavy-Duty Boots") return;
    const mg = m.ability === "Magic Guard";
    if (sc.rocks && !mg) this.hurt(i, m.max*effOf("Rock", m.types)/8, ev, `Pointed stones dug into ${this.who(i)}!`);
    if (m.hp > 0 && sc.spikes && this.grounded(m) && !mg) this.hurt(i, m.max*[0, 1/8, 1/6, 1/4][sc.spikes], ev, `${this.who(i)} was hurt by the spikes!`);
    if (m.hp > 0 && sc.tspikes && this.grounded(m)) { if (m.types.includes("Poison")) { sc.tspikes = 0; this.msg(ev, `${this.who(i)} absorbed the poison spikes!`); } else this.setStatus(i, sc.tspikes >= 2 ? "tox" : "psn", ev); }
    if (m.hp > 0 && sc.web && this.grounded(m)) { this.msg(ev, `${this.who(i)} was caught in a sticky web!`); this.boost(i, {spe:-1}, ev, {foe:true}); }
  }
  setWeather(w, src, ev){
    if (this.weather === w) return false;
    this.weather = w; this.wTurns = src && src.item === WEATHER_ROCK[w] ? 8 : 5;
    this.msg(ev, WEATHER_TXT[w][0], {w}); for (const i of [0, 1]) { this.checkQP(i, ev); } return true;
  }
  setTerrain(t, src, ev){
    if (this.terrain === t) return false;
    this.terrain = t; this.tTurns = src && src.item === "Terrain Extender" ? 8 : 5;
    this.msg(ev, TERRAIN_TXT[t][0], {ter:t}); for (const i of [0, 1]) { this.seed(i, ev); this.checkQP(i, ev); } return true;
  }
  seed(i, ev){
    const m = this.get(i); if (!m || m.hp <= 0 || !this.terrain) return;
    const S = {"Electric Seed":["electric", "def"], "Grassy Seed":["grassy", "def"], "Misty Seed":["misty", "spd"], "Psychic Seed":["psychic", "spd"]}[m.item];
    if (S && S[0] === this.terrain) { m.item = ""; m.v.unburden = true; this.boost(i, {[S[1]]:1}, ev, {by:`${S[0][0].toUpperCase() + S[0].slice(1)} Seed`}); }
  }
  checkQP(i, ev){
    const m = this.get(i); if (!m || m.hp <= 0 || m.v.qp) return;
    const A = m.ability; if (A !== "Protosynthesis" && A !== "Quark Drive") return;
    let on = (A === "Protosynthesis" && this.wx() === "sun") || (A === "Quark Drive" && this.terrain === "electric");
    if (!on && m.item === "Booster Energy") { m.item = ""; m.v.unburden = true; on = true; this.msg(ev, `${this.who(i)} used its Booster Energy to activate ${A}!`); }
    if (!on) return;
    let best = "atk"; for (const k of ["def", "spa", "spd", "spe"]) if (modStat(m.stats[k], m.stages[k]) > modStat(m.stats[best], m.stages[best])) best = k;
    m.v.qp = best; this.msg(ev, `${this.who(i)}’s ${STAT_NAME[best]} was heightened!`);
  }

  // ---------- HP, stats, status ----------
  heal(i, amt, ev, why, m = this.get(i)){
    if (m.hp <= 0 || m.hp >= m.max) return 0;
    const before = m.hp; m.hp = Math.min(m.max, m.hp + Math.max(1, Math.floor(amt)));
    if (m === this.get(i)) ev.push({k:"hp", side:i, hp:m.hp, max:m.max, heal:true}); else ev.push({k:"party", side:i, idx:this.s[i].party.indexOf(m), hp:m.hp, max:m.max});
    if (why) this.msg(ev, why);
    return m.hp - before;
  }
  hurt(i, amt, ev, why){
    const m = this.get(i); if (m.hp <= 0) return 0;
    const d = Math.min(m.hp, Math.max(1, Math.floor(amt))); m.hp -= d; ev.push({k:"hp", side:i, hp:m.hp, max:m.max});
    if (why) this.msg(ev, why);
    if (m.hp <= 0) this.faint(i, ev); else this.hpBerry(i, ev);
    return d;
  }
  faint(i, ev){
    const m = this.get(i); if (m.v.fainted) return; m.v.fainted = true; m.status = null;
    ev.push({k:"faint", side:i, idx:this.s[i].act, t:`${this.who(i, m)} fainted!`});
    this.s[i].lostAllies++;
  }
  // stat stage changes; o.foe = caused by the other side (blocked by Clear Body etc.), o.by = ability/item name
  boost(i, ch, ev, o = {}){
    const m = this.get(i); if (!m || m.hp <= 0) return false;
    const A = m.ability, S = this.s[i]; let any = false, dropped = false;
    for (let [k, v] of Object.entries(ch)) {
      k = {accuracy:"acc", evasion:"eva"}[k] || k;
      if (!(k in m.stages) || !v) continue;
      if (A === "Contrary") v = -v; if (A === "Simple") v *= 2;
      if (v < 0 && o.foe) {
        if (S.sc.mist) { this.msg(ev, `${this.who(i)} is protected by the mist!`); continue; }
        if (m.item === "Clear Amulet") { this.msg(ev, `The effects of ${this.who(i)}’s Clear Amulet prevent its stats from being lowered!`); continue; }
        if (["Clear Body", "White Smoke", "Full Metal Body"].includes(A) || (A === "Hyper Cutter" && k === "atk") || (A === "Big Pecks" && k === "def") || ((A === "Keen Eye" || A === "Mind's Eye") && k === "acc")) { this.msg(ev, `${this.who(i)}’s ${A} prevents its ${STAT_NAME[k]} from being lowered!`); continue; }
      }
      const before = m.stages[k]; m.stages[k] = Math.max(-6, Math.min(6, before + v)); const d = m.stages[k] - before, who = this.who(i);
      const t = d === 0 ? `${who}’s ${STAT_NAME[k]} won’t go any ${v > 0 ? "higher" : "lower"}!`
        : o.by ? `${who}’s ${o.by} ${d > 0 ? "raised" : "lowered"} its ${STAT_NAME[k]}!`
        : `${who}’s ${STAT_NAME[k]} ${d > 0 ? "rose" : "fell"}${Math.abs(d) >= 3 ? (d > 0 ? " drastically" : " severely") : Math.abs(d) >= 2 ? (d > 0 ? " sharply" : " harshly") : ""}!`;
      this.msg(ev, t, {stat: d ? {side:i, up:d > 0} : null});
      if (d) any = true; if (d < 0) { dropped = true; m.v.lowered = this.turnNo; }
      if (d < 0 && o.foe && (A === "Defiant" || A === "Competitive")) this.boost(i, A === "Defiant" ? {atk:2} : {spa:2}, ev, {by:A});
    }
    if (any && !o.foe && !o.mirror) { const j = 1 - i, f = this.get(j); if (f && f.hp > 0 && f.item === "Mirror Herb") { const up = Object.fromEntries(Object.entries(ch).filter(([, v]) => v > 0)); if (Object.keys(up).length) { f.item = ""; this.boost(j, up, ev, {by:"Mirror Herb", mirror:true}); } } }
    if (dropped && m.item === "White Herb") { for (const k in m.stages) if (m.stages[k] < 0) m.stages[k] = 0; m.item = ""; m.v.unburden = true; this.msg(ev, `${this.who(i)} returned its stats to normal using its White Herb!`); }
    if (dropped && m.item === "Eject Pack" && this.bench(i).length && m.hp > 0) { m.item = ""; this.msg(ev, `${this.who(i)} is switched out by the Eject Pack!`); this.selfSwitch(i, ev); }
    return any;
  }
  canStatus(i, st, src, quiet = true, ev){
    const m = this.get(i), A = m.ability;
    const no = t => { if (!quiet && ev) this.msg(ev, t); return false; };
    if (!m || m.hp <= 0) return false;
    if (m.status) return no(m.status === st ? `${this.who(i)} is already ${{brn:"burned", par:"paralyzed", psn:"poisoned", tox:"poisoned", slp:"asleep", frz:"frozen"}[st]}!` : "But it failed!");
    if (A === "Comatose" || A === "Purifying Salt" || (A === "Leaf Guard" && this.wx() === "sun")) return no(`It doesn’t affect ${this.who(i)}…`);
    const imT = {brn:["Fire"], par:["Electric"], psn:["Poison", "Steel"], tox:["Poison", "Steel"], frz:["Ice"], slp:[]}[st];
    if (m.types.some(t => imT.includes(t)) && !((st === "psn" || st === "tox") && src && src.ability === "Corrosion")) return no(`It doesn’t affect ${this.who(i)}…`);
    const imA = {brn:["Water Veil", "Water Bubble", "Thermal Exchange"], par:["Limber"], psn:["Immunity", "Pastel Veil"], tox:["Immunity", "Pastel Veil"], frz:["Magma Armor"], slp:["Insomnia", "Vital Spirit", "Sweet Veil"]}[st];
    if (imA.includes(A)) return no(`${this.who(i)}’s ${A} prevents it!`);
    if (st === "frz" && this.wx() === "sun") return false;
    const g = this.grounded(m);
    if (this.terrain === "misty" && g) return no(`${this.who(i)} surrounds itself with a protective mist!`);
    if (st === "slp" && this.terrain === "electric" && g) return no(`${this.who(i)} surrounds itself with electrified terrain!`);
    if (this.s[i].sc.safeguard && src && src !== m) return no(`${this.who(i)} is protected by Safeguard!`);
    return true;
  }
  setStatus(i, st, ev, src, quiet = true){
    const m = this.get(i); if (st === "tri") st = ["brn", "par", "frz"][this.r(3)];
    if (!this.canStatus(i, st, src, quiet, ev)) return false;
    m.status = st; m.toxN = 0; if (st === "slp") m.sleep = 2 + this.r(3);
    ev.push({k:"st", side:i, st}); this.msg(ev, `${this.who(i)} ${ST_GOT[st]}`);
    this.berryCure(i, ev);
    if (m.ability === "Synchronize" && src && src !== m && src === this.get(1 - i) && ["brn", "par", "psn", "tox"].includes(st) && m.status) { this.msg(ev, `${this.who(i)}’s Synchronize!`); this.setStatus(1 - i, st, ev, m); }
    return true;
  }
  cure(i, ev, why, m = this.get(i)){
    if (!m.status) return; const was = m.status; m.status = null; m.sleep = 0; m.toxN = 0;
    if (m === this.get(i)) ev.push({k:"st", side:i, st:null});
    this.msg(ev, why || `${this.who(i, m)} ${was === "slp" ? "woke up!" : was === "frz" ? "thawed out!" : "was cured of its " + {brn:"burn", par:"paralysis", psn:"poisoning", tox:"poisoning"}[was] + "!"}`);
  }
  confuse(i, ev, quiet){
    const m = this.get(i); if (m.hp <= 0) return false;
    if (m.v.confusion) { if (!quiet) this.msg(ev, `${this.who(i)} is already confused!`); return false; }
    if (m.ability === "Own Tempo") { if (!quiet) this.msg(ev, `${this.who(i)}’s Own Tempo prevents confusion!`); return false; }
    if (this.terrain === "misty" && this.grounded(m)) { if (!quiet) this.msg(ev, `${this.who(i)} surrounds itself with a protective mist!`); return false; }
    m.v.confusion = 2 + this.r(4); this.msg(ev, `${this.who(i)} became confused!`);
    if (m.item === "Persim Berry" || m.item === "Lum Berry") { const it = m.item; this.eat(i); m.v.confusion = 0; this.msg(ev, `${this.who(i)}’s ${it} snapped it out of its confusion!`); }
    return true;
  }
  eat(i, ev){ const m = this.get(i); m.v.ate = m.item; m.lastBerry = m.item; m.item = ""; m.v.unburden = true; if (m.ability === "Cheek Pouch" && m.hp > 0 && ev) this.heal(i, m.max/3, ev, `${this.who(i)}’s Cheek Pouch restored its HP!`); }
  nervous(i){ const f = this.get(1 - i); return !!f && f.hp > 0 && f.ability === "Unnerve"; }
  berryCure(i, ev){
    const m = this.get(i), c = STATUS_BERRY[m.item];
    if (!m.status || !c || this.nervous(i) || (c !== "all" && c !== m.status && !(c === "psn" && m.status === "tox"))) return;
    const it = m.item; this.eat(i); this.cure(i, ev, `${this.who(i)}’s ${it} cured its status!`);
  }
  hpBerryForce(i, ev){ const m = this.get(i), it = m.item; if (it === "Sitrus Berry") { this.eat(i, ev); this.heal(i, m.max/4, ev); } else if (it === "Oran Berry") { this.eat(i, ev); this.heal(i, 10, ev); } else if (FLAVOR_BERRY[it]) { this.eat(i, ev); this.heal(i, m.max/3, ev); } else if (PINCH_BERRY[it]) { this.eat(i, ev); this.boost(i, {[PINCH_BERRY[it]]:1}, ev, {by:it}); } else if (STATUS_BERRY[it]) { const c = STATUS_BERRY[it]; this.eat(i, ev); if (m.status && (c === "all" || c === m.status || (c === "psn" && m.status === "tox"))) this.cure(i, ev); } else this.eat(i, ev); }
  // HP berries: Sitrus/Oran at half, pinch berries at a quarter (half with Gluttony)
  hpBerry(i, ev){
    const m = this.get(i); if (m.hp <= 0 || !m.item) return;
    const it = m.item, q = m.ability === "Gluttony" ? 2 : 4, rip = m.ability === "Ripen" ? 2 : 1;
    if (/Berry$/.test(it) && this.nervous(i)) return;
    if (it === "Micle Berry" && m.hp <= m.max/q) { this.eat(i, ev); m.v.micle = true; this.msg(ev, `${this.who(i)} boosted the accuracy of its next move using its Micle Berry!`); return; }
    if (it === "Sitrus Berry" && m.hp <= m.max/2) { this.eat(i, ev); this.heal(i, Math.floor(m.max/4)*rip, ev, `${this.who(i)} restored its health using its Sitrus Berry!`); }
    else if (it === "Oran Berry" && m.hp <= m.max/2) { this.eat(i); this.heal(i, 10*rip, ev, `${this.who(i)} restored its health using its Oran Berry!`); }
    else if (it === "Berry Juice" && m.hp <= m.max/2) { m.item = ""; this.heal(i, 20, ev, `${this.who(i)} restored its health using its Berry Juice!`); }
    else if (FLAVOR_BERRY[it] && m.hp <= m.max/q) { this.eat(i); this.heal(i, Math.floor(m.max/3)*rip, ev, `${this.who(i)} restored its health using its ${it}!`); if ((NATURES[m.nature] || [])[1] === FLAVOR_BERRY[it]) this.confuse(i, ev, true); }
    else if (PINCH_BERRY[it] && m.hp <= m.max/q) { this.eat(i); this.boost(i, {[PINCH_BERRY[it]]:rip}, ev, {by:it}); }
    else if (it === "Lansat Berry" && m.hp <= m.max/q) { this.eat(i); m.v.critUp = (m.v.critUp || 0) + 2; this.msg(ev, `${this.who(i)} used its Lansat Berry to get pumped!`); }
    else if (it === "Starf Berry" && m.hp <= m.max/q) { this.eat(i); this.boost(i, {[["atk", "def", "spa", "spd", "spe"][this.r(5)]]:2*rip}, ev, {by:it}); }
    if (m.ability === "Berserk" && m.v.berserkFrom > m.max/2 && m.hp <= m.max/2 && m.hp > 0) this.boost(i, {spa:1}, ev, {by:"Berserk"});
    if (m.ability === "Anger Shell" && m.v.berserkFrom > m.max/2 && m.hp <= m.max/2 && m.hp > 0) this.boost(i, {atk:1, spa:1, spe:1, def:-1, spd:-1}, ev, {by:"Anger Shell"});
  }

  // ---------- choices ----------
  // what the active Pokémon may do this turn (moves left, locks, Taunt, Assault Vest, trapping)
  options(i){
    const S = this.s[i], m = this.get(i), foe = this.get(1 - i), v = m.v;
    const forced = v.recharge ? {move:-2, label:"Recharge"} : v.charging ? {move:v.charging.j, label:m.moves[v.charging.j][0]} : v.lock ? {move:v.lock.j, label:m.moves[v.lock.j][0]} : null;
    const moves = m.moves.map((mv, j) => {
      let ok = m.pp[j] > 0, why = ok ? "" : "No PP left";
      if (ok && v.choice !== undefined && v.choice !== j && m.item.startsWith("Choice")) { ok = false; why = `Locked into ${m.moves[v.choice][0]}`; }
      if (ok && v.encore && v.encore.j !== j) { ok = false; why = `Encore: only ${m.moves[v.encore.j][0]}`; }
      if (ok && !isDmg(mv) && v.taunt) { ok = false; why = "Taunted"; }
      if (ok && !isDmg(mv) && m.item === "Assault Vest") { ok = false; why = "Assault Vest blocks status moves"; }
      if (ok && v.lastName === mv[0] && (mv[0] === "Gigaton Hammer" || mv[0] === "Blood Moon" || v.torment)) { ok = false; why = v.torment ? "Tormented: can’t repeat a move" : "Can’t be used twice in a row"; }
      if (ok && v.disable && v.disable.name === mv[0]) { ok = false; why = "Disabled"; }
      if (ok && v.healBlock && !isDmg(mv) && (fl(mv, "h") || fxOf(mv).h)) { ok = false; why = "Heal Block"; }
      return {j, mv, pp:m.pp[j], max:maxPP(mv), ok, why};
    });
    const trapped = !m.types.includes("Ghost") && m.item !== "Shed Shell" && (!!v.partial || (v.trapped !== undefined && v.trapped !== null) || this.fairyLock === this.turnNo || (foe && foe.hp > 0 && ((foe.ability === "Shadow Tag" && m.ability !== "Shadow Tag") || (foe.ability === "Arena Trap" && this.grounded(m)) || (foe.ability === "Magnet Pull" && m.types.includes("Steel")))));
    return {moves, forced, struggle: !forced && !moves.some(x => x.ok), canSwitch: !forced && !trapped && this.bench(i).length > 0, trapped, bag: !!S.bag && !forced && BAG_ORDER.some(k => S.bag[k] > 0)};
  }

  // ---------- one turn ----------
  // choices: [{move:j} | {sw:k} | {item:name, target:k} , …]; j = -1 Struggle, -2 recharge
  turn(ch){
    if (this.over) return [];
    const ev = []; this.turnNo++;
    for (const i of [0, 1]) { const m = this.get(i); if (m) { m.v.hitBy = null; m.v.moved = false; m.v.failed = m.v.failedNext || false; m.v.failedNext = false; m.v.turns = (m.v.turns || 0) + 1; } this.s[i].faintedThis = false; }
    // Bag items first, then switches (fastest first), then moves
    for (const i of [0, 1]) if (ch[i] && ch[i].item) this.useItem(i, ch[i].item, ch[i].target, ev);
    for (const i of this.order([0, 1])) if (ch[i] && ch[i].sw !== undefined) this.switchOut(i, ch[i].sw, ev);
    const q = [0, 1].filter(i => ch[i] && ch[i].move !== undefined).map(i => {
      const m = this.get(i), j = ch[i].move, mv = j >= 0 ? m.moves[j] : STRUGGLE;
      let pr = j === -2 ? 0 : mv[6];
      if (m.ability === "Prankster" && !isDmg(mv)) pr += 1;
      if (m.ability === "Gale Wings" && mv[1] === "Flying" && m.hp === m.max) pr += 1;
      if (m.ability === "Triage" && (fl(mv, "h") || fxOf(mv).d)) pr += 3;
      if (mv[0] === "Grassy Glide" && this.terrain === "grassy" && this.grounded(m)) pr += 1;
      let sub = 0;
      if (m.item === "Quick Claw" && this.chance(.2)) { sub = 1; this.msg(ev, `${this.who(i)}’s Quick Claw let it move first!`); }
      else if (m.ability === "Quick Draw" && isDmg(mv) && this.chance(.3)) { sub = 1; this.msg(ev, `${this.who(i)}’s Quick Draw let it move first!`); }
      else if (m.item === "Custap Berry" && m.hp <= m.max/(m.ability === "Gluttony" ? 2 : 4) && !this.nervous(i) && j !== -2) { sub = 1; this.eat(i, ev); this.msg(ev, `${this.who(i)} can act faster than normal, thanks to its Custap Berry!`); }
      if (m.item === "Lagging Tail" || m.item === "Full Incense" || m.ability === "Stall") sub = -1;
      return {i, j, pr, sub};
    });
    this.queue = q; this.foeMove = Object.fromEntries(q.map(x => [x.i, x.j]));
    this.runQueue(ev);
    return ev;
  }
  nextInQueue(){
    const tr = this.trickRoom > 0;
    this.queue.sort((x, y) => y.pr - x.pr || y.sub - x.sub || (tr ? 1 : -1)*(this.speed(this.get(x.i)) - this.speed(this.get(y.i))) || (this.rand() - .5));
    return this.queue.shift();
  }
  runQueue(ev){
    while (this.queue && this.queue.length && !this.over) {
      const a = this.nextInQueue(), m = this.get(a.i);
      this.curPrio = a.pr;
      if (m.hp > 0 && !m.v.switchedIn) this.act(a.i, a.j, ev);
      this.check(ev, true);
      if (this.pend) return;   // waiting for the player to pick who comes in (U-turn, Eject Button…)
    }
    if (this.over) return;
    this.queue = null;
    this.endTurn(ev);
    this.check(ev);
  }
  // finish a pending mid-turn switch (U-turn, Volt Switch, Baton Pass, Eject Button…) and carry on with the turn
  resume(i, k){
    const ev = [], p = this.pend; if (!p || p.side !== i) return ev;
    this.pend = null; this.need[i] = null;
    this.doSwitch(i, k, ev, p.pass);
    this.runQueue(ev);
    return ev;
  }
  selfSwitch(i, ev, pass){
    if (!this.bench(i).length || this.over) return;
    if (this.s[i].human) { this.pend = {side:i, pass}; this.need[i] = "uturn"; return; }
    this.doSwitch(i, this.aiReplace(i), ev, pass);
  }
  switchOut(i, k, ev){
    const S = this.s[i], out = this.get(i);
    ev.push({k:"recall", side:i, t: S.human === false ? `${S.name} withdrew ${out.name}!` : `Come back, ${out.name}!`});
    this.leave(i);
    S.act = k; this.enter(i, ev); this.get(i).v.switchedIn = true;
  }
  doSwitch(i, k, ev, pass){
    const S = this.s[i], out = this.get(i);
    if (pass) S.passing = {stages:{...out.stages}, sub:out.v.sub, critUp:out.v.critUp, confusion:out.v.confusion};
    if (out.hp > 0) ev.push({k:"recall", side:i, t: S.human === false ? `${S.name} withdrew ${out.name}!` : `Come back, ${out.name}!`});
    this.leave(i);
    S.act = k; this.enter(i, ev); this.get(i).v.switchedIn = true;
  }
  leave(i){
    const m = this.get(i);
    if (m.hp > 0 && m.ability === "Regenerator") m.hp = Math.min(m.max, m.hp + Math.floor(m.max/3));
    if (m.hp > 0 && m.ability === "Natural Cure" && m.status) { m.status = null; m.sleep = 0; }
    if (m.status === "tox") m.toxN = 0;
    const foe = this.get(1 - i); if (foe && foe.v.leechFrom === i) { /* seed belongs to the target, nothing to do */ }
    if (foe) { if (foe.v.trapped === i) foe.v.trapped = null; if (foe.v.partial && foe.v.partial.from === i) foe.v.partial = null; }
    if (m.v.origAbility !== undefined) m.ability = m.v.origAbility;
    if (m.v.powerTrick) [m.stats.atk, m.stats.def] = [m.stats.def, m.stats.atk];
    const sp = NAT_BY.get(m.n); if (sp) { const st = calcStats(sp.stats, m.level, m.nature, m.evs, m.ivs, baseOf(m.n) === 292); m.stats = {...st, hp:m.stats.hp}; m.types = [...sp.types]; }
    m.v = {}; m.stages = {atk:0, def:0, spa:0, spd:0, spe:0, acc:0, eva:0};
  }
  // bag items (any side may carry a bag; AI trainers use theirs in aiItem)
  useItem(i, it, k, ev){
    const S = this.s[i], B = BAG_ITEMS[it]; if (!S.bag || !(S.bag[it] > 0) || !B) return false;
    const m = S.party[k === undefined ? S.act : k], active = m === this.get(i);
    if (!bagCanUse(it, m, active)) return false;
    S.bag[it]--; const who = S.human === false ? `${S.name}` : (S.name || "You");
    this.msg(ev, `${who} used ${/^[AEIOU]/.test(it) ? "an" : "a"} ${it}${active ? "" : ` on ${m.name}`}!`, {item:it});
    if (B.revive) { m.hp = Math.max(1, Math.floor(m.max*B.revive)); m.status = null; m.sleep = 0; m.toxN = 0; m.v = {}; ev.push({k:"party", side:i, idx:S.party.indexOf(m), hp:m.hp, max:m.max, revived:true}); this.msg(ev, `${m.name} was revived!`); return true; }
    if (B.heal) { const before = m.hp; m.hp = B.heal === "full" ? m.max : Math.min(m.max, m.hp + B.heal);
      if (m.hp > before) { if (active) ev.push({k:"hp", side:i, hp:m.hp, max:m.max, heal:true}); else ev.push({k:"party", side:i, idx:S.party.indexOf(m), hp:m.hp, max:m.max}); this.msg(ev, `${active ? this.who(i) : m.name}’s HP was restored by ${m.hp - before} point${m.hp - before === 1 ? "" : "s"}.`); } }
    if (B.cure) { const cures = B.cure === "all" || B.cure.includes(m.status); if (m.status && cures) this.cure(i, ev, null, m); if (B.cure === "all" && active && m.v.confusion) { m.v.confusion = 0; this.msg(ev, `${this.who(i)} snapped out of its confusion!`); } }
    if (B.boost) this.boost(i, B.boost, ev);
    if (B.crit) { m.v.critUp = Math.max(m.v.critUp || 0, 2); this.msg(ev, `${this.who(i)} is getting pumped!`); }
    if (B.mist) { S.sc.mist = 5; this.msg(ev, `${S.human === false ? S.name + "’s team" : "Your team"} became shrouded in mist!`); }
    return true;
  }

  // ---------- using a move ----------
  act(i, j, ev){
    const me = this.get(i), foe = this.get(1 - i), v = me.v;
    if (j === -2 || v.recharge) { v.recharge = false; this.msg(ev, `${this.who(i)} must recharge!`); v.moved = true; return; }
    let mv = j >= 0 ? me.moves[j] : STRUGGLE; if (!mv) { mv = STRUGGLE; j = -1; }
    const fx = fxOf(mv), nm = mv[0], cont = !!(v.charging || v.lock);
    v.moved = true; v.acts = (v.acts || 0) + 1;
    // things that stop a move
    if (me.status === "slp") {
      me.sleep -= me.ability === "Early Bird" ? 2 : 1;
      if (me.sleep <= 0) this.cure(i, ev);
      else if (!fx.su) { this.msg(ev, `${this.who(i)} is fast asleep.`); v.charging = null; v.lock = null; return; }
    }
    if (me.status === "frz") {
      if (fl(mv, "f") || this.chance(.2)) this.cure(i, ev);
      else { this.msg(ev, `${this.who(i)} is frozen solid!`); return; }
    }
    if (me.ability === "Truant") { if (v.loaf) { v.loaf = false; this.msg(ev, `${this.who(i)} is loafing around!`); return; } v.loaf = true; }
    if (v.flinch) { this.msg(ev, `${this.who(i)} flinched and couldn’t move!`); if (me.ability === "Steadfast") this.boost(i, {spe:1}, ev, {by:"Steadfast"}); v.charging = null; return; }
    if (v.taunt && !isDmg(mv) && mv !== STRUGGLE) { this.msg(ev, `${this.who(i)} can’t use ${nm} after the taunt!`); return; }
    if (v.disable && v.disable.name === nm) { this.msg(ev, `${this.who(i)}’s ${nm} is disabled!`); return; }
    if (v.healBlock && (fl(mv, "h") || fx.h) && !isDmg(mv)) { this.msg(ev, `${this.who(i)} can’t use ${nm} because of Heal Block!`); return; }
    if (this.gravity && ["Fly", "Bounce", "Sky Drop", "High Jump Kick", "Jump Kick", "Splash", "Magnet Rise", "Telekinesis", "Flying Press", "Floaty Fall"].includes(nm)) { this.msg(ev, `${this.who(i)} can’t use ${nm} because of gravity!`); return; }
    if (v.confusion) {
      v.confusion--;
      if (!v.confusion) this.msg(ev, `${this.who(i)} snapped out of its confusion!`);
      else {
        this.msg(ev, `${this.who(i)} is confused!`);
        if (this.chance(1/3)) {
          const a = modStat(me.stats.atk, me.stages.atk), d = modStat(me.stats.def, me.stages.def), b = baseDamage(me.level, 40, a, d);
          this.hurt(i, Math.floor(b*(85 + this.r(16))/100), ev, "It hurt itself in its confusion!"); v.charging = null; v.lock = null; return;
        }
      }
    }
    if (me.status === "par" && this.chance(.25)) { this.msg(ev, `${this.who(i)} is paralyzed! It can’t move!`); v.charging = null; v.lock = null; return; }
    // PP, locks
    if (j >= 0 && !cont) me.pp[j] = Math.max(0, me.pp[j] - (foe && foe.hp > 0 && foe.ability === "Pressure" ? 2 : 1));
    if (j >= 0 && me.item.startsWith("Choice")) v.choice = j;
    if (!fx.stall && !(fx.v === "endure")) v.stall = 0;
    if (me.item === "Metronome") { v.metro = v.metro && v.metro.name === nm ? {name:nm, n:v.metro.n + 1} : {name:nm, n:0}; }
    v.furyCutter = v.lastName === "Fury Cutter" && nm === "Fury Cutter" ? (v.furyCutter || 0) + 1 : 0;
    v.echo = this.lastEcho === this.turnNo - 1 && nm === "Echoed Voice" ? (v.echo || 0) + 1 : 0;
    v.lastName = nm; if (j >= 0) v.lastJ = j; this.lastMove = mv;
    if (me.ability === "Protean" || me.ability === "Libero") { const t = this.moveType(me, mv); if (t !== "???" && !v.protean && (me.types.length !== 1 || me.types[0] !== t)) { me.types = [t]; v.protean = true; this.msg(ev, `${this.who(i)} transformed into the ${t} type!`); } }
    ev.push({k:"move", side:i, mv:nm, t:`${this.who(i)} used ${nm}!`, type:this.moveType(me, mv)});
    // two-turn moves
    if (fl(mv, "2") && !v.charging) {
      const w = this.wx(), skip = ((nm === "Solar Beam" || nm === "Solar Blade") && w === "sun" && !this.umbrella(me)) || (nm === "Electro Shot" && w === "rain" && !this.umbrella(me));
      this.msg(ev, `${this.who(i)} ${CHARGE_TXT[nm] || "is charging up!"}`);
      if (nm === "Skull Bash") this.boost(i, {def:1}, ev);
      if (nm === "Meteor Beam" || nm === "Electro Shot") this.boost(i, {spa:1}, ev);
      if (!skip) {
        if (me.item === "Power Herb") { me.item = ""; v.unburden = true; this.msg(ev, `${this.who(i)} became fully charged due to its Power Herb!`); }
        else { v.charging = {j}; if (SEMI[nm]) v.semi = SEMI[nm]; return; }
      }
    }
    v.charging = null; const semiWas = v.semi; v.semi = null;
    if (nm === "Echoed Voice") this.lastEcho = this.turnNo;
    if (isDmg(mv) && this.moveType(me, mv) === "Electric") v.charge = false;
    if (isDmg(mv)) v.laserFocus = false;
    let ok;
    if (!isDmg(mv)) ok = this.statusMove(i, mv, ev);
    else ok = this.attack(i, j, mv, ev, semiWas);
    if (ok === false) { v.failedNext = true; if (v.lock) v.lock = null; }
    // locked moves (Outrage etc.) end in confusion
    if (fx.sv === "lockedmove" && me.hp > 0) {
      if (!v.lock && ok !== false) v.lock = {j, left:1 + this.r(2)};
      else if (v.lock && !v.lock.roll) { v.lock.left--; if (v.lock.left <= 0) { v.lock = null; if (!v.confusion) { this.msg(ev, `${this.who(i)} became confused due to fatigue!`); this.confuse(i, ev, true); } } }
    }
    if (fx.sv === "mustrecharge" && ok !== false && me.hp > 0) v.recharge = true;
    if ((nm === "Rollout" || nm === "Ice Ball") && me.hp > 0) { if (ok === false) { v.roll = 0; v.lock = null; } else { v.roll = (v.roll || 0) + 1; if (v.roll < 5) v.lock = {j, left:99, roll:true}; else { v.roll = 0; v.lock = null; } } }
    if (j >= 0 && v.encore) { v.encore.left--; if (v.encore.left <= 0) { v.encore = null; this.msg(ev, `${this.who(i)}’s encore ended!`); } }
  }
  accuracy(i, mv, semi){
    const me = this.get(i), foe = this.get(1 - i), fx = fxOf(mv), nm = mv[0], w = this.wx();
    if (me.ability === "No Guard" || foe.ability === "No Guard" || (me.v.lockOn && me.v.lockOn >= this.turnNo)) return true;
    if (foe.v.minimized && ["Body Slam", "Stomp", "Dragon Rush", "Heat Crash", "Heavy Slam", "Flying Press", "Malicious Moonsault", "Steamroller", "Supercell Slam"].includes(nm) && !foe.v.semi) return true;
    if (foe.v.semi && !HITS_SEMI[foe.v.semi].includes(nm)) return false;
    let acc = mv[4];
    if ((nm === "Thunder" || nm === "Hurricane" || nm === "Bleakwind Storm" || nm === "Wildbolt Storm" || nm === "Sandsear Storm") && w === "rain") return true;
    if ((nm === "Thunder" || nm === "Hurricane") && w === "sun") acc = 50;
    if (nm === "Blizzard" && w === "snow") return true;
    if (nm === "Toxic" && me.types.includes("Poison")) return true;
    if (!acc) return true;
    if (fx.ohko) { if (foe.level > me.level) return false; acc = (nm === "Sheer Cold" && !me.types.includes("Ice") ? 20 : 30) + me.level - foe.level; return this.r(100) < acc; }
    let b = me.stages.acc;
    if (!fx.ige && foe.ability !== "Unaware" && !((me.ability === "Keen Eye" || me.ability === "Mind's Eye") && foe.stages.eva > 0) && me.ability !== "Unaware") b -= foe.stages.eva;
    else if (me.ability === "Unaware") b = me.stages.acc;
    b = Math.max(-6, Math.min(6, b));
    acc = b > 0 ? Math.floor(acc*ACC_T[b]) : b < 0 ? Math.floor(acc/ACC_T[-b]) : acc;
    if (this.gravity) acc = Math.floor(acc*5/3);
    const mods = [];
    if (me.ability === "Compound Eyes") mods.push(5325);
    if (me.ability === "Hustle" && mv[2] === "P") mods.push(3277);
    if ((foe.ability === "Sand Veil" && w === "sand") || (foe.ability === "Snow Cloak" && w === "snow")) mods.push(3277);
    if (foe.item === "Bright Powder" || foe.item === "Lax Incense") mods.push(3686);
    if (me.item === "Wide Lens") mods.push(4505);
    if (me.item === "Zoom Lens" && foe.v.moved) mods.push(4915);
    if (me.v.micle) { mods.push(4915); me.v.micle = false; }
    acc = pokeRound(acc*chainMods(mods, 0, 1 << 30)/4096);
    void semi;
    return this.r(100) < acc;
  }
  // protection, semi-invulnerability, accuracy; returns true when the move goes through
  lands(i, mv, ev){
    const me = this.get(i), foe = this.get(1 - i), fx = fxOf(mv);
    if (!foe || foe.hp <= 0) { this.msg(ev, "But there was no target…"); return false; }
    const sideG = this.s[1 - i].guard;
    if (sideG && sideG.turn === this.turnNo && fl(mv, "x") && !fx.bp && ((sideG.kind === "quick" && this.curPrio > 0) || (sideG.kind === "crafty" && !isDmg(mv)) || (sideG.kind === "mat" && isDmg(mv)))) { this.msg(ev, `${this.who(1 - i)} was protected by ${{quick:"Quick Guard", crafty:"Crafty Shield", mat:"Mat Block"}[sideG.kind]}!`); return false; }
    if (foe.v.magicCoat && fl(mv, "m") && !isDmg(mv)) return "bounce";
    if (foe.v.protect && fl(mv, "x") && !fx.bp && !(me.ability === "Unseen Fist" && fl(mv, "c"))) {
      this.msg(ev, `${this.who(1 - i)} protected itself!`);
      const p = foe.v.protect, ct = fl(mv, "c") && me.item !== "Protective Pads" && !(me.item === "Punching Glove" && fl(mv, "p"));
      if (ct && isDmg(mv)) {
        if (p === "spikyshield" && me.ability !== "Magic Guard") this.hurt(i, me.max/8, ev, `${this.who(i)} was hurt by the Spiky Shield!`);
        else if (p === "banefulbunker") this.setStatus(i, "psn", ev, foe);
        else if (p === "burningbulwark") this.setStatus(i, "brn", ev, foe);
        else if (p === "kingsshield") this.boost(i, {atk:-1}, ev, {foe:true});
        else if (p === "silktrap") this.boost(i, {spe:-1}, ev, {foe:true});
        else if (p === "obstruct") this.boost(i, {def:-2}, ev, {foe:true});
      }
      return false;
    }
    if (!this.accuracy(i, mv)) {
      this.msg(ev, foe.v.semi ? `${this.who(1 - i)} avoided the attack!` : `${this.who(i)}’s attack missed!`);
      if (me.item === "Blunder Policy" && !fx.ohko) { me.item = ""; this.boost(i, {spe:2}, ev, {by:"Blunder Policy"}); }
      return false;
    }
    return true;
  }
  attack(i, j, mv, ev, semi){
    const me = this.get(i), foe = this.get(1 - i), fx = fxOf(mv), nm = mv[0], S = this.s[i], FS = this.s[1 - i];
    const crash = () => { if (fx.crash && me.ability !== "Magic Guard") this.hurt(i, me.max/2, ev, `${this.who(i)} kept going and crashed!`); };
    if ((nm === "Fake Out" || nm === "First Impression" || nm === "Mat Block") && (me.v.acts || 0) > 1) { this.msg(ev, "But it failed!"); return false; }
    if ((nm === "Sucker Punch" || nm === "Thunderclap") && (foe.v.moved || !(this.foeMove && this.foeMove[1 - i] !== undefined && this.foeMove[1 - i] >= 0 && isDmg(foe.moves[this.foeMove[1 - i]])))) { this.msg(ev, "But it failed!"); return false; }
    if (nm === "Focus Punch" && me.v.hitBy && me.v.hitBy.turn === this.turnNo) { this.msg(ev, `${this.who(i)} lost its focus and couldn’t move!`); return false; }
    if (nm === "Burn Up" && !me.types.includes("Fire")) { this.msg(ev, "But it failed!"); return false; }
    if (nm === "Belch" && !me.lastBerry) { this.msg(ev, "But it failed!"); return false; }
    if (nm === "Spit Up" && !me.v.stockpile) { this.msg(ev, "But it failed!"); return false; }
    if (nm === "Future Sight" || nm === "Doom Desire") {
      if (FS.future) { this.msg(ev, "But it failed!"); return false; }
      FS.future = {turn:this.turnNo + 2, a:me, mv, side:i, name:nm}; this.msg(ev, nm === "Future Sight" ? `${this.who(i)} foresaw an attack!` : `${this.who(i)} chose Doom Desire as its destiny!`); return true;
    }
    if (nm === "Poltergeist" && !foe.item) { this.msg(ev, "But it failed!"); return false; }
    if (!this.lands(i, mv, ev)) { crash(); if (fx.sd && nm !== "Final Gambit") this.selfKO(i, ev); return false; }
    if ((nm === "Brick Break" || nm === "Psychic Fangs" || nm === "Raging Bull") && (FS.sc.reflect || FS.sc.lightscreen || FS.sc.auroraveil) && this.typeMul(me, foe, mv, this.moveType(me, mv)) > 0) { FS.sc.reflect = FS.sc.lightscreen = FS.sc.auroraveil = 0; this.msg(ev, "It shattered the barrier!"); }
    if (nm === "Spit Up") { me.v.stockpile = 0; }
    const movedLast = foe.v.moved && !foe.v.switchedIn, lost = S.lostAllies;
    const pb = me.ability === "Parental Bond" && !fxOf(mv).mh && !fx.ohko && !fx.fd && !["Seismic Toss", "Night Shade", "Super Fang", "Final Gambit", "Endeavor", "Counter", "Mirror Coat", "Metal Burst", "Psywave"].includes(nm) && !fx.sd && !fl(mv, "2");
    const hits = pb ? 2 : this.numHits(me, mv), dSide = FS.sc, aSide = S.sc;
    let total = 0, n = 0, eff = 1, lastCrit = false, anyHit = false, ohko = false;
    for (let h = 1; h <= hits; h++) {
      if (foe.hp <= 0 || me.hp <= 0) break;
      if (h > 1 && fx.ma && me.item !== "Loaded Dice" && !this.accuracy(i, mv)) break;
      const crit = this.rollCrit(me, foe, mv);
      const r = this.calc(me, foe, mv, {crit, hit:pb ? 1 : h, child:pb && h === 2, dSide, aSide, movedLast, lostAllies:lost, prio:mv[6], ppLeft:j >= 0 ? me.pp[j] : 4});
      if (h === 1) {
        if (r.immune) { this.immune(i, r, mv, ev); crash(); if (fx.sd && nm !== "Final Gambit") this.selfKO(i, ev); return false; }
        if (r.fail) { this.msg(ev, "But it failed!"); crash(); return false; }
        if (r.ohko) { if (foe.ability === "Sturdy") { this.msg(ev, `${this.who(1 - i)} endured the hit with Sturdy!`); return false; } if (nm === "Sheer Cold" && foe.types.includes("Ice")) { this.msg(ev, `It doesn’t affect ${this.who(1 - i)}…`); return false; } ohko = true; }
      }
      eff = r.eff; lastCrit = r.crit;
      let dmg = r.rolls[this.r(16)];
      // resist berry
      if (r.berry && foe.item === r.berry) { this.msg(ev, `${this.who(1 - i)}’s ${r.berry} weakened the damage!`); this.eat(1 - i); }
      // substitute takes the hit
      if (foe.v.sub && !fl(mv, "o") && !fl(mv, "y") && me.ability !== "Infiltrator") {
        dmg = Math.min(dmg, foe.v.sub); foe.v.sub -= dmg; total += dmg; n++; anyHit = true;
        this.msg(ev, "The substitute took damage for it!"); if (r.crit) this.msg(ev, "A critical hit!");
        if (foe.v.sub <= 0) { foe.v.sub = 0; this.msg(ev, `${this.who(1 - i)}’s substitute faded!`); ev.push({k:"sub", side:1 - i, on:false}); }
        continue;
      }
      if (foe.ability === "Disguise" && !foe.disguised && !["Mold Breaker", "Teravolt", "Turboblaze"].includes(me.ability)) {
        foe.disguised = true; this.msg(ev, "Its disguise served it as a decoy!"); this.msg(ev, `${this.who(1 - i)}’s disguise was busted!`);
        n++; anyHit = true; this.hurt(1 - i, foe.max/8, ev); continue;
      }
      const full = foe.hp === foe.max, before = foe.hp;
      let endured = null;
      if (dmg >= foe.hp) {
        if (foe.v.endure) { dmg = foe.hp - 1; endured = "endure"; }
        else if (full && foe.item === "Focus Sash" && !ohko) { dmg = foe.hp - 1; endured = "Focus Sash"; foe.item = ""; }
        else if (full && foe.ability === "Sturdy" && !ohko && !(["Mold Breaker", "Teravolt", "Turboblaze"].includes(me.ability))) { dmg = foe.hp - 1; endured = "Sturdy"; }
        else if (foe.item === "Focus Band" && this.chance(.1)) { dmg = foe.hp - 1; endured = "Focus Band"; }
      }
      foe.v.berserkFrom = foe.hp;
      dmg = Math.min(dmg, foe.hp); foe.hp -= dmg; total += dmg; n++; anyHit = true;
      foe.v.hitBy = {dmg, cat:mv[2], turn:this.turnNo}; foe.v.damagedTurn = this.turnNo; foe.timesHit = (foe.timesHit || 0) + 1;
      ev.push({k:"hp", side:1 - i, hp:foe.hp, max:foe.max, hit:true, eff:r.eff});
      if (r.crit) this.msg(ev, "A critical hit!");
      if (ohko && foe.hp <= 0) this.msg(ev, "It’s a one-hit KO!");
      if (endured === "endure") this.msg(ev, `${this.who(1 - i)} endured the hit!`);
      else if (endured) this.msg(ev, `${this.who(1 - i)} hung on using its ${endured}!`);
      if (foe.item === "Air Balloon" && foe.hp > 0) { foe.item = ""; this.msg(ev, `${this.who(1 - i)}’s Air Balloon popped!`); }
      this.afterHit(i, mv, r, dmg, ev);
      if (foe.hp <= 0 && foe.ability === "Innards Out" && me.hp > 0) { this.hurt(i, dmg, ev, `${this.who(i)} was hurt by ${this.who(1 - i)}’s Innards Out!`); }
      if (foe.hp > 0 && (foe.ability === "Wimp Out" || foe.ability === "Emergency Exit") && before > foe.max/2 && foe.hp <= foe.max/2 && this.bench(1 - i).length && !fx.ss) { this.msg(ev, `${this.who(1 - i)}’s ${foe.ability} activated!`); this.selfSwitch(1 - i, ev); }
      if (foe.hp <= 0) { this.faint(1 - i, ev); if (foe.v.destinyBond && me.hp > 0) { this.msg(ev, `${this.who(1 - i)} took its attacker down with it!`); me.hp = 0; ev.push({k:"hp", side:i, hp:0, max:me.max}); this.faint(i, ev); } }
      else this.hpBerry(1 - i, ev);
    }
    if (!anyHit) return true;
    if (n && !ohko) { if (eff >= 2) this.msg(ev, "It’s super effective!", {se:true}); else if (eff < 1 && eff > 0) this.msg(ev, "It’s not very effective…"); }
    if (hits > 1 && n && !pb) this.msg(ev, `The Pokémon was hit ${n} time${n === 1 ? "" : "s"}!`);
    void lastCrit;
    // after the attack: drain, recoil, items, self-boosts, switching
    const mg = me.ability === "Magic Guard", sf = me.ability === "Sheer Force" && !!(fx.sf || fx.sec);
    if (fx.d && me.hp > 0 && total) {
      let amt = Math.round(total*fx.d[0]/fx.d[1]); if (me.item === "Big Root") amt = Math.floor(amt*5324/4096);
      if (foe.ability === "Liquid Ooze") { if (!mg) this.hurt(i, amt, ev, `${this.who(i)} sucked up the liquid ooze!`); }
      else this.heal(i, amt, ev, `${this.who(1 - i)} had its energy drained!`);
    }
    if (fx.r && me.hp > 0 && total && me.ability !== "Rock Head" && !mg) this.hurt(i, Math.max(1, Math.round(total*fx.r[0]/fx.r[1])), ev, `${this.who(i)} was damaged by the recoil!`);
    if (fx.sr && me.hp > 0) this.hurt(i, Math.max(1, Math.round(me.max/4)), ev, `${this.who(i)} was damaged by the recoil!`);
    if (fx.mbr && me.hp > 0 && !mg) this.hurt(i, Math.ceil(me.max/2), ev, `${this.who(i)} cut its own HP to power up its move!`);
    if (me.hp > 0 && me.item === "Shell Bell" && total) this.heal(i, Math.floor(total/8), ev, `${this.who(i)} restored a little HP using its Shell Bell!`);
    if (me.hp > 0 && me.item === "Life Orb" && !mg && !sf && total) this.hurt(i, Math.floor(me.max/10), ev, `${this.who(i)} lost some of its HP!`);
    if (me.hp > 0 && me.item === "Throat Spray" && fl(mv, "o")) { me.item = ""; this.boost(i, {spa:1}, ev, {by:"Throat Spray"}); }
    if (GEMS[me.item] && GEMS[me.item] === this.moveType(me, mv)) { this.msg(ev, `The ${me.item} strengthened ${nm}’s power!`); me.item = ""; me.v.unburden = true; }
    if (fx.sb && me.hp > 0) this.boost(i, fx.sb, ev);
    if (me.hp > 0 && foe.hp <= 0) {
      if (me.ability === "Moxie" || me.ability === "Chilling Neigh") this.boost(i, {atk:1}, ev, {by:me.ability});
      if (me.ability === "Grim Neigh") this.boost(i, {spa:1}, ev, {by:"Grim Neigh"});
      if (me.ability === "Beast Boost") { let k = "atk"; for (const s of ["def", "spa", "spd", "spe"]) if (me.stats[s] > me.stats[k]) k = s; this.boost(i, {[k]:1}, ev, {by:"Beast Boost"}); }
    }
    if (nm === "Knock Off" && foe.hp > 0 && foe.item && me.hp > 0) { this.msg(ev, `${this.who(i)} knocked off ${this.who(1 - i)}’s ${foe.item}!`); foe.item = ""; foe.v.unburden = true; }
    if ((nm === "Thief" || nm === "Covet") && foe.item && !me.item && me.hp > 0) { me.item = foe.item; foe.item = ""; this.msg(ev, `${this.who(i)} stole ${this.who(1 - i)}’s ${me.item}!`); }
    if ((nm === "Rapid Spin" || nm === "Mortal Spin") && me.hp > 0) this.clearHazards(i, ev);
    if (nm === "Spit Up" && me.v.stockDef) { this.boost(i, {def:-me.v.stockDef, spd:-me.v.stockDef}, ev); me.v.stockDef = 0; }
    if (nm === "Clear Smog" && foe.hp > 0) { foe.stages = {atk:0, def:0, spa:0, spd:0, spe:0, acc:0, eva:0}; this.msg(ev, `${this.who(1 - i)}’s stat changes were removed!`); }
    if (fx.dv === "partiallytrapped" && foe.hp > 0 && !foe.v.partial) { foe.v.partial = {from:i, left:me.item === "Grip Claw" ? 7 : 4 + this.r(2), band:me.item === "Binding Band", nm}; this.msg(ev, `${this.who(1 - i)} became trapped by ${nm}!`); }
    if (fx.dv === "smackdown" && foe.hp > 0 && !this.grounded(foe)) { foe.v.smackdown = true; if (foe.item === "Air Balloon") foe.item = ""; this.msg(ev, `${this.who(1 - i)} fell straight down!`); }
    if (TRAP_MOVES.has(nm) && foe.hp > 0) foe.v.trapped = i;
    if (fx.sd) this.selfKO(i, ev);
    if (fx.fs && foe.hp > 0 && me.hp > 0) this.drag(1 - i, ev);
    if (fx.ss && me.hp > 0) this.selfSwitch(i, ev);
    return true;
  }
  selfKO(i, ev){ const me = this.get(i); if (me.hp <= 0) return; me.hp = 0; ev.push({k:"hp", side:i, hp:0, max:me.max}); this.faint(i, ev); }
  immune(i, r, mv, ev){
    const foe = this.get(1 - i), fw = this.who(1 - i);
    if (r.immune === "ability") {
      const how = (ABSORB[r.by] || [])[1];
      if (how === "heal") { if (!this.heal(1 - i, foe.max/4, ev, `${fw} restored HP using its ${r.by}!`)) this.msg(ev, `${fw}’s ${r.by} made the move useless!`); }
      else if (how === "flash") { foe.v.flash = true; this.msg(ev, `The power of ${fw}’s Fire-type moves rose because of its Flash Fire!`); }
      else if (how === "def2") this.boost(1 - i, {def:2}, ev, {by:r.by});
      else if (how) this.boost(1 - i, {[how]:1}, ev, {by:r.by});
      else this.msg(ev, `${fw}’s ${r.by} made the move miss!`.replace(" made the move miss", r.by === "Levitate" ? " makes Ground moves miss" : " protected it"));
    } else if (r.immune === "balloon") this.msg(ev, `${fw} is floating on its Air Balloon!`);
    else if (r.immune === "terrain") this.msg(ev, `${fw} is protected by the Psychic Terrain!`);
    else this.msg(ev, `It doesn’t affect ${fw}…`);
  }
  // per-hit effects: contact abilities and items, secondary effects, thawing, Weakness Policy…
  afterHit(i, mv, r, dmg, ev){
    const me = this.get(i), foe = this.get(1 - i), fx = fxOf(mv), nm = mv[0], D = foe.ability, A = me.ability;
    const contact = fl(mv, "c") && me.item !== "Protective Pads" && !(me.item === "Punching Glove" && fl(mv, "p")) && A !== "Long Reach";
    const type = r.type, phys = mv[2] === "P", sf = A === "Sheer Force" && !!(fx.sf || fx.sec);
    if (foe.hp > 0 && foe.status === "frz" && (type === "Fire" || fx.tt)) this.cure(1 - i, ev);
    // defender's items
    if (foe.hp > 0 && r.eff >= 2 && foe.item === "Weakness Policy" && !r.fixed) { foe.item = ""; this.boost(1 - i, {atk:2, spa:2}, ev, {by:"Weakness Policy"}); }
    if (foe.hp > 0 && r.eff >= 2 && foe.item === "Enigma Berry") { this.eat(1 - i); this.heal(1 - i, foe.max/4, ev, `${this.who(1 - i)} restored its health using its Enigma Berry!`); }
    if (foe.hp > 0) { const tb = {"Absorb Bulb":["Water", "spa"], "Cell Battery":["Electric", "atk"], "Luminous Moss":["Water", "spd"], "Snowball":["Ice", "atk"]}[foe.item]; if (tb && tb[0] === type) { const it = foe.item; foe.item = ""; this.boost(1 - i, {[tb[1]]:1}, ev, {by:it}); } }
    if (foe.hp > 0 && ((foe.item === "Kee Berry" && phys) || (foe.item === "Maranga Berry" && !phys))) { const it = foe.item; this.eat(1 - i); this.boost(1 - i, phys ? {def:1} : {spd:1}, ev, {by:it}); }
    if (me.hp > 0 && ((foe.item === "Jaboca Berry" && phys) || (foe.item === "Rowap Berry" && !phys)) && A !== "Magic Guard") { const it = foe.item; this.eat(1 - i); this.hurt(i, me.max/8, ev, `${this.who(i)} was hurt by ${this.who(1 - i)}’s ${it}!`); }
    if (me.hp > 0 && contact && foe.item === "Rocky Helmet" && A !== "Magic Guard") this.hurt(i, me.max/6, ev, `${this.who(i)} was hurt by the Rocky Helmet!`);
    // defender's abilities
    if (me.hp > 0 && contact && (D === "Rough Skin" || D === "Iron Barbs") && A !== "Magic Guard") this.hurt(i, me.max/8, ev, `${this.who(i)} was hurt by ${this.who(1 - i)}’s ${D}!`);
    if (me.hp > 0 && contact && !me.status && this.chance(.3)) {
      const c = {"Static":"par", "Flame Body":"brn", "Poison Point":"psn", "Effect Spore":["slp", "par", "psn"][this.r(3)]}[D];
      if (c && !(D === "Effect Spore" && (me.types.includes("Grass") || A === "Overcoat" || me.item === "Safety Goggles")) && this.canStatus(i, c, foe)) { this.msg(ev, `${this.who(1 - i)}’s ${D}!`); this.setStatus(i, c, ev, foe); }
    }
    if (foe.hp > 0 && contact && A === "Poison Touch" && this.chance(.3)) this.setStatus(1 - i, "psn", ev, me);
    if (foe.hp > 0 && A === "Toxic Chain" && this.chance(.3)) this.setStatus(1 - i, "tox", ev, me);
    if (me.hp > 0 && contact && (D === "Mummy" || D === "Lingering Aroma") && A !== D && !["Multitype", "Stance Change", "Schooling", "Comatose", "Disguise", "Zen Mode", "Power Construct", "RKS System", "Shields Down", "Ice Face"].includes(A)) { me.ability = D; this.msg(ev, `${this.who(i)}’s Ability became ${D}!`); }
    if (me.hp > 0 && foe.hp > 0 && contact && D === "Wandering Spirit" && !["Multitype", "Stance Change", "Schooling", "Comatose", "Disguise", "Zen Mode", "Power Construct", "RKS System", "Shields Down", "Ice Face", "Wandering Spirit"].includes(A)) { [me.ability, foe.ability] = [foe.ability, me.ability]; this.msg(ev, `${this.who(i)} swapped Abilities with its target!`); }
    if (A === "Magician" && !me.item && foe.item && foe.ability !== "Sticky Hold" && me.hp > 0) { me.item = foe.item; foe.item = ""; this.msg(ev, `${this.who(i)} stole ${this.who(1 - i)}’s ${me.item}!`); }
    else if (D === "Pickpocket" && contact && !foe.item && me.item && foe.hp > 0 && me.ability !== "Sticky Hold") { foe.item = me.item; me.item = ""; this.msg(ev, `${this.who(1 - i)} stole ${this.who(i)}’s ${foe.item}!`); }
    if (D === "Toxic Debris" && phys && (this.s[i].sc.tspikes || 0) < 2) { this.s[i].sc.tspikes = (this.s[i].sc.tspikes || 0) + 1; this.msg(ev, `Poison spikes were scattered on the ground all around ${this.s[i].human === false ? "the opposing team" : "your team"}!`); }
    if (foe.hp > 0 && D === "Color Change" && type !== "???" && !foe.types.includes(type)) { foe.types = [type]; this.msg(ev, `${this.who(1 - i)} transformed into the ${type} type!`); }
    if (me.hp > 0 && contact && (D === "Gooey" || D === "Tangling Hair")) this.boost(i, {spe:-1}, ev, {foe:true});
    if (foe.hp > 0 && D === "Cotton Down") this.boost(i, {spe:-1}, ev, {foe:true});
    if (foe.hp <= 0 && contact && D === "Aftermath" && me.hp > 0 && A !== "Magic Guard") this.hurt(i, me.max/4, ev, `${this.who(i)} was caught in the aftermath!`);
    if (foe.hp > 0) {
      if (D === "Justified" && type === "Dark") this.boost(1 - i, {atk:1}, ev, {by:D});
      if (D === "Rattled" && ["Bug", "Dark", "Ghost"].includes(type)) this.boost(1 - i, {spe:1}, ev, {by:D});
      if (D === "Stamina") this.boost(1 - i, {def:1}, ev, {by:D});
      if (D === "Weak Armor" && phys) this.boost(1 - i, {def:-1, spe:2}, ev, {by:D});
      if (D === "Water Compaction" && type === "Water") this.boost(1 - i, {def:2}, ev, {by:D});
      if (D === "Steam Engine" && (type === "Fire" || type === "Water")) this.boost(1 - i, {spe:6}, ev, {by:D});
      if (D === "Thermal Exchange" && type === "Fire") this.boost(1 - i, {atk:1}, ev, {by:D});
      if (D === "Anger Point" && r.crit) { foe.stages.atk = 6; this.msg(ev, `${this.who(1 - i)} maxed its Attack!`, {stat:{side:1 - i, up:true}}); }
      if (D === "Electromorphosis") { foe.v.charge = true; this.msg(ev, `Being hit by ${nm} charged ${this.who(1 - i)} with power!`); }
      if (D === "Sand Spit") this.setWeather("sand", foe, ev);
      if (D === "Seed Sower") this.setTerrain("grassy", foe, ev);
    }
    // the move's own secondary effects
    if (sf || foe.hp <= 0 && !fx.sec) return;
    const shield = D === "Shield Dust" || foe.item === "Covert Cloak";
    const mul = A === "Serene Grace" ? 2 : 1;
    const secs = fx.sec || (nm === "Tri Attack" ? [{c:20, st:"tri"}] : []);
    let flinched = false;
    for (const s of secs) {
      if (s.sb) { if (me.hp > 0 && this.r(100) < s.c*mul) this.boost(i, s.sb, ev); continue; }
      if (foe.hp <= 0 || shield) continue;
      if (foe.v.sub && !fl(mv, "o")) continue;
      if (this.r(100) >= s.c*mul) continue;
      if (s.st) this.setStatus(1 - i, s.st, ev, me);
      if (s.v === "flinch") { if (!foe.v.moved && D !== "Inner Focus") { foe.v.flinch = true; } flinched = true; }
      else if (s.v === "confusion") this.confuse(1 - i, ev, true);
      if (s.b) this.boost(1 - i, s.b, ev, {foe:true});
    }
    if (!flinched && !secs.some(s => s.v === "flinch") && (me.item === "King's Rock" || me.item === "Razor Fang" || A === "Stench") && foe.hp > 0 && !foe.v.moved && D !== "Inner Focus" && this.r(100) < 10*mul) foe.v.flinch = true;
    if (foe.hp > 0 && foe.item === "Red Card" && me.hp > 0 && this.bench(i).length) { foe.item = ""; this.msg(ev, `${this.who(1 - i)} held up its Red Card against ${this.who(i)}!`); this.drag(i, ev); }
    if (foe.hp > 0 && foe.item === "Eject Button" && this.bench(1 - i).length) { foe.item = ""; this.msg(ev, `${this.who(1 - i)} is switched out with the Eject Button!`); this.selfSwitch(1 - i, ev); }
  }
  // Roar, Dragon Tail, Red Card: a random Pokémon is dragged out
  drag(i, ev){
    const m = this.get(i), b = this.bench(i);
    if (!b.length || m.ability === "Suction Cups" || m.ability === "Guard Dog" || m.v.ingrain) return false;
    const k = b[this.r(b.length)], S = this.s[i];
    this.leave(i); S.act = k; this.msg(ev, `${this.get(i).name} was dragged out!`); this.enter(i, ev); this.get(i).v.switchedIn = true;
    return true;
  }
  clearHazards(i, ev){ const sc = this.s[i].sc; if (sc.rocks || sc.spikes || sc.tspikes || sc.web) { sc.rocks = false; sc.spikes = 0; sc.tspikes = 0; sc.web = false; this.msg(ev, `${this.who(i)} blew away the traps!`); } const m = this.get(i); if (m.v.leech !== undefined && m.v.leech !== null) { m.v.leech = null; this.msg(ev, `${this.who(i)} was freed from Leech Seed!`); } if (m.v.partial) m.v.partial = null; }
  statusMove(i, mv, ev){
    const me = this.get(i), foe = this.get(1 - i), fx = fxOf(mv), nm = mv[0], S = this.s[i], FS = this.s[1 - i], fail = () => { this.msg(ev, "But it failed!"); return false; };
    const self = fx.t === "self" || fx.t === "allySide" || fx.t === "all" || fx.t === "allies" || fx.t === "allyTeam" || fx.t === "adjacentAllyOrSelf" || fx.t === "foeSide";
    if (nm === "Splash" || nm === "Hold Hands" || nm === "Happy Hour") { this.msg(ev, "But nothing happened!"); return true; }
    if (nm === "Celebrate") { this.msg(ev, `Congratulations, ${this.s[i].name}!`); return true; }
    if (DOUBLES_ONLY.has(nm)) return fail();
    if (NO_EFFECT_MOVES.has(nm)) { this.msg(ev, "But nothing happened! (This move has no effect in these battles.)"); return false; }
    if (nm === "Sleep Talk") {
      if (me.status !== "slp" && me.ability !== "Comatose") return fail();
      const pool = me.moves.filter(x => x[0] !== "Sleep Talk" && !fl(x, "2") && !["Bide", "Uproar", "Assist", "Copycat", "Me First", "Metronome", "Mirror Move", "Sketch", "Mimic"].includes(x[0]));
      if (!pool.length) return fail(); const pick = pool[this.r(pool.length)];
      ev.push({k:"move", side:i, mv:pick[0], t:`${this.who(i)} used ${pick[0]}!`, type:this.moveType(me, pick)});
      return isDmg(pick) ? this.attack(i, -1, pick, ev) : this.statusMove(i, pick, ev);
    }
    if (nm === "Metronome" || nm === "Copycat" || nm === "Mirror Move" || nm === "Nature Power") {
      let pick = null;
      if (nm === "Metronome") { const pool = MOVES.filter(x => !NO_EFFECT_MOVES.has(x[0]) && !DOUBLES_ONLY.has(x[0]) && !["Metronome", "Copycat", "Mirror Move", "Sleep Talk", "Struggle", "Nature Power", "Protect", "Detect", "Endure", "King's Shield", "Spiky Shield", "Baneful Bunker", "Silk Trap", "Obstruct", "Burning Bulwark", "Max Guard"].includes(x[0]) && !x[0].startsWith("G-Max")); pick = pool[this.r(pool.length)]; }
      else if (nm === "Copycat") pick = this.lastMove && this.lastMove[0] !== "Copycat" ? this.lastMove : null;
      else if (nm === "Mirror Move") { const l = foe && foe.v.lastName && MOVE_BY.get(foe.v.lastName); pick = l && l[0] !== "Mirror Move" ? l : null; }
      else pick = MOVE_BY.get({electric:"Thunderbolt", grassy:"Energy Ball", misty:"Moonblast", psychic:"Psychic"}[this.terrain] || "Tri Attack");
      if (!pick) return fail();
      if (nm !== "Nature Power") this.msg(ev, `${nm === "Metronome" ? "Waggling a finger let it use" : "It copied"} ${pick[0]}!`); else this.msg(ev, `Nature Power turned into ${pick[0]}!`);
      ev.push({k:"move", side:i, mv:pick[0], t:`${this.who(i)} used ${pick[0]}!`, type:this.moveType(me, pick)});
      return isDmg(pick) ? this.attack(i, -1, pick, ev) : this.statusMove(i, pick, ev);
    }
    if (nm === "Magic Coat") { me.v.magicCoat = true; this.msg(ev, `${this.who(i)} shrouded itself with Magic Coat!`); return true; }
    if (nm === "Quick Guard" || nm === "Crafty Shield" || nm === "Mat Block") {
      if (nm === "Mat Block" && (me.v.acts || 0) > 1) return fail();
      if (nm === "Quick Guard" && (me.v.stall || 0) > 0 && this.r(Math.min(729, 3 ** me.v.stall)) !== 0) { me.v.stall = 0; return fail(); }
      if (nm === "Quick Guard") me.v.stall = (me.v.stall || 0) + 1;
      S.guard = {turn:this.turnNo, kind:{"Quick Guard":"quick", "Crafty Shield":"crafty", "Mat Block":"mat"}[nm]}; this.msg(ev, `${nm} protected ${S.human === false ? "the opposing team" : "your team"}!`); return true;
    }
    // moves aimed at the foe: Protect, accuracy, immunities, Magic Bounce, Substitute
    let tgt = 1 - i;
    if (!self) {
      if (!foe || foe.hp <= 0) return fail();
      if (fl(mv, "m") && foe.ability === "Magic Bounce" && !["Mold Breaker", "Teravolt", "Turboblaze"].includes(me.ability)) { this.msg(ev, `${this.who(1 - i)} bounced the ${nm} back!`); tgt = i; }
      else if (fl(mv, "m") && foe.v.magicCoat) { this.msg(ev, `${this.who(1 - i)} bounced the ${nm} back!`); tgt = i; }
      else {
        if (me.ability === "Prankster" && foe.types.includes("Dark")) { this.msg(ev, `It doesn’t affect ${this.who(1 - i)}…`); return false; }
        if (foe.ability === "Good as Gold" && !["Mold Breaker", "Teravolt", "Turboblaze"].includes(me.ability)) { this.msg(ev, `It doesn’t affect ${this.who(1 - i)}…`); return false; }
        if (!this.lands(i, mv, ev)) return false;
        if (foe.v.sub && !fl(mv, "o") && !fl(mv, "y") && me.ability !== "Infiltrator") return fail();
        if (fl(mv, "w") && (foe.types.includes("Grass") || foe.ability === "Overcoat" || foe.item === "Safety Goggles")) { this.msg(ev, `It doesn’t affect ${this.who(1 - i)}…`); return false; }
        if (nm === "Thunder Wave" && effOf("Electric", foe.types) === 0) { this.msg(ev, `It doesn’t affect ${this.who(1 - i)}…`); return false; }
        if (fl(mv, "o") && foe.ability === "Soundproof") { this.msg(ev, `${this.who(1 - i)}’s Soundproof blocks the move!`); return false; }
      }
    }
    const T = this.get(tgt), tw = this.who(tgt);
    // status conditions
    if (fx.st) {
      if (nm === "Rest") {/* handled below */}
      else { if (!this.setStatus(tgt, fx.st, ev, tgt === i ? null : me, false)) return false; if (fx.v === "confusion") this.confuse(tgt, ev); return true; }
    }
    switch (nm) {
      case "Rest": if (me.hp >= me.max || me.status === "slp" || ["Insomnia", "Vital Spirit", "Sweet Veil", "Comatose"].includes(me.ability) || (this.terrain === "electric" && this.grounded(me))) return fail();
        me.status = "slp"; me.sleep = 3; me.hp = me.max; ev.push({k:"st", side:i, st:"slp"}); ev.push({k:"hp", side:i, hp:me.hp, max:me.max, heal:true}); this.msg(ev, `${this.who(i)} slept and became healthy!`); return true;
      case "Synthesis": case "Moonlight": case "Morning Sun": { if (me.hp >= me.max) return fail(); const w = this.umbrella(me) ? null : this.wx(); this.heal(i, me.max*(w === "sun" ? 2/3 : w ? 1/4 : 1/2), ev, `${this.who(i)} restored its HP.`); return true; }
      case "Shore Up": if (me.hp >= me.max) return fail(); this.heal(i, me.max*(this.wx() === "sand" ? 2/3 : 1/2), ev, `${this.who(i)} restored its HP.`); return true;
      case "Wish": if (S.wish) return fail(); S.wish = {turn:this.turnNo + 1, hp:Math.floor(me.max/2), from:me.name}; this.msg(ev, `${this.who(i)} made a wish!`); return true;
      case "Pain Split": { const avg = Math.floor((me.hp + T.hp)/2); me.hp = Math.min(me.max, avg); T.hp = Math.min(T.max, avg); ev.push({k:"hp", side:i, hp:me.hp, max:me.max}); ev.push({k:"hp", side:tgt, hp:T.hp, max:T.max}); this.msg(ev, "The battlers shared their pain!"); return true; }
      case "Strength Sap": { const a = modStat(T.stats.atk, T.stages.atk); if (T.stages.atk <= -6) return fail(); this.boost(tgt, {atk:-1}, ev, {foe:true}); this.heal(i, a, ev, `${this.who(i)} had its energy drained!`); return true; }
      case "Belly Drum": if (me.hp <= me.max/2 || me.stages.atk >= 6) return fail(); this.hurt(i, me.max/2, ev); me.stages.atk = 6; this.msg(ev, `${this.who(i)} cut its own HP and maximized its Attack!`, {stat:{side:i, up:true}}); return true;
      case "Fillet Away": case "Clangorous Soul": { const c = nm === "Fillet Away" ? 1/2 : 1/3; if (me.hp <= me.max*c) return fail(); this.hurt(i, me.max*c, ev); this.boost(i, fx.b || {atk:1, def:1, spa:1, spd:1, spe:1}, ev); return true; }
      case "Curse": if (me.types.includes("Ghost")) { if (foe.v.curse) return fail(); this.hurt(i, me.max/2, ev); foe.v.curse = true; this.msg(ev, `${this.who(i)} cut its own HP and put a curse on ${this.who(1 - i)}!`); } else this.boost(i, {atk:1, def:1, spe:-1}, ev); return true;
      case "Haze": for (const k of [0, 1]) { const m = this.get(k); if (m) m.stages = {atk:0, def:0, spa:0, spd:0, spe:0, acc:0, eva:0}; } this.msg(ev, "All stat changes were eliminated!"); return true;
      case "Defog": this.boost(tgt, {eva:-1}, ev, {foe:true}); { const sc = FS.sc; sc.reflect = sc.lightscreen = sc.auroraveil = sc.safeguard = sc.mist = 0; } this.clearHazards(i, ev); this.clearHazards(1 - i, ev); return true;
      case "Tidy Up": this.clearHazards(i, ev); this.clearHazards(1 - i, ev); if (foe.v.sub) foe.v.sub = 0; this.boost(i, {atk:1, spe:1}, ev); return true;
      case "Trick": case "Switcheroo": if (!me.item && !T.item || T.ability === "Sticky Hold") return fail(); [me.item, T.item] = [T.item, me.item]; me.v.choice = undefined; T.v.choice = undefined; this.msg(ev, `${this.who(i)} switched items with its target!`); if (me.item) this.msg(ev, `${this.who(i)} obtained one ${me.item}.`); if (T.item) this.msg(ev, `${tw} obtained one ${T.item}.`); return true;
      case "Memento": this.boost(tgt, {atk:-2, spa:-2}, ev, {foe:true}); this.selfKO(i, ev); return true;
      case "Roar": case "Whirlwind": if (!this.drag(tgt, ev)) return fail(); return true;
      case "Psych Up": me.stages = {...T.stages}; this.msg(ev, `${this.who(i)} copied ${tw}’s stat changes!`); return true;
      case "Aurora Veil": if (this.wx() !== "snow") return fail(); break;
      case "Teleport": if (!this.bench(i).length) return fail(); this.selfSwitch(i, ev); return true;
      case "Baton Pass": if (!this.bench(i).length) return fail(); this.selfSwitch(i, ev, true); return true;
      case "Parting Shot": this.boost(tgt, {atk:-1, spa:-1}, ev, {foe:true}); this.selfSwitch(i, ev); return true;
      case "Chilly Reception": this.msg(ev, `${this.who(i)} is preparing to tell a chillingly bad joke!`); this.setWeather("snow", me, ev); this.selfSwitch(i, ev); return true;
      case "Mean Look": case "Block": case "Spider Web": if (T.v.trapped !== undefined && T.v.trapped !== null) return fail(); T.v.trapped = i; this.msg(ev, `${tw} can no longer escape!`); return true;
      case "Psych Up": me.stages = {...foe.stages}; this.msg(ev, `${this.who(i)} copied ${this.who(1 - i)}’s stat changes!`); return true;
      case "Stockpile": if ((me.v.stockpile || 0) >= 3) return fail(); me.v.stockpile = (me.v.stockpile || 0) + 1; this.msg(ev, `${this.who(i)} stockpiled ${me.v.stockpile}!`); if (this.boost(i, {def:1, spd:1}, ev)) me.v.stockDef = (me.v.stockDef || 0) + 1; return true;
      case "Swallow": { const n = me.v.stockpile || 0; if (!n || me.hp >= me.max) return fail(); this.heal(i, me.max*[0, .25, .5, 1][n], ev, `${this.who(i)} restored its HP.`); me.v.stockpile = 0; if (me.v.stockDef) { this.boost(i, {def:-me.v.stockDef, spd:-me.v.stockDef}, ev); me.v.stockDef = 0; } return true; }
      case "Charge": me.v.charge = true; this.msg(ev, `${this.who(i)} began charging power!`); this.boost(i, {spd:1}, ev); return true;
      case "Defense Curl": me.v.curled = true; this.boost(i, {def:1}, ev); return true;
      case "Minimize": me.v.minimized = true; this.boost(i, {eva:2}, ev); return true;
      case "Magnet Rise": if (me.v.magnetRise || this.gravity || me.v.ingrain) return fail(); me.v.magnetRise = 5; this.msg(ev, `${this.who(i)} levitated with electromagnetism!`); return true;
      case "Lock-On": case "Mind Reader": me.v.lockOn = this.turnNo + 1; this.msg(ev, `${this.who(i)} took aim at ${tw}!`); return true;
      case "Laser Focus": me.v.laserFocus = true; this.msg(ev, `${this.who(i)} concentrated intensely!`); return true;
      case "Tar Shot": if (T.v.tarShot) { this.boost(tgt, {spe:-1}, ev, {foe:true}); return true; } T.v.tarShot = true; this.boost(tgt, {spe:-1}, ev, {foe:true}); this.msg(ev, `${tw} became weaker to fire!`); return true;
      case "Power Trick": [me.stats.atk, me.stats.def] = [me.stats.def, me.stats.atk]; me.v.powerTrick = !me.v.powerTrick; this.msg(ev, `${this.who(i)} switched its Attack and Defense!`); return true;
      case "Speed Swap": [me.stats.spe, T.stats.spe] = [T.stats.spe, me.stats.spe]; this.msg(ev, `${this.who(i)} switched Speed with its target!`); return true;
      case "Power Split": case "Guard Split": { const K = nm === "Power Split" ? ["atk", "spa"] : ["def", "spd"]; for (const k of K) { const avg = Math.floor((me.stats[k] + T.stats[k])/2); me.stats[k] = T.stats[k] = avg; } this.msg(ev, `${this.who(i)} shared its ${nm === "Power Split" ? "power" : "guard"} with the target!`); return true; }
      case "Heart Swap": case "Power Swap": case "Guard Swap": { const K = nm === "Heart Swap" ? Object.keys(me.stages) : nm === "Power Swap" ? ["atk", "spa"] : ["def", "spd"]; for (const k of K) [me.stages[k], T.stages[k]] = [T.stages[k], me.stages[k]]; this.msg(ev, `${this.who(i)} switched stat changes with its target!`); return true; }
      case "Topsy-Turvy": if (!Object.values(T.stages).some(Boolean)) return fail(); for (const k in T.stages) T.stages[k] = -T.stages[k]; this.msg(ev, `${tw}’s stat changes were all reversed!`); return true;
      case "Spite": { const lj = T.v.lastJ; if (lj === undefined || !T.pp[lj]) return fail(); const n = Math.min(4, T.pp[lj]); T.pp[lj] -= n; this.msg(ev, `It reduced the PP of ${tw}’s ${T.moves[lj][0]} by ${n}!`); return true; }
      case "Perish Song": for (const k of [0, 1]) { const m = this.get(k); if (m && m.hp > 0 && m.ability !== "Soundproof" && !m.v.perish) m.v.perish = 4; } this.msg(ev, "All Pokémon that heard the song will faint in three turns!"); return true;
      case "Healing Wish": case "Lunar Dance": if (!this.bench(i).length) return fail(); S.healWish = true; this.selfKO(i, ev); return true;
      case "Revival Blessing": { const k = S.party.findIndex(m => m.hp <= 0); if (k < 0) return fail(); const m = S.party[k]; m.hp = Math.floor(m.max/2); m.status = null; m.v = {}; ev.push({k:"party", side:i, idx:k, hp:m.hp, max:m.max, revived:true}); this.msg(ev, `${m.name} was revived and is ready to fight again!`); return true; }
      case "Shed Tail": { const c = Math.ceil(me.max/2); if (!this.bench(i).length || me.hp <= c || me.v.sub) return fail(); this.hurt(i, c, ev); this.msg(ev, `${this.who(i)} shed its tail to create a decoy!`); S.passing = null; this.selfSwitch(i, ev, "shedtail"); S.shedSub = Math.floor(me.max/4); return true; }
      case "Disable": { const ln = T.v.lastName; if (!ln || T.v.disable || !T.moves.some(x => x[0] === ln)) return fail(); T.v.disable = {name:ln, left:4}; this.msg(ev, `${tw}’s ${ln} was disabled!`); if (T.item === "Mental Herb") { T.item = ""; T.v.disable = null; this.msg(ev, `${tw} used its Mental Herb to come back to its senses!`); } return true; }
      case "Torment": if (T.v.torment) return fail(); T.v.torment = true; this.msg(ev, `${tw} was subjected to torment!`); return true;
      case "Heal Block": if (T.v.healBlock) return fail(); T.v.healBlock = 5; this.msg(ev, `${tw} was prevented from healing!`); return true;
      case "Gastro Acid": if (T.v.origAbility !== undefined) return fail(); T.v.origAbility = T.ability; T.ability = ""; this.msg(ev, `${tw}’s Ability was suppressed!`); return true;
      case "Simple Beam": case "Worry Seed": case "Entrainment": { const na = nm === "Simple Beam" ? "Simple" : nm === "Worry Seed" ? "Insomnia" : me.ability; if (T.ability === na) return fail(); if (T.v.origAbility === undefined) T.v.origAbility = T.ability; T.ability = na; this.msg(ev, `${tw} acquired ${na}!`); if (na === "Insomnia" && T.status === "slp") this.cure(tgt, ev); return true; }
      case "Skill Swap": if (me.v.origAbility === undefined) me.v.origAbility = me.ability; if (T.v.origAbility === undefined) T.v.origAbility = T.ability; [me.ability, T.ability] = [T.ability, me.ability]; this.msg(ev, `${this.who(i)} swapped Abilities with its target!`); return true;
      case "Role Play": if (me.ability === T.ability) return fail(); if (me.v.origAbility === undefined) me.v.origAbility = me.ability; me.ability = T.ability; this.msg(ev, `${this.who(i)} copied ${tw}’s ${T.ability} Ability!`); return true;
      case "Soak": case "Magic Powder": { const t = nm === "Soak" ? "Water" : "Psychic"; if (T.types.length === 1 && T.types[0] === t) return fail(); T.types = [t]; this.msg(ev, `${tw} transformed into the ${t} type!`); return true; }
      case "Trick-or-Treat": case "Forest's Curse": { const t = nm === "Trick-or-Treat" ? "Ghost" : "Grass"; if (T.types.includes(t)) return fail(); T.types = [...T.types.slice(0, 2), t]; this.msg(ev, `${t} type was added to ${tw}!`); return true; }
      case "Reflect Type": me.types = [...T.types]; this.msg(ev, `${this.who(i)}’s type became the same as ${tw}’s type!`); return true;
      case "Conversion": { const t = me.moves[0][1]; if (me.types.length === 1 && me.types[0] === t) return fail(); me.types = [t]; this.msg(ev, `${this.who(i)}’s type changed to ${t}!`); return true; }
      case "Camouflage": { const t = {electric:"Electric", grassy:"Grass", misty:"Fairy", psychic:"Psychic"}[this.terrain] || "Normal"; me.types = [t]; this.msg(ev, `${this.who(i)}’s type changed to ${t}!`); return true; }
      case "Court Change": { const a = this.s[0].sc, b = this.s[1].sc; this.s[0].sc = b; this.s[1].sc = a; this.msg(ev, `${this.who(i)} swapped the battle effects affecting each side of the field!`); return true; }
      case "Corrosive Gas": if (!T.item || T.ability === "Sticky Hold") return fail(); this.msg(ev, `${this.who(i)} corroded ${tw}’s ${T.item}!`); T.item = ""; return true;
      case "Teatime": { let any = false; for (const k of [0, 1]) { const m = this.get(k); if (m && m.hp > 0 && /Berry$/.test(m.item)) { any = true; const it = m.item; this.msg(ev, `${this.who(k)} ate its ${it}!`); this.hpBerryForce(k, ev); } } return any || fail(); }
      case "Stuff Cheeks": if (!/Berry$/.test(me.item)) return fail(); this.msg(ev, `${this.who(i)} ate its ${me.item}!`); this.hpBerryForce(i, ev); this.boost(i, {def:2}, ev); return true;
      case "Recycle": if (me.item || !me.lastBerry) return fail(); me.item = me.lastBerry; me.lastBerry = null; this.msg(ev, `${this.who(i)} found one ${me.item}!`); return true;
      case "Bestow": if (!me.item || T.item) return fail(); T.item = me.item; me.item = ""; this.msg(ev, `${tw} received ${T.item} from ${this.who(i)}!`); return true;
      case "Purify": if (!T.status) return fail(); this.cure(tgt, ev); this.heal(i, me.max/2, ev); return true;
      case "Heal Pulse": case "Floral Healing": if (T.hp >= T.max) return fail(); this.heal(tgt, T.max*(nm === "Floral Healing" && this.terrain === "grassy" ? 2/3 : 1/2), ev, `${tw}’s HP was restored.`); return true;
      case "Life Dew": case "Jungle Healing": case "Lunar Blessing": if (me.hp >= me.max && !(nm !== "Life Dew" && me.status)) return fail(); this.heal(i, me.max/4, ev, `${this.who(i)} restored its HP.`); if (nm !== "Life Dew" && me.status) this.cure(i, ev); return true;
      case "Gravity": if (this.gravity) return fail(); this.gravity = 5; this.msg(ev, "Gravity intensified!"); for (const k of [0, 1]) { const m = this.get(k); if (m) { m.v.magnetRise = 0; if (m.v.semi === "sky") { m.v.semi = null; m.v.charging = null; } } } return true;
      case "Foresight": case "Odor Sleuth": T.v.foresight = true; T.stages.eva = Math.min(0, T.stages.eva); this.msg(ev, `${this.who(i)} identified ${tw}!`); return true;
      case "Miracle Eye": T.v.miracleEye = true; T.stages.eva = Math.min(0, T.stages.eva); this.msg(ev, `${this.who(i)} identified ${tw}!`); return true;
      case "Lucky Chant": if (S.sc.luckychant) return fail(); S.sc.luckychant = 5; this.msg(ev, `${S.human === false ? "The opposing team" : "Your team"} is shielded from critical hits!`); return true;
      case "Mud Sport": case "Water Sport": { const k = nm === "Mud Sport" ? "mudSport" : "waterSport"; if (this[k]) return fail(); this[k] = 5; this.msg(ev, nm === "Mud Sport" ? "Electricity’s power was weakened!" : "Fire’s power was weakened!"); return true; }
      case "Nightmare": if (T.status !== "slp" || T.v.nightmare) return fail(); T.v.nightmare = true; this.msg(ev, `${tw} began having a nightmare!`); return true;
      case "Fairy Lock": this.fairyLock = this.turnNo + 1; this.msg(ev, "No one will be able to run away during the next turn!"); return true;
    }
    // volatile conditions
    if (fx.v) {
      const v = fx.v;
      if (PROTECTS.has(v) || v === "endure") {
        const n = me.v.stall || 0;
        if (!this.queue || !this.queue.length && false) {/* moving last still works in singles */}
        if (n > 0 && this.r(Math.min(729, 3 ** n)) !== 0) { me.v.stall = 0; return fail(); }
        me.v.stall = n + 1;
        if (v === "endure") { me.v.endure = true; this.msg(ev, `${this.who(i)} braced itself!`); }
        else { me.v.protect = v; this.msg(ev, `${this.who(i)} protected itself!`); }
        return true;
      }
      if (v === "substitute") { if (me.v.sub) { this.msg(ev, `${this.who(i)} already has a substitute!`); return false; } const c = Math.floor(me.max/4); if (me.hp <= c || c < 1) { this.msg(ev, "But it does not have enough HP left to make a substitute!"); return false; } this.hurt(i, c, ev); me.v.sub = c; this.msg(ev, `${this.who(i)} put in a substitute!`); ev.push({k:"sub", side:i, on:true}); return true; }
      if (v === "confusion") { if (fx.b) this.boost(tgt, fx.b, ev, {foe:tgt !== i}); return this.confuse(tgt, ev) || !!fx.b; }
      if (v === "leechseed") { if (T.types.includes("Grass")) { this.msg(ev, `It doesn’t affect ${tw}…`); return false; } if (T.v.leech !== undefined && T.v.leech !== null) { this.msg(ev, `${tw} is already seeded!`); return false; } T.v.leech = tgt === i ? 1 - i : i; this.msg(ev, `${tw} was seeded!`); return true; }
      if (v === "taunt") { if (T.v.taunt || T.ability === "Oblivious") return fail(); T.v.taunt = T.v.moved ? 4 : 3; this.msg(ev, `${tw} fell for the taunt!`); if (T.item === "Mental Herb") { T.item = ""; T.v.taunt = 0; this.msg(ev, `${tw} used its Mental Herb to come back to its senses!`); } return true; }
      if (v === "encore") { const lj = T.v.lastJ; if (lj === undefined || T.v.encore || !T.moves[lj] || T.pp[lj] <= 0) return fail(); T.v.encore = {j:lj, left:3}; this.msg(ev, `${tw} must do an encore!`); if (T.item === "Mental Herb") { T.item = ""; T.v.encore = null; this.msg(ev, `${tw} used its Mental Herb to come back to its senses!`); } return true; }
      if (v === "yawn") { if (T.status || T.v.yawn || !this.canStatus(tgt, "slp", me)) return fail(); T.v.yawn = 2; this.msg(ev, `${this.who(i)} made ${tw} drowsy!`); return true; }
      if (v === "focusenergy") { if (me.v.critUp >= 2) return fail(); me.v.critUp = (me.v.critUp || 0) + 2; this.msg(ev, `${this.who(i)} is getting pumped!`); return true; }
      if (v === "destinybond") { me.v.destinyBond = true; this.msg(ev, `${this.who(i)} is hoping to take its attacker down with it!`); return true; }
      if (v === "aquaring") { if (me.v.aquaRing) return fail(); me.v.aquaRing = true; this.msg(ev, `${this.who(i)} surrounded itself with a veil of water!`); return true; }
      if (v === "ingrain") { if (me.v.ingrain) return fail(); me.v.ingrain = true; me.v.trapped = 1 - i; this.msg(ev, `${this.who(i)} planted its roots!`); return true; }
      if (v === "noretreat") { if (me.v.noRetreat) return fail(); me.v.noRetreat = true; me.v.trapped = 1 - i; this.boost(i, {atk:1, def:1, spa:1, spd:1, spe:1}, ev); return true; }
      if (v === "curse") return true;
    }
    // boosts (self or foe)
    if (fx.b) {
      const toSelf = fx.t === "self" || fx.t === "adjacentAllyOrSelf" || tgt === i && fx.t !== undefined;
      if (toSelf) { if (!this.boost(i, fx.b, ev)) return false; }
      else if (!this.boost(tgt, fx.b, ev, {foe:tgt !== i})) return false;
      if (fx.sb) this.boost(i, fx.sb, ev);
      return true;
    }
    if (fx.sb) { this.boost(i, fx.sb, ev); return true; }
    // healing
    if (fx.h) { if (me.hp >= me.max) { this.msg(ev, `${this.who(i)}’s HP is full!`); return false; } this.heal(i, me.max*fx.h[0]/fx.h[1], ev, `${this.who(i)} restored its HP.`); if (nm === "Roost") me.v.roost = true; return true; }
    // field
    if (fx.w) { if (!this.setWeather(fx.w, me, ev)) return fail(); return true; }
    if (fx.ter) { if (!this.setTerrain(fx.ter, me, ev)) return fail(); return true; }
    if (fx.pw === "trickroom") { if (this.trickRoom) { this.trickRoom = 0; this.msg(ev, "The twisted dimensions returned to normal!"); } else { this.trickRoom = 5; this.msg(ev, `${this.who(i)} twisted the dimensions!`); for (const k of [0, 1]) { const m = this.get(k); if (m && m.hp > 0 && m.item === "Room Service") { m.item = ""; this.boost(k, {spe:-1}, ev, {by:"Room Service"}); } } } return true; }
    if (fx.sc) {
      const sc = fx.sc, mine = fx.t === "allySide" || ["reflect", "lightscreen", "auroraveil", "tailwind", "safeguard", "mist"].includes(sc), side = mine ? S : FS, who = mine ? (S.human === false ? `The opposing team` : "Your team") : (FS.human === false ? "the opposing team" : "your team");
      if (sc === "reflect" || sc === "lightscreen" || sc === "auroraveil") { if (side.sc[sc]) return fail(); side.sc[sc] = me.item === "Light Clay" ? 8 : 5; this.msg(ev, `${nm} made ${mine ? (S.human === false ? "the opposing team" : "your team") : who} stronger against ${sc === "reflect" ? "physical" : sc === "lightscreen" ? "special" : "physical and special"} moves!`); return true; }
      if (sc === "tailwind") { if (side.sc.tailwind) return fail(); side.sc.tailwind = 4; this.msg(ev, `The Tailwind blew from behind ${mine ? (S.human === false ? "the opposing team" : "your team") : who}!`); return true; }
      if (sc === "safeguard") { if (side.sc.safeguard) return fail(); side.sc.safeguard = 5; this.msg(ev, `${who} cloaked itself in a mystical veil!`); return true; }
      if (sc === "mist") { if (side.sc.mist) return fail(); side.sc.mist = 5; this.msg(ev, `${who} became shrouded in mist!`); return true; }
      if (sc === "stealthrock") { if (side.sc.rocks) return fail(); side.sc.rocks = true; this.msg(ev, `Pointed stones float in the air around ${who}!`); return true; }
      if (sc === "spikes") { if ((side.sc.spikes || 0) >= 3) return fail(); side.sc.spikes = (side.sc.spikes || 0) + 1; this.msg(ev, `Spikes were scattered on the ground all around ${who}!`); return true; }
      if (sc === "toxicspikes") { if ((side.sc.tspikes || 0) >= 2) return fail(); side.sc.tspikes = (side.sc.tspikes || 0) + 1; this.msg(ev, `Poison spikes were scattered on the ground all around ${who}!`); return true; }
      if (sc === "stickyweb") { if (side.sc.web) return fail(); side.sc.web = true; this.msg(ev, `A sticky web has been laid out on the ground around ${who}!`); return true; }
    }
    this.msg(ev, "But nothing happened! (This move has no effect in these battles.)");
    return false;
  }

  // ---------- end of turn ----------
  endTurn(ev){
    const alive = i => { const m = this.get(i); return m && m.hp > 0; };
    const W = this.wx();
    if (this.weather) {
      if (--this.wTurns <= 0) { this.msg(ev, WEATHER_TXT[this.weather][1], {w:null}); this.weather = null; }
      else if (W === "sand") for (const i of this.order([0, 1])) { const m = this.get(i); if (alive(i) && !m.types.some(t => ["Rock", "Ground", "Steel"].includes(t)) && !["Magic Guard", "Sand Veil", "Sand Rush", "Sand Force", "Overcoat"].includes(m.ability) && m.item !== "Safety Goggles") this.hurt(i, m.max/16, ev, `${this.who(i)} is buffeted by the sandstorm!`); }
    }
    const w = this.wx();
    for (const i of this.order([0, 1])) {
      if (!alive(i)) continue; const m = this.get(i), A = m.ability, mg = A === "Magic Guard";
      if (w && !this.umbrella(m)) {
        if ((A === "Rain Dish" && w === "rain") || (A === "Ice Body" && w === "snow")) this.heal(i, m.max/16, ev, `${this.who(i)} restored HP using its ${A}!`);
        if (A === "Dry Skin" && w === "rain") this.heal(i, m.max/8, ev, `${this.who(i)} restored HP using its Dry Skin!`);
        if ((A === "Dry Skin" || A === "Solar Power") && w === "sun" && !mg) this.hurt(i, m.max/8, ev, `${this.who(i)} was hurt by its ${A}!`);
      }
    }
    for (const i of [0, 1]) { const S = this.s[1 - i], f = S.future; if (f && f.turn <= this.turnNo) { S.future = null; if (alive(i)) { const d = this.get(i); this.msg(ev, `${this.who(i)} took the ${f.name} attack!`); const r = this.calc(f.a, d, f.mv, {dSide:this.s[i].sc}); if (r.immune || !r.rolls) this.msg(ev, `It doesn’t affect ${this.who(i)}…`); else this.hurt(i, r.rolls[this.r(16)], ev); } } }
    for (const i of [0, 1]) { const S = this.s[i]; if (S.wish && S.wish.turn <= this.turnNo) { const wi = S.wish; S.wish = null; if (alive(i)) this.heal(i, wi.hp, ev, `${wi.from}’s wish came true!`); } }
    if (this.terrain === "grassy") for (const i of this.order([0, 1])) if (alive(i) && this.grounded(this.get(i))) this.heal(i, this.get(i).max/16, ev, `${this.who(i)}’s HP was restored.`);
    for (const i of this.order([0, 1])) {
      if (!alive(i)) continue; const m = this.get(i), mg = m.ability === "Magic Guard";
      if (m.item === "Leftovers") this.heal(i, m.max/16, ev, `${this.who(i)} restored a little HP using its Leftovers!`);
      if (m.item === "Black Sludge") { if (m.types.includes("Poison")) this.heal(i, m.max/16, ev, `${this.who(i)} restored a little HP using its Black Sludge!`); else if (!mg) this.hurt(i, m.max/8, ev, `${this.who(i)} is hurt by its Black Sludge!`); }
      if (alive(i) && (m.v.aquaRing || m.v.ingrain)) this.heal(i, Math.floor(m.max/16*(m.item === "Big Root" ? 1.3 : 1)), ev, `${this.who(i)} restored HP${m.v.ingrain ? " through its roots" : " with Aqua Ring"}!`);
      if (alive(i) && m.v.leech !== undefined && m.v.leech !== null && !mg) { const src = m.v.leech, d = this.hurt(i, m.max/8, ev, `${this.who(i)}’s health is sapped by Leech Seed!`); if (alive(src) && d) { if (m.ability === "Liquid Ooze") this.hurt(src, d, ev); else this.heal(src, d*(this.get(src).item === "Big Root" ? 1.3 : 1), ev); } }
      if (alive(i) && m.status && !mg) {
        if ((m.status === "psn" || m.status === "tox") && m.ability === "Poison Heal") this.heal(i, m.max/8, ev, `${this.who(i)} restored HP using its Poison Heal!`);
        else if (m.status === "brn") this.hurt(i, m.max/16, ev, `${this.who(i)} was hurt by its burn!`);
        else if (m.status === "psn") this.hurt(i, m.max/8, ev, `${this.who(i)} was hurt by poison!`);
        else if (m.status === "tox") { m.toxN = Math.min(15, m.toxN + 1); this.hurt(i, m.max*m.toxN/16, ev, `${this.who(i)} was hurt by poison!`); }
      } else if (alive(i) && m.status === "tox") m.toxN = Math.min(15, m.toxN + 1);
      if (alive(i) && m.v.curse && !mg) this.hurt(i, m.max/4, ev, `${this.who(i)} is afflicted by the curse!`);
      if (alive(i) && m.v.partial) { const p = m.v.partial; if (!mg) this.hurt(i, m.max/(p.band ? 6 : 8), ev, `${this.who(i)} is hurt by ${p.nm}!`); if (--p.left <= 0 && alive(i)) { m.v.partial = null; this.msg(ev, `${this.who(i)} was freed from ${p.nm}!`); } }
      if (alive(i) && m.v.taunt) { if (--m.v.taunt <= 0) { m.v.taunt = 0; this.msg(ev, `${this.who(i)} shook off the taunt!`); } }
      if (alive(i) && m.v.nightmare && m.status === "slp" && !mg) this.hurt(i, m.max/4, ev, `${this.who(i)} is locked in a nightmare!`);
      if (alive(i) && m.v.disable && --m.v.disable.left <= 0) { m.v.disable = null; this.msg(ev, `${this.who(i)}’s move is no longer disabled!`); }
      if (alive(i) && m.v.healBlock && --m.v.healBlock <= 0) { m.v.healBlock = 0; this.msg(ev, `${this.who(i)}’s Heal Block wore off!`); }
      if (alive(i) && m.v.magnetRise && --m.v.magnetRise <= 0) { m.v.magnetRise = 0; this.msg(ev, `${this.who(i)}’s electromagnetism wore off!`); }
      if (alive(i) && m.v.perish) { m.v.perish--; this.msg(ev, `${this.who(i)}’s perish count fell to ${m.v.perish}.`); if (m.v.perish <= 0) { m.hp = 0; ev.push({k:"hp", side:i, hp:0, max:m.max}); this.faint(i, ev); } }
      if (alive(i) && m.v.yawn) { if (--m.v.yawn <= 0) { m.v.yawn = 0; this.setStatus(i, "slp", ev); } }
      if (alive(i) && m.ability === "Bad Dreams") { const f = this.get(1 - i); if (f && f.hp > 0 && f.status === "slp" && f.ability !== "Magic Guard") this.hurt(1 - i, f.max/8, ev, `${this.who(1 - i)} is tormented!`); }
    }
    for (const i of [0, 1]) {
      const sc = this.s[i].sc, who = this.s[i].human === false ? "the opposing team" : "your team";
      for (const [k, t] of [["reflect", "Reflect"], ["lightscreen", "Light Screen"], ["auroraveil", "Aurora Veil"], ["tailwind", "Tailwind"], ["safeguard", "Safeguard"], ["mist", "Mist"], ["luckychant", "Lucky Chant"]]) if (sc[k] && --sc[k] <= 0) { sc[k] = 0; this.msg(ev, `${who[0].toUpperCase() + who.slice(1)}’s ${t} wore off!`); }
    }
    if (this.trickRoom && --this.trickRoom <= 0) { this.trickRoom = 0; this.msg(ev, "The twisted dimensions returned to normal!"); }
    if (this.gravity && --this.gravity <= 0) { this.gravity = 0; this.msg(ev, "Gravity returned to normal!"); }
    if (this.mudSport && --this.mudSport <= 0) { this.mudSport = 0; this.msg(ev, "The effects of Mud Sport have faded."); }
    if (this.waterSport && --this.waterSport <= 0) { this.waterSport = 0; this.msg(ev, "The effects of Water Sport have faded."); }
    if (this.terrain && --this.tTurns <= 0) { this.msg(ev, TERRAIN_TXT[this.terrain][1], {ter:null}); this.terrain = null; }
    for (const i of this.order([0, 1])) {
      if (!alive(i)) continue; const m = this.get(i), A = m.ability;
      if (A === "Speed Boost" && (m.v.turns || 0) > 0) this.boost(i, {spe:1}, ev, {by:"Speed Boost"});
      if (A === "Moody") { const K = ["atk", "def", "spa", "spd", "spe"], up = K.filter(k => m.stages[k] < 6), u = up.length ? up[this.r(up.length)] : null, dn = K.filter(k => k !== u && m.stages[k] > -6), d = dn.length ? dn[this.r(dn.length)] : null; const ch = {}; if (u) ch[u] = 2; if (d) ch[d] = -1; this.boost(i, ch, ev, {by:"Moody"}); }
      if (A === "Harvest" && !m.item && m.lastBerry && (w === "sun" || this.chance(.5))) { m.item = m.lastBerry; this.msg(ev, `${this.who(i)} harvested one ${m.item}!`); this.hpBerry(i, ev); }
      if (m.status && ((A === "Shed Skin" && this.chance(1/3)) || (A === "Hydration" && w === "rain" && !this.umbrella(m)))) this.cure(i, ev, `${this.who(i)}’s ${A} cured its status!`);
      if (!m.status && (m.item === "Flame Orb" || m.item === "Toxic Orb")) this.setStatus(i, m.item === "Flame Orb" ? "brn" : "tox", ev);
      if (m.item === "Sticky Barb" && A !== "Magic Guard") this.hurt(i, m.max/8, ev, `${this.who(i)} is hurt by its Sticky Barb!`);
    }
    for (const i of [0, 1]) { const m = this.get(i); if (m) { m.v.protect = null; m.v.magicCoat = false; m.v.endure = false; m.v.flinch = false; m.v.roost = false; m.v.switchedIn = false; if (m.v.charge && m.v.chargeUsed) m.v.charge = false; } }
  }
  check(ev, mid){
    for (const i of [0, 1]) if (!this.aliveIdx(i).length) { this.over = true; this.winner = this.aliveIdx(1 - i).length ? 1 - i : (this.lastMover === undefined ? 1 - i : this.lastMover); ev.push({k:"end", winner:this.winner}); this.queue = null; this.pend = null; return; }
    if (mid) return;
    if (this.turnNo >= 250) { const left = i => this.s[i].party.reduce((s, m) => s + m.hp/m.max, 0); this.over = true; this.winner = left(0) >= left(1) ? 0 : 1; this.msg(ev, "Both sides are exhausted. The judges decide!"); ev.push({k:"end", winner:this.winner}); return; }
    for (const i of [0, 1]) this.need[i] = this.get(i).hp <= 0 ? "switch" : null;
  }
  replace(i, k, ev = []){ this.s[i].act = k; this.need[i] = null; this.enter(i, ev); return ev; }
  forfeit(i){ this.over = true; this.winner = 1 - i; return [{k:"msg", t:`${this.s[i].name} forfeited the match.`}, {k:"end", winner:1 - i}]; }
  // after a battle: volatile effects end (a run through the Elite Four keeps HP, status, PP and items left)
  cleanup(){ for (const S of this.s) for (const m of S.party) { m.v = {}; m.stages = {atk:0, def:0, spa:0, spd:0, spe:0, acc:0, eva:0}; const sp = NAT_BY.get(m.n); if (sp) m.types = [...sp.types]; } }

  // ---------- AI ----------
  // ai level: 0 youngster … 2 rival/early gyms … 3 late gyms/Elite Four … 4 Champion
  threat(i){   // best expected damage the foe can do to i's active, as a fraction of its HP
    const me = this.get(i), foe = this.get(1 - i); if (!foe || foe.hp <= 0) return 0;
    return Math.max(0, ...foe.moves.map((mv, j) => foe.pp[j] > 0 ? this.estimate(foe, me, mv, this.s[i].sc) : 0))/Math.max(1, me.hp);
  }
  scoreMove(i, j){
    const me = this.get(i), foe = this.get(1 - i), mv = j >= 0 ? me.moves[j] : STRUGGLE, fx = fxOf(mv), nm = mv[0], L = this.s[i].ai;
    if (!foe || foe.hp <= 0) return 1;
    const faster = this.trickRoom ? this.speed(me) < this.speed(foe) : this.speed(me) > this.speed(foe);
    if (isDmg(mv)) {
      const r = this.calc(me, foe, mv, {dSide:this.s[1 - i].sc, est:true});
      if (r.immune) return 0; if (r.fail) return .5;
      let e = this.estimate(me, foe, mv, this.s[1 - i].sc); if (foe.v.sub && !fl(mv, "o")) e = Math.min(e, foe.v.sub);
      const acc = (mv[4] > 0 ? mv[4] : 100)/100, pct = e/Math.max(1, foe.hp);
      let s = Math.min(pct, 1)*100*acc;
      if (pct >= 1) s += 60*acc + (mv[6] > 0 && !faster ? 45 : 0);
      if (fx.ohko) s = foe.level > me.level || foe.ability === "Sturdy" ? 0 : acc*100*.9;
      if (fl(mv, "2") && !((nm === "Solar Beam" || nm === "Solar Blade") && this.wx() === "sun") && me.item !== "Power Herb") s *= .5;
      if (fx.sv === "mustrecharge" && pct < 1) s *= .6;
      if (fx.sd) s = me.hp/me.max < .3 || pct >= 1 && L >= 3 ? s*.8 : s*.15;
      if (fx.sb && Object.values(fx.sb).some(v => v < 0) && pct < 1) s *= .9;
      if (fx.r && me.ability !== "Rock Head") s *= .95;
      if ((nm === "Fake Out" || nm === "First Impression") && (me.v.acts || 0) > 0) s = 0;
      else if (nm === "Fake Out") s += 25;
      if (fx.ss && L >= 3 && this.threat(i) > .5 && this.bench(i).length) s += 15;
      if (nm === "Knock Off" && foe.item) s += 8;
      if (fx.sec && fx.sec.some(x => x.st && x.c >= 30) && !foe.status) s += 6;
      return Math.max(1, s);
    }
    // status moves: only when they make sense
    const best = Math.max(0, ...me.moves.map((x, k) => isDmg(x) && me.pp[k] > 0 ? this.estimate(me, foe, x, this.s[1 - i].sc)/Math.max(1, foe.hp) : 0));
    const threat = this.threat(i), hp = me.hp/me.max;
    if (NO_EFFECT_MOVES.has(nm)) return 0;
    if (fx.st) {
      const st = fx.st;
      if (foe.status || foe.v.sub || !this.canStatus(1 - i, st, me) || best >= 1 || (nm === "Thunder Wave" && effOf("Electric", foe.types) === 0) || (fl(mv, "w") && (foe.types.includes("Grass") || foe.ability === "Overcoat" || foe.item === "Safety Goggles")) || (me.ability === "Prankster" && foe.types.includes("Dark"))) return 0;
      const v = {slp:80, par:faster ? 30 : 62, brn:foe.stats.atk > foe.stats.spa ? 64 : 28, tox:foe.hp/foe.max > .6 ? 52 : 20, psn:30, frz:40}[st] || 30;
      return v*(mv[4] > 0 ? mv[4]/100 : 1)*(threat >= 1 && faster === false ? .4 : 1);
    }
    if (fx.v && (PROTECTS.has(fx.v))) return L >= 3 && (me.v.stall || 0) === 0 && (foe.status === "tox" || foe.v.leech !== undefined && foe.v.leech !== null || foe.v.charging) ? 55 : (me.v.stall ? 0 : 3);
    if (nm === "Rest" && me.status !== "slp" && hp < .4) return 75;
    if (fx.h || ["Synthesis", "Moonlight", "Morning Sun", "Shore Up", "Strength Sap"].includes(nm)) return hp < .5 && threat < .9 ? 82 : hp < .7 && L >= 3 ? 20 : 0;
    if (nm === "Wish") return hp < .6 ? 40 : 0;
    if (nm === "Pain Split") return hp < .4 && foe.hp > me.hp ? 60 : 0;
    if (fx.b && (fx.t === "self" || fx.t === "adjacentAllyOrSelf") || nm === "Belly Drum" || nm === "Curse" && !me.types.includes("Ghost")) {
      const top = Math.max(me.stages.atk, me.stages.spa, me.stages.spe);
      if (nm === "Belly Drum") return hp > .8 && threat < .4 && me.stages.atk < 2 ? 70 : 0;
      return hp >= .6 && threat < .45 && top < 2 && best < .8 ? 68 + (L >= 3 ? 10 : 0) : 0;
    }
    if (fx.b) { if (foe.v.sub) return 0; return best < .3 ? 18 : 2; }
    if (fx.sc === "stealthrock") return this.s[1 - i].sc.rocks || this.bench(1 - i).length < 2 ? 0 : 58;
    if (fx.sc === "spikes" || fx.sc === "toxicspikes") return this.bench(1 - i).length < 2 || (this.s[1 - i].sc.spikes || 0) >= 2 ? 0 : 30;
    if (fx.sc === "stickyweb") return this.s[1 - i].sc.web || this.bench(1 - i).length < 2 ? 0 : 35;
    if (fx.sc === "reflect" || fx.sc === "lightscreen" || fx.sc === "auroraveil") { if (this.s[i].sc[fx.sc] || (fx.sc === "auroraveil" && this.wx() !== "snow")) return 0; const phys = foe.stats.atk >= foe.stats.spa; return (fx.sc === "reflect") === phys || fx.sc === "auroraveil" ? 50 : 15; }
    if (fx.sc === "tailwind") return this.s[i].sc.tailwind || faster ? 0 : 45;
    if (fx.w) { const good = {sun:"Fire", rain:"Water", sand:"Rock", snow:"Ice"}[fx.w]; return this.weather === fx.w ? 0 : me.types.includes(good) || me.moves.some(x => x[1] === good && isDmg(x)) ? 40 : 4; }
    if (fx.ter) return this.terrain ? 0 : 25;
    if (fx.pw === "trickroom") return this.trickRoom || this.speed(me) > this.speed(foe) ? 0 : 50;
    if (fx.v === "substitute") return me.v.sub || hp < .5 ? 0 : threat < .25 ? 35 : 5;
    if (fx.v === "leechseed") return foe.types.includes("Grass") || (foe.v.leech !== undefined && foe.v.leech !== null) || foe.v.sub ? 0 : 42;
    if (fx.v === "taunt") return foe.v.taunt || !foe.moves.some(x => !isDmg(x)) ? 0 : 30;
    if (fx.v === "confusion") return foe.v.confusion || foe.v.sub || foe.ability === "Own Tempo" ? 0 : 25;
    if (fx.v === "yawn") return foe.status || foe.v.yawn ? 0 : 35;
    if (fx.v === "focusenergy") return me.v.critUp ? 0 : 10;
    if (fx.v === "destinybond") return hp < .25 && threat >= 1 && L >= 3 ? 70 : 0;
    if (fx.ss) return L >= 3 && threat > .6 && this.bench(i).length ? 30 : 0;
    if (nm === "Roar" || nm === "Whirlwind") return Math.max(foe.stages.atk, foe.stages.spa, foe.stages.spe) >= 2 ? 70 : 0;
    if (nm === "Haze" || nm === "Clear Smog") return Math.max(foe.stages.atk, foe.stages.spa, foe.stages.spe) >= 2 ? 70 : 0;
    if (nm === "Defog" || nm === "Rapid Spin") return this.s[i].sc.rocks || this.s[i].sc.spikes ? 30 : 0;
    if (nm === "Trick" || nm === "Switcheroo") return me.item.startsWith("Choice") || ["Flame Orb", "Toxic Orb", "Sticky Barb", "Iron Ball", "Lagging Tail"].includes(me.item) ? 45 : 0;
    return 1;
  }
  ai(i){
    const opt = this.options(i), me = this.get(i), L = this.s[i].ai;
    if (opt.forced) return {move:opt.forced.move};
    const it = this.aiItem(i); if (it) return it;
    if (opt.canSwitch && L >= 2) { const sw = this.aiSwitch(i); if (sw !== null) return {sw}; }
    if (opt.struggle) return {move:-1};
    const sc = opt.moves.filter(x => x.ok).map(x => [x.j, this.scoreMove(i, x.j)]).sort((a, b) => b[1] - a[1]);
    if (!sc.length || sc[0][1] <= 0) return {move: sc.length ? sc[0][0] : -1};
    const sharp = [.6, .72, .82, .9, .96][Math.max(0, Math.min(4, L))];
    void me;
    if (sc.length > 1 && sc[1][1] > 0 && sc[1][1] >= sc[0][1]*.5 && this.rand() > sharp) return {move:sc[1][0]};
    return {move:sc[0][0]};
  }
  // trainers use their bag at low HP, like the games
  aiItem(i){
    const S = this.s[i], m = this.get(i); if (!S.bag || S.human) return null;
    const L = S.ai, cut = L >= 4 ? .35 : L >= 3 ? .3 : .25, threat = this.threat(i);
    const has = k => S.bag[k] > 0;
    if (m.hp > 0 && m.hp/m.max <= cut && !(this.bench(i).length === 0 && false)) {
      const pick = ["Full Restore", "Max Potion", "Hyper Potion", "Super Potion", "Potion"].find(k => has(k) && (BAG_ITEMS[k].heal === "full" || m.hp + BAG_ITEMS[k].heal >= m.max*.5));
      const healedTo = pick ? (BAG_ITEMS[pick].heal === "full" ? m.max : Math.min(m.max, m.hp + BAG_ITEMS[pick].heal)) : 0;
      if (pick && threat*m.hp < healedTo*.85 && this.rand() < (L >= 3 ? .95 : .8)) return {item:pick, target:S.act};
    }
    if (m.status && ["slp", "frz", "tox", "par"].includes(m.status) && L >= 3 && m.hp/m.max > .5) {
      if (has("Full Heal")) return {item:"Full Heal", target:S.act};
      if (m.hp/m.max < .7 && has("Full Restore")) return {item:"Full Restore", target:S.act};
    }
    return null;
  }
  // switch out of a bad matchup; Champions do it more often
  aiSwitch(i){
    const L = this.s[i].ai, me = this.get(i), foe = this.get(1 - i); if (!foe || foe.hp <= 0) return null;
    const p = [0, 0, .1, .25, .45][Math.min(4, L)]; if (this.rand() >= p) return null;
    const myBest = Math.max(0, ...me.moves.map((mv, j) => me.pp[j] > 0 ? this.estimate(me, foe, mv, this.s[1 - i].sc)/Math.max(1, foe.hp) : 0));
    const threat = this.threat(i);
    if (!(threat >= .6 && myBest < .35) && !(me.v.leech !== undefined && me.v.leech !== null && me.hp/me.max < .5) && !(me.status === "tox" && me.toxN >= 3)) return null;
    let best = null, bv = -1e9;
    for (const k of this.bench(i)) { const v = this.matchup(i, this.s[i].party[k]); if (v > bv) { bv = v; best = k; } }
    return best !== null && bv > this.matchup(i, me) + .25 ? best : null;
  }
  matchup(i, m){
    const foe = this.get(1 - i); if (!foe || foe.hp <= 0) return 0;
    const off = Math.max(0, ...m.moves.map((mv, j) => m.pp[j] > 0 ? this.estimate(m, foe, mv, this.s[1 - i].sc)/Math.max(1, foe.hp) : 0));
    const def = Math.max(0, ...foe.moves.map((mv, j) => foe.pp[j] > 0 ? this.estimate(foe, m, mv, this.s[i].sc)/Math.max(1, m.hp) : 0));
    return Math.min(off, 1.2) - Math.min(def, 1.2)*.8 + (m.hp/m.max)*.2;
  }
  aiReplace(i){
    const alive = this.bench(i).length ? this.bench(i) : this.aliveIdx(i);
    let best = alive[0], bv = -1e9;
    for (const k of alive) { const v = this.matchup(i, this.s[i].party[k]) + this.rand()*(this.s[i].ai >= 3 ? .05 : .3); if (v > bv) { bv = v; best = k; } }
    return best;
  }
}
