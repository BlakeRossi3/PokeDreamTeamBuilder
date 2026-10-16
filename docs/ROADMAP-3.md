# Roadmap 3: battles that move, replays, sharing, the Tower, a bigger Home

Blake's brief: "Do steps 2-7 now. Add battle animations too. Try to get the most reasonable options you can that still
work. Every single move should have an animation. Also flying Pokémon appear smaller than they should because their
wings take up so much space in the box." (Online accounts, step 1 of the ideas list, Blake is setting up himself.)

Same rules as before: one branch per phase off the latest `main`, lint plus the phase's tests before each commit, the
full suite at the end of phases 3, 6 and 8, then a PR merged into `main` with a merge commit. Never break saves, never
sell anything, credit every outside source, keep the site well under 1 GB.

## Phase 1: Battle animations for every move, and wide-winged Pokémon at a fair size
- **An animation layer** over the battlefield (a canvas above the sprites, below the HP boxes). It plays between the
  move's name and the damage, in both styles: smooth glows and gradients in 3D, chunky pixel particles in 2D.
- **Every one of the 851 moves gets one.** Each move is described by a small recipe built from its data:
  - **Signature moves** (about 60 of the best known: Hyper Beam, Earthquake, Surf, Thunder, Solar Beam, Psychic,
    Shadow Ball, Protect, Recover, Swords Dance, Draco Meteor…) have hand-made recipes.
  - **Move flags** pick the shape: punch → a fist impact, bite → fangs closing, slicing → slash lines, sound → rings,
    powder → a drifting cloud, bullet → a ball projectile, pulse → a pulsing beam, wind → a gust, dance → a spin with
    sparkles, healing → rising sparkles.
  - **Otherwise the category does:** contact moves lunge and hit, other physical moves throw a projectile, special moves
    fire an orb or a beam, status moves glow on the user (stat up), drop arrows on the target (stat down), spread a
    status cloud (sleep, poison, paralysis, burn), change the weather, set hazards, raise screens or a shield.
  - **The type picks the look:** flames, bubbles, bolts, leaves, ice shards, rocks, shadows… 18 type motifs.
- Big hits shake the field; super-effective hits flash. "Skip to the result", fast mode and Reduced motion shorten or
  skip them.
- **Test:** every move resolves to a recipe and plays without errors; screenshots of a sample in both styles.
- **Flying Pokémon:** sprites are fitted to their box by their whole width, so wide wings make the body tiny. Fit them
  by their body instead (the opaque pixels in the middle of the sprite), letting wing tips use the box's spare width,
  in the Team Builder slots, dex cards, Hall of Fame cards and battle. Still never upscaled with a filter.

## Phase 2: Battle replays
- Every battle (rivals, Gyms, Elite Four, Versus, friend battles) is recorded as its seed, both parties and the
  choices made: a few hundred bytes.
- **Rewatch** from a new Replays list (the last 30 battles), with play/pause, speed and skip.
- **Share** a replay as a link (`?replay=…`, compressed); opening it plays the battle without touching your save.
- **Battle of the week:** pin a replay to your trainer card; friends can watch it from your profile.

## Phase 3: Showdown import/export
- Paste a team in Pokémon Showdown's text format into any team (or a new custom team): species and forms, nicknames,
  items, abilities, moves, natures, EVs, IVs, level and shiny. Unknown names are reported line by line, never guessed
  silently. Mega Stones are ignored (Megas can't hold items here).
- Export any team the same way, from Team options and the Pokémon sheet. Round-trip tested.
- Full suite at the end of this phase.

## Phase 4: The Battle Tower
- Endless battles in a row with one team (3v3 or 6v6, level 50), healed between battles. Opponents come from the
  rival and Gym rosters with tuned sets, getting tougher every 7 wins; every 7th battle is a Tower Tycoon.
- Win streak, best streak, PokéPoints per win that grow with the streak, and Tower-only rewards (an icon, a
  background and a trophy) at 21 and 49 wins. Exclusive: never sold.
- Double battles were considered and left out: they need a different engine (targeting, spread moves, partners) and
  would put the damage-calc guarantee at risk. Noted for a later round.

## Phase 5: More Home
- **New furniture** made with Retro Diffusion (Blake approves the first image; this round stays under ~$1.50):
  hammock, snowman (winter event), toy box, telescope, kitchen stove and a ball pit, each with a canvas fallback for
  3D and a use for Pokémon (nap, play, watch the stars, sniff the cooking, bounce).
- **Winter holidays** ready before Dec 15: snow visitors, the snowman, a holiday tree, frosty nights.
- **Home activities:** Berry Catch (catch falling berries with your Pokémon, keep what you catch) and Hide-and-seek
  (a Pokémon hides behind furniture; find it for friendship).
- **Sleeping sprites:** a better fit in 3D (drawn at the awake sprite's scale with a soft outline) and the species
  without a PMD Sleep animation get a gentler curled-up fallback.

## Phase 6: Speed and offline
- Load what the first screen needs first; sprite packs on demand with priorities; warm the next region's packs when
  idle.
- The service worker caches the app and the packs you've used, so it starts offline and repeat visits are instant.
- Measure first load and repeat load on a throttled phone profile before and after; canvas loops pause when off
  screen. Full suite at the end of this phase.

## Phase 7: Daily missions and a login streak
- Three daily missions picked from your save (win a battle with a Water type, feed 3 berries, play the Daily 10…),
  each paying PokéPoints, with a bonus for all three.
- A login streak with a small reward each day and bigger ones at 7 and 30 days; a missed day keeps half.
- Saves validated (`freshGames`/`cleanGames`); never breaks old saves.

## Phase 8: Wrap-up
- Full suite, layout checker and accessibility check clean; README, CLAUDE.md, credits, changelog and screenshots.

## Status (end of the round)
All eight phases shipped (PRs 18–25). Left for later:
- The other Retro Diffusion furniture (snowman, toy box, telescope, kitchen stove, ball pit) is waiting for Blake to
  approve the first piece, the hammock, which shipped. Budget used so far: about $0.18 of the ~$1.50.
- Double battles (noted in Phase 4).
- The full suite runs once at the end of the round now (cheaper testing); each phase ran only its own tests.
