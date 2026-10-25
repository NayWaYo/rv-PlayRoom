// Procedural sound effects and a soft lounge loop, all synthesised with the
// Web Audio API: no audio files to host or license.
let ctx = null, sfxBus = null, musicBus = null, noiseBuf = null;
const prefs = { sfx: true, music: true };
let musicTimer = null, nextNote = 0, step = 0;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 4;
  comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(comp);
  musicBus = ctx.createGain(); musicBus.gain.value = 0;
  // a little echo gives the music some room
  const delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
  delay.delayTime.value = 0.36; fb.gain.value = 0.28; wet.gain.value = 0.22;
  musicBus.connect(comp); musicBus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyPrefs();
}

export function setPrefs(p) { Object.assign(prefs, p); applyPrefs(); }
export function getPrefs() { return Object.assign({}, prefs); }

function applyPrefs() {
  if (!ctx) return;
  sfxBus.gain.setTargetAtTime(prefs.sfx ? 0.9 : 0, ctx.currentTime, 0.05);
  musicBus.gain.setTargetAtTime(prefs.music ? 0.16 : 0, ctx.currentTime, 0.4);
  if (prefs.music && !musicTimer) startMusic();
  if (!prefs.music && musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}

/* ---------- primitives ---------- */
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function tone(freq, t, dur, o = {}) {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
  if (o.vibrato) {
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = o.vibrato; lg.gain.value = freq * 0.03;
    lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
  }
  const peak = o.gain ?? 0.3, a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out = g;
  if (o.lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lowpass; g.connect(f); out = f; }
  osc.connect(g); out.connect(o.dest || sfxBus);
  osc.start(t); osc.stop(t + dur + 0.02);
}
function noise(t, dur, o = {}) {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf;
  f.type = o.filter || 'bandpass'; f.frequency.setValueAtTime(o.freq || 2000, t); f.Q.value = o.q ?? 1;
  if (o.slideTo) f.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
  const peak = o.gain ?? 0.3;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
const ready = () => ctx && prefs.sfx && ctx.state === 'running';

/* ---------- effects ---------- */
export const sfx = {
  card() {
    if (!ready()) return; const t = ctx.currentTime;
    noise(t, 0.07, { freq: 3200, q: 0.8, gain: 0.35 });
    tone(190, t, 0.08, { gain: 0.25, slideTo: 110 });
  },
  swoosh() {
    if (!ready()) return; const t = ctx.currentTime;
    noise(t, 0.3, { freq: 500, slideTo: 2600, q: 1.2, gain: 0.22, attack: 0.08 });
  },
  dice() {
    if (!ready()) return; const t = ctx.currentTime;
    for (let i = 0, at = 0; i < 7; i++) {
      at += 0.06 + Math.random() * 0.12 + i * 0.015;
      noise(t + at, 0.04, { freq: 2600 + Math.random() * 1500, q: 2, gain: 0.3 - i * 0.03 });
      tone(700 + Math.random() * 500, t + at, 0.04, { type: 'triangle', gain: 0.08 });
    }
  },
  ding() {
    if (!ready()) return; const t = ctx.currentTime;
    tone(880, t, 0.6, { gain: 0.18 }); tone(1320, t + 0.09, 0.7, { gain: 0.14 });
  },
  pop() {
    if (!ready()) return; const t = ctx.currentTime;
    tone(420, t, 0.09, { gain: 0.16, slideTo: 900 });
  },
  poof() {
    if (!ready()) return; const t = ctx.currentTime;
    noise(t, 0.25, { filter: 'lowpass', freq: 900, slideTo: 200, gain: 0.35, attack: 0.02 });
  },
  step() {
    if (!ready()) return; const t = ctx.currentTime;
    noise(t, 0.06, { filter: 'lowpass', freq: 420, gain: 0.12 });
  },
  shuffle() {
    if (!ready()) return; const t = ctx.currentTime;
    for (let i = 0; i < 9; i++) noise(t + i * 0.035, 0.05, { freq: 2400 + i * 120, q: 0.7, gain: 0.16 });
  },
  chime() {
    if (!ready()) return; const t = ctx.currentTime;
    [72, 76, 79, 84].forEach((m, i) => tone(mtof(m), t + i * 0.11, 0.9, { type: 'triangle', gain: 0.14 }));
  },
  fanfare() {
    if (!ready()) return; const t = ctx.currentTime;
    [67, 72, 76, 79].forEach((m, i) => tone(mtof(m), t + i * 0.1, 0.25, { type: 'square', gain: 0.07, lowpass: 2400 }));
    [72, 76, 79, 84].forEach(m => tone(mtof(m), t + 0.45, 1.3, { type: 'sawtooth', gain: 0.06, lowpass: 2000, attack: 0.03 }));
    noise(t + 0.45, 0.5, { freq: 6000, q: 0.5, gain: 0.08 });
  },
  wahwah() {
    // the sad trombone: someone just took the Papayoo
    if (!ready()) return; const t = ctx.currentTime;
    [55, 54, 53].forEach((m, i) => tone(mtof(m), t + i * 0.32, 0.3, { type: 'sawtooth', gain: 0.12, lowpass: 1100, attack: 0.03 }));
    tone(mtof(52), t + 0.96, 0.9, { type: 'sawtooth', gain: 0.12, lowpass: 1000, attack: 0.03, vibrato: 6 });
  },
  confetti() {
    if (!ready()) return; const t = ctx.currentTime;
    noise(t, 0.12, { freq: 1800, q: 0.6, gain: 0.3 });
    tone(300, t, 0.12, { gain: 0.2, slideTo: 1200 });
  }
};

/* ---------- music: a slow, swung lounge loop ---------- */
const BEAT = 60 / 82;
const CHORDS = [[53, 57, 60, 64], [53, 55, 59, 62], [52, 55, 59, 60], [52, 55, 57, 60]]; // Dm9 G9 Cmaj7 Am7
const BASS = [38, 43, 36, 45];
const SCALE = [62, 64, 67, 69, 72, 74, 76];
function keys(m, t, dur, gain) {
  tone(mtof(m), t, dur, { gain, dest: musicBus, attack: 0.01, lowpass: 1800 });
  tone(mtof(m) * 2, t, dur * 0.5, { gain: gain * 0.25, dest: musicBus, attack: 0.01 });
}
function scheduleEighth(i, t) {
  const bar = Math.floor(i / 8) % 4, e = i % 8;
  const swing = e % 2 ? BEAT * 0.17 : 0, at = t + swing;
  if (e === 0 || e === 3) CHORDS[bar].forEach(m => keys(m, at, e === 0 ? 1.8 : 0.9, 0.05));
  if (e === 0) tone(mtof(BASS[bar]), at, BEAT * 1.8, { type: 'triangle', gain: 0.22, dest: musicBus, attack: 0.02 });
  if (e === 4) tone(mtof(BASS[bar] + 7), at, BEAT * 1.6, { type: 'triangle', gain: 0.16, dest: musicBus, attack: 0.02 });
  if (e % 2 === 1 || e === 4) noise(at, 0.05, { freq: 7000, q: 0.6, gain: e === 4 ? 0.05 : 0.025, dest: musicBus });
  if (e % 2 === 0 && Math.random() < 0.28) keys(SCALE[Math.floor(Math.random() * SCALE.length)] + 12, at, 0.7, 0.035);
}
function startMusic() {
  nextNote = ctx.currentTime + 0.1; step = 0;
  musicTimer = setInterval(() => {
    if (ctx.state !== 'running') return;
    while (nextNote < ctx.currentTime + 0.2) {
      scheduleEighth(step++, nextNote);
      nextNote += BEAT / 2;
    }
    if (nextNote < ctx.currentTime) nextNote = ctx.currentTime + 0.05;
  }, 50);
}
