// The second battle map, "la Station": a space station open to the stars. A hangar in the
// west with a parked shuttle (crawl under it, climb onto it) and catwalks along its walls,
// a reactor hall in the middle with balconies and two bridges past the glowing core, and
// labs in the east under an open deck with an antenna.
import * as THREE from 'three';
import { toon } from './fx.js';
import { makeKit } from './fpsmap.js';

const H = 3.5;      // the upper floor
const ROOF = 3.2;   // ceiling of the rooms below it
const WALL = 7;     // outer walls
export const BOUNDS = { x0: -15.6, x1: 15.6, z0: -11.6, z1: 11.6 };

export function buildMap(scene) {
  const { boxes, solid, wallX, wallZ, crate, door, win, vent, stairsX, stairsZ, floor } = makeKit(scene);

  // colours
  const OUT = '#47507a', WALLC = '#c9d3e6', PANEL = '#9aa8c7', SLAB = '#6c7aa6', RAIL = '#f4b63f';
  const STAIR = '#8f73e3', HAZ = '#f08a3c', WHITE = '#e8ecf5', DARK = '#3a3f5c', BOX = '#7d8bb5', GLASS = '#7fe8ff';

  floor(32, 24, '#2b3150', '#323a5c');

  // outer walls, with windows onto space
  wallX(-11.8, -16, 16, 0, WALL, OUT, [win(-12, -8), win(-3, 3, H), win(9, 13)], 0.4);
  wallX(11.8, -16, 16, 0, WALL, OUT, [win(-12, -8), win(-3, 3, H), win(9, 13)], 0.4);
  wallZ(-15.8, -12, 12, 0, WALL, OUT, [win(-4, 4, H)], 0.4); wallZ(15.8, -12, 12, 0, WALL, OUT, [win(-4, 4)], 0.4);

  /* ----- the west hangar: open to the top, catwalks along two walls ----- */
  solid(-15.6, -13, -11.6, 11.6, ROOF, H, SLAB);                       // west catwalk
  solid(-13, -5, 10, 11.6, ROOF, H, SLAB);                              // north catwalk, out to the hall's balcony
  wallZ(-12.94, -10, 10, H, H + 1, RAIL, [[-1, 1, H, H + 1], [7.2, 8.4, H, H + 1]], 0.12); // railing, a gap to drop onto the shuttle
  // a high walkway across the hangar, from the west catwalk to the hall's north balcony
  solid(-12.94, -5.15, 7.2, 8.4, H - 0.25, H, SLAB);
  wallX(7.16, -12.8, -5.2, H, H + 0.6, RAIL, [], 0.08); wallX(8.44, -12.8, -5.2, H, H + 0.6, RAIL, [], 0.08);
  wallX(9.94, -12.94, -5.15, H, H + 1, RAIL, [[-10, -8, H, H + 1]], 0.12);
  stairsX(-11.4, -10, -8, -1, H, STAIR);                                // up to the west catwalk, along the south wall
  // the shuttle: a body on four legs (crawl under it), a nose, wings, an engine
  solid(-11.5, -7.5, -1.6, 1.6, 1.3, 3.0, WHITE);
  solid(-7.5, -6.6, -1.1, 1.1, 1.5, 2.7, WHITE);
  solid(-7.3, -6.5, -0.8, 0.8, 2.1, 2.6, GLASS);                        // the cockpit window
  solid(-10.5, -8.5, -3.4, -1.6, 1.9, 2.2, HAZ); solid(-10.5, -8.5, 1.6, 3.4, 1.9, 2.2, HAZ);
  solid(-12.3, -11.5, -1, 1, 1.6, 2.7, DARK);
  for (const [x, z] of [[-11, -1.2], [-11, 1.2], [-8, -1.2], [-8, 1.2]]) solid(x - 0.15, x + 0.15, z - 0.15, z + 0.15, 0, 1.3, DARK);
  // crates stepping up onto its south wing
  crate(-9.5, -4.3, 0.8, 0.55, 0, HAZ); crate(-8.7, -4.3, 0.8, 1.1, 0, BOX); crate(-8.7, -3.5, 0.8, 1.65, 0, BOX);
  crate(-13.6, -7.5, 1, 1.2, 0, BOX); crate(-12.6, -8.3, 0.8, 0.6, 0, HAZ); crate(-7.5, 7, 1.1, 1.1, 0, BOX); crate(-6.5, -8.5, 1, 1, 0, BOX);
  crate(-13.6, 7.4, 1.2, 1.4, 0, BOX); crate(-12.4, 7.7, 0.8, 0.7, 0, HAZ);
  crate(-14.5, -3, 0.9, 0.9, H, HAZ); crate(-14.3, 4, 1, 1.2, H, BOX); crate(-11.6, 10.8, 0.9, 0.7, H, BOX);

  /* ----- the reactor hall: balconies north and south, two bridges past the core ----- */
  wallZ(-5, -11.6, 11.6, 0, WALL, WALLC, [[-1.6, 1.6, 0, 2.8], door(-8.5, -7), win(5, 7), door(7.2, 8.4, H), door(10.1, 11.5, H), win(-10, -8, H)]);
  solid(-4.85, 5, 6.5, 11.6, ROOF, H, SLAB); solid(-4.85, 5, -11.6, -6.5, ROOF, H, SLAB);
  solid(-3.4, -2.2, -6.5, 6.5, H - 0.25, H, SLAB); solid(2.2, 3.4, -6.5, 6.5, H - 0.25, H, SLAB); // bridges
  // stairs up to each balcony, turned the opposite ways
  const topS = stairsZ(-4.8, -3.6, 0, -1, H, STAIR), topN = stairsZ(3.6, 4.8, 0, 1, H, STAIR);
  solid(-4.8, -3.6, -6.5, topS, 0, H, STAIR); solid(3.6, 4.8, topN, 6.5, 0, H, STAIR);
  // balcony railings, open where the bridges and the stairs arrive
  wallX(6.44, -4.85, 5, H, H + 1, RAIL, [[-3.5, -2.1, H, H + 1], [2.1, 3.5, H, H + 1], [3.5, 4.9, H, H + 1]], 0.12);
  wallX(-6.44, -4.85, 5, H, H + 1, RAIL, [[-4.9, -3.5, H, H + 1], [-3.5, -2.1, H, H + 1], [2.1, 3.5, H, H + 1]], 0.12);
  // cover on the floor
  solid(-1, 1, -4.5, -4.2, 0, 1.0, PANEL); solid(-1, 1, 4.2, 4.5, 0, 1.0, PANEL);
  crate(-2, -8.5, 1, 1, 0, BOX); crate(2.4, 8.8, 1.1, 1.2, 0, HAZ); crate(3.6, -9.5, 0.9, 0.9, 0, BOX); crate(-3.6, 9, 0.9, 0.6, 0, BOX);
  crate(0, 9.5, 1, 1.1, H, BOX); crate(-1, -9.8, 1, 0.8, H, HAZ);
  // the core: a glowing column, round (a disc for the world), lit from inside
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, WALL + 1, 8), toon('#3d4a7a'));
  core.position.y = (WALL + 1) / 2; core.castShadow = core.receiveShadow = true; scene.add(core);
  const glow = new THREE.MeshBasicMaterial({ color: GLASS });
  for (const y of [0.9, 2.4, 4.6, 6.4]) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.08, 8, 24), glow); r.rotation.x = Math.PI / 2; r.position.y = y; scene.add(r); }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2, 0.3, 8), toon(PANEL)); base.position.y = 0.15; scene.add(base);

  /* ----- the east labs: four rooms off a corridor, an open deck above ----- */
  wallZ(5, -11.6, 11.6, 0, ROOF, WALLC, [door(-1, 1), door(7, 8.5), win(-7, -5)]);
  // the deck, with a hole over the stairs
  solid(5.15, 15.6, -11.6, 2.4, ROOF, H, SLAB); solid(5.15, 15.6, 3.85, 11.6, ROOF, H, SLAB);
  solid(5.15, 6.5, 2.4, 3.85, ROOF, H, SLAB); solid(11.45, 15.6, 2.4, 3.85, ROOF, H, SLAB);
  stairsX(2.4, 3.85, 6.5, 1, H, STAIR);
  wallZ(5.06, -6.5, 6.5, H, H + 1, RAIL, [[-1, 1, H, H + 1]], 0.12);   // railing over the hall, a gap to jump down
  wallX(2.34, 6.5, 11.45, H, H + 1, RAIL, [], 0.08); wallX(3.91, 6.5, 11.45, H, H + 1, RAIL, [], 0.08);
  // rooms
  wallX(-4, 5.15, 15.6, 0, ROOF, PANEL, [door(7, 8.5), door(12.5, 14)]);
  wallX(4, 5.15, 15.6, 0, ROOF, PANEL, [door(13, 14.5)]);
  wallZ(10, -11.6, -4, 0, ROOF, PANEL, [door(-8.5, -7), vent(-6, -5)]);
  wallZ(10, 4, 11.6, 0, ROOF, PANEL, [door(7, 8.5)]);
  solid(11.5, 14.5, -0.6, 0.6, 0, 1.0, WHITE);                          // a long counter down the corridor
  solid(12, 12.6, 6, 10.5, 0, 2.4, DARK); solid(14.2, 14.8, 6, 10.5, 0, 2.4, DARK); // server racks
  solid(6.5, 8.5, -9.5, -7.5, 0, 0.9, WHITE);                           // a lab table
  crate(13, -6.5, 1, 1.2, 0, HAZ); crate(7, 6, 0.9, 0.9, 0, BOX); crate(6.2, 10.5, 1, 1.4, 0, BOX);
  // upstairs: the antenna, crates, planters
  solid(12.4, 13.4, -1.5, -0.5, H, H + 4, DARK);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), toon(WHITE, { side: THREE.DoubleSide }));
  dish.position.set(12.9, H + 4.4, -1); dish.rotation.x = Math.PI; dish.rotation.z = 0.5; scene.add(dish);
  for (const z of [6, 9]) solid(8, 11, z - 0.4, z + 0.4, H, H + 0.8, '#8fbf5a');
  crate(9, -6, 1.1, 1.2, H, BOX); crate(14.5, -8.5, 1, 0.8, H, HAZ); crate(7, -2, 1, 1, H, BOX);
  solid(13.5, 13.8, 4, 8, H, H + 1.0, PANEL);

  // glowing strips along the top of the upper floors' edges, drawn only
  for (const x of [-12.94, 5.06]) solid(x - 0.05, x + 0.05, -11.6, 11.6, ROOF - 0.1, ROOF, GLASS, { ghost: true, noShadow: true, flat: true });

  /* ----- space: stars, a ringed planet, a white sun ----- */
  scene.background = new THREE.Color('#0a0c22');
  const pts = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 120, s = Math.sqrt(1 - u * u);
    pts.set([Math.cos(a) * s * r, Math.abs(u) * r * 0.9 + 4, Math.sin(a) * s * r], i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false })));
  const planet = new THREE.Group();
  planet.add(new THREE.Mesh(new THREE.SphereGeometry(22, 32, 20), toon('#e88fb4')));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(34, 2.5, 4, 64), toon('#f4b63f')); ring.rotation.x = 1.25; planet.add(ring);
  planet.position.set(70, 22, -80); scene.add(planet);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x303860, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.3);
  sun.position.set(-12, 22, 10); sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  const sc = sun.shadow.camera; sc.left = -18; sc.right = 18; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 50;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  for (const [x, y, z, c, p] of [[0, 4, 0, 0x7fe8ff, 16], [-10, 5, 0, 0xffc27a, 9], [11, 2.6, 0, 0xd0ffea, 8], [11, 6, 6, 0xff9fd0, 8], [0, 2.6, 9, 0x9fb8ff, 6], [0, 2.6, -9, 0x9fb8ff, 6]]) {
    const l = new THREE.PointLight(c, p, 14, 1.6); l.position.set(x, y, z); scene.add(l);
  }

  const spawns = [[-14.5, 0, -5], [-14.5, 0, 5], [-6.5, 0, 9], [-14.3, H, 0], [-9, H, 10.8], [0, 0, -9.5], [0, 0, 9.5],
    [-2, H, 9.5], [2, H, -9.5], [14.5, 0, -9], [13.4, 0, 9], [14.5, H, 1]];
  // health under the shuttle, in the labs and under a balcony; armor upstairs at both ends;
  // the rocket launcher on the shuttle's roof, the railgun in the middle of a bridge
  const pickups = [['health', -9.5, 0, 0], ['health', 13, 0, -8.6], ['health', -3, 0, 9], ['armor', 8, H, 8], ['armor', -14.3, H, -7],
    ['rocket', -9.5, 3.0, 0], ['railgun', 2.8, H, 0]];
  // jump pads: one in the hangar onto the shuttle's roof, two by the core up to the balconies
  const pads = [[-9.5, 0, 5, 0, 9, -3.2], [0, 0, -3, 0, 10, -3.1], [0, 0, 3, 0, 10, 3.1]];
  return { bounds: BOUNDS, boxes, discs: [{ x: 0, z: 0, r: 1.6 }], spawns, pickups, pads };
}
