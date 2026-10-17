#!/usr/bin/env python3
"""Build the site, serve dist/web on localhost:8765 and run every Playwright test.

    pip install playwright && python3 -m playwright install chromium   # once
    npm install                                                         # once (the Node engine tests use @smogon/calc)
    python3 tests/run_all.py            # all tests
    python3 tests/run_all.py audit      # only tests whose file name contains "audit"

Screenshots land in tests/out/. A test fails if it raises or prints page errors.
"""
import os, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TESTS = [  # (file, args)
    ("audit.py", []),                                   # every screen, 2D/3D, desktop/phone, sideways-scroll check
    ("test_layout_lint.py", []),
    ("test_a11y.py", []),                               # accessibility (axe-core): contrast, labels, ARIA; no serious problems                        # layout checker: nothing sticking out, clipped, overlapping or wrapping unevenly
    ("test_shop_home.py", ["1366", "860", "3d"]),       # Shop, Pokémon Home, Hall of Fame menu, unlocks, gym rewards
    ("test_shop_home.py", ["390", "844", "2d"]),
    ("test_save_migration.py", []),                     # old saves get PokéPoints + rewards, locked Poké Balls
    ("test_battles_and_exports.py", []),                # gyms, Versus, trainer card + GIF export, settings
    ("test_custom_teams.py", []),
    ("test_battle_engine.py", []),
    ("test_battle_ui.py", ["1280", "860", "3d"]),       # moves + PP, Bag, U-turn, Elite Four run bag
    ("test_battle_ui.py", ["390", "844", "2d"]),
    ("test_sheet.py", ["1280", "860", "3d"]),           # Pokémon sheet: Battle tab, move picker, item picker
    ("test_sheet.py", ["390", "844", "2d"]),
    ("test_rewards.py", ["1366", "860", "3d"]),         # reward table v2, migration, Shop exclusives, new furniture, halls, titles
    ("test_rewards.py", ["390", "844", "2d"]),
    ("test_online.py", ["1280", "860"]),                  # online accounts with a stand-in Supabase: sign-in, sync, conflicts
    ("test_online.py", ["390", "844"]),
    ("test_friends.py", ["1280", "860"]),                 # friends: profiles, lineup, Home visits, Likes, friend battles
    ("test_friends.py", ["390", "844"]),
    ("test_friend_battle.py", ["1280", "860"]),           # live friend battles: two players, 1v1 + timer, rematch, 3v3, disconnect
    ("test_friend_battle.py", ["390", "844"]),
    ("test_home_life.py", ["1280", "860", "3d"]),        # Home: furniture spots, night naps, berries, gifts, drag/undo/turn, photo mode
    ("test_home_life.py", ["390", "844", "2d"]),
    ("test_battle_anim.py", ["1280", "860"]),           # every move has an animation that draws in 3D and 2D
    ("test_replays.py", []),                            # replays re-run to the same ending; share links; Replays screen
    ("test_showdown.py", ["390", "844"]),               # Showdown import/export round trip
    ("test_tower.py", ["390", "844", "2d"]),            # Battle Tower: streaks, Tycoon, Tower-only rewards
    ("test_tower.py", ["1280", "860", "3d"]),
    ("test_home_layout.py", ["2d", "1280", "860"]),     # yard + kitchen, old saves keep furniture in its room, house front, designs
    ("test_home_layout.py", ["3d", "390", "844"]),
    ("test_home_games.py", ["2d", "390", "844"]),       # hammock, Berry Catch, Hide-and-seek
    ("test_home_games.py", ["3d", "1280", "860"]),
    ("test_missions.py", ["3d", "390", "844"]),         # daily missions + login streak
    ("test_missions.py", ["2d", "1280", "860"]),
    ("test_engine.mjs", []),                            # engine rules: stats, crits, status, PP, items, Bag, AI (Node)
    ("test_damage.mjs", ["1500"]),                      # damage vs @smogon/calc (Node)
]

def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ""
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build.py")], check=True)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765"], cwd=ROOT / "dist" / "web", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    failed = []
    try:
        for f, args in TESTS:
            if only and only not in f: continue
            print(f"\n=== {f} {' '.join(args)}", flush=True)
            run = ["node"] if f.endswith(".mjs") else [sys.executable]
            r = subprocess.run([*run, str(ROOT / "tests" / f), *args], capture_output=True, text=True, timeout=900, cwd=ROOT)
            out = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if "ERR_TUNNEL" not in l and "fonts.g" not in l)
            print(out[-4000:])
            bad = r.returncode != 0 or "PAGEERR" in out or any(l.startswith(("errors:", "ERRS")) and l.strip() not in ("errors: []", "ERRS []") and "Failed to load resource" not in l for l in out.splitlines())
            if bad: failed.append(f)
    finally:
        srv.terminate()
    print("\nFAILED: " + ", ".join(failed) if failed else "\nAll tests passed.")
    sys.exit(1 if failed else 0)

if __name__ == "__main__":
    main()
