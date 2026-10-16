# Rewards (Phase 3)

Source of truth: `data/rewards.json` (read by the app at build time). First clear gives the rewards; rematches give PokéPoints only.
Exclusives are never sold in the Shop and show as "?" until earned. Furniture is drawn in code (`HOUSE_DRAW`), in both the 2D pixel and 3D styles.

## Gym Leaders (×72)

Every Gym Leader gives **200 PokéPoints**, **their badge** (shown on the trainer card and in the region's **Badge Case**, a Home
furniture piece that lights up each badge you earn; it's given with the region's first badge), **one themed exclusive** that fits the leader
and their type, and a **bonus profile icon** of their ace. Rematches: 40 PokéPoints.

### Kanto

| Leader | Type | Exclusive |
|---|---|---|
| Brock | Rock | Fossil display (furniture) |
| Misty | Water | Seashell fountain (furniture) |
| Lt. Surge | Electric | Tesla lamp (furniture) |
| Erika | Grass | Flower arch (furniture) |
| Koga | Poison | Safari Ball (Poké Ball) — Fuchsia City's Safari Zone |
| Sabrina | Psychic | Crystal ball (furniture) |
| Blaine | Fire | Volcano hot tub (furniture) |
| Giovanni | Ground | Ground-type rug (furniture) |

### Johto

| Leader | Type | Exclusive |
|---|---|---|
| Falkner | Flying | Wind vane (furniture) |
| Bugsy | Bug | Sport Ball (Poké Ball) — the Bug-Catching Contest |
| Whitney | Normal | Friend Ball (Poké Ball) — her friendly Miltank |
| Morty | Ghost | Ghost lantern (furniture) |
| Chuck | Fighting | Punching bag (furniture) |
| Jasmine | Steel | Heavy Ball (Poké Ball) — heavy Steel types |
| Pryce | Ice | Snowman (furniture) |
| Clair | Dragon | Dragon banner (furniture) |

### Hoenn

| Leader | Type | Exclusive |
|---|---|---|
| Roxanne | Rock | Stone totem (furniture) |
| Brawly | Fighting | Dojo banner (furniture) |
| Wattson | Electric | Thunder rug (furniture) |
| Flannery | Fire | Lava lamp (furniture) |
| Norman | Normal | Level Ball (Poké Ball) — the strong dad who trains levels |
| Winona | Flying | Feather rug (furniture) |
| Tate & Liza | Psychic | Dream Ball (Poké Ball) — psychic twins and dreams |
| Wallace | Water | Dive Ball (Poké Ball) — Hoenn's sea, where Dive Balls began |

### Sinnoh

| Leader | Type | Exclusive |
|---|---|---|
| Roark | Rock | Gem display (furniture) |
| Gardenia | Grass | Park Ball (Poké Ball) — Sinnoh's Pal Park |
| Maylene | Fighting | Training dummy (furniture) |
| Crasher Wake | Water | Lure Ball (Poké Ball) — a fisherman's ball |
| Fantina | Ghost | Dusk Ball (Poké Ball) — Ghost types in the dark |
| Byron | Steel | Steel totem (furniture) |
| Candice | Ice | Ice crystal display (furniture) |
| Volkner | Electric | Lighthouse lamp (furniture) |

### Unova

| Leader | Type | Exclusive |
|---|---|---|
| Cilan | Grass | Cactus pot (furniture) |
| Lenora | Normal | Museum display (furniture) |
| Burgh | Bug | Bug terrarium (furniture) |
| Elesa | Electric | Fast Ball (Poké Ball) — the runway star |
| Clay | Ground | Ground totem (furniture) |
| Skyla | Flying | Flying banner (furniture) |
| Brycen | Ice | Frozen totem (furniture) |
| Drayden | Dragon | Dragon totem (furniture) |

### Kalos

| Leader | Type | Exclusive |
|---|---|---|
| Viola | Bug | Net Ball (Poké Ball) — Water/Bug catcher |
| Grant | Rock | Rock rug (furniture) |
| Korrina | Fighting | Champion belt display (furniture) |
| Ramos | Grass | Bonsai pot (furniture) |
| Clemont | Electric | Electric totem (furniture) |
| Valerie | Fairy | Moon Ball (Poké Ball) — Fairy types and the moon |
| Olympia | Psychic | Cosmic orb (furniture) |
| Wulfric | Ice | Ice rug (furniture) |

### Alola

| Leader | Type | Exclusive |
|---|---|---|
| Ilima | Normal | Pillow pile (furniture) |
| Lana | Water | Wave rug (furniture) |
| Kiawe | Fire | Fire torches (furniture) |
| Mallow | Grass | Herb planter (furniture) |
| Sophocles | Electric | Festival banner (furniture) |
| Acerola | Ghost | Ghost totem (furniture) |
| Mina | Fairy | Love Ball (Poké Ball) — Fairy charm |
| Nanu | Dark | Beast Ball (Poké Ball) — Ultra Beasts, from Alola |

### Galar

| Leader | Type | Exclusive |
|---|---|---|
| Milo | Grass | Flower planter (furniture) |
| Nessa | Water | Wave banner (furniture) |
| Kabu | Fire | Fire rug (furniture) |
| Bea | Fighting | Fighting totem (furniture) |
| Opal | Fairy | Fairy arch (furniture) |
| Gordie | Rock | Rock banner (furniture) |
| Piers | Dark | Neon moon lamp (furniture) |
| Raihan | Dragon | Dragon rug (furniture) |

### Paldea

| Leader | Type | Exclusive |
|---|---|---|
| Katy | Bug | Honey cauldron (furniture) |
| Brassius | Grass | Leaf sculpture (furniture) |
| Iono | Electric | Cherish Ball (Poké Ball) — a special event streamer |
| Kofu | Water | Water totem (furniture) |
| Larry | Normal | Plain rug (furniture) |
| Ryme | Ghost | Ghost banner (furniture) |
| Tulip | Psychic | Beauty orb (furniture) |
| Grusha | Ice | Ice banner (furniture) |

## Elite Four (×36)

Clearly better than a gym reward. The first win against each member gives **300 PokéPoints**, an **elite profile icon** of
their ace (with an animated rainbow border; a blinking pixel border in 2D) and their **signature statue**, a 2×2 Home centerpiece with a
gold medallion in their type colour. Three of them also give a **Hall of Fame background** themed on their story: Lucian (Sinnoh) Spear Pillar,
Molayne (Alola) Ultra Space, Hassel (Paldea) Area Zero.

## Champions (×9)

Beating all four plus the Champion completes the set. The first clear gives **1,000 PokéPoints** and:
- the region's **Champion card design** (kept from before),
- the region's **Champion's Hall** Hall of Fame background (one grand hall in the region's colours),
- the region's **trophy** for the Home (it used to come from the 8th gym),
- the **title** "<Region> Champion", chosen on the Trainer card and shown on it (and on the friend profile in Phase 6),
- a profile icon of the Champion's ace. Kanto's Champion also gives the **Master Ball**.

Rematches: 250 PokéPoints.

## Migration

`ecoMigrate()` now has a versioned step (`state.games.eco = 2`). Players keep everything they already own, including rewards from the
old table (rare Poké Balls from 4th gyms, the Area Zero / Ultra Space / Spear Pillar backgrounds, and Shop balls that are now exclusives).
For every badge they already have they get that leader's new exclusive, bonus icon and the region's Badge Case. For every league already
cleared they get all four Elite Four rewards and the Champion's set. A one-time message on the main menu says how many new rewards arrived.

## Shop changes

Net, Dive, Dusk, Heavy, Lure, Level, Fast and Friend Balls are now Gym Leader exclusives, given by leaders that fit them; the Shop keeps
Heal, Luxury, Nest, Quick, Timer and Repeat Balls. Unfound exclusives are collapsed into a "Still to find" strip of "?" tiles.

## Battle Tower (Roadmap 3)

Streak rewards, exclusive like the Gym rewards (`TOWER_REWARD` in `src/app.html`, `it.tower` makes `isExclusive` true):
- **21 wins in a row:** Tower Tycoon's Milotic (elite profile icon) and the **Battle Tower** Hall of Fame background.
- **49 wins in a row:** the steel **Battle Tower trophy** for the Home and Tower Tycoon's Regigigas (elite profile icon).

Each win pays 30 PokéPoints, +10 per 7-win tier (up to +50), and +150 for beating Tycoon Palmer (every 7th battle).
