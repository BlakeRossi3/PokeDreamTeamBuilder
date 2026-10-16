# Battle audit (Phase 1)

This is the audit of the battle engine written for Phase 1 of `docs/ROADMAP.md`: what the old engine did, what was wrong,
and what the new engine (`src/engine.js`) implements, approximates or leaves out. Damage is checked roll-for-roll against
`@smogon/calc` by `tests/test_damage.mjs`; everything else by `tests/test_engine.mjs`.

## 1. The old engine (before Phase 1)

The old engine lived inside `src/app.html` (`class Battle`, ~350 lines). It played a reasonable game but was not the real one:

| Area | What it did | Problem |
|---|---|---|
| Stats | `(2·Base + 31 + 21)·Lv/100 + 5` for every stat | No natures, EVs or IVs; a hidden 84 EVs in every stat; Shedinja had normal HP |
| Damage | One floating-point formula | Modifiers in the wrong order, no 4096-based rounding, random roll as a float, Technician checked the move's listed power, Sheer Force boosted every move, burn applied after STAB |
| Multi-hit moves | Power × average hit count | Hit once; Focus Sash, Sturdy, Rocky Helmet, contact abilities and "hit 3 times!" were all wrong |
| Critical hits | Always 1/24 | No high-crit moves, Scope Lens, Super Luck, Focus Energy; crits ignored only some stat stages |
| Accuracy | Move accuracy only | No accuracy/evasion stages, Bright Powder, weather accuracy (Thunder in rain…) |
| PP | None | Moves never ran out; no Struggle |
| Turn order | A hand-made priority table for 11 moves | Every other priority move (Protect, Sucker Punch, Trick Room −7…) ran at speed order |
| Status | Burn, poison, toxic, paralysis, sleep, freeze | No confusion; no Misty/Electric Terrain or Safeguard protection |
| Moves | Tables for stat moves, healing, recoil, drain, 11 priority moves, ~30 multi-hit | No two-turn moves, recharge, Protect, OHKO moves, hazards, screens, Trick Room, terrains, U-turn/Volt Switch switching, Substitute, Leech Seed, Taunt, Encore… Everything else said "no effect in quick battles" |
| Held items | ~25 (Leftovers, Life Orb, Choice items, type boosters, a few berries…) | Rocky Helmet hurt on every physical move (not only contact); Choice lock only for damaging moves; no Air Balloon, Boots, Light Clay, Shell Bell, Scope Lens, King's Rock, Quick Claw, pinch berries, White/Mental Herb… |
| Bag | None | The Elite Four break screen gave one Max Revive and one Max Potion; the **Max Potion button only appeared when a Pokémon had lost HP**, which is why Blake saw "the Max Potion is not showing up" |
| AI | Highest expected damage, a few status-move rules | Never switched, never used items, the same at every gym |
| Data | Moves without PP, priority, flags or effects | `data/fe.json` marked **122 Pokémon as fully evolved that aren't** (Caterpie, Zubat, Skorupi…), which broke Eviolite and the Team Builder's "Fully evolved" filter |
| UI | — | "Skip to the result" froze the battle if pressed while it was your turn (the moves had moved to the side panel) |

## 2. The new engine

### Data (`scripts/gen_data.mjs`)
Regenerated from Pokémon Showdown's data (`@pkmn/dex`, MIT): base stats and types (Gen 9 data, older generations' data
for the per-region dexes), fully-evolved flags, 851 moves with type, category, power, accuracy, PP, priority, flags
(contact, punch, bite, slicing, sound, powder, bullet, pulse, wind…) and effects (secondary effects and chances, drain,
recoil, multi-hit, crit ratio, healing, switching, weather/terrain/side conditions…), 316 abilities, 386 items with
category and description, learnsets with *how* each move is learned (level, TM, egg, tutor, event, pre-evolution), and
weights (for Low Kick, Heavy Slam…). The build still needs only Python; the script is run by hand.
Mega Stones are left out on purpose: Megas are chosen as their own team members, and they can't hold an item.

### Stats
Official Gen 9 formula with nature (×1.1 / ×0.9), EVs (≤252 each, ≤510 total) and IVs (0–31, default 31), EVs default 0,
Shedinja 1 HP. Natures/EVs/IVs are saved per team member (validated in `cleanMember`; the editing UI is Phase 2).
Checked against `@smogon/calc` for 400 random level/nature/EV/IV combinations.

### Damage
The official formula, in the official order, with 4096-based modifiers and `pokeRound`, mirroring `@smogon/calc`'s
`gen789.js`: base power callbacks (Low Kick, Gyro Ball, Eruption, Acrobatics, Hex, Knock Off, Facade, Weather Ball,
Triple Axel, Stored Power, Crush Grip, Rage Fist, Rollout, Fury Cutter…) → base-power modifiers (terrain, Technician,
-ate abilities, Sheer Force, Tough Claws, Iron Fist, Strong Jaw, Sharpness, auras, gems, type boosters, Plates, orbs,
Muscle Band/Wise Glasses…) → attack (stages, Hustle, Guts, pinch abilities, Huge Power, Choice Band/Specs, Light Ball,
Thick Club, Ruin abilities, Protosynthesis/Quark Drive, Orichalcum Pulse/Hadron Engine…) → defense (stages, sand/snow
boosts, Eviolite, Assault Vest, Fur Coat, Marvel Scale, Grass Pelt…) → base damage → weather → critical hit (×1.5,
ignoring the attacker's drops and the defender's boosts) → random roll 85–100 % → STAB (×1.5, Adaptability ×2) → type
effectiveness (Gen 6+ chart with Fairy, Freeze-Dry, Flying Press, Scrappy, Ring Target, Iron Ball…) → burn → final
modifiers (screens, Multiscale, Fluffy, Filter, Tinted Lens, Sniper, Expert Belt, Life Orb, Metronome, resist berries).
Fixed damage (Seismic Toss, Night Shade, Super Fang, Endeavor, Final Gambit, Counter, Mirror Coat, Metal Burst,
Psywave, Dragon Rage, Sonic Boom) and OHKO moves are handled separately.
**Proof:** 40,000+ random attacker/defender/move/item/ability/nature/EV/IV/status/stage/weather/terrain/screen/crit cases
match `@smogon/calc` exactly (all 16 rolls). Two places where the calculator simplifies, the engine follows the battle
simulator instead: Utility Umbrella switches off Solar Power, and Iron Ball only removes the Flying-type immunity.

### Rules
- Critical-hit stages 1/24, 1/8, 1/2, always; high-crit moves, Scope Lens, Razor Claw, Super Luck, Focus Energy, Dire
  Hit, Leek, Lucky Punch, Lansat Berry; always-crit moves; Battle Armor/Shell Armor; Lucky Chant; Laser Focus.
- Stat stages −6…+6 with the real multipliers; accuracy/evasion stages with the 3-based table; Keen Eye, Unaware,
  moves that ignore evasion; Compound Eyes, Hustle, Sand Veil, Snow Cloak, Bright Powder, Wide/Zoom Lens, Gravity,
  Lock-On, weather accuracy (Thunder/Hurricane in rain and sun, Blizzard in snow), Toxic from Poison types.
- Turn order: Bag items, then switches, then moves by priority bracket, Quick Claw / Quick Draw / Custap Berry,
  Lagging Tail / Stall, Speed (paralysis ×0.5, Choice Scarf ×1.5, stages, Tailwind, weather abilities, Unburden,
  Iron Ball…), Trick Room, random ties; Speed is re-checked after every action (Gen 8+ rule). Prankster, Gale Wings,
  Triage, Grassy Glide change priority.
- Status: burn 1/16 and halves physical damage (not Guts/Facade), poison 1/8, bad poison n/16 rising (reset on switch),
  paralysis 25 % and half Speed, sleep 1–3 turns (Rest 2), freeze 20 % thaw per turn (Fire moves and defrosting moves
  thaw), confusion 2–5 turns with a 33 % 40-power self-hit. Type immunities, ability immunities, Misty/Electric
  Terrain, Safeguard, Leaf Guard, Comatose, Purifying Salt, Corrosion.
- Moves: PP with PP Ups (Pressure costs 2), Struggle, 2–5 hit distribution (35/35/15/15 %), Skill Link, Loaded Dice,
  Triple Axel, Population Bomb, Parental Bond, recoil, crash damage, drain (Big Root, Liquid Ooze), self-KO, two-turn
  moves with semi-invulnerable turns (Fly, Dig, Dive, Phantom Force…, Solar Beam in sun, Power Herb), recharge,
  Protect/Detect and the shields (falling 1/3ⁿ success, contact penalties), Endure, Quick Guard, Crafty Shield,
  Mat Block, priority moves, Fake Out, Sucker Punch, Focus Punch, stat moves, secondary effects with Serene Grace,
  Shield Dust and Covert Cloak, flinch only if the target hasn't moved, contact flag, Substitute, Leech Seed, Taunt,
  Encore, Disable, Torment, Heal Block, Yawn, Destiny Bond, Perish Song, Curse, Belly Drum, Haze, Psych Up, Pain Split,
  Strength Sap, Wish, Healing Wish, Revival Blessing, U-turn / Volt Switch / Flip Turn / Parting Shot / Teleport /
  Baton Pass / Shed Tail / Chilly Reception (you pick who comes in), Roar / Whirlwind / Dragon Tail / Circle Throw,
  Knock Off, Trick, Thief, binding moves, trapping moves, hazards (Stealth Rock, Spikes, Toxic Spikes, Sticky Web,
  Rapid Spin, Defog, Mortal Spin, Tidy Up, Court Change), screens (Reflect, Light Screen, Aurora Veil; Brick Break
  breaks them first), Tailwind, Trick Room, Gravity, Mud/Water Sport, weather, terrains, Future Sight, Sleep Talk,
  Metronome, Copycat, Mirror Move, Nature Power, Magic Coat, type-changing moves, ability-changing moves, Stockpile…
- Weather: sun, rain, sand, snow (5 turns, 8 with the matching rock), from moves or abilities; sand damage; Rock SpD
  and Ice Def boosts; Air Lock / Cloud Nine; weather abilities and healing. Terrains: Electric, Grassy, Misty, Psychic
  (5 turns, 8 with Terrain Extender), Surge abilities, seeds.
- Abilities: 257 of 316 run (the rest are listed below).
- Held items: 224 of the 263 items that matter in battle run, and the item picker (Phase 2) will say "No battle effect
  here" for the rest. Every one of them has a test in `tests/test_engine.mjs` or `tests/test_damage.mjs`.
  Each activation is announced in the battle log ("Charizard lost some of its HP!", "… hung on using its Focus Sash!").

### The Bag
Potion (20), Super Potion (60), Hyper Potion (120), Max Potion, Full Restore, Revive (half), Max Revive, Full Heal,
Antidote, Burn Heal, Ice Heal, Awakening, Paralyze Heal, X Attack / Defense / Sp. Atk / Sp. Def / Speed / Accuracy
(+2), Dire Hit, Guard Spec. Using one takes your turn and happens before switches and moves.
- Rival and Gym battles: 2 Hyper Potions, 1 Revive, 1 Full Heal, X Attack, X Sp. Atk, X Speed.
- Elite Four + Champion: one bag for the whole run — 3 Max Potions, 2 Full Restores, 2 Revives, 2 Full Heals, X Attack,
  X Sp. Atk. What's used stays used; it's shown after each win and can be used between battles. There is no other
  healing between battles (the old free Max Revive + Max Potion are gone).
- Versus: the same standard bag for both players, with a setting to turn bags off.
- Opponents: Gym Leaders 1 Hyper Potion (first four gyms) or 2; Elite Four 2 Max Potions (first two) or 2 Full
  Restores; Champions 3 Full Restores (Kanto–Sinnoh) or 4; rivals by rank. They use them at low HP like the games.

### AI
Moves are scored by expected damage (average roll × hit count × accuracy, with crit chance), going for KOs and priority
KOs when slower, STAB and super-effective coverage naturally win; sensible status (no sleeping a sleeping Pokémon,
no burning Fire types, no Thunder Wave on Ground types, no powders on Grass), set-up only when safe, healing at low HP,
hazards when the foe has a team behind, screens matching the foe's attacking side, Trick Room when slower, Protect to
stall poison. Trainers switch out of bad matchups (chance 0 → 45 % from early gyms to Champions), pick the best
replacement, and use their bag. Natures, items and EVs get better from early gyms to Champions; Gym Leaders' aces hold
a Sitrus Berry like in the games.

## 3. Approximations
- **Singles only**: doubles-only moves fail ("But it failed!") like they do in a single battle in the games.
- Damaging moves whose extra effect isn't modelled still do correct damage: Pursuit (no double power on switching),
  Round, Fusion Bolt / Fusion Flare, Secret Power, Uproar, Rage, Pollen Puff (damages only), Bide, Beat Up, Natural Gift.
- Encore lasts 3 of the target's moves; Taunt 3 turns (4 if the target already moved) — both close to the games.
- Abilities that change the user's own ability or types (Trace, Mummy, Skill Swap, Soak…) last until it switches out.
- Opponents' moves are chosen from what each Pokémon can learn, not copied from the games' exact rosters.
- Accuracy modifiers are chained once (the games round after each one).

## 4. Not in this engine
- **Terastallization, Dynamax, Z-Moves**, and **Mega Evolution during battle** (Megas are their own team members and
  can't hold items). Z-Crystals, Tera Shards etc. will show "No battle effect here".
- Status moves that do nothing here: Snatch, Imprison, Grudge, Telekinesis, Magic Room, Wonder Room, Ion Deluge,
  Electrify, Powder, Attract, Captivate (no genders), Embargo, Transform, Mimic, Sketch, Me First, Assist,
  Conversion 2, Instruct, Quash.
- Abilities not run: Aroma Veil, As One, Battle Bond, Commander, Costar, Cud Chew, Curious Medicine, Cursed Body,
  Cute Charm, Damp, Dancer, Delta Stream, Desolate Land, Eelevate, Embody Aspect, Flower Gift, Flower Veil, Forecast,
  Gulp Missile, Hospitality, Hunger Switch, Ice Face, Illusion, Imposter, Klutz, Mega Sol, Mimicry, Mirror Armor,
  Multitype, Mycelium Might, Neutralizing Gas, Opportunist, Perish Body, Piercing Drill, Poison Puppeteer, Power
  Construct, Primordial Sea, Rivalry (no genders), RKS System, Schooling, Shields Down, Soul-Heart, Spicy Spray,
  Stakeout, Stance Change, Surge Surfer, Tangled Feet, Tera Shell, Tera Shift, Teraform Zero, Victory Star,
  Wind Power, Wonder Skin, Zen Mode, Zero to Hero (mostly form changes and doubles abilities).
- Items not run: the old Gen 2 berries (Berry, Bitter Berry, Burnt Berry, Gold Berry, Ice Berry, Mint Berry, Miracle
  Berry, Mystery Berry, PRZ/PSN Cure Berry), EV-lowering and Poffin berries (Pomeg, Kelpsy, Qualot, Hondew, Grepa,
  Tamato, Razz, Bluk, Nanab, Wepear, Pinap, Cornn, Magost, Rabuta, Nomel, Spelon, Pamtre, Watmel, Durin, Belue),
  Destiny Knot, Mail, Pink Bow, Polkadot Bow, Rusted Sword/Shield and Ogerpon's masks (the forms they need aren't in
  the app).
