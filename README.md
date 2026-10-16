# Dream Team Dex

A free fan-made Pokémon app. Build a dream team for every region and collection (or make your own rules), give each
Pokémon a nickname, Poké Ball, moves and an item, and stage an animated Hall of Fame scene for it. Then take your teams
into battle against rivals, 72 Gym Leaders and nine Elite Fours, play the Daily 10 quiz, earn PokéPoints, unlock things
in the Shop and invite your favorites into your own Pokémon Home. Plays in 2D pixel art or 3D, on desktop or phone,
and installs to your home screen.

## Run it
```
python3 scripts/build.py                               # builds dist/web/
python3 -m http.server 8765 --directory dist/web       # open http://localhost:8765/
```
Pushing to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`
(repository Settings → Pages → Source: **GitHub Actions**). Other hosts: see `site/OTHER-HOSTS.md`.

## Develop
- Edit `src/app.html` (the whole app) and the JSON in `data/`.
- `python3 scripts/lint.py` (after `npm install`) and `python3 tests/run_all.py`
  (after `pip install playwright && python3 -m playwright install chromium`).
- `CLAUDE.md` has the project map and the rules that keep saves and both art styles working.

## PokéPoints and unlockables
- **Categories:** Hall of Fame backgrounds, Home furniture, Home rooms, profile icons, Poké Balls, trainer card designs.
- **Earning:** quiz answers +3 (+23 on every 10th in a row) · Daily 10: +5 per correct, +25 for finishing, +50 more for 10/10 ·
  achievements +100 each · rivals 150 the first time, 40 after · Gym Leaders 200 + exclusive rewards the first time, 40 after ·
  Elite Four members 300 + elite rewards the first time · leagues 1,000 + the Champion's set the first time, 250 after · Versus wins 60 ·
  +10 per Home Pokémon you play with each day · gifts from Home Pokémon at 60+ friendship (20–60, once a day each) · +20 for liking a friend's Home and +20 for each Like your Home gets
  (once a day per Home) · friend battles are just for fun (no points).
- **Exclusives** are never sold (the Shop shows them as "?" until earned). Every Gym Leader gives their badge, a themed
  exclusive (furniture or a rare Poké Ball that fits them) and an icon of their ace; the first badge of a region gives its
  Badge Case. Elite Four members give an elite profile icon and a signature statue; Champions give their card design,
  Champion's Hall background, trophy, title and an icon. The full table is in `docs/rewards.md` / `data/rewards.json`.
- New saves start with 500. Saves from before the economy get points for past progress plus the rewards for badges
  they already had, and keep anything they were using. Saves from before the reward table (v2) get the new rewards for
  leaders they already beat, and keep everything they own.

## Pokémon Home
Invite favorites to live in your Home, walk around as your trainer (keyboard, tap-to-walk, or the on-screen joystick
on phones) and decorate it (drag pieces to move them, Undo, flip, turn rugs). Pokémon nap in beds, sit on sofas, watch
TV, warm up by the fire, bounce on trampolines and splash in fountains, choosing by type (Fire likes the fireplace,
Water the fountain…). They meet up to play (family and same-type friends first), most sleep at night while Ghost and
Dark types roam, and lamps, fires and TVs glow after dark. Pick up to 3 berries a day per Berry tree and feed them
(+8 friendship, +15 for a Pokémon's hidden favourite flavour). Friendship 25 unlocks a special emote, 50 makes it follow
you, 60+ brings the odd gift and 100 earns a friendship ribbon on its Team Builder card and your trainer card. Daily
weather shows through the windows and in outdoor rooms; seasonal events (Halloween, winter holidays) bring limited-time
furniture and night visitors. Photo mode saves a PNG or a short GIF.

## Saves
Progress lives in each player's browser (several save files per device, optional PIN). Players move a save between
devices with Account menu → **Download a backup** / **Restore a backup**.

**Online accounts** (optional, Supabase): fill in `site/config.js` and players can sign in with Google or an email
code. They get a username, a friend code and one cloud save that syncs local-first across devices; when two devices
both changed, the player chooses which progress to keep. Without the config the app is exactly as above. Setup:
[docs/supabase-setup.md](docs/supabase-setup.md); schema and privacy rules: `supabase/migrations/`.

**Friends** (online accounts only): add friends by friend code, username or a share link (`?friend=CODE`). See their
trainer card, the team they show off (Hall of Fame card + lineup with sprites, nicknames, Poké Balls, items and moves),
copy that team, battle it against the computer, and visit their Pokémon Home. A Like on a friend's Home gives both
players 20 PokéPoints, once a day. No chat or free text; blocking hides you completely. Choose what friends see on the
Trainer card screen.

## Credits
Full credits are in the app under Settings → Credits. The 2D Hall of Fame backgrounds and Pokémon Home art were made
with [Retro Diffusion](https://retrodiffusion.ai/). Dream Team Dex is a free, non-profit fan project.
Pokémon and all related names and images are © Nintendo, Game Freak, Creatures and The Pokémon Company.
