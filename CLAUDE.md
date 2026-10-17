# Dream Team Dex — notes for Claude Code

A free, non-profit Pokémon fan web app: pick dream teams for every region, personalize them, stage animated
Hall of Fame scenes, battle rivals / Gym Leaders / Elite Four, play quizzes, earn PokéPoints, unlock items in a
Shop and decorate a walk-around Pokémon Home. Everything runs in the browser; saves live in localStorage.
Owner: Blake. It is deployed as a static site on GitHub Pages (see "Deploy").

## First-time setup (only if you are starting from the downloaded zips)
1. Unzip every `dream-team-dex-part*.zip` into the same folder. They all extract into `dream-team-dex/` and
   don't overlap; part 1 has the code, the rest are sprite packs. Check `packs/index.json` resolves:
   `python3 scripts/build.py` fails loudly if a pack is missing.
2. `cd dream-team-dex && git init -b main && git add -A && git commit -m "Dream Team Dex"`
3. Create the GitHub repo and push: `gh repo create dream-team-dex --public --source . --push`
   (or create it on github.com and `git remote add origin … && git push -u origin main`).
4. Turn on Pages: repository Settings → Pages → Source: **GitHub Actions**
   (or `gh api -X POST repos/{owner}/dream-team-dex/pages -f build_type=workflow`).
   The workflow in `.github/workflows/pages.yml` then builds and deploys on every push to `main`.
   The site appears at `https://<github-user>.github.io/dream-team-dex/`.
5. Delete this section once it's done.

## Commands
- `python3 scripts/build.py` — build `dist/web/` (the website). `--artifact` also writes the single-page claude.ai version.
- `python3 -m http.server 8765 --directory dist/web` — run it locally at http://localhost:8765/
- `python3 scripts/lint.py` — ESLint over the inline script (`npm install` once), plus a CSS check for broken rules (a stray
  declaration line silently kills the next rule; needs `pip install tinycss2`). Must be clean.
- `node scripts/gen_data.mjs` — regenerate Pokémon/move/ability/item/learnset data from Pokémon Showdown (`@pkmn/dex`).
  Run by hand when data should change; the build itself never needs Node.
- `node scripts/gen_families.mjs` — rebuild `data/families.json` (evolution families, for Home Pokémon that play together).
- `python3 scripts/gen_back_packs.py` — rebuild the 3D back-sprite packs (`3db`/`3dbs`) from PokéAPI's copy of Showdown's `ani-back`.
- `python3 scripts/gen_sleep_packs.py` — rebuild the sleeping-sprite packs (`zz`) from PMD Sprite Collab (CC BY-NC 4.0) and
  `docs/pmd-credits.md` (every artist). Napping Pokémon in the Home use them; others fall back to a squash.
- `python3 scripts/gen_item_icons.py` — rebuild the item icon sheet `packs/items.png` + `data/item_icons.json` (needs Pillow;
  downloads PokéSprite and PokéAPI sprites into `.cache/`). Run after items are added to the data.
- `python3 tests/run_all.py [name]` — builds, serves dist/web on :8765 and runs the Playwright tests
  (`pip install playwright && python3 -m playwright install chromium` once; `npm install` for axe-core). Screenshots go to `tests/out/`;
  look at them after UI changes. Run lint + tests before every commit that touches `src/`.
- `python3 tests/perf_load.py` — first / repeat / offline load times on a throttled phone (run after loading changes).
- `python3 tests/test_layout_lint.py [d t m]` — the layout checker (controls sticking out, clipped text, overlaps, uneven wraps,
  jitter) on every screen; `python3 tests/test_a11y.py` — axe-core accessibility (contrast, labels, ARIA). Both must report 0.
- `sh supabase/tests/run.sh` — apply the Supabase migrations to a throwaway local Postgres and check their rules.
- `node tests/test_engine.mjs` (rules, items, Bag, AI, random-battle stress test) and `node tests/test_damage.mjs [n] [seed]`
  (damage vs `@smogon/calc`, all 16 rolls) — both also run from `run_all.py`.
- No Python packages are needed to build; Playwright is only for tests. If the pre-installed browser doesn't match,
  install the Playwright version that does (e.g. `pip install playwright==1.56.0` for `/opt/pw-browsers/chromium-1194`).

## Layout
- `src/app.html` — **the whole app** (CSS, markup and JS in one file, ~7,900 lines). Source of truth.
- `src/engine.js` — the battle engine (pure logic, no DOM), inlined into the page at `/*ENGINE*/`; Node tests load it
  through `tests/engine_harness.mjs`. See `docs/battle-audit.md` for what it covers.
  Placeholders `/*DATA*/`, `/*IDX*/`, `/*TRAINERS*/`, `/*OLDTRAINERS*/`, `/*TAGS*/`, `/*HOFD*/`, `/*FORMS*/`, `/*FE*/`,
  `/*MOVES*/`, `/*BALLS*/`, `/*RIVALS*/`, `/*LEADERS*/`, `/*ITEMICONS*/`, `/*REWARDS*/`, `/*FAMILIES*/`, `/*ENGINE*/` (= `src/engine.js`) are filled from `data/` and `packs/index.json`;
  `"/*BUILD*/"` becomes the build hash; `{}/*PACKV*/` becomes a per-file content hash for each pack, `learnsets.json`,
  `items.png` and `art2d.json` (`packUrl` adds `?v=`), so a deploy only re-downloads files that changed.
- `data/` — Pokédex, forms, moves, balls, rivals, leaders, trainer names, Hall of Fame tuning, etc. (JSON).
- `packs/` — sprites. `s/*.wasm` Pokémon packs (`2d`, `2ds`, `3d`, `3ds`, `3db`/`3dbs` = 3D back sprites, `h` = HOME stills, `zz` = PMD sleeping sprites,
  `-f*` = forms; 16 per pack; `python3 scripts/gen_back_packs.py` rebuilds the back packs),
  `t/*.wasm` trainer packs (`2d`, `3d`, `3f`, `l` = Gym Leader portraits). `index.json` maps each sprite to
  `[id, offset, length, kind]` — kind 0 png, 1 gif, 2 webp, 3 = shiny stored as a palette patch of the normal sprite.
  `.wasm` is only a container name so hosts serve them compressed; they are not WebAssembly. Packs are large
  binaries: don't rewrite them unless asked.
- `site/` — icons, share image, service worker template, notes for other hosts, `config.js` (Supabase URL + anon key;
  empty = local saves only) and `vendor/supabase.js` (supabase-js, vendored).
- `supabase/` — `migrations/*.sql` (tables, RLS, RPCs for accounts, saves and friends) and `tests/` (runs them on a local Postgres).
- `art/2d/` — the 2D pixel art (Hall of Fame backgrounds `hof/<scene>[_sunset|_night]`, Home `furn/<id>` (and `anim/<id>`: the same item's animation frames side by side, drawn by `furnSprite`/`furnFrame`), `room/…`
  walls/floors/windows, `div/<type>_col|cap|post|door` room dividers). The website build puts them in
  `art2d.json` (fetched after the first screen; `ART_SRC` is `null` in the page); the single-page artifact keeps them inline
  (`/*ART2D*/`). The app looks them up with `artOf(key)` (null until loaded) and falls back to the canvas drawings. 2D only: 3D still uses canvas art.
- `art-src/` — how that art was made: `raw/` Retro Diffusion downloads (`raw/anim/*.gif` = animations), `jobs.tsv` (image → job id), `process.py`
  (cut-outs, trophy recolours, clear window glass, wood/carpet floors) which writes `art/2d/`. Re-run it after changing `raw/`.
- `docs/` — roadmap, battle audit, rewards table, 3D sprite research, Supabase setup, changelog.
- `scripts/` — build, lint and the data/asset generators. `tests/` — Playwright tests + runner. `dist/` — build output (git-ignored).

## Map of src/app.html (search for these banners)
CSS first (themes via CSS variables; 2D look = `:root[data-mode="2d"] …` overrides), then markup, then JS sections:
`ENVIRONMENT` · `DATA` · `SOUND` (chiptune synth; `Sound.play(name)`, names listed in its switch) · `SPRITES AT NATIVE SIZE`
(`getSprite`, `spKey`, `natK` whole-number canvas scale, `hasBack`, `paintAll` for `<img class="spr" data-num>`) · `HALL OF FAME` (`SCENES`,
`paintBg`, `renderScene`, `Stage`, `openHof`) · `UNDO` · `FILTERS` · `SHARE CODES` · `TEAM OPTIONS` · `CUSTOM TEAMS` ·
`SHOWDOWN IMPORT / EXPORT` (`sdParse`, `sdExport`) · `POKÉMON SHEET` (`battleHTML`/`wireBattle`, `openMovePicker`, `openItemPicker`, `personalHTML`, `itemIcon`) · `BATTLE ENGINE` (= `src/engine.js`: `Battle`, `mkMon`, `BAG_ITEMS`, `ITEM_WORKS`, `ABIL_WORKS`) · `GYM CHALLENGE + LEAGUES` (`LEAGUES`) · `POKÉPOINTS + UNLOCKABLES` · `SHOP` ·
`POKÉMON HOME` · `HOME GAMES` (`berryCatch`, `seekStart`/`seekAt`) · `HALL OF FAME GALLERY` · `ONLINE ACCOUNTS` (`sbStart`, `sbUpload`, `syncConflict`, `openOnlineMenu`) · `FRIENDS` (`enterVisit`/`leaveVisit`, `renderFriends`, `publicProfile`) · `FRIEND BATTLES` (`fbChallenge`, `fbOpen`, `runLive`, `fbValid`) · `HOME LIFE` (`SPOT_OF`, `homeDecide`, `BERRIES`, `EVENTS`, `homePhoto`) · `DAILY MISSIONS + LOGIN STREAK` (`MISSIONS`, `missionBump`,
`loginTick`) · `MAIN MENU + SCREENS` (`HUB`, `openScreen`, `SCREEN_TITLE`, `renderScreen` map,
`nav.onClick/onChange/cleanup`) · `SETTINGS` · `ACHIEVEMENTS` (`ACH`, `checkAch`) · `TRAINER CARD` · `QUIZ` · `BATTLE ANIMATIONS` (`TYPE_FX`, `FXP`, `SIG_FX`, `moveRecipe`,
`playMoveFx`) · `REPLAYS` (`rpNew`, `rpStep`, `rpEncode`/`rpDecode`, `runReplay`) · `BATTLE TOWER` (`towerFoe`, `towerBattle`,
`TOWER_REWARD`) · `BATTLE SCREENS`.
Boot code is at the very end of the script.

## Things that are easy to get wrong
- **Saves.** `persisted()` is what gets stored; `applySaved` + `cleanGames`/`cleanMember`/`cleanUI` validate everything
  loaded. Any new field in `state.games` needs a default in `freshGames()` *and* validation in `cleanGames()`, or it is
  lost on reload. Never break old saves: players can't recover them.
- **Two styles.** Everything must look right in both 2D (pixel art, square corners, VT323/Pixelify fonts) and 3D, on
  desktop and a 390px-wide phone, with no sideways scrolling (the audit test checks this).
- **Hall of Fame scenes are per style:** `state.scenes[id]` is 3D, `state.scenes[id + "~2d"]` is 2D. Use
  `sceneOf(id, mode)`; copying/deleting a team must handle both keys.
- **Economy.** Unlockables are in `ITEMS_ALL`; look up with `unlockOf(cat, id)`; use `owns`/`grant`/`buy`/`earn`.
  Gym Leader, Elite Four and Champion rewards (`GYM_REWARD`, `GYM_BONUS`, `E4_REWARD`, `BADGE_CASE`, built from
  `data/rewards.json`; see `docs/rewards.md`) are exclusive (`isExclusive`): never sell them in the Shop. A team's default
  Hall of Fame background is always usable (`bgUsable`). `ecoMigrate()` upgrades old saves once per version
  (`eco` 1: players from before the economy existed; `eco` 2: grants the v2 rewards for badges and leagues already won). Point values are listed in README.md.
- **Screens** render into `#scBody` and wire events through `nav.onClick` etc.; anything with timers, rAF or observers
  must undo it in `nav.cleanup` (see `renderHome`).
- **Modals:** `openModal(html, {wide, onClose})` / `closeModal()`; the modal layer sits above the overlays.
- **Online accounts** (`ONLINE ACCOUNTS` section, `docs/supabase-setup.md`): on only when `site/config.js` has a Supabase
  URL + anon key (`CLOUD_ON`). A linked save file has `sb`/`sbVer`/`sbDirty` in its `accounts.list` entry; `save()` marks
  it dirty and `sbQueue()` uploads via the `put_save` RPC with the version it builds on (conflict → `syncConflict`).
  Cloud data goes through `applySaved` like local saves. Schema, RLS and RPCs: `supabase/migrations/*.sql`; check them
  with `sh supabase/tests/run.sh`. `tests/test_online.py` uses a stand-in client. Never commit the service_role key.
- **Friends** (`FRIENDS` section): a friend's card, showcased team, Hall of Fame card and Home are drawn by the normal code
  inside a sandbox: `enterVisit(pub, who)` swaps `state` for one built from their `public_profile`, and while `VISIT` is set
  `save()`, `checkAch()` and `earn()` do nothing and `persisted()` returns a snapshot of the player's own save. Always pair it
  with `leaveVisit()` (screens do it in `nav.cleanup`). What friends see is built by `publicProfile()` and uploaded after a
  sync (`friendsAfterSync`). New `state.games` fields: `showcase` {team, style}, `social` {vis, likes, friends, likeAt}.
  `tests/test_friends.py` plays two players with `tests/fake_supabase.js`.
- **Friend battles** (`FRIEND BATTLES` section, `supabase/migrations/*_friend_battles.sql`): live lockstep battles. Both
  clients build the same `Battle` (sides in invite order: inviter = side 0; `F.me` is which side is "you") with the
  invite's seed; shared randomness is only drawn inside `fbStep`, so never call engine code that rolls dice outside it
  in a live battle (auto-picks use `Math.random`). Remote choices go through `fbValid` on both sides. Counters live in
  `state.games.social.fbN/fbW`. `tests/test_friend_battle.py` runs two browser contexts joined by a stand-in server.
- **The claude.ai build** (`--artifact`) has no `<!doctype>` (quirks mode) and can use `window.claude` for cloud saves
  (`ON_CLAUDE`). The website is standards mode and stores saves only in the browser. Test layout changes on the website.
- **Size:** the site is ~420 MB (610 files; the sleeping-sprite packs add 2.8 MB). GitHub Pages allows 1 GB per site and 100 MB per file; keep it well under.
- **Credits** (Settings → Credits) must stay complete: sprite sources, Pokémon © notice. Add credits for any new
  outside asset. The 2D Hall of Fame backgrounds and Home art are Retro Diffusion pixel art (credited); the 3D look and
  everything else drawn is canvas code. Keep both: the canvas versions are the fallback.
- **Home life** (`HOME LIFE` section): Pokémon use furniture through `SPOT_OF` (kind → nap/sit/watch/… spots), weighted
  by type and time in `spotWeight`/`homeDecide`; new furniture kinds that Pokémon should use need an entry there.
  Berries, feeding, gifts, `fedN` and `photos` live in `state.games.home` (validated in `cleanGames`). Seasonal events are
  data in `EVENTS` (dates, night tint, visitors, `furn` ids sold only while it runs: give the item `event:"<id>"`).
  Tests pin the time of day with `window.DTD_TOD = "night"`.
- **Home layout.** `ROOMS` is in house order (front yard, bedroom, living room, kitchen, Grand hall, garden, pond). Item,
  gift and berry-tree positions are absolute x along the house; `home.lay` records the room order they refer to and
  `homeRelayout()` moves everything with its room when the owned rooms change (old saves without `lay` use
  `LEGACY_ROOMS`). Never change a room's `w` without migrating. Out in a yard the house rooms are covered by
  `drawFacade` (2D art `house/<design>`, canvas `facadeShapes` in 3D); `HS.outA` fades it. House designs are `HOUSES`
  (cat `house`, `home.house`, `houseOf()`). `tests/test_home_layout.py` checks the migration.
  Decorate mode has its own camera (`HS.dcam`: drag the floor, arrow keys, `data-hroom` buttons), a toolbar over the
  selected piece (`decoFloat`), `decoNudge`, and `decoCancel` (a piece picked up with Move goes back). The trainer in the
  Home is `homeTrainer()` (`home.tr`, null = the "All" team's trainer). Gyms take any team once `leagues[g]` is won
  (`gymTeamsOpen`).
- **Home walls.** Rooms sit side by side; between each pair `dividers()` puts a wall with a doorway (`DOOR` depth range)
  whose look comes from `divType` (indoor, house back door, hedge, Grand hall). `inWall` blocks walking, `fits` keeps
  furniture off walls, and Pokémon use `findPath` to cross rooms. 2D Homes are drawn at exactly 32 px per tile.

- **The Pokémon sheet** has three tabs: Battle (everything that changes a battle), Personalize (looks only) and Info.
  Keep anything that affects battle on the Battle tab only. Pickers open in the same modal and return with `sheetBack`.
- **Replays** record the seed and every choice; a replay re-runs the engine and must reach the same hash (`rpHash`).
  So every bit of battle randomness goes through `B.rand` inside `rpStep`/`fbStep`; never roll engine dice anywhere else,
  and record deep copies (the engine mutates choice objects). `tests/test_replays.py` checks it.
- **Animations:** every move needs a `moveRecipe` (signature ones in `SIG_FX`); `tests/test_battle_anim.py` draws all of
  them in both styles.
- **Battle Tower / missions / login / Home games** keep their state in `state.games.tower`, `.missions`, `.login` and
  `home.games` (all validated in `cleanGames`). New ways to finish a mission call `missionBump(kind)`; nothing counts while
  `VISIT` is set or for replays/hotseat. Tower rewards (`it.tower`) are exclusives.
- **Battles.** Member battle fields (`nature`, `evs`, `ivs`, `level`) are validated in `cleanMember`; Megas/Primals never hold
  items (there are no Mega Stones). Any damage change must keep `tests/test_damage.mjs` at 0 mismatches.

## Blake's preferences
- Keep it free and non-profit. Polished, "production-ready" feel; he likes bold improvements when asked to clean up.
- He prefers the animated idle 3D sprites over HD stills (an HD-sprite swap was tried and reverted).
- Sprites are shown at native size, never upscaled with a filter (whole-number multiples on big canvases only).
  See `docs/3d-sprites.md`.
- Plain-language summaries of what changed; show screenshots of UI changes when possible.
