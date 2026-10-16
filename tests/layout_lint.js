// Layout checker, injected into the page by tests/test_layout_lint.py. window.__layoutLint() returns a list of problems:
//   overflow  a control, badge or icon sticking out of the card or button it sits in
//   offscreen a control cut off by the edge of the screen (outside any sideways-scrolling row)
//   clipped   text cut off by its box (marked-up "…" truncation on purpose is allowed with data-ll-ok)
//   overlap   two neighbouring controls or labels covering each other
//   wrap      a row of badges, chips or buttons that wraps unevenly (one-then-four, or one left alone on a line)
// Elements (or any ancestor) with data-ll-ok are skipped.
(() => {
  const CTRL = "button, .btn, select, input:not([type=hidden]), .tb, .pill, .chip, .tchip, [role=tab], a.btn";
  const vis = e => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === "none" || s.visibility === "hidden" || +s.opacity < .05) return false; } return true; };
  const ok = e => !!e.closest("[data-ll-ok], canvas, svg, .sr-only, [hidden], #toast, .pp-chips");
  const label = e => { const id = e.id ? "#" + e.id : ""; const cls = typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : ""; const t = (e.textContent || e.value || e.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 24); return `${e.tagName.toLowerCase()}${id}${cls}${t ? ` "${t}"` : ""}`; };
  const where = e => { const a = []; for (let x = e.parentElement; x && x !== document.body && a.length < 3; x = x.parentElement) if (x.id || (typeof x.className === "string" && x.className.trim())) a.unshift(x.id ? "#" + x.id : "." + x.className.trim().split(/\s+/)[0]); return a.join(" > "); };
  const clips = s => /(hidden|auto|scroll|clip)/.test(s.overflowX + s.overflowY);
  // the "box" an element should stay inside: the nearest ancestor with a visible border or background of its own
  function boxOf(e){
    for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) {
      const s = getComputedStyle(x);
      if (parseFloat(s.borderLeftWidth) > 0 && s.borderLeftStyle !== "none" && s.borderLeftColor !== "rgba(0, 0, 0, 0)") return x;
      if (s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundColor !== "transparent" && x.getBoundingClientRect().width < innerWidth*.98) return x;
    }
    return null;
  }
  function scroller(e){ for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const s = getComputedStyle(x); if (/(auto|scroll)/.test(s.overflowX) && x.scrollWidth > x.clientWidth + 1) return x; } return null; }
  window.__layoutLint = (root = document) => {
    const out = [], seen = new Set(), add = (kind, e, extra = "") => { const k = kind + label(e) + where(e); if (seen.has(k)) return; seen.add(k); out.push({kind, el:label(e), where:where(e), extra}); };
    const ctrls = [...root.querySelectorAll(CTRL)].filter(e => vis(e) && !ok(e));
    for (const e of ctrls) {
      const r = e.getBoundingClientRect(), sc = scroller(e), pos = getComputedStyle(e).position;
      // offscreen: cut off by the screen edge (rows that scroll sideways are allowed to)
      if (!sc && (r.left < -1 || r.right > innerWidth + 1)) add("offscreen", e, `${Math.round(r.left)}..${Math.round(r.right)} of ${innerWidth}`);
      // overflow: sticking out of its box (absolute corner badges are allowed to sit on the edge, but not beyond it)
      const b = boxOf(e); if (!b || b.contains(e) === false) continue;
      const br = b.getBoundingClientRect(), slack = pos === "absolute" ? 4 : 1;
      if (r.left < br.left - slack || r.right > br.right + slack || r.top < br.top - slack || r.bottom > br.bottom + slack) {
        if (clips(getComputedStyle(b))) continue;   // inside a box that clips or scrolls its content: that's scrolling, not sticking out
        add("overflow", e, `out of ${label(b)} by ${Math.round(Math.max(br.left - r.left, r.right - br.right, br.top - r.top, r.bottom - br.bottom))}px`);
      }
    }
    // clipped text: a leaf with text whose content is wider than its box and the overflow is hidden
    for (const e of root.querySelectorAll("body *")) {
      if (e.children.length > 2 || !e.textContent.trim() || ok(e) || !vis(e)) continue;
      const s = getComputedStyle(e);
      if (s.textOverflow === "ellipsis" && e.scrollWidth > e.clientWidth + 1) { if (e.matches("h1, h2, h3, h4, b, strong, .nt, [class*=name], [class*=title]")) add("clipped", e, "shows …"); }   // descriptions may shorten on purpose; names and headings may not
      else if (clips(s) && !/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 2 && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) add("clipped", e, `${e.scrollWidth} > ${e.clientWidth}`);
    }
    // overlaps between neighbours in normal flow
    const groups = new Set(ctrls.map(e => e.parentElement));
    for (const g of groups) {
      const kids = [...g.children].filter(e => vis(e) && !ok(e) && !["absolute", "fixed"].includes(getComputedStyle(e).position));
      for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i].getBoundingClientRect(), c = kids[j].getBoundingClientRect(), w = Math.min(a.right, c.right) - Math.max(a.left, c.left), h = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
        if (w > 2 && h > 2) add("overlap", kids[i], `with ${label(kids[j])}`);
      }
    }
    // uneven wraps in rows of similar items (badges, chips, buttons)
    for (const g of root.querySelectorAll("body *")) {
      if (ok(g) || !vis(g)) continue; const s = getComputedStyle(g);
      if (!((s.display.includes("flex") && s.flexWrap === "wrap") || s.display === "block")) continue;   // grids of tiles may end on a short row
      const kids = [...g.children].filter(e => vis(e) && e.matches(CTRL + ", .tb, .type, [class*=badge]") && !["absolute", "fixed"].includes(getComputedStyle(e).position));
      if (kids.length < 3 || kids.length > 12 || kids.length !== [...g.children].filter(vis).length) continue;
      const kind = e => e.tagName + "." + (typeof e.className === "string" ? e.className.trim().split(/\s+/)[0] : "");
      if (kids.filter(k => kind(k) === kind(kids[0])).length < kids.length*.8) continue;   // only rows of similar items (badges, chips, option buttons)
      const rows = []; for (const k of kids) { const t = Math.round(k.getBoundingClientRect().top); const row = rows.find(r => Math.abs(r.t - t) < 6); if (row) row.n++; else rows.push({t, n:1}); }
      if (rows.length < 2) continue;
      rows.sort((a, b) => a.t - b.t);
      const counts = rows.map(r => r.n), last = counts[counts.length - 1], most = Math.max(...counts);
      if (last === 1 && most >= 3) add("wrap", g, `rows ${counts.join("+")} (one left alone)`);
      else if (counts[0] < most && counts[0] === 1) add("wrap", g, `rows ${counts.join("+")} (one-then-many)`);
    }
    return out;
  };
  // jitter: positions of every control twice, some frames apart; nothing should move while nothing is happening
  window.__layoutJitter = async (ms = 600) => {
    const snap = () => [...document.querySelectorAll(CTRL)].filter(e => vis(e) && !ok(e)).map(e => { const r = e.getBoundingClientRect(); return [label(e), Math.round(r.left), Math.round(r.top), Math.round(r.width)]; });
    const a = snap(); await new Promise(r => setTimeout(r, ms)); const b = snap();
    const moved = a.filter((x, i) => b[i] && b[i][0] === x[0] && (Math.abs(b[i][1] - x[1]) > 1 || Math.abs(b[i][2] - x[2]) > 1 || Math.abs(b[i][3] - x[3]) > 1));
    return moved.length ? [{kind:"jitter", el:moved[0][0], where:"", extra:`${moved.length} controls moved`}] : [];
  };
})();
