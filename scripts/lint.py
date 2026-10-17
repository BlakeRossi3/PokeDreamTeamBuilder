#!/usr/bin/env python3
"""Lint the app's script (src/js/*.js, joined as the page has them) with ESLint (undefined names, redeclarations, unused
variables), and its CSS (src/css/*.css) for broken rules (a stray declaration line silently kills the rule after it).
Problems are reported as src/js/<file>:<line>. The CSS check needs tinycss2 and is skipped without it.

    npm install            # once (installs eslint from package.json)
    python3 scripts/lint.py
"""
import subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import js_parts, DIST, SRC

ROOT = Path(__file__).resolve().parent.parent
parts, spans, n = js_parts(), [], 0   # which lines of the joined script came from which file
for p, t in parts: spans.append((n, p.relative_to(ROOT))); n += t.count("\n")
DIST.mkdir(exist_ok=True)
(DIST / "app.js").write_text("".join(t for _, t in parts), encoding="utf-8")
cmd = ["npx", "eslint", "--no-eslintrc", "--env", "browser,es2022", "--parser-options=ecmaVersion:2022", "--format", "unix",
       "--rule", "no-undef:error", "--rule", "no-redeclare:error", "--rule", "no-dupe-keys:error",
       "--rule", 'no-unused-vars:[warn,{"vars":"all","args":"none"}]', "--global", "claude,GifKit", str(DIST / "app.js")]
r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
for line in r.stdout.splitlines():   # dist/app.js:LINE:COL: message -> src/js/<file>:<line>:COL: message
    bits = line.split(":", 3)
    if len(bits) == 4 and bits[1].isdigit():
        ln = int(bits[1]) - 1; start, f = max(s for s in spans if s[0] <= ln)
        print(f"{f}:{ln - start + 1}:{bits[2]}:{bits[3]}")
    elif line.strip(): print(line)

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

bad = []
for p in sorted((SRC / "css").glob("*.css")):
    for line, msg in css_problems(p.read_text(encoding="utf-8")): bad.append(1); print(f"{p.relative_to(ROOT)}:{line}: CSS {msg}")
ok = r.returncode == 0 and not bad
print("lint clean" if ok else "lint found problems")
sys.exit(0 if ok else 1)
