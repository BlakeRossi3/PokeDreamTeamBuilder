// ================= SHARE CODES =================
function shareCode(id){
  const t = teamOf(id); if (!t.length) return "";
  const sh = state.teamShiny[id] || [];
  return `DTD-${id}-` + t.map(n => n.toString(36) + (sh.includes(n) ? "!" : "") + (ballOf(id, n) !== "poke" ? "~" + BALL_IDS.indexOf(ballOf(id, n)).toString(36) : "")).join(".") + "@" + trainerOf(id).toString(36);
}
function parseCode(s){
  const m = String(s || "").trim().replace(/\s+/g, "").match(/^DTD-([a-z0-9]+)-([0-9a-z!~.]+?)(?:@([0-9a-z]+))?$/i); if (!m) return null;
  let id = m[1].toLowerCase(), T = TEAM_BY.get(id), fresh = false;
  if (!T && /^c[0-9a-z]+$/.test(id)) { T = TEAM_BY.get("all"); fresh = true; }
  if (!T) return null;
  const mons = [], shiny = [], balls = {};
  for (const part of m[2].toLowerCase().split(".")) {
    const p = part.match(/^([0-9a-z]+)(!)?(?:~([0-9a-z]))?$/); if (!p) return null;
    const n = parseInt(p[1], 36); if (!T.byNum.has(n) || mons.includes(n)) return null;
    mons.push(n); if (p[2]) shiny.push(n);
    if (p[3]) { const b = BALL_IDS[parseInt(p[3], 36)]; if (b) balls[n] = b; }
  }
  if (!mons.length || mons.length > (fresh ? MAXSIZE : T.size || MAX)) return null;
  const tr = m[3] ? parseInt(m[3], 36) : NaN;
  return {id: fresh ? null : id, mons, shiny, balls, tr: Number.isInteger(tr) && tr >= 0 && tr < TRAINERS.length ? tr : null};
}
function applyCode(c){
  if (!c.id) { const nc = addCustom({...ctDraft0(), name:"Shared team", size:Math.max(MAX, c.mons.length)}); if (!nc) return; c.id = nc.id; }
  const T = TEAM_BY.get(c.id);
  snap(`Loaded a ${T.card} code`);
  state.teams[c.id] = c.mons; state.teamShiny[c.id] = c.shiny;
  state.members[c.id] = Object.fromEntries(Object.entries(c.balls).map(([n, b]) => [n, {ball:b}]));
  if (c.tr !== null) state.trainers[c.id] = c.tr;
  state.hidden = state.hidden.filter(x => x !== c.id); state.team = c.id;
  touched(); save(); renderAll(); toast(`Loaded a ${T.card} team from a code.`, {undo:true});
}

