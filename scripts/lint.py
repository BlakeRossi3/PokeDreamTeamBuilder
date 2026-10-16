#!/usr/bin/env python3
"""Lint the app's inline script with ESLint (undefined names, redeclarations, unused variables), and its CSS for
broken rules (a stray declaration line silently kills the rule after it). The CSS check needs tinycss2 and is skipped
without it.

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

def css_problems(css):
    """Rules whose selector holds a ';' (leftover declarations glued onto it) and parse errors, with line numbers."""
    try: import tinycss2
    except ImportError: print("(CSS check skipped: pip install tinycss2)"); return []
    out = []
    def walk(rules):
        for r in rules:
            if r.type == "error": out.append((r.source_line, r.message))
            elif r.type == "qualified-rule":
                sel = tinycss2.serialize(r.prelude)
                if ";" in sel or "}" in sel: out.append((r.source_line, "broken selector: " + " ".join(sel.split())[:90]))
            elif r.type == "at-rule" and r.content is not None and r.lower_at_keyword in ("media", "supports", "container", "layer"):
                walk(tinycss2.parse_rule_list(r.content, skip_comments=True, skip_whitespace=True))
    walk(tinycss2.parse_stylesheet(css, skip_comments=True, skip_whitespace=True))
    return out

src = (Path(__file__).resolve().parent.parent / "src" / "app.html").read_text(encoding="utf-8")
a = src.index("<style>") + 7; base = src[:a].count("\n")
bad = css_problems(src[a: src.index("</style>")])
for line, msg in bad: print(f"src/app.html:{base + line}: CSS {msg}")
ok = r.returncode == 0 and not bad
print("lint clean" if ok else "lint found problems")
sys.exit(0 if ok else 1)
