# Roadmap 2: polish, a living Home, and friend battles

**Status: done (Oct 16, 2026).** All seven phases are merged (PRs #11–#17). Notes on what changed from the plan:
- Friends show as online from `profiles.last_active` (refreshed every minute, visible only to accepted friends) instead of
  a separate presence channel: simpler, same privacy.
- A win by disconnect can't be confirmed by both players, so it isn't paid (the result still counts on your device).
- The two-player test joins two browser contexts through a small stand-in server rather than BroadcastChannel, so each
  player keeps their own saves.
- The optional Eat animation was left out: feeding uses a munch, crumbs and sparkles instead.
- 56 species have no PMD Sleep animation yet (listed in `docs/pmd-credits.md`); they nap with the old squash.

Blake's brief:
- Clean up the messes everywhere: arrow buttons sticking out of their boxes, type badges wrapping one-then-four, and
  similar. No overhaul; make it look professional.
- Find real sleeping sprites; the sleeping in the Pokémon Home isn't convincing.
- The Home needs a lot of help: prettier text, better shadows, and the existing mechanics greatly improved.
- Carry the same polish to the rest of the site.
- **Friend-list 1v1 battles are a must.**

## How to work through this
- Work through the phases in order without stopping for "go". Make your own calls at "ask Blake first" spots and write
  each decision into the phase's PR.
- One branch per phase (`r2-1-…` to `r2-7-…`), off the latest `main`. Use small commits.
- At the end of each phase:
  - run lint and the phase's own tests;
  - open a PR and **merge it into `main` with a merge commit** once they pass;
  - start the next phase from the new `main`.
  - Run the **full suite** (`python3 tests/run_all.py`) at the end of phases 2, 5 and 7, and fix anything red before
    merging.
- **Be efficient:**
  - Batch edits with Python replacements, and run single test files while iterating.
  - Don't re-read the same file sections twice.
  - Don't run `git ls-tree -l` on partial clones (it downloads every blob).
  - Look at screenshots rather than guessing at layout.
- **Rules that still hold:** never break saves (new `state.games` fields need `freshGames` + `cleanGames`); 2D and 3D;
  desktop and a 390px phone with no sideways scroll; credits complete; free and non-profit; native-size sprites, never
  filtered.
- Blake wants plain-language summaries and screenshots of UI changes.

---

## Phase 1: Layout cleanup sweep (whole site)
Build a checker first, then fix everything it and the screenshots show.

**1a. A layout checker.** Add `tests/test_layout_lint.py`. It visits every screen and modal that `audit.py` visits, at
1366×860, 768×1024 and 390×844, in 2D and 3D, and reports:
- **Overflow:** elements sticking out of their parent card or button (an icon or arrow outside its box).
- **Clipped text:** text cut off where it shouldn't be (`scrollWidth > clientWidth`, unless it is meant to show "…").
- **Overlaps:** sibling text or controls covering each other (bounding boxes intersect).
- **Uneven rows:** badge, chip or button rows that wrap unevenly, e.g. 1 item then 4, or a single orphan on its own
  line.
- **Jitter:** a layout that changes between two frames when nothing should move (the hover bug in #9 was one of
  these).

Then make it a regression test. The final run must report nothing, or only items explicitly listed as allowed.

**1b. Problems already seen in screenshots** (fix these and everything the checker finds):
- **Type badges:**
  - Pairs touch with no gap (FIRE|FLYING, ROCK|DARK on View team / Pokédex cards).
  - Long groups wrap as 1 + 4. Give every badge group one style: equal widths per row, a consistent gap, and wrapping
    in balanced rows.
- **Cut-off names:** "Chariz…" and "Garcho…" in team slots (2D and 3D phone). Fit names with a smaller font step or two
  lines before falling back to "…". Keep the shiny ✦ inside the card.
- **Battle header:** the Gym Leader portrait in the oval is cropped to the top of the hair (Brock on phones). Frame
  portraits on the face.
- **Battle actions:** the Switch / Bag / Auto battle / Forfeit row runs off the bottom of the phone screen. Make it a tidy
  2×2 grid on phones.
- **Shop categories:** the chips wrap 2/3/1 with "Trainer card designs" alone on a row. Use a balanced grid, or a
  scrollable segmented row with fade edges.
- **Battle menu (phone):** the "Gym challenge" heading is pale blue on orange (low contrast). Check every heading for
  contrast.
- **Trainer card (2D):** "VIII" overlaps the badge diamonds. Right-align the numerals in a fixed column.
- **Team Builder (desktop):** the stat hover card covers the team slots. Position hover cards so they never cover the
  card they describe, and keep them on screen.
- **Region tabs:** the last tab is cut off at the edge with no hint that the row scrolls. Add fade edges and scroll
  arrows that sit inside the rail.
- **Shop thumbnails:** the cobweb thumbnail is tiny. Scale thumbnails to their content's visible bounds.
- **Chevrons and arrow buttons** (select carets, "Hide ‹", "▶" go arrows, scroll arrows): keep each inside its button
  with consistent padding and alignment.

**Done when:** the checker is clean for every screen × size × style, and before/after screenshots are in the PR.

## Phase 2: A professional look (design tokens, applied everywhere)
Tighten, don't redesign:
- **Type scale:** one scale (e.g. 12/13/15/17/20/24/32) and line heights, with headings, labels, meta text and numbers
  aligned on it. Use tabular numbers for stats, PokéPoints and HP.
- **Spacing:** a 4px grid, consistent card padding, section gaps and control heights (one small and one regular button
  height).
- **Elevation:** three shadow levels (card, raised, modal) for both styles. 2D keeps hard pixel shadows.
- **Buttons, chips and pills:** one shape per style, with icons and text vertically centred. Visible focus rings on
  everything focusable.
- **Empty, loading and error states:** consistent and friendly, with skeletons instead of blank spaces while sprites
  load.
- **Modals and toasts:** consistent headers, close button placement and max widths. Toasts never cover controls.
- **Run the full suite at the end of this phase.**

## Phase 3: The Pokémon Home, rendering
Make it pretty:
- **Text:**
  - Replace the plain message box with a speech-bubble dialog: the Pokémon's mini icon, its name in the display font,
    a typewriter reveal and a soft entrance.
  - Name tags above Pokémon on hover/tap.
  - Prompt bubbles ("E · Play") become small rounded key-cap chips with a tail, crisp in both styles.
  - Emote bubbles get drawn art, not font glyphs (heart, zz, note, star, sparkle, drop, "…").
- **Shadows:**
  - Contact shadows sized to each sprite's real footprint (from its alpha bounds), softer and offset away from the
    main light.
  - Shadows lift and shrink when a Pokémon hops or floats, and sit on top of furniture when a Pokémon is on it.
  - Furniture gets ambient-occlusion shadows where it meets the floor and wall.
  - 2D keeps dithered pixel shadows.
- **Lighting:**
  - Day, sunset and night fade smoothly (no hard switch).
  - Window light falls on the floor by day; night lights glow and have warm floor pools.
  - Halloween purple is subtler.
- **Chrome:**
  - A tidy Home toolbar with icons (Pokémon, Decorate, Shop, Photo, berry pouch) and PokéPoints as a pill.
  - The residents strip as cards with friendship hearts and the ribbon.
  - The event banner as a small themed pill.
- **Camera:** smooth easing, a slight look-ahead when walking, and no jitter at room edges.

## Phase 4: The Pokémon Home, mechanics + real sleeping sprites
**Sleeping sprites.** Use the Sleep animation from **PMD Sprite Collab** (github.com/PMDCollab/SpriteCollab).
- **Coverage:** 974 species have `sprite/<dex4>/Sleep-Anim.png` + `AnimData.xml` (frame size and durations). Each
  sheet is ~1 KB, about 1 MB for all.
- **License:** CC BY-NC 4.0: non-commercial, with credit (fits a free fan app).
- **Steps:**
  1. Write `scripts/gen_sleep_packs.py`. It reads AnimData.xml for the Sleep frames (down-facing row) and packs them as
     `packs/s/zz-*.wasm` (GIF or PNG strips), with an index entry like the other packs.
  2. Write the artist credits for every sprite used (from `tracker.json` / `credit_names.txt`) into
     `docs/pmd-credits.md`, and link it from Settings → Credits ("Sleeping sprites: PMD Sprite Collab contributors,
     CC BY-NC 4.0").
  3. Napping Pokémon use these in both styles: native in 2D, a whole-number scale in 3D. Fall back to the current
     squash when a species has none.
  4. List the gaps.
- **Optional, same source:** an Eat animation for feeding.

**Improve the existing mechanics:**
- Pokémon avoid walking through each other and the trainer, with gentle steering.
- Walking accelerates and decelerates, and they turn to face where they're going.
- Activities settle exactly on their spot, facing the right way: sitting faces out, watching faces the TV, warming
  faces the fire.
- Petting gives a heart burst and a happy hop, and the friendship meter animates in the dialog.
- Play-together pairs actually chase or circle each other for a few seconds.
- Followers trail at a natural distance, and stop when you stop.
- Berry picking: a berry pops off the tree into the pouch. Feeding: the Pokémon eats (bite frames or the Eat
  animation), with a favourite-flavour reaction.
- Gifts sparkle and wobble, and opening one plays a little unwrap.
- Weather particles get depth layers. Rain splashes on outdoor floors; snow settles lightly outdoors.
- Re-check the Phase 7 code for bugs:
  - Pokémon stuck on furniture after redecorating.
  - Spot claims never released.
  - Visitors leaving at dawn.
  - Followers at night.

## Phase 5: Friend 1v1 battles (live, from the friends list)
Must-have. Real-time battles between two friends, each controlling their own team.
- **Database** (new migration):
  - Add a `battle_invites` table (from, to, status: pending/accepted/declined/expired/cancelled, `match_id` uuid,
    `seed`, `created_at`).
  - RLS: only the two players can see it; only accepted friends can invite; at most 5 open invites; invites expire
    after 2 minutes.
  - RPCs to invite, respond and cancel.
  - Add a `battle_results` table (match, winner, loser, turns, ended_at) for a friend-battle record, written through
    an RPC that both clients must confirm.
  - Check it all in `supabase/tests/scenario.sql`.
- **Live link:**
  - Supabase Realtime: `postgres_changes` on `battle_invites` to get invites, then a private broadcast channel
    `battle:<match_id>` for the match.
  - Both clients build the same `Battle` with `opt.rand = rng(seed)` from the invite (the engine already takes `rand`).
  - Each side sends only its turn choice (move / switch / Bag item, plus turn number). When both choices are in, both
    resolve the turn locally (lockstep).
  - Every 5 turns, compare a hash of the battle state. On a mismatch, the inviter's state wins and the other side
    resyncs.
- **Flow:**
  1. On a friend's row and profile, a **Battle** button shows when they are online (presence on a `friends` channel).
  2. The invite toast has Accept / Decline.
  3. Both players pick a team and press Ready, then the battle starts with the normal battle UI (3D back sprites for
     your side).
  4. A 60-second turn timer; after the time runs out, the move is picked automatically.
  5. Disconnect handling: wait 30 s, then that player forfeits.
  6. Rematch button. Spectating isn't needed.
- **Rules:**
  - The format picker offers 1v1 (one Pokémon each), 3v3 or 6v6.
  - Level 50 for everyone; Bag on or off (both agree).
- **Rewards:**
  - A win gives 60 PokéPoints, at most 3 paid wins per friend per day (enforced by the results RPC).
  - Achievements: first friend battle, 10 friend wins.
- **Testing:**
  - Extend `tests/fake_supabase.js` with a fake Realtime (BroadcastChannel between two pages in one browser).
  - `tests/test_friend_battle.py` plays a full 1v1 and a 3v3 between two pages, including a timeout and a disconnect.
- **Run the full suite at the end of this phase.**

## Phase 6: Polish the rest of the site
Carry Phases 1–3's quality to every screen:
- **Battle:** the battle screen, battle menus and the Gym, Elite Four and rival screens.
- **Team Builder:** the builder, the Pokémon sheet and its pickers.
- **Hall of Fame:** the gallery and the scene editor toolbar.
- **Collection screens:** the Shop, trainer card, quiz, achievements and settings.
- **Accounts and friends:** the sign-in screen, account menus, the friends list and profile, and the Home visit.
- **Also:**
  - **Micro-interactions:** press states and subtle transitions, all respecting Reduced motion.
  - **Accessibility:** contrast AA, labels and keyboard order.
  - **Performance:** no layout thrash, and canvas loops pause when hidden.
- **Small leftovers:**
  - After asking for an email code, change the wording to "Open the email and tap **Sign in** (or type the code if
    there is one)", since the default Supabase email has no code until custom SMTP is set up.

## Phase 7: Wrap-up
- Full suite green.
- The layout checker clean across all sizes and styles.
- Fresh screenshots of the main screens in both styles and both sizes go into the PR.
- Update README, CLAUDE.md and the credits (PMD Sprite Collab).
- Add a plain-language section to `docs/CHANGELOG.md` and report the site size.
- Merge into `main`.
