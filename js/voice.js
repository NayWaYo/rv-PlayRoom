// Proximity voice chat: each friend's microphone plays from their avatar's head,
// louder when you stand close, positioned in 3D with an HRTF panner.
import { audioCtx } from './sfx.js';

const voices = new Map();   // peer id -> { stream, el, panner, analyser, data, level }
let mic = null, micAnalyser = null, micData = null, micOn = false;

export function addVoice(peer, stream) {
  dropVoice(peer);
  // Chrome only feeds a remote WebRTC stream to Web Audio if a media element plays it too
  const el = new Audio(); el.srcObject = stream; el.muted = true; el.play().catch(() => {});
  voices.set(peer, { stream, el, panner: null, analyser: null, data: null, level: 0 });
}
export function dropVoice(peer) {
  const v = voices.get(peer); if (!v) return;
  try { v.src && v.src.disconnect(); v.panner && v.panner.disconnect(); } catch (e) {}
  v.el.srcObject = null;
  voices.delete(peer);
}
function wire(ctx, v) {
  v.src = ctx.createMediaStreamSource(v.stream);
  v.panner = new PannerNode(ctx, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 1.2, rolloffFactor: 1.3, maxDistance: 12 });
  v.analyser = ctx.createAnalyser(); v.analyser.fftSize = 512; v.data = new Uint8Array(v.analyser.fftSize);
  v.src.connect(v.analyser); v.src.connect(v.panner); v.panner.connect(ctx.destination);
}
function rms(an, data) {
  an.getByteTimeDomainData(data);
  let s = 0; for (let i = 0; i < data.length; i++) { const x = (data[i] - 128) / 128; s += x * x; }
  return Math.sqrt(s / data.length);
}
const setP = (p, x, y, z) => { if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); };
// each frame: move the listener with the camera, each voice with its avatar
export function updateVoices(camera, posOf) {
  const ctx = audioCtx();
  if (!ctx) return;
  const L = ctx.listener, c = camera.position;
  const f = camera.getWorldDirection(updateVoices.f || (updateVoices.f = c.clone()));
  if (L.positionX) {
    L.positionX.value = c.x; L.positionY.value = c.y; L.positionZ.value = c.z;
    L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
  } else { L.setPosition(c.x, c.y, c.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
  for (const [peer, v] of voices) {
    if (!v.panner) wire(ctx, v);
    const p = posOf(peer);
    if (p) setP(v.panner, p.x, p.y, p.z); else setP(v.panner, c.x, c.y + 50, c.z); // nobody to hear yet: far away
    const lv = rms(v.analyser, v.data);
    v.level = Math.max(lv, v.level * 0.85);
  }
  if (micAnalyser) micLevelValue = micOn ? Math.max(rms(micAnalyser, micData), micLevelValue * 0.85) : 0;
}
let micLevelValue = 0;
export const levelOf = peer => (voices.get(peer) || {}).level || 0;
export const micLevel = () => micLevelValue;
export const micActive = () => micOn;

// ask for the microphone once; later calls just mute or unmute it
export async function toggleMic() {
  if (!mic) {
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const ctx = audioCtx();
    if (ctx) { micAnalyser = ctx.createAnalyser(); micAnalyser.fftSize = 512; micData = new Uint8Array(512); ctx.createMediaStreamSource(mic).connect(micAnalyser); }
    micOn = true;
    return { stream: mic, on: true, fresh: true };
  }
  micOn = !micOn;
  mic.getAudioTracks().forEach(t => { t.enabled = micOn; });
  return { stream: mic, on: micOn, fresh: false };
}
