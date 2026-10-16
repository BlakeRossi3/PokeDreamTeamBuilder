# Dream Team Dex: vision and history (handoff from claude.ai)

This file sums up everything that happened in the claude.ai chats where Dream Team Dex was built (Oct 14–15, 2026), so a
Claude Code session can continue without re-asking. Put it in the repo root next to `CLAUDE.md`.

- **`CLAUDE.md`** is the technical guide: commands, file layout, source map and the rules that keep saves working. Read it first.
- **This file** covers *why* things are the way they are: the vision, what Blake asked for, what was decided or reverted, and what's next.

---

## 1. The vision

Dream Team Dex is a **free, non-profit Pokémon fan web app** owned by Blake. It started as a simple idea: *pick a dream team
of six for every Pokémon generation, with real animated sprites, and a toggle that switches the whole app between a 2D
pixel-art look and a 3D modern look.*

It has grown into a small game built around that core:

1. **Build** dream teams for each region, a National (all-gen) team, themed collections and custom teams.
2. **Personalize** each Pokémon with a nickname, Poké Ball, ability, held item and moves.
3. **Show them off** in an animated, editable, full-screen Hall of Fame scene that can be saved as a GIF or PNG.
4. **Play** with them: Gym challenge (72 badges, 9 leagues), rivals, Versus, quizzes and achievements.
5. **Progress:** earn PokéPoints, unlock items in the Shop and decorate a walk-around Pokémon Home where your favorites live.

Guiding principles that came up again and again:
- **Two complete art styles.** Every screen must look right in both 2D (pixel, square corners, retro fonts) and 3D (dark
  glassy "battle stage"), on desktop and on a 390px phone.
- **Clean main screen.** Blake said the builder screen is "busy as is". New modes go in menus (main menu, start screen),
  not on the team builder.
- **Polished and production-ready.** He wants it to look and feel professional, and he likes bold improvements when he asks
  for a cleanup.
- **Never lose player data.** Old saves must always load and migrate.

---

## 2. Current state (as of the handoff)

- **Live claude.ai version:** https://claude.ai/artifact/FDgWf4cH9xZvnCgoLbjeFS (version 43+, Home/Shop update). It stays
  up, but **the GitHub Pages website is now the main version** going forward.
- **Project package:** 10 zips (`dream-team-dex-part1-of-10.zip` … `part10`). Part 1 is the code, parts 2–10 are sprite packs.
  They unzip into one `dream-team-dex/` folder (~420 files, ~245 MB). The website build from this folder was identical to the
  live version, and every Playwright test passed before packaging.
- **Not done yet:** git init, GitHub repo, first push, enabling Pages. These are the "First-time setup" steps in `CLAUDE.md`.

### Feature inventory
| Area | What exists |
|---|---|
| Teams | 9 region tabs (Kanto → Paldea, each gen's *new* Pokémon only, using that gen's types/stats/matchups: Gen I has one Special stat and no Dark/Steel/Fairy), an **All gens · National** team (Gen IX rules), **collections** (Pseudo-Legendaries, Legendaries, Mythicals, Ultra Beasts, Paradox, Fossils, Babies, Eeveelutions, …), and **custom teams** with your own rules |
| Builder | Search, type chips, filters panel (favorites, not on any team, fully evolved, legendary include/only/hide, base-stat ranges, generation, Megas & forms), favorites, Random six, Undo (button, Ctrl+Z, toast link), share codes (`DTD-…`), type coverage (uses chosen moves), stats sheet |
| Forms | 108 older Megas/regional forms plus all **49 Legends Z-A Megas** (including Mega Dimension DLC), with real typing, stats and abilities |
| Personalize | Nickname, Poké Ball (27), ability, held item, 4 learnable moves; team star rating + notes. The team panel shows only ball + nickname |
| Trainers | Trainer picker per team, 2D and 3D sprites |
| Hall of Fame | Full-page animated canvas scene per team, drag/resize/flip/float Pokémon and trainer, per-Pokémon animated/still toggle (3D), many backdrops, time of day incl. "My clock", camera still/zoom/pan, Poké Ball entrance, Save GIF/PNG. **2D and 3D scenes are stored separately.** Hall of Fame menu shows all cards with 2D/3D tabs |
| Battles | Turn-based engine (pick moves, switch, auto/skip), ~70 abilities, common held items, weather, priority, recoil, drain, stat moves. **Gym challenge** is the featured option: 9 regions × 8 leaders with real badge names, then Elite Four + Champion with no healing. 26 rivals. **Versus** between save files on one device ("pass the device") |
| Quiz | Who's that Pokémon?, super-effective matchups, guess by base stats, name the type, plus Daily 10 |
| Economy | PokéPoints, Shop (Home furniture, Home rooms, HoF backgrounds, profile icons, Poké Balls, trainer card designs), Gym/Champion exclusives never sold. Point values are in README.md |
| Pokémon Home | Canvas house in a 3/4 view. Pick residents from favorites, walk as your trainer (WASD/arrows/tap, A* pathing), play to raise friendship (0–100), decorate mode, 5 rooms (bedroom, living room, garden, pond, grand hall). Furniture is drawn with canvas shapes (`HOUSE_DRAW`), not image files |
| Other | Trainer card (designs + profile icon, save as image), 30 achievements, original chiptune music/SFX with volume, 4 3D themes + 4 2D themes + 8 accents, large text, reduced motion, settings per save file |
| Saves | Local save files on each device with optional 4-digit PIN (not real security), guest mode, **Download/Restore a backup**. Cloud sync only exists in the claude.ai build (`window.claude`) |
| Website | PWA (installable, offline after first visit), share-preview image, service worker cache-busting per build, credits screen |

---

## 3. How it got here (timeline of Blake's requests)

Roughly in order. Each step was built, tested with Playwright in both styles and both sizes, then published.

1. **Original ask:** a dream-team picker per generation with real animated sprites and a 2D/3D toggle that changes the theme
   and the sprites. Built with PokéAPI/Showdown sprites in per-gen packs, type coverage, shiny toggle, stats, random six, and browser saves.
2. **All-gen National team** tab.
3. **Trainer picker** (uniform 2D/3D sprites), a team view with the trainer, per-member shiny, a **start screen** (All-gen
   team + trainer + logo, showing both styles), **favorites**, and **accounts**.
4. **Pretty scrollbars** that match each style, then the **Hall of Fame scene.** Blake's spec: a moving GIF scene (not a photo)
   that opens full page, with sprites sharp enough for a large screen, editable with a choice of background, while keeping the
   View team card.
5. **Bug: Hall of Fame couldn't be edited at all** when signed in. Root cause: account data loaded frozen/read-only. Fixed by
   deep-copying in `applySaved`. He also asked for **animated vs still per Pokémon** instead of all at once.
6. **Local account sign in/out** → save files with PIN, guest, and optional claude.ai sync for one save per claude.ai login.
7. **"Any other ideas?"** He picked **all** of the quality-of-life, Hall of Fame polish, share codes, fun/replayability and
   personalization ideas, plus a Poké Ball for each Pokémon. Conditions: the replayability modes go **on the start screen, not the
   main screen**, the team pop-out shows only nickname + ball, and "don't make it messy."
8. Personalize also added inside View team. Then **items and abilities that count**, **turn-based battles**, **Gym badge run + Elite Four**
   and **Versus** (him vs Sofia).
9. Main menu hub, quiz modes, achievements, sound, themes, real-time sky, trainer card.
10. **Sofia lost a save file.** It couldn't be recovered (only one save syncs per claude.ai account, and hers was browser-only).
    This is why **Download/Restore a backup** exists and why save safety matters.
11. **"Make it production ready overnight"**, with as many changes as reasonable. Full audit of every screen, 3D sprite quality
    work and code cleanup.
12. **HD 3D sprite swap (HOME renders) was tried and reverted.** Blake: "I prefer the idle sprites." Keep animated idle 3D sprites.
13. **Legends Z-A Megas** (all 49). **Gen 6–9 and all forms now animate in 2D via Pocketdex.** PokeRogue sprites were briefly
    used, then fully removed. A complete **Credits** card was added to Settings.
14. **Make it public without Claude.** Options were laid out: local-only saves vs real accounts (Supabase/Firebase). The website was
    built **local-only** with backup/restore, PWA and a share preview. Cloudflare Pages was offered as a host.
15. **Pokémon Home + Shop + unlockables (v43).** His spec: a walk-around Home with Pokémon chosen from favorites; unlockable
    backgrounds, house items, house expansions, profile icons and 2 more categories of Claude's choosing (Poké Balls and card designs);
    Gym Leaders give hidden exclusives + PokéPoints while everything else gives PokéPoints only; **remove Team challenge and Shiny
    hunt**; a Hall of Fame menu; separate 2D/3D Hall of Fame; Gym challenge at the top of the battle menu, bigger, clearly the main option.
16. **Move to Claude Code.** The project was packaged as a normal repo with build/lint/test scripts, a Pages workflow and `CLAUDE.md`.
    Plan: GitHub repo → GitHub Pages.

---

## 4. Decisions and things not to undo

- **Animated idle 3D sprites, not HD stills.** HD was tried and reverted at Blake's request.
- **Team challenge and Shiny hunt were deliberately removed.** Don't bring them back unless asked.
- **Gym/Champion rewards are exclusive.** Never sell them in the Shop.
- **Starter content stays free.** New saves start with 500 PokéPoints. Old saves were migrated with points for past progress, and
  anything already in use stays unlocked.
- **Local-only saves on the website.** Real accounts (Supabase/Firebase) were discussed but not chosen. Ask Blake before adding a backend.
- **Free and non-profit.** No ads or donations, and a full credits screen. This keeps the fan project low-risk.
- **No PokeRogue assets.** They were replaced by Pocketdex.
- **Original art is drawn in code** (Home furniture, Hall of Fame backdrops, music). Any outside asset needs a credit.

---

## 5. Known gaps and risks

- **3D animation gaps:** 14 late Paldea Pokémon (Paradox mons, Ogerpon, …) and 40 of the 49 Z-A Megas have no animated 3D sprite
  yet, so they show still renders. They can be swapped in if the sprite source adds them.
- **Elite Four is hard.** A Kanto sample team lost even after levels were lowered (E4 48–51, Champion 54). It may need easing or
  some healing between battles if Blake finds it unfair.
- **Legal:** sprites and especially the **Pokémon Masters EX trainer art** belong to Nintendo/Game Freak/TPC. A public repo
  exposes them, and fan projects sometimes get takedowns. Pages from a private repo needs a paid GitHub plan. Claude also suggested
  (not decided) avoiding "Pokémon" in the site name.
- **Saves are tied to the web address.** Progress from the claude.ai version won't appear on the new site. Players use
  Account → Download a backup there, then Restore a backup on the website.
- **PIN is not security,** since everything lives in the browser.
- **Size:** ~255 MB site. GitHub Pages limits are 1 GB per site and 100 MB per file.

---

## 6. What's next

### Immediately (first Claude Code session)
1. Make sure the folder is **outside OneDrive** (Blake's screenshot showed OneDrive sync checkmarks). Use something like
   `C:\dev\dream-team-dex`, because syncing can lock files mid-commit.
2. `python3 scripts/build.py` to confirm all sprite packs are present. On Windows the command may be `python` or `py`.
3. Do the "First-time setup" in `CLAUDE.md`: git init, `gh repo create dream-team-dex --public --source . --push`, then
   Pages → Source: GitHub Actions. Watch the first deploy and give Blake the URL (`https://<user>.github.io/dream-team-dex/`).
4. Remind Blake to move his and Sofia's saves over with Download/Restore a backup.

### Art direction (the active thread)
Blake is working on **Hall of Fame backgrounds, the Pokémon Home and its Shop items, and the general art direction.**
In a separate chat he asked for the best tool for this. The recommendation was **Retro Diffusion's official Claude Code plugin**
(true pixel art, 90+ styles, free cost estimates). SpriteCook is the alternative if the look should be HD rather than pixel.
He hasn't confirmed that it's installed yet.

Setup steps:
```
/plugin marketplace add Retro-Diffusion/retro-diffusion-mcp
/plugin install pixel-art@retro-diffusion
```
Then run `/mcp` and enter the API key from retrodiffusion.ai (Developer Tools → Create API Key; needs credits).

Before generating anything:
- Write **`ART_STYLE.md`** and reference it from `CLAUDE.md`. Include one Retro Diffusion style name used everywhere, base sizes
  (for example 32×32 shop items, 64×64 furniture, one fixed background resolution), an 8–16 color palette, top-left light, and an
  outline rule. Draft it *with* Blake.
- Make one "anchor" Hall of Fame background he loves and use it as the reference image for everything after.
- Prompt the subject only, and never write "pixel art" in the prompt (e.g. "cozy wooden bookshelf, front view, transparent background").
- Render crisp: `image-rendering: pixelated`, integer scaling only, and `NearestFilter` for any three.js textures.
- **Keep generated items original.** Furniture, plants, rugs, posters and trophies are fine. Don't generate Poké Balls, Potions,
  Rare Candy or plushies of named Pokémon.
- Integration notes: furniture is currently drawn in `HOUSE_DRAW` and backdrops in `paintBg`/`SCENES`. Image-based art needs to
  fit both 2D and 3D, stay within the size budget, and get credits.

### Other ideas raised but not built
- Real cross-device accounts (Supabase/Firebase): about a day of work. Only if Blake asks.
- "Compare two teams side by side" was suggested early and wasn't picked.
- Remaining 3D animations, if sources appear.

---

## 7. Working with Blake

- He's a C#/.NET and full-stack developer with a game design background. He's technical but likes **plain-language summaries**
  of what changed, not code walkthroughs.
- Show **screenshots** of UI changes (the Playwright tests save them to `tests/out/`).
- When he asks for "ideas", give a grouped menu. He tends to pick many at once and attach conditions, like keeping the main
  screen uncluttered.
- Ask questions about execution up front when a feature has real choices. He asked for that from the very first message.
- Sofia (his girlfriend) also plays and has her own save file. Versus and the per-save settings exist partly for her.
