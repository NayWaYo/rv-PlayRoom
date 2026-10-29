// Things to throw at your friends: paper balls (as many as you like, they fade
// away) and a few cushions you pick up and throw. Every browser runs the same
// small physics from the same throw, so nobody has to stream positions.
import * as THREE from 'three';
import { toon, roundedBox } from './fx.js';

const G = 9.8, HALF = 5.85, CEIL = 3.15;
const paperGeo = new THREE.IcosahedronGeometry(0.07, 0);
const paperMat = toon('#fbf6ea');
const CUSHIONS = [
  { id: 0, col: '#f0b84f', pos: [4.0, 0.47, -1.55] }, // on the pouf: the sofa's places stay free to sit in
  { id: 1, col: '#ea6a4f', pos: [4.2, 0.07, 1.5] },
  { id: 2, col: '#4fb3a9', pos: [-5.0, 0.07, 1.4] },  // under the window, clear of the blackjack table
  { id: 3, col: '#e88fb4', pos: [1.5, 0.07, 5.2] }    // by the door, clear of the roulette table
];

export class Toys {
  constructor(scene, { tableR, tableY, tables = [], blocks = [], onHit, onBounce }) {
    this.tables = tables; // other round table tops: { x, z, r, y }
    this.scene = scene; this.tableR = tableR; this.tableY = tableY; this.blocks = blocks;
    this.onHit = onHit; this.onBounce = onBounce;
    this.balls = [];
    this.cushions = CUSHIONS.map(c => {
      const mesh = new THREE.Mesh(roundedBox(0.42, 0.14, 0.42), toon(c.col));
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.set(...c.pos); scene.add(mesh);
      return { id: c.id, mesh, r: 0.17, v: new THREE.Vector3(), held: null, moving: false, by: null, t: 0, spin: new THREE.Vector3() };
    });
  }
  // a fresh paper ball from (p) with velocity (v), thrown by player key `by`
  throwBall(p, v, by) {
    const mesh = new THREE.Mesh(paperGeo, paperMat);
    mesh.castShadow = true; mesh.position.set(p[0], p[1], p[2]);
    this.scene.add(mesh);
    this.balls.push({ mesh, r: 0.07, v: new THREE.Vector3(v[0], v[1], v[2]), moving: true, by, t: 0, life: 7, spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, 0), kind: 'paper' });
    if (this.balls.length > 24) this.removeBall(this.balls[0]);
  }
  removeBall(b) { this.scene.remove(b.mesh); this.balls.splice(this.balls.indexOf(b), 1); }
  hold(id, by) { const c = this.cushions[id]; if (!c) return; c.held = by; c.moving = false; }
  throwCushion(id, p, v, by) {
    const c = this.cushions[id]; if (!c) return;
    c.held = null; c.mesh.position.set(p[0], p[1], p[2]); c.v.set(v[0], v[1], v[2]);
    c.moving = true; c.by = by; c.t = 0; c.kind = 'cushion';
    c.spin.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
  }
  // the cushion nearest to (x, z) within reach and not in anyone's hands
  nearestCushion(x, z, reach = 1.6) {
    let best = null, bd = reach;
    for (const c of this.cushions) {
      if (c.held || c.moving) continue;
      const d = Math.hypot(c.mesh.position.x - x, c.mesh.position.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  // targets: [{ key, x, z, y0, y1 }] people who can be hit (avatars and you)
  update(dt, targets, holdPos) {
    const steps = Math.max(1, Math.ceil(dt / 0.008)), h = dt / steps;
    for (const b of [...this.balls]) {
      for (let i = 0; i < steps; i++) this.step(b, h, targets);
      b.life -= dt;
      if (b.life < 0.6) b.mesh.scale.setScalar(Math.max(0.01, b.life / 0.6));
      if (b.life <= 0) this.removeBall(b);
    }
    for (const c of this.cushions) {
      if (c.held) {
        const p = holdPos(c.held);
        if (p) { c.mesh.position.lerp(p.pos, 1 - Math.exp(-dt * 20)); c.mesh.rotation.set(0.2, p.yaw, 0); }
        continue;
      }
      if (c.moving) for (let i = 0; i < steps; i++) this.step(c, h, targets);
    }
  }
  step(o, dt, targets) {
    if (!o.moving) return;
    const p = o.mesh.position, v = o.v, r = o.r;
    o.t += dt;
    v.y -= G * dt;
    v.multiplyScalar(1 - dt * 0.15);
    p.addScaledVector(v, dt);
    o.mesh.rotation.x += o.spin.x * dt; o.mesh.rotation.y += o.spin.y * dt;
    let bounced = false;
    // floor, ceiling, walls
    if (p.y < r) { p.y = r; if (v.y < 0) { bounced = v.y < -1; v.y = -v.y * 0.35; v.x *= 0.7; v.z *= 0.7; o.spin.multiplyScalar(0.6); } }
    if (p.y > CEIL - r) { p.y = CEIL - r; v.y = -Math.abs(v.y) * 0.4; bounced = true; }
    for (const ax of ['x', 'z']) {
      if (p[ax] > HALF - r) { p[ax] = HALF - r; v[ax] = -Math.abs(v[ax]) * 0.5; bounced = true; }
      if (p[ax] < -HALF + r) { p[ax] = -HALF + r; v[ax] = Math.abs(v[ax]) * 0.5; bounced = true; }
    }
    // table top
    const d = Math.hypot(p.x, p.z);
    if (d < this.tableR && p.y - r < this.tableY && p.y > this.tableY - 0.15 && v.y < 0) {
      p.y = this.tableY + r; bounced = v.y < -1; v.y = -v.y * 0.35; v.x *= 0.75; v.z *= 0.75;
    }
    // furniture: land on top, bounce off the sides
    let rest = p.y <= r + 0.001 || (p.y <= this.tableY + r + 0.001 && d < this.tableR);
    for (const T of this.tables) {
      const dt2 = Math.hypot(p.x - T.x, p.z - T.z);
      if (dt2 < T.r && p.y - r < T.y && p.y > T.y - 0.15 && v.y < 0) { p.y = T.y + r; bounced = v.y < -1; v.y = -v.y * 0.35; v.x *= 0.75; v.z *= 0.75; }
      if (dt2 < T.r && p.y <= T.y + r + 0.001) rest = true;
    }
    for (const b of this.blocks) {
      if (p.x < b.x0 - r || p.x > b.x1 + r || p.z < b.z0 - r || p.z > b.z1 + r || p.y - r > b.top) continue;
      if (p.y > b.top - 0.12) {
        p.y = b.top + r;
        if (v.y < 0) { bounced = v.y < -1; v.y = -v.y * 0.35; v.x *= 0.75; v.z *= 0.75; }
        rest = true;
      } else { // push out through the nearest side
        const out = [[p.x - (b.x0 - r), 'x', b.x0 - r, -1], [b.x1 + r - p.x, 'x', b.x1 + r, 1], [p.z - (b.z0 - r), 'z', b.z0 - r, -1], [b.z1 + r - p.z, 'z', b.z1 + r, 1]].sort((m, n) => m[0] - n[0])[0];
        p[out[1]] = out[2]; v[out[1]] = out[3] * Math.abs(v[out[1]]) * 0.5; bounced = true;
      }
    }
    // people
    const speed = v.length();
    if (speed > 1.6) for (const t of targets) {
      if (t.key === o.by && o.t < 0.4) continue; // not your own hand
      if (p.y < t.y0 - r || p.y > t.y1 + r) continue;
      const dx = p.x - t.x, dz = p.z - t.z, dd = Math.hypot(dx, dz);
      if (dd < 0.3 + r && o.lastHit !== t.key) {
        o.lastHit = t.key;
        v.x = dx / (dd || 1) * speed * 0.35; v.z = dz / (dd || 1) * speed * 0.35; v.y = Math.abs(v.y) * 0.3 + 0.8;
        this.onHit(t, o);
        break;
      }
    }
    if (bounced && speed > 1.2) this.onBounce(o, speed);
    if (rest && Math.hypot(v.x, v.z) < 0.08 && Math.abs(v.y) < 0.3) { v.set(0, 0, 0); o.moving = false; o.lastHit = null; }
  }
}
