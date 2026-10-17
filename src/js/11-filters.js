// ================= FILTERS =================
function cleanF(f){
  const d = F0(); if (!f || typeof f !== "object") return d;
  return {fav:!!f.fav, free:!!f.free, fe:!!f.fe, leg:["all","only","hide"].includes(f.leg) ? f.leg : "all", bst:BST_R[f.bst] ? f.bst : "any", forms:["show","hide","only"].includes(f.forms) ? f.forms : "show", gens:Array.isArray(f.gens) ? f.gens.filter(g => Number.isInteger(g) && g >= 1 && g <= 9) : []};
}
function activeFilters(){
  const F = state.f, T = G(), hasForms = T.mons.some(m => isForm(m.num));
  return (F.fav ? 1 : 0) + (F.free ? 1 : 0) + (F.fe ? 1 : 0) + (F.leg !== "all" ? 1 : 0) + (F.bst !== "any" ? 1 : 0) + (T.kind !== "gen" && F.gens.length ? 1 : 0) + (hasForms && F.forms !== "show" ? 1 : 0);
}
function passFilters(m, ctx){
  const F = state.f, n = m.num, b = bst(m), r = BST_R[F.bst];
  return (!F.fav || isFav(n)) && (!ctx.taken || !ctx.taken.has(n)) && (F.leg === "all" || (F.leg === "only") === isLegend(n)) && (!F.fe || isFE(n))
    && (!ctx.gens || ctx.gens.has(genOf(baseOf(n)))) && b >= r[0] && b <= r[1] && (!ctx.forms || F.forms === "show" || (F.forms === "only") === isForm(n));
}
function filterCtx(){
  const F = state.f, T = G();
  return {taken: F.free ? new Set(TEAMS.flatMap(t => teamOf(t.id))) : null, gens: T.kind !== "gen" && F.gens.length ? new Set(F.gens) : null, forms: T.mons.some(m => isForm(m.num))};
}
function renderFilters(){
  const F = state.f, T = G(), n = activeFilters(), b = $("filterBtn");
  b.setAttribute("aria-expanded", !!state.fOpen); b.classList.toggle("on", n > 0);
  $("fBadge").textContent = n; $("fBadge").hidden = !n;
  const P = $("fpanel"); P.hidden = !state.fOpen; if (!state.fOpen) return;
  const tg = (k, label) => `<button type="button" class="fchip" data-ft="${k}" aria-pressed="${!!F[k]}">${label}</button>`;
  const seg = (k, opts) => `<div class="segrow" data-fk="${k}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${F[k] === v}">${l}</button>`).join("")}</div>`;
  P.innerHTML = `<div class="frow"><span class="fl">Show only</span><div class="ftg">${tg("fav", "♥ Favorites")}${tg("free", "Not on any team")}${tg("fe", "Fully evolved")}</div></div>
    <div class="frow"><span class="fl">Legendary</span>${seg("leg", [["all","Include"],["only","Only"],["hide","Hide"]])}</div>
    <div class="frow"><span class="fl">Base stats</span>${seg("bst", [["any","Any"],["lo","Under 400"],["mid","400s"],["hi","500s"],["top","600+"]])}</div>
    ${T.mons.some(m => isForm(m.num)) ? `<div class="frow"><span class="fl">Megas &amp; forms</span>${seg("forms", [["show","Include"],["only","Only"],["hide","Hide"]])}</div>` : ""}
    ${T.kind !== "gen" ? `<div class="frow"><span class="fl">Generation</span><div class="segrow gens">${GENS.map(g => `<button type="button" data-fg="${g.g}" aria-pressed="${F.gens.includes(g.g)}" title="${g.region}">${ROMAN[g.g]}</button>`).join("")}</div></div>` : ""}
    <div class="frow end"><span class="meta" id="fCount"></span><button class="btn sm" type="button" id="fReset" ${n ? "" : "disabled"}>Reset filters</button></div>`;
}
$("filterBtn").addEventListener("click", () => { state.fOpen = !state.fOpen; renderFilters(); if (state.fOpen) renderGrid(); });
$("fpanel").addEventListener("click", e => {
  const F = state.f; let b;
  if ((b = e.target.closest("[data-ft]"))) F[b.dataset.ft] = !F[b.dataset.ft];
  else if ((b = e.target.closest("[data-fk] [data-v]"))) F[b.parentElement.dataset.fk] = b.dataset.v;
  else if ((b = e.target.closest("[data-fg]"))) { const g = +b.dataset.fg; F.gens = F.gens.includes(g) ? F.gens.filter(x => x !== g) : [...F.gens, g].sort((x, y) => x - y); }
  else if (e.target.closest("#fReset")) state.f = F0();
  else return;
  saveUI(); renderFilters(); renderGrid();
});

