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
  achievements +100 each · rivals 150 the first time, 40 after · Gym Leaders 200 + an exclusive reward the first time, 40 after ·
  leagues 1,000 + the Champion's card design and icon the first time, 250 after · Versus wins 60 ·
  +10 per Home Pokémon you play with each day.
- **Gym exclusives** are never sold: each region's 4th gym gives a rare Poké Ball, the 6th gym in regions I–III a
  background, the 8th a trophy for your Home, the others an icon of the leader's ace.
- New saves start with 500. Saves from before the economy get points for past progress plus the rewards for badges
  they already had, and keep anything they were using.

## Saves
Progress lives in each player's browser (several save files per device, optional PIN). Players move a save between
devices with Account menu → **Download a backup** / **Restore a backup**.

## Credits
Full credits are in the app under Settings → Credits. The 2D Hall of Fame backgrounds and Pokémon Home art were made
with [Retro Diffusion](https://retrodiffusion.ai/). Dream Team Dex is a free, non-profit fan project.
Pokémon and all related names and images are © Nintendo, Game Freak, Creatures and The Pokémon Company.
