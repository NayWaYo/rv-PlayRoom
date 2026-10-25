// Cartoon look helpers (toon materials, outlines, rounded boxes) and the small
// effects that make the room feel alive: glows, floating dust, confetti.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// three flat tones: shadow, mid, lit
export const toonGradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

export function toon(color, o = {}) {
  return new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: toonGradient }, o));
}
// flat things (floor, walls, cards) get no outline: the inverted-hull trick only reads on volumes
export function noOutline(m) { m.userData.outlineParameters = { visible: false }; return m; }
export function outline(m, thickness) { m.userData.outlineParameters = { thickness }; return m; }

const roundCache = new Map();
export function roundedBox(w, h, d) {
  const k = [w, h, d].map(v => v.toFixed(3)).join('x');
  let g = roundCache.get(k);
  if (!g) { g = new RoundedBoxGeometry(w, h, d, 2, Math.min(0.035, Math.min(w, h, d) * 0.3)); roundCache.set(k, g); }
  return g;
}

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(cv); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
export function makeGlow(color, size, opacity = 0.7) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

/* specks drifting in the lamp light */
export class Dust {
  constructor(scene, n = 70) {
    this.n = n; this.seed = [];
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 1.3;
      this.seed.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.95 + Math.random() * 1.2, s: 0.3 + Math.random() * 0.7 });
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.pts = new THREE.Points(this.geo, new THREE.PointsMaterial({ size: 0.03, map: glowTexture(), color: '#ffd59a', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(this.pts);
  }
  update(t) {
    const p = this.geo.attributes.position.array;
    this.seed.forEach((s, i) => {
      const y = 0.95 + ((s.y - 0.95 + t * 0.03 * s.s) % 1.2);
      p[i * 3] = s.x + Math.sin(t * 0.4 * s.s + i) * 0.08;
      p[i * 3 + 1] = y;
      p[i * 3 + 2] = s.z + Math.cos(t * 0.33 * s.s + i * 2) * 0.08;
    });
    this.geo.attributes.position.needsUpdate = true;
  }
}

/* paper confetti: one instanced mesh, cheap enough for phones */
export class Confetti {
  constructor(scene, max = 260) {
    this.max = max; this.parts = [];
    const mat = noOutline(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.035, 0.055), mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
    this.c = new THREE.Color();
    for (let i = 0; i < max; i++) { this.mesh.setColorAt(i, this.c.set('#ffffff')); this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0)); }
    scene.add(this.mesh);
  }
  burst(x, y, z, n, colors, power = 1) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= this.max) this.parts.shift();
      const a = Math.random() * Math.PI * 2, up = (2.2 + Math.random() * 1.8) * power, out = (0.6 + Math.random() * 1.4) * power;
      this.parts.push({
        x, y, z, vx: Math.cos(a) * out, vy: up, vz: Math.sin(a) * out,
        rx: Math.random() * 6, ry: Math.random() * 6, sx: (Math.random() - 0.5) * 14, sy: (Math.random() - 0.5) * 14,
        life: 3.5 + Math.random() * 1.5, col: colors[i % colors.length]
      });
    }
  }
  update(dt) {
    const ps = this.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      if (p.y > 0.01) {
        p.vy -= 3.2 * dt; p.vx *= 1 - dt * 1.4; p.vz *= 1 - dt * 1.4; p.vy = Math.max(p.vy, -0.9);
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.rx += p.sx * dt; p.ry += p.sy * dt;
      } else { p.y = 0.012; p.rx = -Math.PI / 2; }
    }
    for (let i = 0; i < this.max; i++) {
      const p = ps[i];
      if (!p) { this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0)); continue; }
      const k = Math.min(1, p.life / 0.6);
      this.q.setFromEuler(this.e.set(p.rx, p.ry, 0));
      this.m.compose(this.v.set(p.x, p.y, p.z), this.q, this.s.set(k, k, k));
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, this.c.set(p.col));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
