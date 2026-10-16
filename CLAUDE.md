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
- `python3 scripts/lint.py` — ESLint over the inline script (`npm install` once). Must be clean.
- `node scripts/gen_data.mjs` — regenerate Pokémon/move/ability/item/learnset data from Pokémon Showdown (`@pkmn/dex`).
  Run by hand when data should change; the build itself never needs Node.
- `python3 scripts/gen_item_icons.py` — rebuild the item icon sheet `packs/items.png` + `data/item_icons.json` (needs Pillow;
  downloads PokéSprite and PokéAPI sprites into `.cache/`). Run after items are added to the data.
- `python3 tests/run_all.py [name]` — builds, serves dist/web on :8765 and runs the Playwright tests
  (`pip install playwright && python3 -m playwright install chromium` once). Screenshots go to `tests/out/`;
  look at them after UI changes. Run lint + tests before every commit that touches `src/`.
- `node tests/test_engine.mjs` (rules, items, Bag, AI, random-battle stress test) and `node tests/test_damage.mjs [n] [seed]`
  (damage vs `@smogon/calc`, all 16 rolls) — both also run from `run_all.py`.
- No Python packages are needed to build; Playwright is only for tests. If the pre-installed browser doesn't match,
  install the Playwright version that does (e.g. `pip install playwright==1.56.0` for `/opt/pw-browsers/chromium-1194`).

## Layout
- `src/app.html` — **the whole app** (CSS, markup and JS in one file, ~6,400 lines). Source of truth.
- `src/engine.js` — the battle engine (pure logic, no DOM), inlined into the page at `/*ENGINE*/`; Node tests load it
  through `tests/engine_harness.mjs`. See `docs/battle-audit.md` for what it covers.
  Placeholders `/*DATA*/`, `/*IDX*/`, `/*TRAINERS*/`, `/*OLDTRAINERS*/`, `/*TAGS*/`, `/*HOFD*/`, `/*FORMS*/`, `/*FE*/`,
  `/*MOVES*/`, `/*BALLS*/`, `/*RIVALS*/`, `/*LEADERS*/`, `/*ENGINE*/` (= `src/engine.js`) are filled from `data/` and `packs/index.json`;
  `"/*BUILD*/"` becomes the build hash (cache-busting `?v=` on pack URLs).
- `data/` — Pokédex, forms, moves, balls, rivals, leaders, trainer names, Hall of Fame tuning, etc. (JSON).
- `packs/` — sprites. `s/*.wasm` Pokémon packs (`2d`, `2ds`, `3d`, `3ds`, `3db`/`3dbs` = 3D back sprites, `h` = HOME stills,
  `-f*` = forms; 16 per pack; `python3 scripts/gen_back_packs.py` rebuilds the back packs),
  `t/*.wasm` trainer packs (`2d`, `3d`, `3f`, `l` = Gym Leader portraits). `index.json` maps each sprite to
  `[id, offset, length, kind]` — kind 0 png, 1 gif, 2 webp, 3 = shiny stored as a palette patch of the normal sprite.
  `.wasm` is only a container name so hosts serve them compressed; they are not WebAssembly. Packs are large
  binaries: don't rewrite them unless asked.
- `site/` — icons, share image, service worker template, notes for other hosts, `config.js` (Supabase URL + anon key;
  empty = local saves only) and `vendor/supabase.js` (supabase-js, vendored).
- `supabase/` — `migrations/*.sql` (tables, RLS, RPCs for accounts, saves and friends) and `tests/` (runs them on a local Postgres).
- `art/2d/` — the 2D pixel art (Hall of Fame backgrounds `hof/<scene>[_sunset|_night]`, Home `furn/<id>`, `room/…`
  walls/floors/windows, `div/<type>_col|cap|post|door` room dividers). Embedded in the page at build time (`/*ART2D*/`);
  the app looks them up with `artOf(key)` and falls back to the canvas drawings. 2D only: 3D still uses canvas art.
- `art-src/` — how that art was made: `raw/` Retro Diffusion downloads, `jobs.tsv` (image → job id), `process.py`
  (cut-outs, trophy recolours, clear window glass, wood/carpet floors) which writes `art/2d/`. Re-run it after changing `raw/`.
- `scripts/` — build and lint. `tests/` — Playwright tests + runner. `dist/` — build output (git-ignored).

## Map of src/app.html (search for these banners)
CSS first (themes via CSS variables; 2D look = `:root[data-mode="2d"] …` overrides), then markup, then JS sections:
`ENVIRONMENT` · `DATA` · `SOUND` (chiptune synth; `Sound.play(name)`, names listed in its switch) · `SPRITES AT NATIVE SIZE`
(`getSprite`, `spKey`, `natK` whole-number canvas scale, `hasBack`, `paintAll` for `<img class="spr" data-num>`) · `HALL OF FAME` (`SCENES`,
`paintBg`, `renderScene`, `Stage`, `openHof`) · `UNDO` · `FILTERS` · `SHARE CODES` · `TEAM OPTIONS` · `CUSTOM TEAMS` ·
`POKÉMON SHEET` (`battleHTML`/`wireBattle`, `openMovePicker`, `openItemPicker`, `personalHTML`, `itemIcon`) · `BATTLE ENGINE` (= `src/engine.js`: `Battle`, `mkMon`, `BAG_ITEMS`, `ITEM_WORKS`, `ABIL_WORKS`) · `GYM CHALLENGE + LEAGUES` (`LEAGUES`) · `POKÉPOINTS + UNLOCKABLES` · `SHOP` ·
`POKÉMON HOME` · `HALL OF FAME GALLERY` · `ONLINE ACCOUNTS` (`sbStart`, `sbUpload`, `syncConflict`, `openOnlineMenu`) · `FRIENDS` (`enterVisit`/`leaveVisit`, `renderFriends`, `publicProfile`) · `MAIN MENU + SCREENS` (`HUB`, `openScreen`, `SCREEN_TITLE`, `renderScreen` map,
`nav.onClick/onChange/cleanup`) · `SETTINGS` · `ACHIEVEMENTS` (`ACH`, `checkAch`) · `TRAINER CARD` · `QUIZ` · `BATTLE SCREENS`.
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
- **The claude.ai build** (`--artifact`) has no `<!doctype>` (quirks mode) and can use `window.claude` for cloud saves
  (`ON_CLAUDE`). The website is standards mode and stores saves only in the browser. Test layout changes on the website.
- **Size:** the site is ~417 MB. GitHub Pages allows 1 GB per site and 100 MB per file; keep it well under.
- **Credits** (Settings → Credits) must stay complete: sprite sources, Pokémon © notice. Add credits for any new
  outside asset. The 2D Hall of Fame backgrounds and Home art are Retro Diffusion pixel art (credited); the 3D look and
  everything else drawn is canvas code. Keep both: the canvas versions are the fallback.
- **Home walls.** Rooms sit side by side; between each pair `dividers()` puts a wall with a doorway (`DOOR` depth range)
  whose look comes from `divType` (indoor, house back door, hedge, Grand hall). `inWall` blocks walking, `fits` keeps
  furniture off walls, and Pokémon use `findPath` to cross rooms. 2D Homes are drawn at exactly 32 px per tile.

- **The Pokémon sheet** has three tabs: Battle (everything that changes a battle), Personalize (looks only) and Info.
  Keep anything that affects battle on the Battle tab only. Pickers open in the same modal and return with `sheetBack`.
- **Battles.** Member battle fields (`nature`, `evs`, `ivs`, `level`) are validated in `cleanMember`; Megas/Primals never hold
  items (there are no Mega Stones). Any damage change must keep `tests/test_damage.mjs` at 0 mismatches.

## Blake's preferences
- Keep it free and non-profit. Polished, "production-ready" feel; he likes bold improvements when asked to clean up.
- He prefers the animated idle 3D sprites over HD stills (an HD-sprite swap was tried and reverted).
- Sprites are shown at native size, never upscaled with a filter (whole-number multiples on big canvases only).
  See `docs/3d-sprites.md`.
- Plain-language summaries of what changed; show screenshots of UI changes when possible.
