// ================= TEAM OPTIONS: rating, notes, share code =================
const notesOf = id => state.notes[id] || {text:"", stars:0};
function setNotes(id, patch){
  const n = {...notesOf(id), ...patch}; n.text = String(n.text || "").slice(0, 600); n.stars = Math.max(0, Math.min(5, n.stars | 0));
  if (!n.text.trim() && !n.stars) delete state.notes[id]; else state.notes[id] = n;
  save();
}
const starsHTML = s => `<span class="stars-ro" aria-label="${s} of 5 stars">${"★".repeat(s)}<span>${"★".repeat(5 - s)}</span></span>`;
function openTeamOptions(){
  const id = state.team, T = G(), N = notesOf(id), code = shareCode(id);
  const md = openModal(`<h3 class="mt" id="modalTitle">Team options</h3><p class="note">${esc(T.title)}</p>
    <div id="toRoot">
      ${T.custom ? `<div class="cov-h">Rules</div><p class="to-rules">${esc(ctSummary(T.def))}</p>
      <div class="actions left"><button class="btn sm primary" type="button" id="toRules">Edit rules</button><button class="btn sm" type="button" id="toCopy">Duplicate</button></div>`
      : `<div class="actions left"><button class="btn sm" type="button" id="toCopy">Copy as a new team</button><button class="btn sm" type="button" id="toNew">＋ New team</button></div><p class="note">Copying makes another ${esc(T.card)} team with its own picks, so you can keep more than one.</p>`}
      <div class="cov-h">Your rating</div>
      <div class="stars" role="radiogroup" aria-label="Team rating">${[1,2,3,4,5].map(i => `<button type="button" role="radio" data-star="${i}" aria-checked="${N.stars === i}" aria-label="${i} star${i > 1 ? "s" : ""}" class="${i <= N.stars ? "on" : ""}">★</button>`).join("")}</div>
      <label class="field">Notes<textarea id="tNotes" maxlength="600" rows="4" placeholder="Strategy, memories, why these six…">${esc(N.text)}</textarea></label>
      <div class="cov-h">Share code</div>
      ${code ? `<div class="code-row"><code id="shareCode">${esc(code)}</code><button class="btn sm" type="button" id="copyCode">Copy</button></div>
      <p class="note">Anyone with Dream Team Dex can load this team from the code, including shiny picks, Poké Balls and your trainer. Nicknames and notes stay with you.</p>` : `<p class="note">Add Pokémon to this team to get its share code.</p>`}
      <div class="cov-h">Pokémon Showdown</div>
      <div class="actions left">${code ? `<button class="btn sm" type="button" id="sdExp">Export to Showdown</button>` : ""}<button class="btn sm" type="button" id="sdImp">Import from Showdown</button></div>
      <div class="cov-h">Load a code</div>
      <form class="code-load" id="codeForm"><input class="search" id="codeIn" placeholder="DTD-…" autocomplete="off" spellcheck="false" aria-label="Share code"><button class="btn sm primary" type="submit">Load</button></form>
      <p class="acc-err" id="codeErr" role="alert" hidden></p>
    </div>`);
  const root = md.querySelector("#toRoot");
  root.addEventListener("click", async e => {
    if (e.target.closest("#toRules")) { openCustomEditor(id); return; }
    if (e.target.closest("#toCopy")) { copyTeam(id); return; }
    if (e.target.closest("#toNew")) { openCustomEditor(); return; }
    if (e.target.closest("#sdExp")) { sdOpenExport(id); return; }
    if (e.target.closest("#sdImp")) { sdOpenImport(); return; }
    const s = e.target.closest("[data-star]");
    if (s) { const v = +s.dataset.star === notesOf(id).stars ? 0 : +s.dataset.star; setNotes(id, {stars:v}); root.querySelectorAll("[data-star]").forEach(b => { b.classList.toggle("on", +b.dataset.star <= v); b.setAttribute("aria-checked", +b.dataset.star === v); }); return; }
    if (e.target.closest("#copyCode")) {
      try { await navigator.clipboard.writeText(code); toast("Share code copied."); }
      catch(err){ const r = document.createRange(); r.selectNodeContents(root.querySelector("#shareCode")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast("Code selected. Press Ctrl+C (or ⌘C) to copy it."); }
    }
  });
  let nt = 0; root.querySelector("#tNotes").addEventListener("input", e => { clearTimeout(nt); const v = e.target.value; nt = setTimeout(() => setNotes(id, {text:v}), 300); });
  root.querySelector("#codeForm").addEventListener("submit", e => {
    e.preventDefault();
    const c = parseCode(root.querySelector("#codeIn").value), err = root.querySelector("#codeErr");
    if (!c) { err.textContent = "That code doesn’t look right. Codes start with DTD- and come from the Team options of another team."; err.hidden = false; return; }
    closeModal(); applyCode(c);
  });
}
$("teamMore").addEventListener("click", openTeamOptions);

