// The sixth battle map, "les Deux Forts", made for capture the flag: a big open valley (about
// 120 x 70 m) with a fort at each end, the Rouges' in the west and the Bleus' in the east, the
// same both sides. Each fort has three front gates and two side gates, a rampart with
// battlements, and its flag on a pedestal at the back of the courtyard. In the middle, open
// ruins with a raised platform; on each side of it, a lane: crates and a footbridge in the
// north, zig-zag trenches in the south.
import * as THREE from 'three';
import { toon, noOutline, makeGlow } from './fx.js';
import { makeKit } from './fpsmap.js';

const RAMP = 3.9;   // the ramparts' walkway
const FWALL = 4.9;  // the forts' walls
const OUTER = 7;    // the valley's walls
export const BOUNDS = { x0: -59.6, x1: 59.6, z0: -34.6, z1: 34.6 };
const FLAG_X = 54;  // where each flag stands, on its own side (x = -54 for the Rouges)

export function buildMap(scene) {
  const { boxes, solid, wallX, wallZ, crate, stairsX, floor } = makeKit(scene);

  // colours
  const ROCK = '#a39a8a', ROCK2 = '#8f8676', STONE = '#c9bfae', WOOD = '#b07a45', WOOD2 = '#c98b52', SAND = '#d9b77a';
  const RED = '#c9483a', BLUE = '#3d6fd1', STAIR = '#8f73e3', RAIL = '#f4b63f';

  floor(120, 70, '#7aa35a', '#82ab62');

  // the valley's walls
  wallX(-35.2, -60.4, 60.4, 0, OUTER, ROCK2, [], 0.8); wallX(35.2, -60.4, 60.4, 0, OUTER, ROCK2, [], 0.8);
  wallZ(-60, -35, 35, 0, OUTER, ROCK2, [], 0.8); wallZ(60, -35, 35, 0, OUTER, ROCK2, [], 0.8);

  /* ----- the two forts: built once for each side, s = -1 in the west, +1 in the east ----- */
  const pads = [];
  function fort(s, col) {
    const X = x => s * x;                                   // a distance from the middle, on this side
    const span = (a, b) => [Math.min(X(a), X(b)), Math.max(X(a), X(b))];
    const block = (a, b, z0, z1, y0, y1, c, o) => { const [x0, x1] = span(a, b); return solid(x0, x1, z0, z1, y0, y1, c, o); };
    // a tinted courtyard floor, drawn only
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(15.6, 40), noOutline(toon(col === RED ? '#b88a7a' : '#8a9ab8')));
    yard.rotation.x = -Math.PI / 2; yard.position.set(X(52.2), 0.01, 0); yard.receiveShadow = true; scene.add(yard);
    // the front wall: three gates, battlements along the top
    const notches = [];
    for (let z = -19; z < 19; z += 3) notches.push([z, z + 1.2, FWALL - 0.6, FWALL]);
    wallZ(X(44), -20, 20, 0, FWALL, STONE, [[-15, -11, 0, 3], [-3, 3, 0, 3], [11, 15, 0, 3]].concat(notches).sort((a, b) => a[0] - b[0])
      .filter((h, i, all) => !all.some((o, j) => j !== i && o[2] === 0 && h[2] !== 0 && h[0] < o[1] && h[1] > o[0])), 0.8);
    // the side walls, a gate in each
    for (const z of [-20, 20]) wallX(z, ...span(44.4, 59.6), 0, FWALL, STONE, [[...span(50, 54), 0, 3]], 0.8);
    // the rampart's walkway behind the front wall, stairs up to it along both side walls
    block(44.4, 46.4, -19.6, 19.6, RAMP - 0.3, RAMP, ROCK);
    for (const [z0, z1] of [[16.8, 18.4], [-18.4, -16.8]]) stairsX(z0, z1, X(51.4), -s, RAMP, STAIR);
    // the flag's pedestal, low enough to walk onto, in the team's colour, with a glow
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.2, 28), toon(col)); ped.position.set(X(FLAG_X), 0.1, 0); ped.receiveShadow = true; scene.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.08, 8, 32), toon(RAIL)); ring.rotation.x = Math.PI / 2; ring.position.set(X(FLAG_X), 0.21, 0); scene.add(ring);
    const glow = makeGlow(col, 4, 0.5); glow.position.set(X(FLAG_X), 1.2, 0); scene.add(glow);
    // behind the flag: the keep, a solid block with the team's banners
    block(57, 59.6, -9, 9, 0, 6.5, ROCK);
    for (const z of [-5, 5]) block(56.9, 57, z - 1, z + 1, 2.5, 6, col, { ghost: true, noShadow: true });
    // cover in the courtyard
    crate(X(49), -12, 1.2, 1.2, 0, WOOD); crate(X(49), 12, 1.2, 1.2, 0, WOOD);
    crate(X(52), -6, 1, 0.9, 0, WOOD2); crate(X(52), 6, 1, 0.9, 0, WOOD2);
    crate(X(56.5), -15, 1.4, 1.4, 0, WOOD); crate(X(56.5), 15, 1.4, 1.4, 0, WOOD);
    // a jump pad up to the rampart, near each of its ends
    for (const z of [-9, 9]) pads.push([X(49), 0, z, -s * 2.7, 9.5, 0]);
    // the team's colour on the gates' lintels
    for (const [z0, z1] of [[-15, -11], [-3, 3], [11, 15]]) block(43.55, 44.45, z0, z1, 3, 3.3, col, { ghost: true, noShadow: true });
  }
  fort(-1, RED); fort(1, BLUE);

  /* ----- the middle: walls between the lanes, open ruins with a platform ----- */
  for (const z of [-12, 12]) for (const [a, b] of [[-36, -26], [-20, -8], [8, 20], [26, 36]]) wallX(z, a, b, 0, 2.4, ROCK, [], 0.5);
  // the ruins: four corners of broken walls, a gap in the middle of each side
  const lo = (a, b) => Math.min(a, b), hi = (a, b) => Math.max(a, b);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    wallX(sz * 9, lo(sx * 2, sx * 9), hi(sx * 2, sx * 9), 0, sx * sz > 0 ? 3.5 : 2.6, STONE, [], 0.6);
    wallZ(sx * 9, lo(sz * 2, sz * 9), hi(sz * 2, sz * 9), 0, sx * sz > 0 ? 2.2 : 3.5, STONE, [], 0.6);
    solid(sx * 6 - 0.4, sx * 6 + 0.4, sz * 6 - 0.4, sz * 6 + 0.4, 0, 4, ROCK);  // pillars
  }
  // the platform, with stairs up from east and west
  solid(-3, 3, -3, 3, 0, 2.2, ROCK);
  stairsX(-1, 1, 5.64, -1, 2.2, STAIR, 8, 0.33); stairsX(-1, 1, -5.64, 1, 2.2, STAIR, 8, 0.33);
  // big rocks in the open middle lane
  for (const s of [-1, 1]) { crate(s * 25, -5, 2.2, 2, 0, ROCK2); crate(s * 25, 5, 2.2, 2, 0, ROCK2); crate(s * 35, 0, 1.6, 1.4, 0, ROCK2); crate(s * 16, 0, 1.2, 1.1, 0, WOOD); }

  /* ----- the north lane: rows of crates, thin walls, a footbridge in the middle ----- */
  for (const s of [-1, 1]) {
    for (const [x, z, w, h] of [[38, 18, 1.4, 1.4], [38, 29, 1.4, 1.2], [32, 23, 1.2, 1.2], [26, 16, 1.2, 1.4], [26, 31, 1.4, 1.4], [20, 26, 1.2, 1.2], [14, 18, 1.4, 1.2], [14, 30, 1.2, 1.4]]) crate(s * x, z, w, h, 0, x % 4 ? WOOD : WOOD2);
    for (const [x, z0, z1] of [[30, 26, 30], [22, 14, 19], [17, 29, 33]]) wallZ(s * x, z0, z1, 0, 2.0, ROCK, [], 0.3);
  }
  // the footbridge: up three metres, stairs at both ends
  solid(-7, 7, 20.5, 23.5, 2.7, 3, WOOD2);
  for (const x of [-6.5, 6.5]) solid(x - 0.25, x + 0.25, 20.8, 23.2, 0, 2.7, ROCK);
  stairsX(21, 23, 11.95, -1, 3, STAIR, 15, 0.33); stairsX(21, 23, -11.95, 1, 3, STAIR, 15, 0.33);
  wallX(20.56, -7, 7, 3, 3.8, RAIL, [], 0.1); wallX(23.44, -7, 7, 3, 3.8, RAIL, [], 0.1);

  /* ----- the south lane: low trench walls in a zig-zag, sandbags ----- */
  for (const s of [-1, 1]) {
    for (const [x, z0, z1] of [[34, -35, -23], [27, -24, -12], [20, -35, -23], [13, -24, -12], [6, -35, -23]]) wallZ(s * x, z0, z1, 0, 1.15, SAND, [], 0.8);
    for (const [x, z] of [[30.5, -18], [23.5, -29], [16.5, -18], [9.5, -29]]) crate(s * x, z, 1.2, 0.6, 0, SAND);
  }
  crate(0, -18, 1.4, 1.2, 0, WOOD);

  /* ----- a sunny afternoon ----- */
  const sky = '#9fd3ff';
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, 70, 150);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a8a50, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
  sun.position.set(-30, 50, 25); sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  const sc = sun.shadow.camera; sc.left = -66; sc.right = 66; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 140;
  sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  // spawn points inside each fort: Rouges in the west (x < 0), Bleus in the east
  const spawns = [];
  for (const s of [-1, 1]) for (const [x, y, z] of [[50, 0, -6], [50, 0, 6], [55.5, 0, -11], [55.5, 0, 11], [48, 0, -16], [48, 0, 16], [45.4, RAMP, -5], [45.4, RAMP, 5]]) spawns.push([s * x, y, z]);
  // health in each lane, armor on each rampart, the rocket launcher on the ruins' platform, the railgun on the footbridge
  const pickups = [['health', -30, 0, 0], ['health', 30, 0, 0], ['health', -38, 0, 24], ['health', 38, 0, 24], ['health', -38, 0, -18], ['health', 38, 0, -18],
    ['armor', -45.4, RAMP, 12], ['armor', 45.4, RAMP, 12], ['rocket', 0, 2.2, 0], ['railgun', 0, 3, 22]];
  // the flags: the Rouges' first, then the Bleus'
  const flags = [[-FLAG_X, 0, 0], [FLAG_X, 0, 0]];
  // far: how far the camera sees on a map this size (the fog hides where it stops)
  return { bounds: BOUNDS, boxes, spawns, pickups, pads, flags, far: 160 };
}
