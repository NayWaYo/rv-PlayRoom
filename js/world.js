// The shape of the place you walk around in, shared by you, your friends' avatars and
// the bots: solid boxes you bump into, stand on or crawl under, round obstacles, and
// the outer bounds. Floors are at y = 0 unless a box says otherwise.
export const STEP = 0.25;      // what you climb without jumping
export const BODY_R = 0.2;     // how wide a person is, for walls
export const TALL = 1.8, LOW = 1.2; // standing and crouching heights

const world = { x0: -5.6, x1: 5.6, z0: -5.6, z1: 5.6, boxes: [], discs: [] };
// boxes: { x0, x1, z0, z1, y0, y1 }; discs: { x, z, r } from the floor up
export function setWorld(w) {
  Object.assign(world, { boxes: [], discs: [] }, w);
  nav = null;
}
export const bounds = () => world;

const over = (B, x, z, r) => x > B.x0 - r && x < B.x1 + r && z > B.z0 - r && z < B.z1 + r;
// the highest surface under (x, z) that feet at height y can stand on
export function groundAt(x, z, y) {
  let g = 0;
  for (const B of world.boxes) if (B.y1 <= y + STEP && B.y1 > g && over(B, x, z, BODY_R * 0.75)) g = B.y1;
  return g;
}
// the lowest thing above feet at height y: where your head stops
export function ceilingAt(x, z, y) {
  let c = Infinity;
  for (const B of world.boxes) if (B.y0 > y + STEP && B.y0 < c && over(B, x, z, BODY_R * 0.75)) c = B.y0;
  return c;
}
// is a body with feet at y and this height stuck in something at (x, z)?
export function blocked(x, z, y, height) {
  if (x < world.x0 || x > world.x1 || z < world.z0 || z > world.z1) return true;
  for (const D of world.discs) if (Math.hypot(x - D.x, z - D.z) < D.r) return true;
  for (const B of world.boxes) if (B.y1 > y + STEP && B.y0 < y + height && over(B, x, z, BODY_R)) return true;
  return false;
}
// slide a body ({ x, z, y, height }) from where it was (ox, oz) to where it wants to be
export function slide(b, ox, oz) {
  b.x = Math.max(world.x0, Math.min(world.x1, b.x)); b.z = Math.max(world.z0, Math.min(world.z1, b.z));
  for (const D of world.discs) {
    const dx = b.x - D.x, dz = b.z - D.z, d = Math.hypot(dx, dz);
    if (d < D.r) { b.x = D.x + dx / (d || 1) * D.r; b.z = D.z + dz / (d || 1) * D.r; }
  }
  if (!blocked(b.x, b.z, b.y, b.height)) return;
  if (!blocked(b.x, oz, b.y, b.height)) b.z = oz;
  else if (!blocked(ox, b.z, b.y, b.height)) b.x = ox;
  else { b.x = ox; b.z = oz; }
}
// gravity, landing, and bumping your head; returns the landing speed (0 if none)
export function fall(b, dt) {
  const ground = groundAt(b.x, b.z, b.y);
  if (b.vy === 0 && b.y <= ground) { b.y = ground; return 0; } // walking, or stepping up something low
  b.vy -= 9.8 * dt; b.y += b.vy * dt;
  const roof = ceilingAt(b.x, b.z, b.y - b.vy * dt);
  if (b.vy > 0 && b.y + b.height > roof) { b.y = roof - b.height; b.vy = 0; }
  if (b.y <= ground && b.vy <= 0) { const v = -b.vy; b.y = ground; b.vy = 0; return v || 0.01; }
  return 0;
}

/* ---------- where bots can walk: a grid of standing spots, built once per world ---------- */
const CELL = 0.5;
let nav = null;
// boxes that move (a lift, marked `moving`) are left out: the grid is built once, wherever they are
function buildNav() {
  const all = world.boxes;
  world.boxes = all.filter(B => !B.moving);
  try { return buildGrid(); } finally { world.boxes = all; }
}
function buildGrid() {
  const W = world, nx = Math.floor((W.x1 - W.x0) / CELL) + 1, nz = Math.floor((W.z1 - W.z0) / CELL) + 1;
  const nodes = [], at = new Map();
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    const x = W.x0 + i * CELL, z = W.z0 + k * CELL;
    const heights = new Set([0]);
    for (const B of W.boxes) if (over(B, x, z, BODY_R * 0.75)) heights.add(B.y1); // as wide as groundAt looks
    for (const y of heights) {
      if (y > 0 && groundAt(x, z, y) !== y) continue;
      if (W.fall != null && y < W.fall) continue;                        // the bottom of a void: nowhere to stand
      if (blocked(x, z, y, LOW)) continue;
      const crouch = blocked(x, z, y, TALL);
      const n = { id: nodes.length, i, k, x, z, y, crouch, next: [] };
      nodes.push(n);
      const key = i + ',' + k; if (!at.has(key)) at.set(key, []); at.get(key).push(n);
    }
  }
  for (const n of nodes) for (const [di, dk] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    for (const m of at.get((n.i + di) + ',' + (n.k + dk)) || []) {
      // spots half a metre apart on stairs can be two steps apart: fine if the middle is a step in between
      const lo = Math.min(n.y, m.y), my = Math.max(n.y, m.y);
      if (my - lo > 2 * STEP) continue;
      const mx = (n.x + m.x) / 2, mz = (n.z + m.z) / 2, mid = groundAt(mx, mz, lo);
      if (my - mid > STEP || blocked(mx, mz, mid, LOW)) continue;
      if (di && dk && (blocked(m.x, n.z, my, LOW) || blocked(n.x, m.z, my, LOW))) continue; // no corner cutting
      const cost = Math.hypot(m.x - n.x, m.z - n.z) * (n.crouch || m.crouch ? 1.6 : 1);
      n.next.push([m, cost]); m.next.push([n, cost]);
    }
  }
  // keep the biggest connected area: bots never head for a crate top they can't climb
  let main = [];
  const seen = new Set();
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    const part = [n]; seen.add(n.id);
    for (let i = 0; i < part.length; i++) for (const [m] of part[i].next) if (!seen.has(m.id)) { seen.add(m.id); part.push(m); }
    if (part.length > main.length) main = part;
  }
  for (const n of main) n.main = true;
  return { nodes, at, main };
}
// the standing spot nearest to (x, y, z)
export function nearestSpot(x, y, z) {
  if (!nav) nav = buildNav();
  const W = world, i0 = Math.round((x - W.x0) / CELL), k0 = Math.round((z - W.z0) / CELL);
  let best = null, bd = Infinity;
  for (let r = 0; r < 4 && !best; r++) for (let i = i0 - r; i <= i0 + r; i++) for (let k = k0 - r; k <= k0 + r; k++) {
    for (const n of nav.at.get(i + ',' + k) || []) {
      const d = Math.hypot(n.x - x, n.z - z) + Math.abs(n.y - y) * 2 + (n.main ? 0 : 3);
      if (d < bd) { bd = d; best = n; }
    }
  }
  return best;
}
export function randomSpot() { return spotAt(Math.random()); }
// a standing spot picked by a number from 0 to 1: the same for everyone (the grid is)
export function spotAt(u) {
  if (!nav) nav = buildNav();
  return nav.main[Math.min(nav.main.length - 1, Math.floor(u * nav.main.length))];
}
// a tiny binary heap of [priority, node]
function push(h, e) {
  h.push(e); let i = h.length - 1;
  while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; }
}
function pop(h) {
  const top = h[0], last = h.pop();
  if (h.length) {
    h[0] = last; let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1; let s = i;
      if (l < h.length && h[l][0] < h[s][0]) s = l;
      if (r < h.length && h[r][0] < h[s][0]) s = r;
      if (s === i) break; [h[s], h[i]] = [h[i], h[s]]; i = s;
    }
  }
  return top;
}
// shortest walk from one spot to another, as a list of spots (A*)
export function findPath(a, b, limit = 6000) {
  if (!a || !b || a.main !== b.main) return null;
  const g = new Map([[a.id, 0]]), from = new Map(), open = [[Math.hypot(a.x - b.x, a.z - b.z), a]];
  const done = new Set();
  while (open.length && done.size < limit) {
    const [, n] = pop(open);
    if (n === b) {
      const path = [n]; let c = n;
      while (from.has(c.id)) { c = from.get(c.id); path.unshift(c); }
      return path;
    }
    if (done.has(n.id)) continue;
    done.add(n.id);
    for (const [m, cost] of n.next) {
      const ng = g.get(n.id) + cost;
      if (ng < (g.get(m.id) ?? Infinity)) { g.set(m.id, ng); from.set(m.id, n); push(open, [ng + Math.hypot(m.x - b.x, m.z - b.z) + Math.abs(m.y - b.y), m]); }
    }
  }
  return null;
}
