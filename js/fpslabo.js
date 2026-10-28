// The fifth battle map, "le Labo", drawn from the players' own plan. A closed central corridor
// splits it in two, shut at both ends by automatic sliding doors: the deadliest line of fire.
// Over it runs a low ventilation duct you cross crouching, reached from the offices' heights on
// the Rouges' side and by crates on the Bleus' side. North of the corridor, each team's spawn
// with a back corridor: offices for the Rouges (a staircase up to the heights), labs for the
// Bleus (raised, a staircase down). South, the low flanks: a loading dock outside, an inner
// courtyard, and a generator room full of blind corners.
import * as THREE from 'three';
import { toon } from './fx.js';
import { makeKit } from './fpsmap.js';

const H = 3.3;      // the heights: the duct's floor, the offices' mezzanine
const ROOF = 3.0;   // ceiling of the corridor and the rooms under the heights
const WALL = 7;     // outer walls
const DOCK = 1.1;   // the loading dock, just low enough to jump onto
const LAB = 1.0;    // the labs' raised floor
export const BOUNDS = { x0: -15.6, x1: 15.6, z0: -11.6, z1: 11.6 };

export function buildMap(scene) {
  const { boxes, solid, wallX, wallZ, crate, door, stairsX, stairsZ, floor } = makeKit(scene);

  // colours
  const OUT = '#454e6e', METAL = '#8a94ad', DUCT = '#5d6680', SLAB = '#6c7aa6', RAIL = '#f4b63f', STAIR = '#8f73e3';
  const WOOD = '#b07a45', BEIGE = '#d9cbb0', LABW = '#e8ecf5', LABF = '#bfd7e6', TEAL = '#4fb3a9', GLASS = '#7fe8ff';
  const CONC = '#9a8f86', GEN = '#f08a3c', DARK = '#3a3340', PIPE = '#5b9bd5', PLANT = '#8fbf5a', POT = '#c9483a', RED = '#ea6a4f';

  floor(32, 24, '#3d4560', '#444d6b');

  // outer walls
  wallX(-11.8, -16, 16, 0, WALL, OUT, [], 0.4); wallX(11.8, -16, 16, 0, WALL, OUT, [], 0.4);
  wallZ(-15.8, -12, 12, 0, WALL, OUT, [], 0.4); wallZ(15.8, -12, 12, 0, WALL, OUT, [], 0.4);

  /* ----- the central corridor, along x, sliding doors at both ends ----- */
  wallX(-1.65, -10.35, 10.35, 0, ROOF, METAL, [], 0.3);
  wallX(1.65, -10.35, 10.35, 0, ROOF, METAL, [], 0.3);
  solid(-15.6, 15.6, -1.8, 1.8, ROOF, H, SLAB);                          // its roof, the duct's floor, and the two duct-end platforms
  solid(-4.3, -3.9, -1.5, -0.4, 0, 1.0, RED); solid(3.9, 4.3, 0.4, 1.5, 0, 1.0, RED); // two barricades, nothing else to hide behind
  for (const s of [-1, 1]) {
    const X = s * 10.5;
    // the frame round each door
    solid(X - 0.15, X + 0.15, -1.8, -1.2, 0, ROOF, METAL); solid(X - 0.15, X + 0.15, 1.2, 1.8, 0, ROOF, METAL);
    solid(X - 0.15, X + 0.15, -1.2, 1.2, 2.6, ROOF, METAL);
    solid(X - 0.15, X + 0.15, 1.8, 3.5, 0, WALL, BEIGE);                  // between the end of the corridor and the courtyard
  }
  // the sliding doors: two panels each, sliding apart into the walls when anyone comes near
  const doors = [];
  for (const s of [-1, 1]) {
    const X = s * 10.5, panels = [];
    for (const [z0, z1, dz] of [[-1.2, 0, -1.2], [0, 1.2, 1.2]]) {
      const m = solid(X - 0.08, X + 0.08, z0, z1, 0, 2.6, METAL);
      const box = boxes[boxes.length - 1]; box.moving = true;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, z1 - z0), toon(RAIL));
      stripe.position.set(X, 1.3, (z0 + z1) / 2); scene.add(stripe);
      panels.push({ box, objs: [m, stripe], dx: 0, dz });
    }
    doors.push({ x: X, z: 0, r: 2.6, panels });
  }

  /* ----- the vents: a low duct on the corridor's roof, crossed crouching ----- */
  // grilles in its sides, to look down on the spawns and the courtyard
  const grille = (a, b) => [a, b, 3.65, 4.25];
  wallX(-1.65, -12.6, 12.6, H, 4.6, DUCT, [grille(-7, -6), grille(-2.5, -1.5), grille(1.5, 2.5), grille(6, 7)], 0.3);
  wallX(1.65, -12.6, 12.6, H, 4.6, DUCT, [grille(-4.5, -3.5), grille(3.5, 4.5)], 0.3);
  solid(-12.6, 12.6, -1.8, 1.8, 4.6, 4.8, DUCT);
  solid(-9, 9, 1.0, 1.5, H, 3.75, PIPE);                                 // pipes along one side

  /* ----- north: the two spawns, back to back, a back corridor behind each ----- */
  wallZ(0, -11.6, -1.8, 0, WALL, BEIGE);                                 // no way through between them
  // the Rouges' offices (west), floor at 0, a mezzanine up high along the back wall
  wallX(-9.8, -10.35, -0.15, 0, WALL, BEIGE, [door(-6, -4.8)], 0.3);
  wallZ(-10.5, -9.8, -1.8, 0, WALL, BEIGE, [door(-9.6, -8.4, H), door(-6.5, -5.2)]);
  solid(-10.35, -5.5, -9.65, -7.6, ROOF, H, SLAB);
  wallX(-7.54, -10.35, -5.5, H, H + 1, RAIL, [], 0.12);
  crate(-6.5, -8.7, 0.8, 0.8, H, WOOD);
  for (const [x0, x1, z0, z1] of [[-9, -7.4, -5.4, -4.6], [-4.5, -2.9, -5.4, -4.6], [-7, -5.4, -3, -2.4]]) solid(x0, x1, z0, z1, 0, 0.8, WOOD);
  crate(-1, -9, 0.8, 1.6, 0, METAL); crate(-9.6, -2.4, 0.8, 1.6, 0, METAL);
  // the Bleus' labs (east), on a raised floor
  solid(0.15, 10.35, -9.65, -1.8, 0, LAB, LABF);
  wallX(-9.8, 0.15, 10.35, 0, WALL, LABW, [door(5, 6.2, LAB)], 0.3);
  wallZ(10.5, -9.8, -1.8, 0, WALL, LABW, [door(-7, -5.5, LAB)]);
  for (const [x0, x1] of [[2, 5], [6, 9]]) { solid(x0, x1, -6.2, -5.4, LAB, LAB + 0.9, LABW); solid(x0 + 0.3, x0 + 0.7, -6, -5.6, LAB + 0.9, LAB + 1.3, GLASS); }
  crate(9.4, -9, 0.8, 1.6, LAB, TEAL); crate(8.4, -9, 0.8, 1.2, LAB, TEAL); crate(1, -3, 0.9, 1.0, LAB, LABW);
  // the back corridors: the Rouges' on the floor, the Bleus' raised like their labs
  crate(-8, -10.8, 0.8, 0.8, 0, WOOD); crate(-3, -10.9, 0.7, 1.1, 0, METAL);
  solid(0.15, 15.6, -11.6, -9.8, 0, LAB, LABF);
  crate(4, -10.8, 0.8, 0.9, LAB, TEAL);

  /* ----- the stair blocks at the corridor's ends ----- */
  // the Rouges' side: a staircase up to a landing, the door to the mezzanine, a catwalk to the vents
  // (the stairs keep clear of the wall, so the ground-floor door into the offices stays open)
  stairsZ(-13.8, -12.4, -2.0, -1, H, STAIR);
  solid(-14.2, -10.65, -9.8, -6.95, ROOF, H, SLAB);
  solid(-15.6, -14.2, -9.8, -1.8, ROOF, H, SLAB);
  wallZ(-14.14, -6.95, -1.8, H, H + 1, RAIL, [], 0.1);
  wallX(-6.89, -12.4, -10.65, H, H + 1, RAIL, [], 0.1);
  // the Bleus' side: a short staircase down from the labs' level, crates up to the vents
  stairsZ(10.9, 12.3, -2.0, -1, LAB, STAIR, 4, 0.5);
  solid(10.65, 12.5, -9.8, -4, 0, LAB, LABF);
  crate(14.8, -4.8, 0.9, 0.85, 0, WOOD); crate(14.8, -3.9, 0.9, 1.7, 0, WOOD); crate(14.8, -3.0, 0.9, 2.55, 0, WOOD);
  // a little cover in front of each corridor door
  crate(-13, 2.8, 0.9, 1.0, 0, METAL); crate(13, 2.8, 0.9, 1.0, 0, METAL);

  /* ----- south: the low flanks ----- */
  // the inner courtyard, open to the sky
  wallZ(-9, 3.5, 11.6, 0, 2.2, CONC, [door(5, 6.5), door(9, 10.5)]);
  wallZ(9, 3.5, 11.6, 0, H, CONC, [door(5, 6.5), door(9, 10.5)]);
  for (const s of [-1, 1]) solid(s > 0 ? 9 : -10.35, s > 0 ? 10.35 : -9, 3.35, 3.65, 0, s > 0 ? H : 2.2, CONC);
  solid(-1.2, 1.2, 6.5, 8.5, 0, 0.5, TEAL);                              // a basin
  for (const x of [-5, 5]) { solid(x - 1, x + 1, 5, 6, 0, 0.7, POT); crate(x, 5.5, 0.9, 1.0, 0.7, PLANT); }
  for (const x of [-5, 5]) solid(x - 1, x + 1, 9.6, 10.1, 0, 0.45, WOOD); // benches
  crate(-7.5, 3, 0.8, 0.9, 0, CONC); crate(7.5, 3, 0.8, 0.9, 0, CONC);
  // outside access (west): a loading dock, steps up, crates, a forklift
  solid(-15.6, -12, 3.5, 11.6, 0, DOCK, CONC);
  stairsX(6, 8, -10.8, -1, DOCK, STAIR, 5, 0.24);
  crate(-14, 5, 1, 1.2, DOCK, WOOD); crate(-13, 9.5, 1.2, 1, DOCK, WOOD); crate(-10.5, 10, 1.1, 0.5, 0, WOOD);
  solid(-11, -10, 4.2, 5.2, 0, 1.4, RAIL); solid(-11, -10.8, 4.2, 5.2, 1.4, 2.2, DARK);
  // the generator room (east), roofed: generators, server racks, a pipe to crawl under
  solid(9.15, 15.6, 3.65, 11.6, ROOF, H, SLAB);
  for (const [z0, z1] of [[5, 6.6], [8.6, 10.2]]) { solid(10.5, 12.5, z0, z1, 0, 2.0, GEN); solid(10.8, 12.2, z0 + 0.3, z1 - 0.3, 2.0, 2.4, DARK); }
  for (const [z0, z1] of [[4.2, 7], [8.2, 11.2]]) solid(14.2, 15.4, z0, z1, 0, 2.3, DARK);
  solid(9.15, 14.2, 7.2, 7.6, 1.2, 1.5, PIPE);

  /* ----- light: night outside, office lamps, lab lights, the generators' glow ----- */
  scene.background = new THREE.Color('#12162b');
  scene.add(new THREE.HemisphereLight(0xe8eeff, 0x3a3a60, 1.5));
  const moon = new THREE.DirectionalLight(0xc8d4ff, 1.2);
  moon.position.set(-8, 22, 12); moon.target.position.set(0, 0, 0);
  moon.castShadow = true;
  const sc = moon.shadow.camera; sc.left = -18; sc.right = 18; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 50;
  moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.03;
  scene.add(moon, moon.target);
  for (const [x, y, z, c, p] of [[-5, 2.8, -5, 0xffd08a, 9], [5, 3.6, -5, 0xbfefff, 9], [-6, 2.6, 0, 0xf0f4ff, 6], [6, 2.6, 0, 0xf0f4ff, 6],
    [0, 4.3, 0, 0x9fb8ff, 4], [0, 5, 7, 0xb8c4ff, 7], [12.5, 2.6, 7.5, 0xff9a4a, 9], [-13, 4, 7, 0xffc27a, 6], [-13, 2.6, -5, 0xffd08a, 5], [13, 2.6, -5, 0xbfefff, 5]]) {
    const l = new THREE.PointLight(c, p, 14, 1.6); l.position.set(x, y, z); scene.add(l);
  }

  // Rouges in the offices (west), Bleus in the labs (east)
  const spawns = [[-9, 0, -3], [-2, 0, -8.5], [-5, 0, -7], [-13, 0, -10.8], [-8, H, -8.8], [-14.8, 0, 2.8], [-13, DOCK, 7.2],
    [9, LAB, -3], [2, LAB, -8.5], [5, LAB, -7.8], [13, LAB, -10.8], [11.5, LAB, -7], [14.8, 0, 2.8], [13.3, 0, 10.8]];
  // health in the courtyard, on the dock, among the generators; armor in the vents and up on each side;
  // the rocket launcher among the generators, the railgun in the middle of the corridor
  const pickups = [['health', 0, 0, 4.5], ['health', -14.6, DOCK, 7.2], ['health', 9.8, 0, 4.4], ['armor', 0, H, -0.6], ['armor', -12.4, H, -8.3],
    ['armor', 14, H, 0], ['rocket', 13.3, 0, 7.4], ['railgun', 0, 0, 0]];
  return { bounds: BOUNDS, boxes, spawns, pickups, doors };
}
