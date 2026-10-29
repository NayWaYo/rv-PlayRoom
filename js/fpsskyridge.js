// The seventh battle map, "Skyridge", drawn from the players' own plan, made for capture the flag:
// a floating island split north to south by a gorge with a stream at the bottom. Each team's base
// sits against its edge of the island with its flag inside, its spawn in the corner beside it.
// Three ways across: the high route in the north (a lookout tower on each side, a footbridge
// between them, for snipers), the main bridge in the middle with its platform over a rock pillar,
// and the low route in the south, down into the gorge and up the other side.
import * as THREE from 'three';
import { toon, noOutline } from './fx.js';
import { makeKit } from './fpsmap.js';

const G = 2.4;      // the island's top; the gorge's bed is at 0
const GW = 3;       // half the gorge's width
const T = 5;        // the lookout towers and the high footbridge
export const BOUNDS = { x0: -15.6, x1: 15.6, z0: -14.6, z1: 14.6 };

export function buildMap(scene) {
  const { boxes, solid, wallX, wallZ, crate, stairsX } = makeKit(scene);

  // colours
  const ROCK = '#a39a8a', ROCK2 = '#8f8676', GRASS = '#7aa35a', GRASS2 = '#6b9450', STONE = '#c9bfae', WOOD = '#b07a45', WOOD2 = '#c98b52';
  const RED = '#c9483a', BLUE = '#3d6fd1', LEAF = '#5f9a45', WATER = '#5bb8e8';

  // under the island: its cliffs, falling away to the sea far below (drawn only)
  solid(-15.6, 15.6, -14.6, 14.6, -30, 0, ROCK2, { ghost: true });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), noOutline(toon('#4a9fd8')));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -30; scene.add(sea);

  /* ----- the two halves of the island, the gorge between them ----- */
  for (const s of [-1, 1]) {
    const [x0, x1] = s < 0 ? [-15.6, -GW] : [GW, 15.6];
    solid(x0, x1, -14.6, 14.6, 0, G - 0.25, ROCK);
    solid(x0, x1, -14.6, 14.6, G - 0.25, G, GRASS);
    // a rocky rim round the edge
    wallX(-14.4, x0, x1, G, G + 0.9, ROCK2, [], 0.4); wallX(14.4, x0, x1, G, G + 0.9, ROCK2, [], 0.4);
    wallZ(s * 15.4, -14.6, 14.6, G, G + 0.9, ROCK2, [], 0.4);
  }
  // the stream at the bottom of the gorge, shallow enough to walk in
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2 * GW, 29.2), noOutline(toon(WATER)));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.03; water.receiveShadow = true; scene.add(water);
  // a waterfall pouring off the north end, drawn only
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(2 * GW, 30), noOutline(toon('#bfe6fa', { side: THREE.DoubleSide })));
  fall.position.set(0, -15, 14.6); scene.add(fall);
  // stairs down into the gorge at both ends, on both banks: the low route
  for (const z of [-12.9, 11.5]) for (const s of [-1, 1]) stairsX(z, z + 1.4, s * (GW - 10 * 0.29), s, G, ROCK2, 10, 0.29);
  // rocks in the stream to hide behind
  crate(0, -7.8, 1.3, 1.1, 0, ROCK2); crate(-1.6, -6.4, 1, 0.8, 0, ROCK2); crate(1.6, 6.4, 1.2, 1, 0, ROCK2); crate(0, 8.5, 1, 0.9, 0, ROCK2);

  /* ----- the main bridge, with a platform over a rock pillar ----- */
  solid(-GW, GW, -1.2, 1.2, G - 0.25, G, WOOD);
  solid(-1.6, 1.6, -2.4, 2.4, G - 0.3, G, STONE);
  solid(-1.1, 1.1, -1.9, 1.9, 0, G - 0.3, ROCK);                         // the pillar: walk round it in the stream
  for (const z of [-1.25, 1.25]) for (const [a, b] of [[-GW, -1.6], [1.6, GW]]) wallX(z, a, b, G, G + 0.5, WOOD2, [], 0.1);
  for (const [x, z] of [[-1.1, -1.9], [1.1, 1.9]]) crate(x, z, 0.8, 0.9, G, WOOD); // cover on the platform

  /* ----- built once for each side, s = -1 for the Rouges in the west, +1 for the Bleus ----- */
  const X = (s, x) => s * x;
  const span = (s, a, b) => [Math.min(s * a, s * b), Math.max(s * a, s * b)];
  function side(s, col) {
    const block = (a, b, z0, z1, y0, y1, c, o) => solid(...span(s, a, b), z0, z1, y0, y1, c, o);
    // the base against the edge: three doors (front, north, south), the flag inside
    wallZ(X(s, 10.6), -3.5, 3.5, G, G + 3.2, col, [[-1.3, 1.3, G, G + 2.4]]);
    for (const z of [-3.5, 3.5]) wallX(z, ...span(s, 10.6, 15.2), G, G + 3.2, col, [[...span(s, 12.2, 13.6), G, G + 2.4]]);
    block(15, 15.6, -3.5, 3.5, G, G + 3.2, col);                            // its back wall, over the rim
    block(10.45, 15.6, -3.65, 3.65, G + 3.2, G + 3.45, STONE);
    for (const z of [-2.3, 2.3]) block(10.4, 10.45, z - 0.6, z + 0.6, G + 0.6, G + 2.8, STONE, { ghost: true, noShadow: true }); // banners by the door
    // cover in front of it, along the middle lane
    crate(X(s, 8.6), 2.4, 1.1, 1.1, G, WOOD); crate(X(s, 8.6), -2.4, 1, 0.8, G, WOOD2);
    crate(X(s, 6.6), -1, 1, 1, G, WOOD); block(4.9, 5.2, 0.6, 2.6, G, G + 1, ROCK2);
    // the spawn in the south corner: a ring on the grass, cover round it
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2, 32), noOutline(toon(col)));
    ring.rotation.x = -Math.PI / 2; ring.position.set(X(s, 12.4), G + 0.02, -10.6); scene.add(ring);
    block(8, 11, -6.3, -6, G, G + 1, ROCK2);
    crate(X(s, 7.2), -9, 1.1, 1.2, G, WOOD); crate(X(s, 7.5), -12.8, 1, 0.8, G, ROCK2);
    // the lookout tower in the north: posts, a deck, stairs up its south side, rails
    for (const x of [5.2, 7.8]) for (const z of [7.7, 10.8]) block(x - 0.15, x + 0.15, z - 0.15, z + 0.15, G, T - 0.25, WOOD);
    block(5, 8, 7.5, 11, T - 0.25, T, WOOD2);
    const n = 11, run = 0.33, z0 = 7.5 - n * run;
    for (let k = 1; k <= n; k++) block(6.8, 8, z0 + (k - 1) * run, z0 + k * run, G, G + k * (T - G) / n, WOOD);
    wallX(11, ...span(s, 5, 8), T, T + 0.8, WOOD2, [], 0.12);
    wallZ(X(s, 8), 7.5, 11, T, T + 0.8, WOOD2, [], 0.12);
    wallX(7.5, ...span(s, 5, 6.8), T, T + 0.8, WOOD2, [], 0.12);
    crate(X(s, 5.6), 10.4, 0.7, 0.7, T, WOOD);
    // rocks and trees round the north
    crate(X(s, 10.4), 6.6, 1.2, 1.2, G, ROCK2); crate(X(s, 12.8), 8.4, 1, 0.9, G, WOOD2);
    tree(X(s, 11.5), 11.5); tree(X(s, 13.6), 5.6); tree(X(s, 4.6), -11.5); tree(X(s, 14), -5.5);
  }
  // a tree: a trunk to bump into, a round top (drawn only)
  function tree(x, z) {
    solid(x - 0.25, x + 0.25, z - 0.25, z + 0.25, G, G + 1.8, WOOD);
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 0), toon(LEAF));
    top.position.set(x, G + 2.6, z); top.castShadow = true; scene.add(top);
  }
  side(-1, RED); side(1, BLUE);

  // the high footbridge between the two towers
  solid(-5, 5, 8.6, 9.9, T - 0.25, T, WOOD2);
  wallX(8.56, -5, 5, T, T + 0.6, WOOD2, [], 0.08); wallX(9.94, -5, 5, T, T + 0.6, WOOD2, [], 0.08);

  /* ----- far away: other islands, a sunny sky ----- */
  for (const [x, z, r, h] of [[-48, -30, 5, 26], [52, -18, 6, 30], [-40, 36, 7, 24], [44, 40, 4, 34], [0, -55, 8, 22], [10, 58, 6, 28]]) {
    const isle = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.4, h, 7), toon(ROCK));
    isle.position.set(x, G - h / 2 - 3, z); scene.add(isle);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.6, 7), toon(GRASS2));
    cap.position.set(x, G - 2.7, z); scene.add(cap);
  }
  const sky = '#9fd3ff';
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, 45, 110);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a8a50, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
  sun.position.set(-14, 26, 10); sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  const sc = sun.shadow.camera; sc.left = -20; sc.right = 20; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 60;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // spawns: Rouges in the west (x < 0), round their spawn ring and by their base; Bleus the same in the east
  const spawns = [];
  for (const s of [-1, 1]) for (const [x, y, z] of [[12.4, G, -10.6], [10.6, G, -12.4], [14.2, G, -8.6], [10, G, -9.4], [9.4, G, 3.8], [9.4, G, -4], [6.5, T, 9.8]]) spawns.push([s * x, y, z]);
  // health on each side and down in the gorge, armor on the towers, the rocket launcher on the
  // bridge's platform, the railgun in the middle of the high footbridge
  const pickups = [['health', -9, G, -12.2], ['health', 9, G, -12.2], ['health', 0, 0, -10], ['armor', -6.5, T, 8.4], ['armor', 6.5, T, 8.4],
    ['rocket', 0, G, 0], ['railgun', 0, T, 9.25]];
  // jump pads at the bottom of the gorge, throwing you back up onto your side
  const pads = [[-2.2, 0, -4.5, -3, 10, 0], [2.2, 0, 4.5, 3, 10, 0], [-2.2, 0, 4.5, -3, 10, 0], [2.2, 0, -4.5, 3, 10, 0]];
  // capture the flag: inside each base
  const flags = [[-13.2, G, 0], [13.2, G, 0]];
  return { bounds: BOUNDS, boxes, spawns, pickups, pads, flags };
}
