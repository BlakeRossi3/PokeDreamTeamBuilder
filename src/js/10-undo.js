// ================= UNDO =================
const undoStack = [];
const redoStack = [];
const snapData = () => JSON.stringify({teams:state.teams, teamShiny:state.teamShiny, members:state.members, trainers:state.trainers, custom:state.custom, scenes:state.scenes, notes:state.notes, hidden:state.hidden, order:state.order});
function snap(label){
  redoStack.length = 0;
  undoStack.push({label, team:state.team, data:snapData()});
  if (undoStack.length > 40) undoStack.shift();
  renderUndo();
}
function undo(){ stepHistory(undoStack, redoStack, "Undid"); }
function redo(){ stepHistory(redoStack, undoStack, "Redid"); }
function stepHistory(from, to, verb){
  const s = from.pop(); if (!s) { toast(verb === "Undid" ? "Nothing to undo." : "Nothing to redo."); renderUndo(); return; }
  to.push({label:s.label, team:state.team, data:snapData()});
  const before = JSON.stringify(state.custom);
  Object.assign(state, JSON.parse(s.data)); rebuildTeams();
  const customChanged = before !== JSON.stringify(state.custom);
  const switched = s.team !== state.team && TEAM_BY.has(s.team);
  if (!TEAM_BY.has(state.team)) fixCurrent();
  if (switched) { state.hidden = state.hidden.filter(x => x !== s.team); state.team = s.team; }
  save();
  if (!$("app").hidden) { if (switched || customChanged) renderAll(); else { renderTabs(); renderTeam(); syncSelection(); if (state.f.free) renderGrid(); } }
  else if (!$("start").hidden) startStage.load();
  renderUndo(); toast(`${verb}: ${s.label}`);
}
function renderUndo(){
  const b = $("undoBtn"); if (!b) return;
  b.disabled = !undoStack.length;
  b.title = undoStack.length ? `Undo: ${undoStack[undoStack.length - 1].label} (Ctrl+Z · redo with Ctrl+Shift+Z)` : "Nothing to undo";
}
$("undoBtn").addEventListener("click", undo);
$("toast").addEventListener("click", e => { if (e.target.closest("[data-tundo]")) { $("toast").hidden = true; undo(); } });
document.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (!(e.ctrlKey || e.metaKey) || e.altKey || (k !== "z" && k !== "y")) return;
  if ($("app").hidden || !$("modalWrap").hidden || !$("hof").hidden || !$("view").hidden || e.target.closest("input, textarea, select")) return;
  e.preventDefault(); if (k === "y" || e.shiftKey) redo(); else undo();
});

