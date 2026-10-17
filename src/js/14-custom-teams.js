// ================= CUSTOM TEAMS: create, edit, copy, delete =================
const CT_PRESETS = [
  {k:"blank", label:"Blank National", d:{name:"", base:"all"}},
  {k:"mono", label:"One type", d:{types:["Fire"]}},
  {k:"mega", label:"Megas only", d:{forms:"mega"}},
  {k:"leg", label:"Legendaries only", d:{leg:"only"}},
  {k:"big", label:"Big team of 12", d:{size:12}},
];
const ctDraft0 = () => ({id:"", name:"", base:"all", types:[], both:false, forms:"show", leg:"all", fe:false, bst:"any", gens:[], size:MAX});
function newCustomId(){ let id; do { id = "c" + Date.now().toString(36) + Math.floor(Math.random()*1296).toString(36); } while (TEAM_BY.has(id)); return id; }
function goTeam(id){
  state.hidden = state.hidden.filter(x => x !== id); state.team = id; state.q = ""; const s = $("search"); if (s) s.value = "";
  if ($("app").hidden) enterApp(null, id); else renderAll();
}
function addCustom(d, picks){
  const c = cleanCustom([{...d, id:newCustomId()}])[0]; if (!c) return null;
  state.custom.push(c); rebuildTeams();
  if (picks) { for (const k of ["teams", "teamShiny", "members", "trainers", "scenes"]) if (picks[k] !== undefined && picks[k] !== null) state[k][c.id] = JSON.parse(JSON.stringify(picks[k])); if (picks.scenes2d) state.scenes[c.id + "~2d"] = JSON.parse(JSON.stringify(picks.scenes2d)); }
  return c;
}
function copyTeam(id){
  const T = TEAM_BY.get(id); if (!T) return;
  const def = T.custom ? {...T.def, name:(T.def.name + " copy").slice(0, 24)} : {...ctDraft0(), base:id, name:(T.big + " team 2").slice(0, 24)};
  snap("Copied " + T.card);
  const c = addCustom(def, {teams:teamOf(id), teamShiny:state.teamShiny[id] || [], members:state.members[id] || {}, trainers:state.trainers[id], scenes:state.scenes[id], scenes2d:state.scenes[id + "~2d"]});
  if (!c) return;
  touched(); save(); closeModal(); goTeam(c.id);
  toast(`Made “${c.name}”. Change its rules from ⋯ Team options.`, {undo:true});
}
function deleteCustom(id){
  const d = state.custom.find(x => x.id === id); if (!d) return;
  snap("Deleted " + d.name);
  state.custom = state.custom.filter(x => x.id !== id);
  for (const k of ["teams", "teamShiny", "members", "trainers", "scenes", "notes"]) delete state[k][id];
  delete state.scenes[id + "~2d"];
  state.hidden = state.hidden.filter(x => x !== id); state.order = state.order.filter(x => x !== id);
  rebuildTeams(); fixCurrent(); touched(); save(); closeModal();
  if (!$("app").hidden) renderAll();
  toast(`Deleted “${d.name}”.`, {undo:true});
}
function openCustomEditor(editId = null, seed = null){
  const cur = editId ? state.custom.find(x => x.id === editId) : null;
  let d = cur ? JSON.parse(JSON.stringify(cur)) : {...ctDraft0(), ...JSON.parse(JSON.stringify(seed || {}))};
  let armed = false;
  const md = openModal(`<h3 class="mt" id="modalTitle">${cur ? "Team rules" : "New team"}</h3>
    <p class="note">${cur ? "Your picks are kept. Any that stop fitting the rules are set aside and come back if you change the rules back." : "Choose who can join. The team gets its own tab, trainer, notes and Hall of Fame scene, and you can make as many as you like."}</p>
    <div id="ctRoot" class="ct"></div>`, {wide:true});
  const root = md.querySelector("#ctRoot");
  const seg = (k, opts) => `<div class="segrow" data-ck="${k}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(d[k]) === v}">${l}</button>`).join("")}</div>`;
  const draw = () => {
    const pool = ctPool(d), B = BUILTIN.find(t => t.id === d.base), nm = root.querySelector("#ctName");
    if (nm) d.name = nm.value;
    root.innerHTML = `
      ${cur ? "" : `<div class="cov-h">Quick start</div><div class="ftg ct-presets">${CT_PRESETS.map(p => `<button type="button" class="fchip" data-preset="${p.k}">${p.label}</button>`).join("")}</div>`}
      <div class="ct-grid">
        <label class="field">Team name<input id="ctName" maxlength="24" placeholder="${esc(ctAutoName(d))}" value="${esc(d.name)}" autocomplete="off" spellcheck="false"></label>
        <label class="field">Pokémon from<select class="select" id="ctBase">
          <optgroup label="Everyone"><option value="all" ${d.base === "all" ? "selected" : ""}>National Pokédex · every region</option></optgroup>
          <optgroup label="One region">${GENS.map(g => `<option value="g${g.g}" ${d.base === "g" + g.g ? "selected" : ""}>Gen ${ROMAN[g.g]} · ${g.region}</option>`).join("")}</optgroup>
          <optgroup label="Collection">${THEMES.map(t => `<option value="${t.id}" ${d.base === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</optgroup></select></label>
      </div>
      <div class="ct-row"><span class="fl">Type</span><div class="ct-types">${TYPE_ORDER.map(t => `<button type="button" class="chip" data-cty="${t}" style="${tStyle(t)}" aria-pressed="${d.types.includes(t)}">${t}</button>`).join("")}</div></div>
      <p class="note ct-tip">${d.types.length ? "Tap a type again to remove it. Up to two." : "Any type. Pick one for a single-type team, or two."}</p>
      ${d.types.length === 2 ? `<div class="ct-row"><span class="fl">Two types</span>${seg("both", [["false", `${d.types[0]} or ${d.types[1]}`], ["true", `Both ${d.types[0]} and ${d.types[1]}`]])}</div>` : ""}
      <div class="ct-row"><span class="fl">Megas &amp; forms</span>${seg("forms", [["show", "Include"], ["mega", "Megas only"], ["regional", "Regional only"], ["only", "Any form only"], ["hide", "No forms"]])}</div>
      <div class="ct-row"><span class="fl">Legendary</span>${seg("leg", [["all", "Include"], ["only", "Only"], ["hide", "None"]])}</div>
      <div class="ct-row"><span class="fl">Base stats</span>${seg("bst", [["any", "Any"], ["lo", "Under 400"], ["mid", "400s"], ["hi", "500s"], ["top", "600+"]])}</div>
      <div class="ct-row"><span class="fl">Evolution</span>${seg("fe", [["false", "Any stage"], ["true", "Fully evolved only"]])}</div>
      ${B && B.kind !== "gen" ? `<div class="ct-row"><span class="fl">Generations</span><div class="segrow gens">${GENS.map(g => `<button type="button" data-cg="${g.g}" aria-pressed="${d.gens.includes(g.g)}" title="${g.region}">${ROMAN[g.g]}</button>`).join("")}</div></div>` : ""}
      <div class="ct-row"><span class="fl">Team size</span><div class="ct-size"><button class="btn sm" type="button" data-csz="-1" aria-label="Smaller team" ${d.size <= 1 ? "disabled" : ""}>−</button><output id="ctSize" aria-live="polite">${d.size}</output><button class="btn sm" type="button" data-csz="1" aria-label="Bigger team" ${d.size >= MAXSIZE ? "disabled" : ""}>+</button><span class="meta">Pokémon · up to ${MAXSIZE}</span></div></div>
      ${d.size > MAX ? `<p class="note ct-tip">Battles use the first six. Drag your team to choose who leads.</p>` : ""}
      <div class="ct-count${pool.length < d.size ? " warn" : ""}" role="status"><b>${pool.length.toLocaleString()}</b> Pokémon fit${pool.length ? "" : ". Loosen a rule to make this team"}${pool.length && pool.length < d.size ? ` · fewer than ${d.size}, so the team can’t fill up` : ""}</div>
      <div class="actions">
        ${cur ? `<button class="btn danger" type="button" id="ctDel" data-armed="${armed ? 1 : 0}">${armed ? "Tap again to delete" : "Delete team"}</button><button class="btn" type="button" id="ctDup">Duplicate</button>` : ""}
        <button class="btn primary" type="button" id="ctSave" ${pool.length ? "" : "disabled"}>${cur ? "Save rules" : "Create team"}</button>
      </div>`;
  };
  root.addEventListener("input", e => { if (e.target.id === "ctName") d.name = e.target.value; });
  root.addEventListener("change", e => { if (e.target.id === "ctBase") { d.base = e.target.value; Sound.play("select"); draw(); } });
  root.addEventListener("click", e => {
    let b;
    if ((b = e.target.closest("[data-preset]"))) { const p = CT_PRESETS.find(x => x.k === b.dataset.preset); d = {...ctDraft0(), ...JSON.parse(JSON.stringify(p.d))}; Sound.play("select"); draw(); return; }
    if ((b = e.target.closest("[data-cty]"))) { const t = b.dataset.cty; d.types = d.types.includes(t) ? d.types.filter(x => x !== t) : [...d.types, t].slice(-2); Sound.play("select"); draw(); return; }
    if ((b = e.target.closest("[data-ck] [data-v]"))) { const k = b.parentElement.dataset.ck, v = b.dataset.v; d[k] = v === "true" ? true : v === "false" ? false : v; Sound.play("select"); draw(); return; }
    if ((b = e.target.closest("[data-cg]"))) { const g = +b.dataset.cg; d.gens = d.gens.includes(g) ? d.gens.filter(x => x !== g) : [...d.gens, g].sort((x, y) => x - y); Sound.play("select"); draw(); return; }
    if ((b = e.target.closest("[data-csz]"))) { d.size = Math.max(1, Math.min(MAXSIZE, d.size + (+b.dataset.csz))); Sound.play("select"); draw(); return; }
    if (e.target.closest("#ctDel")) { if (!armed) { armed = true; draw(); return; } deleteCustom(cur.id); return; }
    if (e.target.closest("#ctDup")) { copyTeam(cur.id); return; }
    if (e.target.closest("#ctSave")) {
      d.name = (d.name || "").trim() || ctAutoName(d);
      if (cur) {
        snap("Changed rules for " + cur.name);
        Object.assign(cur, cleanCustom([{...d, id:cur.id}])[0]); rebuildTeams(); touched(); save(); closeModal();
        if (state.team === cur.id || !$("app").hidden) renderAll();
        toast(`Saved the rules for “${cur.name}”.`, {undo:true});
      } else {
        snap("Created " + d.name); const c = addCustom(d); if (!c) return;
        touched(); save(); closeModal(); Sound.play("confirm"); goTeam(c.id);
        toast(`Created “${c.name}”. ${ctPool(c).length.toLocaleString()} Pokémon to choose from.`, {undo:true});
      }
    }
  });
  draw();
}

