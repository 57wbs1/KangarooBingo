// Game rules and shared rendering helpers. No Firebase in here.

export const SQUARES = [
  "Arrives after the Head Table",
  "Eats with the wrong utensils",
  "Stands at the wrong time, then sits slowly",
  "Talks so loud the Head Table hears",
  "Takes a selfie during formal dinner",
  "Phone seen ON the table",
  "Spills a drink or soup",
  "Eats before the Head Table",
  "Elbows on the table, caught in 4K",
  "Fires shots before the colours leave",
  "Forgets the toast mouths along",
  "Drops cutlery, whole mess hears",
  "Leaves seat without permission",
  "Receives shots before the colours leave",
  "Laughs at the wrong moment",
  "Sits in a seat other than assigned",
  "Checks their watch during a speech",
  "Takes a photo of the food",
  "Sits before being told",
  "Starts drinking too early",
  "Puts used cutlery back on the tablecloth",
  "Passes the port the wrong way",
  "Doesn’t follow dress regulations",
  "Nods off during a speech"
];
export const FREE = 12;   // centre of the 5×5 grid
export const TOP = 5;     // places that score syndicate points

export const LINES = [];
for (let r = 0; r < 5; r++) LINES.push([0, 1, 2, 3, 4].map(c => r * 5 + c));
for (let c = 0; c < 5; c++) LINES.push([0, 1, 2, 3, 4].map(r => r * 5 + c));
LINES.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);

// A fresh random order of the 24 squares for one player's card.
export function shuffledLayout() {
  const a = [...Array(SQUARES.length).keys()];
  const r = new Uint32Array(a.length);
  crypto.getRandomValues(r);
  for (let i = a.length - 1; i > 0; i--) { const j = r[i] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// 25 grid positions -> square index, null for the free space.
export function gridOf(layout) {
  const out = []; let k = 0;
  for (let p = 0; p < 25; p++) out.push(p === FREE ? null : layout[k++]);
  return out;
}

export const accusedAt = (marks, sq) => ((marks && marks[sq]) || "").trim();

export function winningLines(layout, marks) {
  const g = gridOf(layout);
  const on = p => g[p] === null || !!accusedAt(marks, g[p]);
  return LINES.filter(l => l.every(on));
}

export function filledCount(marks) {
  return Object.values(marks || {}).filter(v => v && String(v).trim()).length;
}

// ---- time ----
export const pad = (n, w = 2) => String(n).padStart(w, "0");
export const toDate = ts => !ts ? null : ts.toDate ? ts.toDate() : ts instanceof Date ? ts : new Date(ts);
export function fmtTime(ts, ms = false) {
  const d = toDate(ts); if (!d) return "--:--:--";
  return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) + (ms ? "." + pad(d.getMilliseconds(), 3) : "");
}
const millis = p => (toDate(p.claimedAt) || new Date(8.64e15)).getTime();

// ---- leaderboard ----
// Every live claim (under review or approved) in server-time order. Only approved claims get a
// rank; one still under review keeps its place in the queue and can land ahead of later ones.
export function standings(players) {
  let rank = 0;
  return players
    .filter(p => p.claimedAt && (p.status === "claimed" || p.status === "approved"))
    .sort((a, b) => millis(a) - millis(b))
    .map(p => ({ ...p, rank: p.status === "approved" ? ++rank : null }));
}

export function synTally(rows) {
  const t = new Map();
  rows.filter(r => r.rank && r.rank <= TOP).forEach(r => {
    const k = (r.syn || "—").trim() || "—";
    t.set(k, (t.get(k) || 0) + 1);
  });
  return [...t.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], undefined, { numeric: true }));
}

// Accused names across every card, merged case- and space-insensitively.
export function mostWanted(players, n = 8) {
  const m = new Map();
  players.forEach(p => Object.values(p.marks || {}).forEach(v => {
    const name = String(v || "").trim().replace(/\s+/g, " ");
    if (!name) return;
    const k = name.toLowerCase();
    const e = m.get(k) || { name, count: 0 };
    e.count++; m.set(k, e);
  }));
  return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, n);
}

// ---- tiny DOM helper (text only, never innerHTML with user data) ----
export function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
}

// Read-only mini card (judge view): winning lines outlined.
export function miniCard(layout, marks) {
  const g = gridOf(layout);
  const win = new Set(winningLines(layout, marks).flat());
  const grid = el("div", { class: "mini" });
  g.forEach((sq, p) => {
    if (sq === null) { grid.append(el("div", { class: "mc free" }, "FREE")); return; }
    const who = accusedAt(marks, sq);
    grid.append(el("div", { class: "mc" + (who ? " on" : "") + (win.has(p) ? " win" : "") },
      el("div", { class: "q" }, SQUARES[sq]),
      el("div", { class: "a" }, who)));
  });
  return grid;
}

// Leaderboard markup shared by the player app and the projector board.
export function renderBoard(root, players, { meUid = null, big = false } = {}) {
  const rows = standings(players);
  const approved = rows.filter(r => r.rank);
  const pending = rows.filter(r => !r.rank).length;
  const filed = players.reduce((s, p) => s + (p.filled || 0), 0);
  root.textContent = "";

  root.append(el("div", { class: "stats" },
    el("span", null, el("b", null, players.length), " on the card"),
    el("span", null, el("b", null, filed), " charges filed"),
    el("span", null, el("b", null, approved.length), " approved"),
    pending ? el("span", { class: "hot" }, el("b", null, pending), " under review") : null));

  const lb = el("section", { class: "panel" }, el("div", { class: "label" }, "LEADERBOARD · BY SUBMIT TIME"));
  if (!rows.length) lb.append(el("div", { class: "empty" }, "No bingos yet. The court is watching."));
  else {
    const list = el("ol", { class: "lb" + (big ? " big" : "") });
    rows.forEach(r => {
      const top = r.rank && r.rank <= TOP;
      list.append(el("li", { class: "row" + (top ? " top" : "") + (r.rank ? "" : " pend") + (r.id === meUid ? " me" : "") },
        el("div", { class: "rk" }, r.rank ? pad(r.rank) : "?"),
        el("div", { class: "nm" }, el("div", { class: "n" }, r.name || "—"), el("div", { class: "s" }, "SYN " + (r.syn || "—"))),
        el("div", { class: "tm" }, fmtTime(r.claimedAt), el("small", null, r.rank ? (top ? "TOP " + TOP : "APPROVED") : "VETTING"))));
    });
    lb.append(list);
    if (pending) lb.append(el("div", { class: "fine" }, "A claim under review keeps its submit time and can still move ahead of later ones."));
  }
  root.append(lb);

  const tally = synTally(rows);
  const st = el("section", { class: "panel" }, el("div", { class: "label" }, "TOP " + TOP + " BY SYNDICATE"));
  if (!tally.length) st.append(el("div", { class: "empty" }, "No approved bingos yet."));
  else st.append(el("div", { class: "tally" }, tally.map(([s, n]) =>
    el("div", { class: "t" }, el("b", null, "SYN " + s), el("span", null, n + (n === 1 ? " place" : " places"))))));
  root.append(st);

  const mw = mostWanted(players, big ? 8 : 6);
  const wp = el("section", { class: "panel" }, el("div", { class: "label" }, "MOST WANTED · MOST ACCUSED"));
  if (!mw.length) wp.append(el("div", { class: "empty" }, "Nobody charged yet."));
  else {
    const max = mw[0].count;
    wp.append(el("ol", { class: "mw" }, mw.map(m => el("li", null,
      el("span", { class: "who" }, m.name),
      el("span", { class: "bar" }, el("i", { style: "width:" + Math.round(100 * m.count / max) + "%" })),
      el("b", null, m.count)))));
  }
  root.append(wp);
}
