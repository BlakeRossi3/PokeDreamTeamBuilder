// ================= SHOWDOWN IMPORT / EXPORT =================
// Pokémon Showdown's team text, both ways. Import reads species (forms too: Ninetales-Alola, Charizard-Mega-X…),
// nicknames, items, abilities, moves, natures, EVs, IVs, level and shiny, and reports every line it couldn't use
// instead of guessing silently. Mega Stones are skipped (Megas can't hold items here).
const SD_REGION = {Alola:"Alolan", Galar:"Galarian", Hisui:"Hisuian", Paldea:"Paldean"};
const sdKey = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]/g, "");
let SD_SPECIES = null;
// our names → Showdown names, and an index that reads both
function sdShowName(n){
  const m = NAT_BY.get(n); if (!m) return String(n); if (n <= 1025) return m.name;
  const base = NAT_BY.get(baseOf(n)), b = base ? base.name : m.name, nm = m.name;
  let x;
  if ((x = /^Mega (.+?)( [XYZ])?$/.exec(nm))) return `${b}-Mega${x[2] ? "-" + x[2].trim() : ""}`;
  if (/^Primal /.test(nm)) return `${b}-Primal`;
  for (const [reg, adj] of Object.entries(SD_REGION)) if (nm.startsWith(adj + " ")) { const p = /\(([^)]+)\)/.exec(nm); return `${b}-${reg}${p ? "-" + p[1].split(/\s+/)[0] : ""}`; }
  return nm;
}
function sdSpecies(){
  if (SD_SPECIES) return SD_SPECIES; SD_SPECIES = new Map();
  for (const m of NAT) { SD_SPECIES.set(sdKey(m.name), m.num); SD_SPECIES.set(sdKey(sdShowName(m.num)), m.num); }
  return SD_SPECIES;
}
const sdStat = {hp:"hp", atk:"atk", def:"def", spa:"spa", spd:"spd", spe:"spe"};
// text → {mons:[{n, member, sh}], notes:[…]}
function sdParse(text){
  const IDX = sdSpecies(), MV = new Map(MOVES.map(m => [sdKey(m[0]), m[0]])), AB = new Map(Object.keys(ABIL).map(a => [sdKey(a), a])), NAT_K = new Map(Object.keys(NATURES).map(k => [sdKey(k), k]));
  const out = [], notes = [];
  for (const block of String(text || "").replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = block.split("\n").map(l => l.trim()).filter(l => l && !/^===/.test(l)); if (!lines.length) continue;
    // first line: Nickname (Species) (M) @ Item  |  Species (F) @ Item  |  Species @ Item
    let head = lines[0], item = "";
    const at = head.lastIndexOf(" @ "); if (at >= 0) { item = head.slice(at + 3).trim(); head = head.slice(0, at).trim(); }
    head = head.replace(/\s*\((M|F)\)\s*$/, "").trim();
    let nick = "", sp = head; const pm = /^(.*)\(([^()]+)\)$/.exec(head); if (pm && pm[1].trim()) { nick = pm[1].trim(); sp = pm[2].trim(); }
    let n = IDX.get(sdKey(sp));
    if (!n) { const base = sp.split("-")[0]; n = IDX.get(sdKey(base)); if (n) notes.push(`${sp} isn’t in Dream Team Dex, so it came in as ${monName(n)}.`); else { notes.push(`Skipped “${lines[0]}”: no Pokémon called ${sp}.`); continue; } }
    const M = {}, moves = []; let sh = false;
    if (nick && nick !== monName(n)) { M.nick = nick.slice(0, 12); if (nick.length > 12) notes.push(`${nick}: nicknames are up to 12 letters, so it became ${M.nick}.`); }
    if (item) { const lc = item.toLowerCase(); if (/ite( [xy])?$/i.test(item) && !ITEM_LC.has(lc) || isMega(n)) notes.push(`${monName(n)}: ${item} left out (Megas don’t hold items, and there are no Mega Stones).`); else if (ITEM_LC.has(lc)) M.item = ITEM_LC.get(lc)[0]; else notes.push(`${monName(n)}: unknown item ${item}.`); }
    for (const l of lines.slice(1)) {
      let x;
      if ((x = /^Ability:\s*(.+)$/i.exec(l))) { const a = AB.get(sdKey(x[1])); if (a) M.ability = a; else notes.push(`${monName(n)}: unknown ability ${x[1]}.`); }
      else if ((x = /^Level:\s*(\d+)/i.exec(l))) M.level = Math.max(1, Math.min(100, +x[1]));
      else if (/^Shiny:\s*Yes/i.test(l)) sh = true;
      else if ((x = /^(EVs|IVs):\s*(.+)$/i.exec(l))) { const o = {}; for (const part of x[2].split("/")) { const y = /(\d+)\s*(HP|Atk|Def|SpA|SpD|Spe)/i.exec(part); if (y) o[sdStat[y[2].toLowerCase()]] = +y[1]; } M[x[1].toLowerCase()] = o; }
      else if ((x = /^(\w+)\s+Nature$/i.exec(l))) { const k = NAT_K.get(sdKey(x[1])); if (k) M.nature = k; else notes.push(`${monName(n)}: unknown nature ${x[1]}.`); }
      else if ((x = /^[-~]\s*(.+)$/.exec(l))) { const name = x[1].replace(/\s*\[[^\]]*\]\s*$/, "").trim(), k = MV.get(sdKey(name)) || MV.get(sdKey(name.replace(/^Hidden Power.*/i, "Hidden Power"))); if (k) { if (moves.length < 4 && !moves.includes(k)) moves.push(k); } else notes.push(`${monName(n)}: unknown move ${name}.`); }
      else if (!/^(Tera Type|Happiness|Gigantamax|Dynamax Level|Hidden Power|Pokeball):/i.test(l)) notes.push(`${monName(n)}: didn’t understand “${l}”.`);
    }
    if (moves.length) M.moves = moves;
    out.push({n, member:cleanMember(M, n), sh});
  }
  return {mons:out, notes};
}
// a team → Showdown text (level, nature, EVs/IVs only where they differ from the defaults)
function sdExport(id){
  const names = {hp:"HP", atk:"Atk", def:"Def", spa:"SpA", spd:"SpD", spe:"Spe"};
  return teamOf(id).map(n => {
    const M = memberOf(id, n), m = monFromTeam(id, n, Math.max(1, Math.min(100, M.level || 50))), sp = sdShowName(n), nk = M.nick && M.nick !== monName(n) ? `${M.nick} (${sp})` : sp;
    const ev = Object.entries(m.evs).filter(([, v]) => v).map(([k, v]) => `${v} ${names[k]}`), iv = Object.entries(m.ivs).filter(([, v]) => v !== IV_MAX).map(([k, v]) => `${v} ${names[k]}`);
    return [`${nk}${m.item ? " @ " + m.item : ""}`, `Ability: ${m.ability}`, `Level: ${m.level}`, ...(m.sh ? ["Shiny: Yes"] : []), ...(ev.length ? [`EVs: ${ev.join(" / ")}`] : []), `${m.nature} Nature`, ...(iv.length ? [`IVs: ${iv.join(" / ")}`] : []), ...m.moves.map(x => `- ${x[0]}`)].join("\n");
  }).join("\n\n");
}
function sdOpenExport(id){
  const T = TEAM_BY.get(id), txt = sdExport(id);
  const md = openModal(`<h3 class="mt" id="modalTitle">Export to Showdown</h3><p class="note">${esc(T ? T.title : "Team")}: paste this into Pokémon Showdown’s teambuilder (Import from text).</p>
    <textarea class="sd-text" id="sdOut" readonly spellcheck="false" aria-label="Team in Showdown format">${esc(txt)}</textarea>
    <div class="actions"><button class="btn primary" type="button" id="sdCopy">Copy</button><button class="btn" type="button" data-close>Done</button></div>`);
  md.querySelector("#sdCopy").onclick = () => copyText(txt, "Team copied in Showdown format.");
}
function sdOpenImport(){
  const md = openModal(`<h3 class="mt" id="modalTitle">Import from Showdown</h3><p class="note">Paste a team exported from Pokémon Showdown (or written in its format). Nicknames, items, abilities, moves, natures, EVs, IVs, level and shiny come along.</p>
    <textarea class="sd-text" id="sdIn" spellcheck="false" placeholder="Garchomp @ Choice Scarf&#10;Ability: Rough Skin&#10;Level: 50&#10;EVs: 252 Atk / 4 SpD / 252 Spe&#10;Jolly Nature&#10;- Earthquake&#10;- Outrage" aria-label="Showdown team text"></textarea>
    <div class="sd-where"><label><input type="radio" name="sdWhere" value="new" checked> A new team</label><label><input type="radio" name="sdWhere" value="here"> Replace ${esc(G().card)}</label></div>
    <p class="note" id="sdMsg" role="status"></p>
    <div class="actions"><button class="btn primary" type="button" id="sdGo">Import</button><button class="btn" type="button" data-close>Cancel</button></div>`, {wide:true});
  md.querySelector("#sdGo").onclick = () => {
    const R = sdParse(md.querySelector("#sdIn").value), where = md.querySelector('[name="sdWhere"]:checked').value, msg = md.querySelector("#sdMsg");
    if (!R.mons.length) { msg.textContent = R.notes[0] || "No Pokémon found in that text."; return; }
    let id = state.team;
    if (where === "here") { const bad = R.mons.filter(x => !G().byNum.has(x.n)); if (bad.length) { msg.textContent = `${bad.map(x => monName(x.n)).join(", ")} can’t be on ${G().card}. Import into a new team instead.`; return; } }
    else { const nc = addCustom({...ctDraft0(), name:"Showdown team", size:Math.max(MAX, Math.min(12, R.mons.length))}); if (!nc) return; id = nc.id; }
    const mons = R.mons.slice(0, sizeOf(id)); snap("Imported a team");
    state.teams[id] = [...new Set(mons.map(x => x.n))]; state.teamShiny[id] = mons.filter(x => x.sh).map(x => x.n); state.members[id] = Object.fromEntries(mons.filter(x => x.member).map(x => [x.n, x.member]));
    touched(); save(); closeModal(); Sound.play("confirm"); goTeam(id);
    if (R.notes.length) openModal(`<h3 class="mt" id="modalTitle">Imported ${mons.length} Pokémon</h3><p>A few lines needed a change:</p><ul class="sd-notes">${R.notes.slice(0, 20).map(t => `<li>${esc(t)}</li>`).join("")}</ul><div class="actions"><button class="btn primary" type="button" data-close>OK</button></div>`);
    else toast(`Imported ${mons.length} Pokémon.`, {undo:true});
  };
}

