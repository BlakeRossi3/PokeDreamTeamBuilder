#!/usr/bin/env python3
"""Lint the app's inline script with ESLint (undefined names, redeclarations, unused variables).

    npm install            # once (installs eslint from package.json)
    python3 scripts/lint.py
"""
import subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import assemble, DIST

page = assemble()
js = page[page.index("<script>") + 8: page.rindex("</script>")]
DIST.mkdir(exist_ok=True)
(DIST / "app.js").write_text(js, encoding="utf-8")
cmd = ["npx", "eslint", "--no-eslintrc", "--env", "browser,es2022", "--parser-options=ecmaVersion:2022",
       "--rule", "no-undef:error", "--rule", "no-redeclare:error", "--rule", "no-dupe-keys:error",
       "--rule", 'no-unused-vars:[warn,{"vars":"all","args":"none"}]', "--global", "claude,GifKit", str(DIST / "app.js")]
r = subprocess.run(cmd, cwd=Path(__file__).resolve().parent.parent)
print("lint clean" if r.returncode == 0 else "lint found problems")
sys.exit(r.returncode)
