# Dream Team Dex: next big update

This is the full brief for the next round of work. Read `CLAUDE.md` first: it covers the project layout, how to
build and test, and the rules that keep old saves and both art styles working. Those rules apply to everything below.

**How to work through this**
- Do the phases in order. Make a branch per phase (`phase-1-battles`, …), commit in small steps, and open a pull
  request at the end of each phase.
- **Stop at the end of every phase.** Summarize in plain language what changed, show screenshots (2D and 3D, desktop
  and phone), list anything you couldn't do, and wait for Blake to say "go" before starting the next phase.
- Before every commit that touches `src/`: `python3 scripts/lint.py` must be clean and `python3 tests/run_all.py`
  must pass. Look at the screenshots in `tests/out/` after UI changes. Add tests for every new feature.
- Never break existing saves. Every new saved field gets a default in `freshGames()`/`freshState()` and validation in
  `cleanGames()`/`applySaved()`. If a change alters saved data (rewards, moves, items), write a one-time migration
  and test it with an old save (see `tests/test_save_migration.py`).
- The site is served from `https://blakerossi3.github.io/PokeDreamTeamBuilder/` (a sub-path), so every URL must stay
  relative. GitHub Pages limits: 1 GB per site, 100 MB per file. Keep the site well under that and report its size.
- Credit every outside source in Settings → Credits (who made it, where it came from, the license). Keep the
  Pokémon © notice. Never sell anything; this stays a free fan project.
- When something here is ambiguous, pick the option that plays most like the official games and say what you picked.

---

## Phase 1: Battles that work like the real games

Blake's words: *"Ensure that Pokémon damage and moves and health and stats are accurate and work properly as if it
is a real Pokémon game. I want items on Pokémon to actually work. The Max Potion is not showing up in the Elite Four
battles."*

**First, audit.** Read the whole BATTLE ENGINE section and write `docs/battle-audit.md`: what is implemented, what
is approximated, what is missing. Note: there is currently **no bag** (no Potions, Max Potions, Revives) anywhere, and
the Elite Four run is "no healing between battles".

**1. Correct data.** Regenerate Pokémon, move, ability and item data from Pokémon Showdown's data
(`@pkmn/dex` / `@pkmn/data` on npm, MIT) with a script `scripts/gen_data.mjs` that writes into `data/`, so base stats,
types, abilities, move power/accuracy/PP/priority/category/flags/secondary effects and learnsets match the games
(Scarlet/Violet data, older-gen data for Pokémon not in SV). Keep every field the app already uses. The build must
still need only Python; the data script is run by hand when data changes.

**2. Correct math (Gen 9 rules).**
- Stats: HP = ⌊(2·Base + IV + ⌊EV/4⌋)·Lv/100⌋ + Lv + 10; others = ⌊(⌊(2·Base + IV + ⌊EV/4⌋)·Lv/100⌋ + 5)·Nature⌋.
  Add **nature, EVs (max 252 per stat, 510 total) and IVs (0–31, default 31)** per team member (UI in Phase 2).
  Blake wants full competitive depth here, like Showdown: include EV presets (e.g. 252/252/4 spreads), and default every IV to 31 and EVs to 0
  so casual players never have to touch them.
  Shedinja has 1 HP.
- Damage: the official formula with modifiers applied in the official order and 4096-based rounding: spread,
  weather, critical hit (×1.5, ignores the attacker's negative and the defender's positive stat stages), random
  roll (85–100 %), STAB (×1.5, Adaptability ×2, Tera STAB if you add Tera), type effectiveness (full Gen 6+ chart
  with Fairy), burn (×0.5 physical, except Guts/Facade), screens, and item/ability modifiers.
- Critical hit stages 1/24, 1/8, 1/2, always. Accuracy/evasion stages. Stat stages −6…+6 with the real multipliers.
- Turn order: priority brackets, then Speed (paralysis halves Speed, Choice Scarf ×1.5, stat stages, Trick Room if
  you add it), ties random.
- Status: burn 1/16 per turn; poison 1/8; bad poison n/16 rising; paralysis 25 % full-paralysis; sleep 1–3 turns;
  freeze 20 % thaw per turn (fire moves thaw); confusion 2–5 turns, 33 % self-hit at 40 power. Type immunities
  (Fire can't burn, Electric can't be paralyzed, Poison/Steel can't be poisoned, Ice can't be frozen, Grass immune to
  powder moves).
- Moves: PP that runs out (Struggle when all are empty), multi-hit (2–5 distribution), recoil, drain, fixed damage
  (Seismic Toss, Night Shade, Super Fang), OHKO moves, two-turn moves, recharge moves, Protect/Detect with falling
  success, priority moves, stat-changing moves, secondary effect chances, contact flag (for Rocky Helmet, Static,
  Rough Skin, etc.). Implement as many moves fully as is reasonable; any move not fully implemented must at least
  do correct damage and be listed in the audit doc.
- Weather (rain, sun, sand, snow) and the abilities the engine already supports, kept correct.

**3. Held items that work.** Implement at least: Leftovers, Black Sludge, Life Orb, Choice Band/Specs/Scarf (with
move lock), Assault Vest, Eviolite, Focus Sash, Expert Belt, Muscle Band, Wise Glasses, type-boosting items and
Plates, Rocky Helmet, Air Balloon, Heavy-Duty Boots (if hazards exist), Sitrus/Oran/Lum/Chesto/Persim berries and the
type-resist berries, the pinch berries, Weakness Policy, White Herb, Mental Herb, Light Clay, Shell Bell, Scope Lens,
Razor Claw, King's Rock, Bright Powder, Quick Claw, Metronome, Toxic Orb, Flame Orb, Light Ball, Thick Club, Mega
Stones (Mega-evolve in battle if the Pokémon holds its stone and the form exists). Show an item message in the battle
log when an item activates ("Charizard's Life Orb hurt it!"). Items that do nothing in this engine must say so in the
item picker (Phase 2), never silently.

**4. The bag.** Add a Bag to the battle menu, like the games: Potion (20), Super Potion (60), Hyper Potion (120),
Max Potion (full HP), Full Restore (full HP + status), Revive (half HP), Max Revive, Full Heal, status heals, and
X items (X Attack, etc.). Using an item takes your turn. Quantities:
- Rival and Gym battles: a small standard bag (e.g. 2 Hyper Potions, 1 Revive, 1 Full Heal).
- Elite Four + Champion run: **one bag for the whole run** (e.g. 3 Max Potions, 2 Full Restores, 2 Revives,
  2 Full Heals), and what's used stays used for the rest of the run. Show what's left between battles. Keep "no
  healing between battles" otherwise.
- Versus: a mirrored bag for both players, with a setting to turn bags off.
- Opponents use items like the games: Gym Leaders 1–2 Hyper Potions, Elite Four 2 Max Potions or Full Restores,
  Champions 3–4 Full Restores, used at low HP.

**5. Smarter opponents.** The AI should pick moves the way an in-game trainer does: prefer super-effective and
STAB moves, go for KOs, use status and stat moves sensibly, switch out of bad matchups sometimes (Champions more
often), and use bag items as above. Difficulty rises from early gyms to Champions.

**6. Prove it.** Add `tests/test_damage.mjs` using `@smogon/calc` (npm, MIT) as a reference: generate a few hundred
random attacker/defender/move/item/ability/weather combinations that the engine supports and assert the engine's
damage range matches exactly. Add engine tests for stats, crits, status, PP, every implemented held item, and the
bag. Keep `tests/test_battle_engine.py` passing.

---

## Phase 2: Team Builder sheet, move picker and item picker

Blake's words: *"Item and moves and stats should be on the same screen. Anything that affects battle. Everything in
the personalize screen should be exactly that, personalization, not affecting battle. I want improved move
selection both in battles and in the team builder, more interactive with sorting and proper UI. I want official
pixel art for Pokémon items. Any and all items should be available, with good UI: a pop-up window with official
art, similar to the trainer selection."*

**1. Reorganize the Pokémon sheet** (opened by tapping a team member) into two tabs:
- **Battle**: ability, held item, the four moves, level, nature, EVs/IVs, and the live stat block (final stats with
  nature arrows, base-stat bars, total), plus a small type-matchup summary (weak to / resists) and a "move coverage"
  summary for the chosen moves. Everything that changes a battle lives here and nowhere else.
- **Personalize**: nickname, Poké Ball, shiny toggle, form/appearance options that don't change battle, and anything
  else cosmetic (e.g. Hall of Fame name tag). Nothing here changes battle.
- Keep the Overview/info content (Pokédex info, flavor) where it fits best; propose the layout with a screenshot
  before finishing. Works as a centered panel on desktop and a full-height bottom sheet on phones, in 2D and 3D.

**2. Move picker (Team Builder).** Tapping a move slot opens a move picker:
- Every move the Pokémon can learn, with: name, type badge, category icon (physical / special / status), power,
  accuracy, PP, priority if non-zero, and a one-line effect description. How it's learned (level, TM, egg, tutor,
  event) as a small tag.
- **Sorting** by any column (tap the header; tap again to reverse) and a **Recommended** sort that scores STAB,
  power × accuracy, useful effects and coverage the current moves are missing.
- **Filters**: type, category, learn method, "STAB only", "hits a type the current moves can't", and a search box.
- Tapping a move shows its full details (power, accuracy, PP, priority, contact, effect chance, full description)
  with a big **Teach** button; already-chosen moves are marked; no duplicates. Drag (or arrows) to reorder the four.
- Fast with 200+ moves (virtualize or paginate if needed), keyboard-navigable, works on a phone.

**3. Move menu in battle.** Rebuild the Fight menu like Scarlet/Violet:
- Four move cards in the move's type colour, each with name, category icon, PP left / max, and an effectiveness hint
  against the current opponent ("Super effective", "Not very effective", "No effect"; only shown for moves whose
  type is known to matter, the way the games do it once the opponent has been seen).
- Long-press / hover shows power, accuracy and the description. 0-PP moves are disabled; when all are 0, Struggle.
- The Pokémon/switch menu shows HP bars, status, held item and moves for each party member.
- Keep auto-battle, fast speed and the existing battle log.

**4. Official item art + item picker.**
- Source official item icons (the in-game bag pixel icons). Good candidates to evaluate: the PokéAPI sprites
  repository on GitHub (`sprites/items/*.png`) and Pokémon Showdown's item icons. Pick the most complete set; fill
  gaps from the other. Pack them like the other sprite packs (a new `packs/s/items-*.wasm` + index entries, or a
  sheet) and credit the source.
- Item data (name, category, description, effect) comes from the Phase 1 data script. **Every item** a Pokémon can
  hold is available: held items, berries, type boosters, Plates, Memories, Drives, Mega Stones, Z-Crystals (cosmetic
  if Z-Moves aren't implemented), Tera Shards, evolution items, etc.
- The item picker is a pop-up like the trainer picker: a searchable grid of item icons with category tabs (Popular
  held items, Berries, Type boosters, Mega Stones, Battle-only, Everything), a detail pane with the large icon, the
  official description and a clear label: **"Works in battle"** / **"No battle effect here"**. The current held item is
  highlighted; "Remove item" is available. Same look for the battle Bag (Phase 1).

---

## Phase 3: Rewards that make sense

Blake's words: *"Improve reward selection for the Gym trainers. They don't make much sense. Defeating an Elite Four
should give an elite reward. If we need to generate more art for this then do so."*

**Current state** (see `GYM_REWARD` in POKÉPOINTS + UNLOCKABLES): Gym 4 of each region gives a rare Poké Ball
(Master Ball from Brock's region, etc.), Gym 6 in regions I–III a background, Gym 8 a trophy, all others a profile
icon of the leader's ace. Elite Four members give nothing; Champions give a card design and an icon. The pairing of
reward to leader feels random.

**Design a new reward table**, write it to `docs/rewards.md` and `data/rewards.json`, then implement it:
- **Every Gym Leader** gives something that fits **that leader and their type**: their badge (shown in a Badge Case
  furniture item and on the trainer card), plus one themed exclusive, e.g. Brock: a Fossil display (furniture);
  Misty: a Seashell fountain; Lt. Surge: a Tesla lamp; Erika: a Flower arch; Sabrina: a Crystal ball; Blaine: a
  Volcano hot tub; Giovanni: a Ground-type rug… Rare Poké Balls should come from leaders who fit them (Net Ball from a
  Water/Bug leader, Dusk Ball from a Ghost/Dark leader, Heavy Ball from a Rock/Steel leader, Moon Ball from a Fairy
  leader…). Profile icons of a leader's ace can stay, but as a bonus, not the main reward.
- **Every Elite Four member gives an elite-tier reward** that's clearly better than a gym reward: e.g. an Elite
  trainer card frame in their type colour, an animated profile-icon border, a signature furniture centerpiece, or a
  Hall of Fame background themed on their room. Beating all four plus the Champion completes a set.
- **Champions** give the region's Champion card design (keep), a Champion's Hall background for that region, a
  trophy, and something that shows off on the friend profile (Phase 5), e.g. a Champion ribbon/title.
- First clear gives the reward; rematches give PokéPoints only (keep current values unless the table says otherwise).
- **Migration:** players keep everything they already own. Players who already beat leaders get the new rewards for
  those leaders the first time they load the update (extend `ecoMigrate` with a versioned step).
- The Shop still never sells exclusives, and still shows them as "?" until earned.

**Art.** Prefer original art drawn in code (like the existing Home furniture in `HOUSE_DRAW` and the Hall of Fame
backgrounds), in both 2D pixel and 3D styles. If an item needs real artwork, Blake has a **Retro Diffusion**
(retrodiffusion.ai, a pixel-art image generator) account with about **$7 of credit left**. Read its current API
docs before using it. Ask Blake to put the API key in an environment variable (`RETRO_DIFFUSION_API_KEY`) and never
commit the key. Rules for generated art: original designs only (badges, frames, furniture, backgrounds, icons),
never copies of official Pokémon characters or artwork; check the remaining balance and estimate the cost before
generating, stay under $7 total, generate at the sizes the app actually displays, show Blake the first image before
generating the rest, save results under `site/art/` (or a pack), and credit them as original art made with Retro
Diffusion. Retro Diffusion makes pixel art, which suits the 2D style; for the 3D style, draw in code or use the
generated art at a clean whole-number scale.

---

## Phase 4: 3D sprite overhaul

Blake's words: *"The current 3D sprites are not acceptable. They shouldn't have to be resized or altered from the
source we get them from. They are out there the same as the 2D ones. Find them and hook them up. They must be moving,
animated sprites, not still pictures."*

**Background.** The 3D mode currently uses Pokémon Showdown's animated sprites (`3d`/`3ds` packs), which are small,
so the app upscales them (`hqFrame`, an xBR filter) and that looks wrong. An earlier attempt to swap in large HOME
stills was rejected because they don't move: Blake prefers animated idle sprites.

**Requirements**
- Animated idle sprites rendered from the 3D models, at a native size large enough to display **without upscaling
  or filtering** (target roughly 200 px or more tall for medium Pokémon), with clean transparent edges.
- Coverage: every Pokémon the app supports (Gen 1–9), normal and shiny, plus forms (Megas, regional forms, Gigantamax
  if available), and both front views. Back sprites if available (for the player's side in battle).
- Display them at native size or a whole-number multiple, never filtered. Remove the xBR path for 3D once the new
  set is in.

**Steps**
1. **Research first.** Evaluate sources such as Project Pokémon's sprite index (animated 3D model sprites by
   generation), Pokémon Showdown (`ani`, `ani-shiny`, `ani-back`), the PokéAPI sprites repo, and any other public
   collection of animated 3D renders. For each, report: native size, frame count/quality, coverage (how many of the
   app's Pokémon and forms, shiny included), file format, total size, and the license/credit terms.
2. Write `docs/3d-sprites.md` with the comparison and a recommendation, plus a contact sheet image of ~24 sample
   Pokémon (small, medium, huge, a few forms, a few shinies) from the top candidates, side by side with today's
   sprites. **Stop and show Blake before converting anything.**
3. After Blake picks: convert into the pack format (keep animation frames and timing; WebP or GIF as now), rebuild
   `packs/index.json`, update `spKey` and sizing so sprites sit correctly in the Team Builder, Hall of Fame, battles,
   the Home and the trainer card. Use the best available fallback per Pokémon when a sprite is missing, and list the
   gaps. Keep the total site size comfortably under 1 GB; split packs so no file is near 100 MB.
4. Update the credits.

---

## Phase 5: Real accounts and cloud saves

Blake's words: *"A new sign-in system with actual working accounts across browsers. Figure your own way to do this."*

Today saves live only in the browser (localStorage), with optional 4-digit PINs that aren't real security. Players
move saves with Download/Restore a backup.

**Use Supabase** (free tier: Postgres, Auth and row-level security, callable straight from a static site).
- Include `supabase/migrations/*.sql` with every table, index and row-level-security policy, and
  `docs/supabase-setup.md` with click-by-click steps for Blake: create the project, run the SQL (or `supabase db push`
  with the CLI), turn on Email (magic link / one-time code) and Google sign-in, and add
  `https://blakerossi3.github.io/PokeDreamTeamBuilder/` (and `http://localhost:8765/`) to the allowed redirect URLs.
- The project URL and the public **anon** key go in `site/config.js` (they're meant to be public; RLS protects the
  data). Never commit the service-role key.
- Vendor `@supabase/supabase-js` into the site (no runtime CDN dependency) and cache it in the service worker.
- If the site has no config (or Supabase is unreachable) the app must keep working exactly as today, offline and local.

**Sign-in and saves**
- Sign in with email (code or magic link) or Google. On first sign-in, choose a **username** (3–16 characters,
  letters/numbers/underscore, unique, filtered for offensive words) and get a short **friend code**.
- One cloud save per account. **Local-first sync:** play always reads/writes local storage; changes upload a few
  seconds after the last edit and when the tab is hidden; on sign-in or app start, download the cloud copy. If both
  the cloud and the device changed since the last sync, show a clear choice ("Keep this device's progress" /
  "Use the cloud progress", with teams/badges/PokéPoints shown for each). Version every upload so nothing is lost
  silently. Show sync state in the account button (Synced / Saving… / Offline).
- **Bringing existing saves over:** after sign-in, offer to upload any local save file (pick which one) into the
  account. Download/Restore a backup keeps working.
- Keep **Play as guest** and local-only save files for people who don't want an account, with a gentle prompt to
  create one so progress follows them.
- Account menu: change username (rate-limited), sign out, download my data, delete my account (removes all cloud
  data).
- Cap save size (e.g. 1 MB) with a database check constraint; validate everything loaded from the cloud with the same
  `clean*` functions as local saves.

---

## Phase 6: Friends

Blake's words: *"A friends menu allowing you to visit friends' Homes and see their trainer cards and chosen hero's
row card."* The "hero's row card" means **both**: the Hall of Fame scene a player chooses to show off, **and** a team
lineup card for that same team (the six Pokémon with sprites, nicknames, Poké Balls, held items and moves).

**Data (in the Phase 5 migrations):** `profiles` (username, friend code, icon, title), `friendships`
(requester, addressee, status: pending/accepted/blocked), and `public_profile` (what friends can see: trainer card
data, the showcased team (members, cosmetics, items, moves) and its scene settings, the Home layout and residents,
updated on sync). RLS: only
accepted friends can read a player's `public_profile`; nobody can read anyone's full save.

**Friends menu** (new tile on the main menu, signed-in players only; guests see an explanation and a sign-in button):
- Your friend code with a copy button and a share link (`…/PokeDreamTeamBuilder/?friend=CODE` opens the app and
  offers to send a request).
- Add a friend by code or exact username; incoming and outgoing requests (accept / decline / cancel); friend list
  with profile icon, username, title and last active; remove and block.
- **Friend profile page:** their **trainer card** (drawn with the same `drawCard`, from their public data), their
  **showcased Hall of Fame card** (rendered with `renderScene` from their team, cosmetics and scene; tap to view it
  full screen, read-only), a **team lineup card** for the same team (each Pokémon's animated sprite, nickname, Poké
  Ball, types, held item with its icon, and four moves with type colours; tap a Pokémon for its stats), badges and
  leagues, and a **Visit Home** button. Give the lineup card a "Copy this team" button that imports it with the
  existing share-code system.
- **Visit a friend's Home:** a read-only version of their Home with their residents walking around and their
  furniture, using the same renderer. You can walk around and pet their Pokémon (no friendship change for them), and
  leave one **Like** per day, which gives both players 20 PokéPoints (enforce once-per-day in the database).
- **Showcase setting:** on the Trainer card screen, pick which team friends see (its Hall of Fame card and lineup
  card) and which style the Hall of Fame card uses (2D or 3D).
- Friend-related achievements (first friend, 5 friends, visit 10 Homes, get 10 likes).

**Safety (players may be kids):** no free-text chat or messages; usernames filtered; no emails or real names shown;
block hides you completely; friend requests rate-limited.

**Stretch goal (ask Blake first):** battle a friend's showcased team with the AI controlling it.

---

## Phase 7: Pokémon Home improvements

Blake picked these from the Home ideas list:

1. **Pokémon use furniture.** Each furniture kind gets "spots": bed/beanbag/cushion = nap, sofa/chair/bench = sit,
   TV/arcade = watch, fireplace = warm up, trampoline = bounce, fountain/pond/aquarium = splash. Idle Pokémon
   sometimes walk to a free spot and do that action for a while (lying/sitting offset, bounce animation, zz/note/heart
   emotes).
2. **Type preferences.** Weight spot choice by type: Fire → fireplace; Water → pond/fountain/aquarium; Grass and Bug →
   plants, flowers, berry tree; Electric → TV, arcade, PC desk; Ghost and Dark → dim corners at night; Fairy and
   Normal → sofa and cushions.
3. **Play together.** Pairs sometimes meet and play (face each other, hop, shared emote). Members of the same
   evolution line and same-type pairs prefer each other's company.
4. **Daily rhythm.** Using `clockTod()`: at night most Pokémon go to beds/cushions and sleep; nocturnal Pokémon
   (Ghost and Dark types, Umbreon, Hoothoot/Noctowl, Murkrow, Sableye, the Gastly line…) are more active at night;
   lamps, the fireplace and the TV glow after dark.
5. **Berries and feeding.** The Berry tree grows up to 3 berries per tree per day (drawn on the tree); walk up and
   press E / tap to pick. Berries go in a small Home inventory shown in the Home bar. Feeding gives +8 friendship
   (separate from the daily petting cap); each Pokémon has a hidden favorite flavor (seeded by its number) worth +15
   and a special emote.
6. **Friendship milestones and gifts.** 25: a unique emote; 50: it follows you around the Home; 100: a friendship
   ribbon shown on its Team Builder card and the trainer card. Pokémon at 60+ friendship sometimes leave a gift
   (PokéPoints, berries, rarely a furniture item) as a little present to pick up, at most once per day each.
7. **Decorating: drag to move, undo, rotate.** Drag placed items to move them, Undo (last 20 placement actions),
   rotate (four facings where it makes sense; keep flip). Works with touch.
8. **Photo mode.** A camera button hides the UI, lets you pan, and saves a PNG or a short GIF (reuse the Hall of Fame
   GIF exporter) with the trainer's name as a caption.
9. **Music and sounds.** An original, calm Home music track in the existing chiptune synth, plus footsteps, fireplace
   crackle, splash and pick-up sounds. Respect the volume settings.
10. **Weather and seasons.** Random daily weather outside the windows and in outdoor rooms (sun, rain, snow in winter
    months). A **Halloween event** (Oct 15 – Nov 1): pumpkins and cobwebs as limited-time Shop furniture, purple
    lighting at night, and Ghost-type Pokémon visiting at night. Build it so more seasonal events (winter holidays)
    are easy to add.
11. **Phone controls and camera.** An on-screen joystick plus a Play button on touch screens (keep tap-to-walk), and a
    short camera pan across the house when you first walk in.

Visiting friends' Homes is covered in Phase 6. Add achievements where they fit (feed 10 berries, three friendship
ribbons, take a photo).

---

## When everything is done
Update `README.md` and `CLAUDE.md` (new data script, Supabase setup, rewards table, sprite sources, tests), make
sure the credits are complete, report the final site size, and give Blake a plain-language changelog he can post.
