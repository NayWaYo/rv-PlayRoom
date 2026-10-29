// The eighth battle map, "le Manoir": a big house at night in the style of the card room (teal
// wallpaper, dark wainscot, plank floors, warm lamps), made for the traitor mode but good for the
// others too. Ground floor: a hall with the grand staircase, the lounge and the dining room in the
// west wing, the library and the kitchen (with the back stairs) in the east wing. First floor: a
// gallery round the hall, a bedroom and a bathroom in the west, a kids' room and a billiard room in
// the east, a balcony over the front door. Under the roof, an attic full of junk, reached by a steep
// stair from the bathroom. Round the house, a garden: a fountain at the front, a gazebo at the back,
// the garden shed in the west (the Rouges' flag) and the greenhouse in the east (the Bleus').
import * as THREE from 'three';
import { toon, noOutline, makeGlow } from './fx.js';
import { makeKit } from './fpsmap.js';

const SLAB = 3.4;   // the ground floor's ceiling
const F1 = 3.6;     // the first floor
const TOP = 6.8;    // the first floor's ceiling
const ATT = 7.0;    // the attic floor
const RIDGE = 11;   // the top of the roof
const EAVE = 7.6;   // how far the roof reaches out on each side (z)
export const BOUNDS = { x0: -23.6, x1: 23.6, z0: -17.6, z1: 17.6 };

export function buildMap(scene) {
  const { boxes, solid, wallX, wallZ, crate, stairsZ, floor } = makeKit(scene);

  // colours: the card room's, and a wallpaper for each room
  const PLASTER = '#e6d3b3', TIMBER = '#5a3a26', ROOF = '#9c4436', WAIN = '#5e3d29', TRIM = '#e0c08f', CEIL = '#3a2c3f';
  const WOOD = '#7a4a2b', WOOD2 = '#93603a', DARK = '#4e2d19', CRATE = '#b07a45', STONE = '#b8ad9a', WHITE = '#f2ece0';
  const SOFA = '#8f73e3', SOFA2 = '#7559c9', CUSH = '#f0b84f', FELT = '#7e2d3c', CARPET = '#86323f';
  const HEDGE = '#3f7a3c', LEAF = '#4e8a4a', SHED = '#8a5a2f', GLASS = '#bfe6fa';
  const P = {
    lounge: '#2f6066', dining: '#5d4a7a', hall: '#7a3440', library: '#3f5f3a', kitchen: '#c9b98f',
    bedroom: '#5e3a5a', bath: '#4f8585', kids: '#35557a', billiard: '#2f4f3a'
  };
  const BOOKS = ['#ea6a4f', '#4fb3a9', '#f4b63f', '#8f73e3', '#5b9bd5', '#8fbf5a', '#f08a3c', '#e88fb4'];

  // openings: a door, a window (from the floor at y)
  const D = (a, b, y = 0) => [a, b, y, y + 2.4], W = (a, b, y = 0) => [a, b, y + 1, y + 2];
  // the openings that fall between y0 and y1, cut to fit
  const clip = (holes, y0, y1) => holes.filter(h => h[2] < y1 && h[3] > y0).map(h => [h[0], h[1], Math.max(h[2], y0), Math.min(h[3], y1)]);
  // a wall over two floors is built a floor at a time: the kit cuts one opening per stretch, and a
  // door upstairs often sits over a door downstairs
  function floors(y0, y1, fn) {
    const at = [y0, ...[SLAB, TOP].filter(y => y > y0 && y < y1), y1];
    for (let i = 0; i < at.length - 1; i++) fn(at[i], at[i + 1]);
  }
  // a solid wall along x (at z) or along z (at x)
  function wall(ax, at, a, b, y0, y1, col, holes = [], t = 0.3) {
    floors(y0, y1, (c0, c1) => (ax === 'x' ? wallX : wallZ)(at, a, b, c0, c1, col, clip(holes, c0, c1), t));
  }
  function cut(s0, s1, y0, y1, holes, put) {
    let s = s0;
    // only the openings in this stretch (a room's wallpaper covers part of a wall)
    const here = holes.filter(h => h[1] > s0 && h[0] < s1).map(h => [Math.max(h[0], s0), Math.min(h[1], s1), h[2], h[3]]);
    for (const [h0, h1, hb, ht] of here.sort((p, q) => p[0] - q[0])) {
      if (h0 > s) put(s, h0, y0, y1);
      if (hb > y0) put(h0, h1, y0, hb);
      if (ht < y1) put(h0, h1, ht, y1);
      s = h1;
    }
    if (s < s1) put(s, s1, y0, y1);
  }
  // drawn only: wallpaper over a wall's face (at `at`), dark wainscot below with a light trim on top
  function dress(ax, at, a, b, y0, y1, col, holes = []) {
    const layer = (lo, hi, colour, t) => floors(lo, hi, (c0, c1) => cut(a, b, c0, c1, clip(holes, c0, c1), (s0, s1, d0, d1) =>
      ax === 'x' ? solid(s0, s1, at - t, at + t, d0, d1, colour, { ghost: true, noShadow: true, flat: true })
        : solid(at - t, at + t, s0, s1, d0, d1, colour, { ghost: true, noShadow: true, flat: true })));
    layer(y0 + 0.96, y1, col, 0.01);
    layer(y0, y0 + 0.9, WAIN, 0.02);
    layer(y0 + 0.9, y0 + 0.96, TRIM, 0.025);
  }
  // a plank floor, drawn only
  function planks(x0, x1, z0, z1, y, tones) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    for (let i = 0; i < 4; i++) {
      c.fillStyle = tones[i % tones.length]; c.fillRect(0, i * 64, 256, 64);
      c.fillStyle = 'rgba(40,20,10,.35)'; c.fillRect(0, i * 64, 256, 4); c.fillRect((i * 97) % 256, i * 64, 4, 64);
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set((x1 - x0) / 2.5, (z1 - z0) / 2.5);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), noOutline(toon('#ffffff', { map: t })));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
  }
  const OAK = ['#9a6743', '#a6714a', '#93613e', '#ad7a50'], PINE = ['#b98552', '#c49060', '#ae7b4a', '#c99a66'];
  const TILE = ['#d9cdb4', '#cfc2a6'], BLUE = ['#7f9fc0', '#7393b6'];
  // something round on the floor or on a wall, drawn only
  function disc(x, y, z, r, col, seg = 40) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, seg), noOutline(toon(col)));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m;
  }
  function mesh(geo, col, x, y, z, o = {}) {
    const m = new THREE.Mesh(geo, toon(col, o)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
  }
  // a box people bump into, with nothing drawn (the drawing is something rounder)
  const hidden = (x0, x1, z0, z1, y0, y1) => boxes.push({ x0, x1, z0, z1, y0, y1 });
  // stairs climbing along x from the floor at `base` (the kit's start at the ground)
  function stairsUpX(z0, z1, from, dir, base, h, col, n = 15, run = 0.33) {
    for (let k = 1; k <= n; k++) { const a = from + dir * (k - 1) * run, b = a + dir * run; solid(Math.min(a, b), Math.max(a, b), z0, z1, base, base + k * h / n, col); }
  }
  // a shelf full of books
  function bookcase(x0, x1, z0, z1, y, h, face) {
    solid(x0, x1, z0, z1, y, y + h, DARK);
    const along = x1 - x0 > z1 - z0;
    for (let r = 0; r < 3; r++) {
      const sy = y + 0.25 + r * (h - 0.3) / 3;
      for (let s = (along ? x0 : z0) + 0.08, i = r; s < (along ? x1 : z1) - 0.2; s += 0.2, i++) {
        const bh = (h - 0.3) / 3 - 0.1 - (i * 7 % 3) * 0.05;
        if (along) solid(s, s + 0.16, face - 0.03, face + 0.03, sy, sy + bh, BOOKS[i % 8], { ghost: true, noShadow: true, flat: true });
        else solid(face - 0.03, face + 0.03, s, s + 0.16, sy, sy + bh, BOOKS[i % 8], { ghost: true, noShadow: true, flat: true });
      }
    }
  }
  // a chair seen from above: a seat to bump into, a back (drawn only)
  function chair(x, z, col, back) {
    crate(x, z, 0.44, 0.46, base(), col);
    const [bx, bz] = back;
    solid(x + bx * 0.2 - (bz ? 0.22 : 0.04), x + bx * 0.2 + (bz ? 0.22 : 0.04), z + bz * 0.2 - (bx ? 0.22 : 0.04), z + bz * 0.2 + (bx ? 0.22 : 0.04), base() + 0.46, base() + 1.0, col, { ghost: true });
  }
  let floorY = 0; const base = () => floorY;
  // a tree: a trunk to bump into, a round top (drawn only)
  function tree(x, z, s = 1) {
    solid(x - 0.25, x + 0.25, z - 0.25, z + 0.25, 0, 2, TIMBER);
    for (const [dx, dy, dz, r] of [[0, 3, 0, 1.6], [0.7, 2.5, 0.4, 1.1], [-0.6, 2.6, -0.5, 1.1]]) {
      const m = mesh(new THREE.IcosahedronGeometry(r * s, 0), LEAF, x + dx * s, dy * s, z + dz * s);
      m.rotation.set(dx, dz, 0);
    }
  }

  /* ===================== the ground ===================== */
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(90, 80), noOutline(toon('#4a7f45')));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -0.01; grass.receiveShadow = true; scene.add(grass);
  // gravel paths: the drive to the front door, round to the back, out to the shed and the greenhouse
  const gravel = (x0, x1, z0, z1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), noOutline(toon('#cbbd9f')));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.002, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
  };
  gravel(-1.6, 1.6, 7, 17.6); gravel(-1.2, 1.2, -17.6, -7); gravel(-16.5, -12, -0.8, 0.8); gravel(12, 16.5, -0.8, 0.8);
  gravel(-13.5, -12, -12, 12); gravel(12, 13.5, -12, 12); gravel(-13.5, 13.5, 8.6, 9.4); gravel(-13.5, 13.5, -9.4, -8.6);
  // the house's floors: marble in the hall, planks and tiles elsewhere
  floor(6, 14, '#e8e0d0', '#3a3340');
  planks(-12, -3, 0, 7, 0.004, OAK); planks(-12, -3, -7, 0, 0.004, PINE); planks(3, 12, 0, 7, 0.004, OAK);
  planks(3, 12, -7, 0, 0.004, TILE);
  planks(-12, -3, 0, 7, F1 + 0.004, PINE); planks(-12, -3, -7, 0, F1 + 0.004, BLUE); planks(3, 12, 0, 7, F1 + 0.004, OAK);
  planks(3, 6.65, -7, -5.5, F1 + 0.004, PINE); planks(3, 12, -5.5, 0, F1 + 0.004, PINE);
  for (const [x0, x1, z0, z1] of [[-3, 3, -7, -3.95], [-3, -1.8, -3.95, 5.8], [1.8, 3, -3.95, 5.8], [-3, 3, 5.8, 7], [-3, 3, 7.15, 9.6]]) planks(x0, x1, z0, z1, F1 + 0.004, OAK);
  planks(-11.85, 11.85, -2.05, 3.5, ATT + 0.004, PINE); planks(-11.85, 11.85, -3.5, -3.35, ATT + 0.004, PINE); planks(-6.65, 11.85, -3.35, -2.05, ATT + 0.004, PINE);

  /* ===================== the walls ===================== */
  // outside: plaster with a timber beam at each floor; inside: wallpaper and wainscot, room by room
  const front = [[-1.5, 1.5, 0, 2.6], D(-8, -6.8), D(6.8, 8), W(-11, -9.5), W(-5, -3.8), W(3.8, 5), W(9.5, 11),
    D(-1, 1, F1), W(-11, -9.5, F1), W(-6.5, -5, F1), W(-2.6, -1.6, F1), W(1.6, 2.6, F1), W(5, 6.5, F1), W(9.5, 11, F1)];
  const back = [D(-1, 1), D(-6, -4.8), D(3.6, 4.8), W(-11, -9.5), W(-2.6, -1.6), W(1.6, 2.6),
    W(-11, -9.5, F1), W(-6, -4.5, F1), W(-1, 1, F1), W(4.2, 5.6, F1), W(9, 10.5, F1)];
  const west = [D(-1.4, -0.2), W(-4.4, -3), W(5, 6.5), W(-5.5, -4, F1), W(5, 6.5, F1)];
  const east = [D(-1.4, -0.2), W(-4.8, -3.4), W(4, 5.5), W(-4, -2.5, F1), W(3, 4.5, F1)];
  wall('x', 7, -12.15, 12.15, 0, ATT, PLASTER, front); wall('x', -7, -12.15, 12.15, 0, ATT, PLASTER, back);
  wall('z', -12, -7, 7, 0, ATT, PLASTER, west); wall('z', 12, -7, 7, 0, ATT, PLASTER, east);
  // the beams between the floors, and the corners, outside
  for (const s of [-1, 1]) {
    solid(-12.2, 12.2, s * 7.15 - 0.03, s * 7.15 + 0.03, SLAB - 0.05, F1 + 0.1, TIMBER, { ghost: true, noShadow: true, flat: true });
    solid(s * 12.15 - 0.03, s * 12.15 + 0.03, -7.2, 7.2, SLAB - 0.05, F1 + 0.1, TIMBER, { ghost: true, noShadow: true, flat: true });
    for (const z of [-7.15, 7.15]) solid(s * 12.15 - 0.12, s * 12.15 + 0.12, z - 0.12, z + 0.12, 0, ATT, TIMBER, { ghost: true, noShadow: true });
  }
  // inside the walls
  const hallSide = [D(3, 4.4), D(-3.4, -2), D(3, 4.4, F1), D(-5.4, -4.2, F1)];
  wall('z', -3, -7, 7, 0, TOP, P.hall, hallSide); wall('z', 3, -7, 7, 0, TOP, P.hall, hallSide);
  wall('x', 0, -12, -3, 0, TOP, P.lounge, [D(-8, -6.8), D(-8, -6.8, F1)], 0.2);
  wall('x', 0, 3, 12, 0, TOP, P.library, [D(6.8, 8), [10.2, 11.2, 0, 1.3], D(6.8, 8, F1)], 0.2);
  // the rooms' wallpaper: [room, floor, x0, x1, z0, z1]
  const rooms = [
    [P.lounge, 0, -12, -3, 0, 7], [P.dining, 0, -12, -3, -7, 0], [P.library, 0, 3, 12, 0, 7], [P.kitchen, 0, 3, 12, -7, 0],
    [P.bedroom, F1, -12, -3, 0, 7], [P.bath, F1, -12, -3, -7, 0], [P.kids, F1, 3, 12, 0, 7], [P.billiard, F1, 3, 12, -7, 0]
  ];
  for (const [col, y, x0, x1, z0, z1] of rooms) {
    const h = y ? TOP : SLAB, inX0 = x0 === -12 ? -11.84 : x0 === 3 ? 3.16 : x0 + 0.11, inX1 = x1 === 12 ? 11.84 : x1 === -3 ? -3.16 : x1 - 0.11;
    const inZ0 = z0 === -7 ? -6.84 : 0.11, inZ1 = z1 === 7 ? 6.84 : -0.11;
    const zWall = z => z === 7 ? front : z === -7 ? back : x0 < 0 ? [D(-8, -6.8), D(-8, -6.8, F1)] : [D(6.8, 8), [10.2, 11.2, 0, 1.3], D(6.8, 8, F1)];
    dress('x', inZ1, inX0, inX1, y, h, col, zWall(z1)); dress('x', inZ0, inX0, inX1, y, h, col, zWall(z0));
    dress('z', inX0, inZ0, inZ1, y, h, col, x0 === -12 ? west : hallSide);
    dress('z', inX1, inZ0, inZ1, y, h, col, x1 === 12 ? east : hallSide);
  }
  // the hall: one wallpaper up two floors
  dress('z', -2.84, -6.84, 6.84, 0, TOP, P.hall, hallSide); dress('z', 2.84, -6.84, 6.84, 0, TOP, P.hall, hallSide);
  dress('x', 6.84, -2.84, 2.84, 0, TOP, P.hall, front); dress('x', -6.84, -2.84, 2.84, 0, TOP, P.hall, back);

  /* ===================== floors and stairs ===================== */
  // the first floor over each wing (with the back stairs' hole in the east), the gallery round the hall
  for (const [x0, x1, z0, z1] of [[-12, -3, -7, 7], [3, 12, -5.5, 7], [3, 6.65, -7, -5.5],
    [-3, 3, -7, -3.95], [-3, -1.8, -3.95, 5.8], [1.8, 3, -3.95, 5.8], [-3, 3, 5.8, 7]]) solid(x0, x1, z0, z1, SLAB, F1, CEIL);
  // the attic floor, with the hole for its stair
  for (const [x0, x1, z0, z1] of [[-12, 12, -2.05, 7], [-12, 12, -7, -3.35], [-6.65, 12, -3.35, -2.05]]) solid(x0, x1, z0, z1, TOP, ATT, CEIL);
  // the grand staircase in the hall, up to the back of the gallery
  stairsZ(-1.2, 1.2, 1, -1, F1, CARPET, 15, 0.33);
  for (const x of [-1.25, 1.25]) for (let k = 0; k < 15; k++) solid(x - 0.05, x + 0.05, 1 - (k + 1) * 0.33, 1 - k * 0.33, (k + 1) * F1 / 15, (k + 1) * F1 / 15 + 0.9, TRIM, { ghost: true, noShadow: true });
  // the gallery's railings
  for (const [x0, x1, z0, z1] of [[-1.8, -1.2, -4, -3.9], [1.2, 1.8, -4, -3.9], [-1.85, -1.75, -3.95, 5.8], [1.75, 1.85, -3.95, 5.8], [-1.8, 1.8, 5.75, 5.85]]) solid(x0, x1, z0, z1, F1, F1 + 1, TRIM);
  // the back stairs, in the kitchen against the back wall, up to the billiard room
  stairsUpX(-6.85, -5.65, 11.6, -1, 0, F1, WOOD2);
  solid(6.65, 11.85, -5.55, -5.45, F1, F1 + 1, TRIM);
  // the attic's stair, steep, in the bathroom
  stairsUpX(-3.3, -2.1, -11.6, 1, F1, ATT - F1, WOOD2);
  for (const z of [-3.4, -2.0]) solid(-11.85, -6.9, z - 0.05, z + 0.05, ATT, ATT + 1, TRIM);

  /* ===================== the roof and the attic ===================== */
  const slope = Math.atan2(RIDGE - ATT, EAVE), len = Math.hypot(EAVE, RIDGE - ATT);
  for (const s of [-1, 1]) {
    for (const [col, off, th] of [[ROOF, 0.14, 0.25], [WOOD, -0.06, 0.1]]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(25.4, th, len + 0.6), toon(col));
      r.rotation.x = s * slope; r.position.set(0, (ATT + RIDGE) / 2 + off * Math.cos(slope), s * (EAVE / 2 + off * Math.sin(slope)));
      r.castShadow = true; r.receiveShadow = true; scene.add(r);
    }
  }
  // the gable ends, with a round window each (a square hole behind it)
  const gable = new THREE.Shape([new THREE.Vector2(-EAVE, 0), new THREE.Vector2(EAVE, 0), new THREE.Vector2(0, RIDGE - ATT)]);
  gable.holes.push(new THREE.Path().absarc(0, 1.3, 0.6, 0, Math.PI * 2, true));
  for (const s of [-1, 1]) {
    const g = new THREE.Mesh(new THREE.ShapeGeometry(gable), toon(PLASTER, { side: THREE.DoubleSide }));
    g.rotation.y = Math.PI / 2; g.position.set(s * 12.16, ATT, 0); scene.add(g);
    wall('z', s * 12, -3.5, 3.5, ATT, ATT + 2.6, PLASTER, [[-0.6, 0.6, ATT + 0.7, ATT + 1.9]]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.08, 8, 24), toon(TIMBER)); ring.rotation.y = Math.PI / 2; ring.position.set(s * 12.2, ATT + 1.3, 0); scene.add(ring);
  }
  // the low walls where the roof comes down, inside: nobody walks into the slope
  for (const s of [-1, 1]) wall('x', s * 3.5, -11.85, 11.85, ATT, ATT + 2.1, WOOD, [], 0.15);
  // a chimney through the roof, over the lounge's fireplace
  solid(-11.6, -10.6, 4.2, 5.2, ATT, RIDGE - 1, '#8a5040', { ghost: true });
  solid(-11.75, -10.45, 4.05, 5.35, RIDGE - 1, RIDGE - 0.8, STONE, { ghost: true });

  /* ===================== the porch and its balcony ===================== */
  solid(-3, 3, 7.15, 9.6, SLAB, F1, STONE);
  for (const x of [-2.65, 2.65]) crate(x, 9.25, 0.4, SLAB, 0, PLASTER);
  for (const [x0, x1, z0, z1] of [[-3, -2.9, 7.15, 9.6], [2.9, 3, 7.15, 9.6], [-3, 3, 9.5, 9.6]]) solid(x0, x1, z0, z1, F1, F1 + 1, WHITE);
  disc(0, 0.006, 8.4, 1.2, '#86323f').scale.set(1.5, 1, 1);

  /* ===================== the hall ===================== */
  floorY = 0;
  for (const x of [-2.3, 2.3]) { crate(x, 5.5, 0.7, 0.9, 0, STONE); mesh(new THREE.SphereGeometry(0.3, 12, 10), WHITE, x, 1.25, 5.5); }
  solid(-2.85, -2.45, 0.3, 0.9, 0, 2.2, DARK);                          // the grandfather clock
  disc(-2.44, 1.7, 0.6, 0.18, WHITE).rotation.set(0, Math.PI / 2, 0);
  solid(2.45, 2.85, -0.2, 1.4, 0, 0.8, WOOD);                           // a console table
  mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.3, 12), '#4fb3a9', 2.65, 0.95, 0.6);
  solid(-2.85, -2.35, -6.6, -4.6, 0, 0.45, WOOD2); solid(2.35, 2.85, -6.6, -4.6, 0, 0.45, WOOD2); // benches by the back door
  // the chandelier
  const chand = new THREE.Group(); chand.position.set(0, 5.6, 1.5); scene.add(chand);
  chand.add(new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 6, 24), toon(TRIM)));
  chand.children[0].rotation.x = Math.PI / 2;
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffe2a8' })); b.position.set(Math.cos(i) * 0.7, 0.1, Math.sin(i) * 0.7); chand.add(b); }
  const chandGlow = makeGlow('#ffd08a', 3.5, 0.5); chandGlow.position.set(0, 5.6, 1.5); scene.add(chandGlow);

  /* ===================== the lounge (west, front) ===================== */
  disc(-6.4, 0.008, 3.6, 2.2, '#d58b33'); disc(-6.4, 0.01, 3.6, 1.9, '#f0bb55'); disc(-6.4, 0.012, 3.6, 1.4, '#86323f');
  // the fireplace, its mantel, the chimney breast
  solid(-11.85, -11.2, 2.7, 4.3, 0, 1.3, STONE); solid(-11.85, -11.05, 2.5, 4.5, 1.3, 1.45, WOOD);
  solid(-11.85, -11.4, 2.8, 4.2, 1.45, SLAB, PLASTER, { ghost: true });
  solid(-11.22, -11.18, 3.1, 3.9, 0.1, 0.8, '#2a1e24', { ghost: true, flat: true });
  const fire = makeGlow('#ff9a4a', 1.6, 0.8); fire.position.set(-11.1, 0.45, 3.5); scene.add(fire);
  // the purple sofa facing it, the round card table behind it
  solid(-9.6, -8.8, 2.2, 4.8, 0, 0.45, SOFA); solid(-8.8, -8.5, 2.2, 4.8, 0, 1.0, SOFA2);
  solid(-9.6, -8.5, 2.0, 2.2, 0, 0.7, SOFA2); solid(-9.6, -8.5, 4.8, 5.0, 0, 0.7, SOFA2);
  crate(-9.2, 2.6, 0.35, 0.3, 0.45, CUSH); crate(-9.3, 4.4, 0.3, 0.3, 0.45, '#4fb3a9');
  crate(-9.25, 3.7, 0.4, 0.25, 0.45, '#f08a3c');                        // the cat, asleep
  hidden(-7.1, -5.7, 2.9, 4.3, 0, 0.8);
  mesh(new THREE.CylinderGeometry(0.85, 0.82, 0.08, 40), WOOD, -6.4, 0.76, 3.6);
  disc(-6.4, 0.805, 3.6, 0.73, FELT);
  mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.72, 12), DARK, -6.4, 0.36, 3.6);
  for (const [x, z, b] of [[-6.4, 2.45, [0, -1]], [-6.4, 4.75, [0, 1]], [-5.25, 3.6, [1, 0]]]) chair(x, z, WOOD2, b);
  // an armchair by the window, a lamp, a plant, a bookcase, the crates
  solid(-11.4, -10.4, 5.5, 6.5, 0, 0.45, '#4fb3a9'); solid(-11.4, -10.4, 6.3, 6.6, 0.45, 1.1, '#3c9189', { ghost: true });
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8), '#2a2a2a', -9.9, 0.75, 6.4);
  mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.3, 16, 1, true), '#fbf3e4', -9.9, 1.6, 6.4, { side: THREE.DoubleSide, emissive: '#8a5a22' });
  crate(-3.7, 6.3, 0.5, 0.5, 0, '#d0724f');
  for (let i = 0; i < 5; i++) mesh(new THREE.SphereGeometry(0.28, 10, 8), i % 2 ? '#4e8a4a' : '#6aa35b', -3.7 + Math.cos(i) * 0.18, 0.75 + (i % 3) * 0.22, 6.3 + Math.sin(i) * 0.18);
  bookcase(-11.6, -9.2, 0.12, 0.55, 0, 2.2, 0.57);
  crate(-4.0, 0.9, 0.8, 0.8, 0, CRATE); crate(-4.0, 0.9, 0.55, 0.5, 0.8, '#8a5a2f');

  /* ===================== the dining room (west, back) ===================== */
  solid(-10.6, -7.0, -4.2, -3.0, 0.72, 0.8, WOOD);                       // the long table
  hidden(-10.6, -7.0, -4.2, -3.0, 0, 0.72);
  for (const [x, z] of [[-10.4, -4.0], [-7.2, -4.0], [-10.4, -3.2], [-7.2, -3.2]]) solid(x - 0.08, x + 0.08, z - 0.08, z + 0.08, 0, 0.72, DARK, { ghost: true });
  for (const x of [-10, -8.8, -7.6]) { chair(x, -2.6, WOOD2, [0, 1]); chair(x, -4.6, WOOD2, [0, -1]); }
  for (const x of [-9.8, -7.8]) mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 8), WHITE, x, 0.95, -3.6);
  solid(-11.5, -8, -6.85, -6.3, 0, 0.9, DARK);                          // the sideboard
  solid(-11.85, -11.35, -6.6, -5.2, 0, 2.2, WOOD);                      // the china cabinet
  for (const z of [-6.3, -5.8]) disc(-11.33, 1.5, z, 0.16, WHITE).rotation.set(0, -Math.PI / 2, 0);

  /* ===================== the library (east, front) ===================== */
  bookcase(11.35, 11.85, 0.3, 3.6, 0, 2.6, 11.33);
  bookcase(3.5, 6.4, 0.12, 0.55, 0, 2.4, 0.57);
  bookcase(5.2, 5.7, 2.5, 5.5, 0, 2.2, 5.18);                           // a bookcase in the middle: cover
  solid(8.6, 10.6, 2.6, 3.6, 0, 0.8, WOOD);                             // the reading desk
  chair(9.6, 4.1, WOOD2, [0, 1]);
  mesh(new THREE.SphereGeometry(0.25, 14, 10), '#5b9bd5', 9.0, 1.1, 3.1);
  for (const [x, z] of [[8.2, 6.1], [10.8, 6.1]]) { solid(x - 0.5, x + 0.5, z - 0.45, z + 0.45, 0, 0.45, '#3f7a3c'); solid(x - 0.5, x + 0.5, z + 0.3, z + 0.45, 0.45, 1.1, '#356a33', { ghost: true }); }
  disc(7.5, 0.008, 4, 1.8, '#5d4a7a');

  /* ===================== the kitchen (east, back) ===================== */
  solid(11.15, 11.85, -4.6, -1.8, 0, 0.9, WHITE); solid(11.1, 11.85, -4.65, -1.75, 0.9, 0.96, STONE, { ghost: true });
  solid(6.2, 8.6, -3.4, -2.2, 0, 0.9, WOOD); solid(6.15, 8.65, -3.45, -2.15, 0.9, 0.96, STONE, { ghost: true }); // the island
  solid(3.15, 3.85, -1.0, -0.15, 0, 2.0, WHITE);                         // the fridge
  solid(5.0, 6.3, -6.85, -6.25, 0, 0.9, '#3a3340');                     // the stove
  mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.25, 12), '#ea6a4f', 5.4, 1.03, -6.55);
  hidden(4.1, 5.3, -5.6, -4.6, 0, 0.75);
  mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 24), WOOD2, 4.7, 0.75, -5.1);
  mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.72, 10), DARK, 4.7, 0.36, -5.1);
  for (const [x, y, z] of [[7, 1.05, -2.8], [7.6, 1.05, -2.6]]) mesh(new THREE.SphereGeometry(0.1, 8, 6), '#f08a3c', x, y, z);
  // the secret way into the library: a low hatch under the shelves
  solid(10.15, 11.25, -0.12, 0.12, 1.3, 1.4, TRIM, { ghost: true });

  /* ===================== the bedroom (west, upstairs) ===================== */
  floorY = F1;
  solid(-11.85, -9.4, 2.3, 4.7, F1, F1 + 0.35, WOOD); solid(-11.6, -9.4, 2.35, 4.65, F1 + 0.35, F1 + 0.6, WHITE);
  solid(-10.6, -9.4, 2.3, 4.7, F1 + 0.6, F1 + 0.65, '#e88fb4', { ghost: true });
  solid(-11.85, -11.6, 2.2, 4.8, F1, F1 + 1.4, DARK);                   // the headboard
  crate(-11.4, 1.9, 0.5, 0.6, F1, WOOD2); crate(-11.4, 5.1, 0.5, 0.6, F1, WOOD2);
  solid(-9.3, -8.7, 2.8, 4.2, F1, F1 + 0.5, CRATE);                     // a chest at the foot of the bed
  solid(-8.6, -6.6, 6.3, 6.85, F1, F1 + 2.3, WOOD);                     // the wardrobe
  solid(-11, -9.5, 0.15, 0.65, F1, F1 + 1.0, WOOD2);                    // a dresser
  disc(-7.5, F1 + 0.008, 3.5, 1.5, '#e88fb4');

  /* ===================== the bathroom (west, upstairs), with the attic stair ===================== */
  solid(-11.85, -10.1, -6.85, -6.0, F1, F1 + 0.6, WHITE); solid(-11.7, -10.25, -6.7, -6.15, F1 + 0.5, F1 + 0.56, '#7fd0e8', { ghost: true, flat: true });
  solid(-8.5, -7.7, -6.85, -6.45, F1, F1 + 0.9, WHITE);                 // the sink
  solid(-6.5, -6.0, -6.85, -6.3, F1, F1 + 0.5, WHITE);                  // the loo
  crate(-3.6, -6.4, 0.6, 0.55, F1, '#e8ddc8');                          // the laundry basket
  disc(-5, F1 + 0.008, -5, 1, '#f2ece0');

  /* ===================== the kids' room (east, upstairs) ===================== */
  // the bunk bed against the east wall: crawl between the bunks, climb the steps to the top one
  solid(10.6, 11.85, 0.4, 2.8, F1, F1 + 0.5, '#5b9bd5');
  solid(10.6, 11.85, 0.4, 2.8, F1 + 1.75, F1 + 2.1, '#ea6a4f');
  for (const z of [0.45, 2.75]) solid(10.55, 10.65, z - 0.05, z + 0.05, F1, F1 + 2.4, WOOD, { ghost: true });
  [0.45, 0.9, 1.35].forEach((h, i) => solid(9.55 + i * 0.35, 9.9 + i * 0.35, 0.5, 1.1, F1, F1 + h, BOOKS[i + 2]));
  solid(4.0, 6.0, 6.3, 6.85, F1, F1 + 0.8, WOOD2); chair(5.0, 5.8, '#4fb3a9', [0, -1]);
  crate(7.2, 1.2, 0.7, 0.7, F1, '#f4b63f'); crate(7.2, 1.2, 0.5, 0.5, F1 + 0.7, '#8f73e3'); crate(8.1, 1.0, 0.6, 0.6, F1, '#4fb3a9');
  solid(9.6, 10.4, 5.6, 6.6, F1, F1 + 0.6, '#e88fb4');                  // the toy chest
  disc(7.5, F1 + 0.008, 3.8, 1.6, '#f4b63f');

  /* ===================== the billiard room (east, upstairs) ===================== */
  solid(5.6, 9.4, -3.4, -1.6, F1 + 0.65, F1 + 0.85, WOOD); hidden(5.6, 9.4, -3.4, -1.6, F1, F1 + 0.65);
  solid(5.75, 9.25, -3.25, -1.75, F1 + 0.85, F1 + 0.87, '#3f8a4a', { ghost: true, flat: true });
  for (const [x, z] of [[5.8, -3.2], [9.2, -3.2], [5.8, -1.8], [9.2, -1.8]]) solid(x - 0.1, x + 0.1, z - 0.1, z + 0.1, F1, F1 + 0.65, DARK, { ghost: true });
  solid(11.2, 11.85, -4.6, -1.0, F1, F1 + 1.0, DARK);                   // the bar
  disc(11.83, F1 + 1.6, 1.8, 0.35, '#ea6a4f').rotation.set(0, -Math.PI / 2, 0); // the dartboard
  disc(11.82, F1 + 1.6, 1.8, 0.22, '#fbf3e4').rotation.set(0, -Math.PI / 2, 0);
  solid(3.6, 4.6, -1.2, -0.3, F1, F1 + 0.45, '#7a3440'); solid(3.3, 3.6, -1.2, -0.3, F1 + 0.45, F1 + 1.1, '#6a2a36', { ghost: true });

  /* ===================== the attic ===================== */
  floorY = ATT;
  crate(-3, -2.6, 0.9, 0.7, ATT, CRATE); crate(-2, -2.7, 0.7, 0.6, ATT, '#8a5a2f'); crate(-3, -2.6, 0.6, 0.5, ATT + 0.7, '#c98b52');
  solid(1, 2.2, 2.6, 3.3, ATT, ATT + 2.0, WOOD);                        // an old wardrobe
  for (const [x, z, w, d, h] of [[4.5, 0, 1.4, 0.9, 1.1], [-5.5, 2, 1.2, 1.2, 0.9], [9.5, -2, 1.3, 1, 1.2]]) solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, ATT, ATT + h, '#ece6d8'); // dust sheets
  solid(-9.5, -8.5, 1.5, 3.2, ATT, ATT + 0.7, '#8a5a2f');               // a trunk
  crate(6.5, 2.6, 0.8, 0.8, ATT, CRATE); crate(-0.5, 0.5, 0.7, 0.9, ATT, '#e88fb4');
  solid(10.6, 11.6, 1.8, 2.2, ATT, ATT + 1.0, '#ea6a4f'); solid(10.4, 11.8, 1.85, 2.15, ATT + 1.0, ATT + 1.2, '#f4b63f', { ghost: true }); // a rocking horse

  /* ===================== the garden ===================== */
  floorY = 0;
  // the hedge round it all, the gate at the front (drawn only: the bounds hold you in)
  for (const s of [-1, 1]) {
    solid(-24.6, 24.6, s * 18.1 - 0.5, s * 18.1 + 0.5, 0, 2, HEDGE, { ghost: true });
    solid(s * 24.1 - 0.5, s * 24.1 + 0.5, -18.6, 18.6, 0, 2, HEDGE, { ghost: true });
  }
  for (let x = -1.5; x <= 1.5; x += 0.3) solid(x - 0.03, x + 0.03, 17.95, 18.05, 0, 2.2, '#2a2a2a', { ghost: true, noShadow: true });
  for (const x of [-1.8, 1.8]) solid(x - 0.25, x + 0.25, 17.8, 18.3, 0, 2.6, STONE, { ghost: true });
  // the fountain in front of the house
  solid(-1.6, 1.6, 11, 14, 0, 0.55, STONE);
  disc(0, 0.56, 12.5, 1.4, '#5bb8e8', 32).scale.set(1, 1, 1);
  solid(-0.25, 0.25, 12.25, 12.75, 0.55, 1.6, STONE);
  mesh(new THREE.CylinderGeometry(0.7, 0.3, 0.25, 20), STONE, 0, 1.7, 12.5);
  disc(0, 1.83, 12.5, 0.6, '#7fd0e8', 24);
  // hedges to hide behind, front and back and on the sides
  for (const s of [-1, 1]) {
    const hedge = (a, b, z0, z1, h = 1.4) => solid(Math.min(s * a, s * b), Math.max(s * a, s * b), z0, z1, 0, h, HEDGE);
    hedge(5, 9, 10, 10.8); hedge(15.2, 16, 4, 9); hedge(3, 8, -10.2, -9.4); hedge(13, 17, -14.2, -13.4); hedge(14.7, 15.5, -8, -4);
    hedge(6, 6.8, 13, 16.5, 1.1);
    // benches along the drive, lanterns on posts
    solid(Math.min(s * 3, s * 3.5), Math.max(s * 3, s * 3.5), 12, 13.6, 0, 0.45, WOOD2);
    for (const z of [9.8, 13.5, 16.8]) {
      solid(s * 2.2 - 0.06, s * 2.2 + 0.06, z - 0.06, z + 0.06, 0, 1.6, '#2a2a2a', { ghost: true });
      const l = makeGlow('#ffd08a', 0.9, 0.85); l.position.set(s * 2.2, 1.7, z); scene.add(l);
      mesh(new THREE.SphereGeometry(0.1, 8, 6), '#ffe2a8', s * 2.2, 1.7, z, { emissive: '#ffc070' });
    }
  }
  for (const [x, z, s] of [[-18, 9, 1], [18, 9, 1], [-20.5, -11, 1.1], [20.5, -11, 1.1], [-14.5, 14.5, 0.9], [14.5, 14.5, 0.9], [-11, -15.5, 1], [11, -15.5, 1], [-21, 15.5, 1], [21, 15.5, 1]]) tree(x, z, s);
  // the gazebo at the back
  solid(-2.5, 2.5, -15.5, -10.5, 0, 0.24, WOOD2);
  for (const x of [-2.25, 2.25]) for (const z of [-15.25, -10.75]) crate(x, z, 0.3, 2.8, 0.24, WHITE);
  const roof = mesh(new THREE.ConeGeometry(3.9, 1.7, 4), '#5d4a7a', 0, 3.85, -13); roof.rotation.y = Math.PI / 4;
  solid(-1.5, 1.5, -15.3, -14.9, 0.24, 0.69, WOOD);
  // a pond and a flower bed (drawn only)
  disc(-9, 0.004, -14, 2.2, '#3f7fb0').scale.set(1.3, 1, 1);
  disc(9, 0.004, -14, 2.2, '#6b4a2f').scale.set(1.3, 1, 1);
  for (let i = 0; i < 14; i++) mesh(new THREE.SphereGeometry(0.16, 6, 5), BOOKS[i % 8], 9 + Math.cos(i * 2.4) * (0.6 + (i % 4) * 0.5), 0.15, -14 + Math.sin(i * 2.4) * (0.4 + (i % 3) * 0.4));

  /* ===================== the shed (west) and the greenhouse (east) ===================== */
  // the shed: wooden walls, a door facing the house, one to the north, the Rouges' flag inside
  wall('z', -16.5, -3, 3, 0, 2.8, SHED, [[-0.7, 0.7, 0, 2.3]], 0.2);
  wall('z', -22.5, -3, 3, 0, 2.8, SHED, [W(-1, 1)], 0.2);
  wall('x', -3, -22.6, -16.4, 0, 2.8, SHED, [[-20.2, -19, 0, 2.3]], 0.2);
  wall('x', 3, -22.6, -16.4, 0, 2.8, SHED, [W(-21, -19.5)], 0.2);
  solid(-23, -16, -3.5, 3.5, 2.8, 3.0, '#5a3a26', { ghost: true });
  solid(-22.35, -21.7, 1.2, 2.8, 0, 0.9, WOOD);                          // the workbench
  for (const [x, z] of [[-22.3, -2.4], [-21.6, -2.5]]) solid(x - 0.04, x + 0.04, z - 0.04, z + 0.04, 0, 1.4, '#8a8a8a', { ghost: true }); // a rake, a spade
  planks(-22.4, -16.6, -2.9, 2.9, 0.004, PINE);
  // the greenhouse: the same, in glass (you see and shoot through it, you don't walk through it)
  const glassMat = toon(GLASS, { transparent: true, opacity: 0.28, depthWrite: false });
  function pane(x0, x1, z0, z1, y0, y1) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), glassMat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); scene.add(m);
    boxes.push({ x0, x1, z0, z1, y0, y1 });
  }
  const glassWall = (ax, at, a, b, holes) => cut(a, b, 0, 2.8, holes, (s0, s1, d0, d1) => ax === 'x' ? pane(s0, s1, at - 0.05, at + 0.05, d0, d1) : pane(at - 0.05, at + 0.05, s0, s1, d0, d1));
  glassWall('z', 16.5, -3, 3, [[-0.7, 0.7, 0, 2.3]]); glassWall('z', 22.5, -3, 3, []);
  glassWall('x', -3, 16.5, 22.5, [[19, 20.2, 0, 2.3]]); glassWall('x', 3, 16.5, 22.5, []);
  for (const x of [16.5, 19.5, 22.5]) for (const z of [-3, 3]) crate(x, z, 0.16, 2.8, 0, '#e8ecf5');
  for (const z of [-0.7, 0.7]) crate(16.5, z, 0.16, 2.8, 0, '#e8ecf5');
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.06, 3.6), glassMat); r.rotation.x = s * 0.5; r.position.set(19.5, 3.25, s * 1.55); scene.add(r);
  }
  solid(16.45, 22.55, -0.03, 0.03, 3.65, 3.75, '#e8ecf5', { ghost: true });
  solid(21.7, 22.35, 1.2, 2.8, 0, 0.9, WOOD);                            // the potting table
  for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.22, 8, 6), i % 2 ? '#6aa35b' : '#8fbf5a', 22, 1.15, 1.4 + i * 0.4);
  planks(16.6, 22.4, -2.9, 2.9, 0.004, TILE);

  /* ===================== night, lamps in every room ===================== */
  const sky = '#1a1430';
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, 30, 75);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff4d6', fog: false }));
  moon.position.set(-30, 34, 40); scene.add(moon);
  const pts = new Float32Array(400 * 3);
  for (let i = 0; i < 400; i++) { const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 20; pts.set([Math.cos(a) * r, 12 + Math.random() * 40, Math.sin(a) * r], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, fog: false })));
  scene.add(new THREE.HemisphereLight(0x9fa8ff, 0x2b2238, 1.0));
  const moonLight = new THREE.DirectionalLight(0xb0bcff, 1.0);
  moonLight.position.set(-18, 30, 20); moonLight.target.position.set(0, 0, 0);
  moonLight.castShadow = true;
  const sc = moonLight.shadow.camera; sc.left = -28; sc.right = 28; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 80;
  moonLight.shadow.mapSize.set(2048, 2048); moonLight.shadow.bias = -0.0006; moonLight.shadow.normalBias = 0.03;
  scene.add(moonLight, moonLight.target);
  for (const [x, y, z, c, p, r] of [[-7.5, 2.8, 3.5, 0xffb070, 9, 10], [-7.5, 2.8, -3.5, 0xffc890, 7, 10], [0, 5.4, 1, 0xffd8a0, 12, 14],
    [7.5, 2.8, 3.5, 0xffb070, 8, 10], [7.5, 2.8, -3.5, 0xfff0d0, 8, 10], [-7.5, 6.2, 0, 0xffb8d0, 9, 11], [7.5, 6.2, 0, 0xffd090, 9, 11], [0, 9, 0, 0xc0a0ff, 6, 16]]) {
    const l = new THREE.PointLight(c, p, r, 1.6); l.position.set(x, y, z); scene.add(l);
  }

  // spawns, Rouges in the west (x < 0) and Bleus in the east, inside and out
  const spawns = [];
  for (const s of [-1, 1]) for (const [x, y, z] of [[19.5, 0, 6.5], [19.5, 0, -6.5], [14, 0, 11.5], [14, 0, -11.5], [5.5, 0, 5.8], [4.6, 0, -3.9], [6, F1, 4.5], [4.8, F1, -4.6], [3, ATT, 1.5]]) spawns.push([s * x, y, z]);
  // health in the lounge, the kitchen and upstairs; armor on the gallery and in the gazebo; the
  // rocket launcher in the attic, the railgun on the balcony over the front door
  const pickups = [['health', -5.2, 0, 1.0], ['health', 5.0, 0, -1.0], ['health', -4.4, F1, 1.2], ['health', 4.4, F1, -2.6],
    ['armor', 0, F1, -5.8], ['armor', 0, 0.24, -13], ['rocket', 8, ATT, 0], ['railgun', 0, F1, 8.6]];
  // capture the flag: in the shed and in the greenhouse
  const flags = [[-19.5, 0, 0], [19.5, 0, 0]];
  return { bounds: BOUNDS, boxes, spawns, pickups, flags };
}
