import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as SkeletonUtilsClone } from 'three/addons/utils/SkeletonUtils.js';

// ============================================================
//  SOUND SYSTEM (Web Audio API - procedural)
// ============================================================
class SoundSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.bgmPlaying = false;
    this.bgmNodes = [];
    this.enabled = true;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.25;
      this.bgmGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.6;
      this.sfxGain.connect(this.masterGain);

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not available');
      this.enabled = false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Procedural BGM - simple arpeggiated synth loop
  startBGM(type = 'menu') {
    if (!this.enabled || !this.ctx) return;
    this.stopBGM();
    this.bgmPlaying = true;

    const notes = type === 'menu'
      ? [261.63, 329.63, 392.00, 523.25, 392.00, 329.63]  // C E G C' G E
      : [293.66, 349.23, 440.00, 523.25, 440.00, 349.23];  // D F A C' A F

    const tempo = type === 'menu' ? 0.35 : 0.2;
    let noteIndex = 0;

    const playNote = () => {
      if (!this.bgmPlaying || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type === 'menu' ? 'sine' : 'sawtooth';
      osc.frequency.value = notes[noteIndex % notes.length];

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = type === 'menu' ? 1200 : 2000;

      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + tempo * 0.9);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + tempo);

      noteIndex++;
      this.bgmTimer = setTimeout(playNote, tempo * 1000);
    };
    playNote();
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmTimer) clearTimeout(this.bgmTimer);
  }

  // SFX: coin collect
  playCoin() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  // SFX: ally pickup
  playAllyPickup() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(784, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  // SFX: damage / hit obstacle
  playHit() {
    if (!this.enabled || !this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start();
    noise.stop(this.ctx.currentTime + 0.15);
  }

  // SFX: weapon pickup
  playWeapon() {
    if (!this.enabled || !this.ctx) return;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 440 * (1 + i * 0.5);
      gain.gain.setValueAtTime(0, this.ctx.currentTime + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.08 + 0.15);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(this.ctx.currentTime + i * 0.08);
      osc.stop(this.ctx.currentTime + i * 0.08 + 0.15);
    }
  }

  // SFX: gate pass
  playGate() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(880, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  // SFX: boss hit
  playBossHit() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  // SFX: victory fanfare
  playVictory() {
    if (!this.enabled || !this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, this.ctx.currentTime + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + i * 0.15 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.15 + 0.5);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(this.ctx.currentTime + i * 0.15);
      osc.stop(this.ctx.currentTime + i * 0.15 + 0.5);
    });
  }

  // SFX: fail
  playFail() {
    if (!this.enabled || !this.ctx) return;
    const notes = [392, 349.23, 293.66, 220];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, this.ctx.currentTime + i * 0.2);
      gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + i * 0.2 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.2 + 0.4);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(this.ctx.currentTime + i * 0.2);
      osc.stop(this.ctx.currentTime + i * 0.2 + 0.4);
    });
  }

  // SFX: button click
  playClick() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  // SFX: upgrade purchase
  playUpgrade() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  // SFX: shooting bullet
  playShoot() {
    if (!this.enabled || !this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start();
    noise.stop(this.ctx.currentTime + 0.08);
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.masterGain) this.masterGain.gain.value = this.enabled ? 0.5 : 0;
    if (!this.enabled) this.stopBGM();
    return this.enabled;
  }
}

const sound = new SoundSystem();

// ============================================================
//  SCREEN SHAKE SYSTEM
// ============================================================
class ScreenShake {
  constructor() {
    this.intensity = 0;
    this.decay = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }
  trigger(intensity = 0.3, duration = 0.3) {
    this.intensity = intensity;
    this.decay = intensity / duration;
  }
  update(dt) {
    if (this.intensity > 0) {
      this.offsetX = (Math.random() - 0.5) * this.intensity * 2;
      this.offsetY = (Math.random() - 0.5) * this.intensity * 2;
      this.intensity = Math.max(0, this.intensity - this.decay * dt);
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
    }
  }
}

const screenShake = new ScreenShake();

// ============================================================
//  MODEL CACHE - Soldier.glb
// ============================================================
let soldierModel = null;
let soldierAnimations = null;
// Try multiple CDN sources for CORS compatibility
const MODEL_URLS = [
  'https://threejs.org/examples/models/gltf/Soldier.glb',
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Soldier.glb',
];

const gltfLoader = new GLTFLoader();

// Load model in background - game starts immediately, model loads async
function loadSoldierModelBackground() {
  let urlIndex = 0;

  function tryNext() {
    if (urlIndex >= MODEL_URLS.length) {
      console.warn('All model URLs failed - using fallback characters');
      return;
    }
    const url = MODEL_URLS[urlIndex];
    console.log('Trying model from:', url);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.timeout = 6000;

    xhr.onload = function() {
      if (xhr.status === 200 && xhr.response) {
        try {
          gltfLoader.parse(xhr.response, '', function(gltf) {
            soldierModel = gltf.scene;
            soldierAnimations = gltf.animations;
            console.log('Model loaded! Animations:', gltf.animations.map(function(a) { return a.name; }));
          }, function(err) {
            console.warn('Parse error:', err);
            urlIndex++;
            tryNext();
          });
        } catch (e) {
          console.warn('Parse exception:', e);
          urlIndex++;
          tryNext();
        }
      } else {
        console.warn('HTTP', xhr.status, 'from', url);
        urlIndex++;
        tryNext();
      }
    };

    xhr.onerror = function() {
      console.warn('Network error from', url);
      urlIndex++;
      tryNext();
    };

    xhr.ontimeout = function() {
      console.warn('Timeout from', url);
      urlIndex++;
      tryNext();
    };

    xhr.send();
  }

  tryNext();
}

function cloneSoldier(scale = 1.0) {
  if (!soldierModel) return null;
  try {
    const clone = SkeletonUtilsClone(soldierModel);
    clone.scale.set(scale, scale, scale);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material = child.material.clone();
      }
    });
    return clone;
  } catch (e) {
    console.warn('cloneSoldier failed:', e);
    return null;
  }
}

function createSoldierMixer(model) {
  if (!soldierAnimations || !model) return null;
  const mixer = new THREE.AnimationMixer(model);
  return mixer;
}

function playAnimation(mixer, animName) {
  if (!mixer || !soldierAnimations) return null;
  const animMap = { idle: 0, run: 1, walk: 3 };
  const idx = animMap[animName];
  if (idx === undefined || !soldierAnimations[idx]) return null;
  const action = mixer.clipAction(soldierAnimations[idx]);
  action.play();
  return action;
}

// ============================================================
//  STAGE DATA (Korean names)
// ============================================================
const STAGES = [
  {
    id: 1, name: "첫 번째 도전", length: 100,
    enemies: [
      { type: "red_box", x: 0, z: 25, damage: 3 },
      { type: "red_box", x: -2, z: 40, damage: 5 },
    ],
    collectibles: [
      { type: "ally", x: 1, z: 10 }, { type: "ally", x: -1, z: 15 },
      { type: "ally", x: 0, z: 20 }, { type: "ally", x: 2, z: 30 },
      { type: "ally", x: -1, z: 35 },
      { type: "coin", x: 1, z: 18, value: 10 }, { type: "coin", x: -2, z: 28, value: 10 },
      { type: "weapon", x: 0, z: 45, weapon: "gun" },
    ],
    gates: [
      { type: "add", z: 55, value: 5, lane: -1 },
      { type: "multiply", z: 55, value: 2, lane: 1.5 },
    ],
    boss: { type: "zombie_boss", nameKo: "좀비 대장", z: 95, health: 200 },
    rewards: { coins: 100 }
  },
  {
    id: 2, name: "좀비 습격", length: 120,
    enemies: [
      { type: "red_box", x: 1, z: 25, damage: 5 },
      { type: "red_box", x: -1, z: 35, damage: 8 },
      { type: "red_box", x: 0, z: 50, damage: 6 },
      { type: "zombie", x: 2, z: 55, health: 30 },
      { type: "zombie", x: -2, z: 60, health: 30 },
    ],
    collectibles: [
      { type: "ally", x: 0, z: 10 }, { type: "ally", x: 1, z: 15 },
      { type: "ally", x: -1, z: 20 }, { type: "ally", x: 0, z: 30 },
      { type: "ally", x: 2, z: 40 }, { type: "ally", x: -2, z: 45 },
      { type: "coin", x: 0, z: 22, value: 10 }, { type: "coin", x: 1, z: 42, value: 15 },
      { type: "weapon", x: -1, z: 65, weapon: "shotgun" },
    ],
    gates: [
      { type: "multiply", z: 75, value: 2, lane: -1.5 },
      { type: "add", z: 75, value: 8, lane: 1.5 },
    ],
    boss: { type: "zombie_king", nameKo: "좀비 왕", z: 115, health: 400 },
    rewards: { coins: 150 }
  },
  {
    id: 3, name: "불의 길", length: 140,
    enemies: [
      { type: "red_box", x: -1, z: 20, damage: 6 },
      { type: "red_box", x: 1, z: 30, damage: 8 },
      { type: "red_box", x: 0, z: 45, damage: 10 },
      { type: "red_box", x: -2, z: 60, damage: 7 },
      { type: "zombie", x: 1, z: 65, health: 40 },
      { type: "zombie", x: -1, z: 70, health: 40 },
      { type: "zombie", x: 0, z: 80, health: 50 },
    ],
    collectibles: [
      { type: "ally", x: 0, z: 8 }, { type: "ally", x: 1, z: 12 },
      { type: "ally", x: -1, z: 16 }, { type: "ally", x: 2, z: 25 },
      { type: "ally", x: -2, z: 35 }, { type: "ally", x: 0, z: 50 },
      { type: "ally", x: 1, z: 55 }, { type: "ally", x: -1, z: 75 },
      { type: "coin", x: 0, z: 28, value: 15 }, { type: "coin", x: 2, z: 48, value: 20 },
      { type: "coin", x: -1, z: 68, value: 15 },
      { type: "weapon", x: 0, z: 85, weapon: "rocket" },
    ],
    gates: [
      { type: "multiply", z: 90, value: 2, lane: -1.5 },
      { type: "add", z: 90, value: 12, lane: 1.5 },
    ],
    boss: { type: "fire_demon", nameKo: "화염 악마", z: 135, health: 700 },
    rewards: { coins: 200 }
  },
  {
    id: 4, name: "어둠의 계곡", length: 150,
    enemies: [
      { type: "red_box", x: 0, z: 18, damage: 7 },
      { type: "red_box", x: 2, z: 28, damage: 9 },
      { type: "red_box", x: -2, z: 38, damage: 11 },
      { type: "red_box", x: 1, z: 55, damage: 8 },
      { type: "red_box", x: -1, z: 65, damage: 12 },
      { type: "zombie", x: 0, z: 75, health: 50 },
      { type: "zombie", x: 2, z: 80, health: 60 },
      { type: "zombie", x: -2, z: 85, health: 55 },
    ],
    collectibles: [
      { type: "ally", x: -1, z: 8 }, { type: "ally", x: 1, z: 12 },
      { type: "ally", x: 0, z: 22 }, { type: "ally", x: -2, z: 32 },
      { type: "ally", x: 2, z: 42 }, { type: "ally", x: 0, z: 50 },
      { type: "ally", x: 1, z: 60 }, { type: "ally", x: -1, z: 70 },
      { type: "ally", x: 0, z: 90 }, { type: "ally", x: 2, z: 95 },
      { type: "coin", x: 1, z: 25, value: 15 }, { type: "coin", x: -1, z: 45, value: 20 },
      { type: "coin", x: 0, z: 72, value: 20 },
      { type: "weapon", x: -1, z: 48, weapon: "shotgun" },
      { type: "weapon", x: 1, z: 92, weapon: "rocket" },
    ],
    gates: [
      { type: "add", z: 100, value: 10, lane: -1.5 },
      { type: "multiply", z: 100, value: 2, lane: 1.5 },
    ],
    boss: { type: "shadow_lord", nameKo: "그림자 군주", z: 145, health: 1000 },
    rewards: { coins: 300 }
  },
  {
    id: 5, name: "최후의 결전", length: 170,
    enemies: [
      { type: "red_box", x: 1, z: 15, damage: 8 },
      { type: "red_box", x: -1, z: 25, damage: 10 },
      { type: "red_box", x: 0, z: 35, damage: 12 },
      { type: "red_box", x: 2, z: 50, damage: 9 },
      { type: "red_box", x: -2, z: 60, damage: 14 },
      { type: "red_box", x: 0, z: 75, damage: 10 },
      { type: "zombie", x: 1, z: 80, health: 60 },
      { type: "zombie", x: -1, z: 85, health: 70 },
      { type: "zombie", x: 0, z: 95, health: 80 },
      { type: "zombie", x: 2, z: 100, health: 60 },
    ],
    collectibles: [
      { type: "ally", x: 0, z: 8 }, { type: "ally", x: -1, z: 12 },
      { type: "ally", x: 1, z: 18 }, { type: "ally", x: -2, z: 22 },
      { type: "ally", x: 2, z: 30 }, { type: "ally", x: 0, z: 40 },
      { type: "ally", x: -1, z: 45 }, { type: "ally", x: 1, z: 55 },
      { type: "ally", x: 0, z: 65 }, { type: "ally", x: -2, z: 70 },
      { type: "ally", x: 2, z: 90 }, { type: "ally", x: 0, z: 105 },
      { type: "coin", x: 1, z: 20, value: 20 }, { type: "coin", x: -1, z: 42, value: 25 },
      { type: "coin", x: 0, z: 68, value: 25 }, { type: "coin", x: 2, z: 92, value: 30 },
      { type: "weapon", x: -1, z: 38, weapon: "gun" },
      { type: "weapon", x: 0, z: 72, weapon: "shotgun" },
      { type: "weapon", x: 1, z: 108, weapon: "rocket" },
    ],
    gates: [
      { type: "multiply", z: 115, value: 2, lane: -1.5 },
      { type: "add", z: 115, value: 15, lane: 1.5 },
      { type: "multiply", z: 130, value: 2, lane: 0 },
    ],
    boss: { type: "dragon_king", nameKo: "용의 왕", z: 165, health: 1800 },
    rewards: { coins: 500 }
  },
  {
    id: 6, name: "얼음 왕국", length: 150,
    enemies: [
      { type: "red_box", x: 0, z: 15, damage: 10 },
      { type: "red_box", x: 2, z: 30, damage: 12 },
      { type: "red_box", x: -2, z: 45, damage: 10 },
      { type: "red_box", x: 1, z: 60, damage: 14 },
      { type: "zombie", x: -1, z: 50, health: 70 },
      { type: "zombie", x: 0, z: 70, health: 80 },
      { type: "zombie", x: 2, z: 85, health: 70 },
    ],
    collectibles: [
      { type: "ally", x: 0, z: 8 }, { type: "ally", x: 1, z: 14 },
      { type: "ally", x: -1, z: 20 }, { type: "ally", x: 2, z: 28 },
      { type: "ally", x: -2, z: 38 }, { type: "ally", x: 0, z: 48 },
      { type: "ally", x: 1, z: 58 }, { type: "ally", x: -1, z: 75 },
      { type: "coin", x: 0, z: 25, value: 20 }, { type: "coin", x: -1, z: 55, value: 25 },
      { type: "weapon", x: 1, z: 40, weapon: "shotgun" },
      { type: "weapon", x: -1, z: 90, weapon: "rocket" },
    ],
    gates: [
      { type: "multiply", z: 100, value: 2, lane: -1.5 },
      { type: "add", z: 100, value: 12, lane: 1.5 },
    ],
    boss: { type: "shadow_lord", nameKo: "얼음 거인", z: 145, health: 2200 },
    rewards: { coins: 600 }
  },
  {
    id: 7, name: "폭풍의 사막", length: 160,
    enemies: [
      { type: "red_box", x: -1, z: 18, damage: 11 },
      { type: "red_box", x: 1, z: 32, damage: 13 },
      { type: "red_box", x: 0, z: 48, damage: 15 },
      { type: "red_box", x: -2, z: 65, damage: 12 },
      { type: "red_box", x: 2, z: 78, damage: 14 },
      { type: "zombie", x: 0, z: 55, health: 80 },
      { type: "zombie", x: -1, z: 72, health: 90 },
      { type: "zombie", x: 1, z: 88, health: 85 },
    ],
    collectibles: [
      { type: "ally", x: 1, z: 8 }, { type: "ally", x: -1, z: 14 },
      { type: "ally", x: 0, z: 22 }, { type: "ally", x: 2, z: 30 },
      { type: "ally", x: -2, z: 40 }, { type: "ally", x: 0, z: 52 },
      { type: "ally", x: 1, z: 62 }, { type: "ally", x: -1, z: 76 },
      { type: "ally", x: 0, z: 85 },
      { type: "coin", x: -2, z: 28, value: 25 }, { type: "coin", x: 2, z: 60, value: 30 },
      { type: "weapon", x: 0, z: 45, weapon: "gun" },
      { type: "weapon", x: -1, z: 95, weapon: "rocket" },
    ],
    gates: [
      { type: "add", z: 105, value: 15, lane: -1.5 },
      { type: "multiply", z: 105, value: 2, lane: 1.5 },
    ],
    boss: { type: "fire_demon", nameKo: "폭풍의 마신", z: 155, health: 2800 },
    rewards: { coins: 700 }
  },
  {
    id: 8, name: "죽음의 던전", length: 170,
    enemies: [
      { type: "red_box", x: 0, z: 15, damage: 12 },
      { type: "red_box", x: -2, z: 28, damage: 14 },
      { type: "red_box", x: 2, z: 42, damage: 16 },
      { type: "red_box", x: -1, z: 58, damage: 13 },
      { type: "red_box", x: 1, z: 72, damage: 15 },
      { type: "red_box", x: 0, z: 88, damage: 18 },
      { type: "zombie", x: 1, z: 60, health: 90 },
      { type: "zombie", x: -1, z: 78, health: 100 },
      { type: "zombie", x: 0, z: 95, health: 95 },
    ],
    collectibles: [
      { type: "ally", x: -1, z: 8 }, { type: "ally", x: 1, z: 14 },
      { type: "ally", x: 0, z: 20 }, { type: "ally", x: -2, z: 30 },
      { type: "ally", x: 2, z: 38 }, { type: "ally", x: 0, z: 48 },
      { type: "ally", x: 1, z: 55 }, { type: "ally", x: -1, z: 68 },
      { type: "ally", x: 0, z: 82 }, { type: "ally", x: 2, z: 92 },
      { type: "coin", x: 1, z: 25, value: 25 }, { type: "coin", x: -1, z: 50, value: 30 },
      { type: "coin", x: 0, z: 80, value: 30 },
      { type: "weapon", x: -2, z: 35, weapon: "shotgun" },
      { type: "weapon", x: 1, z: 100, weapon: "rocket" },
    ],
    gates: [
      { type: "multiply", z: 110, value: 2, lane: -1.5 },
      { type: "add", z: 110, value: 18, lane: 1.5 },
    ],
    boss: { type: "zombie_king", nameKo: "죽음의 기사", z: 165, health: 3500 },
    rewards: { coins: 800 }
  },
  {
    id: 9, name: "혼돈의 문", length: 180,
    enemies: [
      { type: "red_box", x: 1, z: 15, damage: 14 },
      { type: "red_box", x: -1, z: 28, damage: 16 },
      { type: "red_box", x: 0, z: 42, damage: 18 },
      { type: "red_box", x: 2, z: 55, damage: 14 },
      { type: "red_box", x: -2, z: 68, damage: 20 },
      { type: "red_box", x: 0, z: 82, damage: 16 },
      { type: "red_box", x: 1, z: 98, damage: 18 },
      { type: "zombie", x: -1, z: 65, health: 100 },
      { type: "zombie", x: 0, z: 85, health: 110 },
      { type: "zombie", x: 2, z: 105, health: 100 },
    ],
    collectibles: [
      { type: "ally", x: 0, z: 8 }, { type: "ally", x: -1, z: 14 },
      { type: "ally", x: 1, z: 20 }, { type: "ally", x: -2, z: 28 },
      { type: "ally", x: 2, z: 35 }, { type: "ally", x: 0, z: 45 },
      { type: "ally", x: -1, z: 55 }, { type: "ally", x: 1, z: 65 },
      { type: "ally", x: 0, z: 78 }, { type: "ally", x: 2, z: 88 },
      { type: "ally", x: -2, z: 100 },
      { type: "coin", x: 1, z: 22, value: 30 }, { type: "coin", x: -1, z: 52, value: 35 },
      { type: "coin", x: 0, z: 75, value: 35 }, { type: "coin", x: 2, z: 95, value: 40 },
      { type: "weapon", x: 0, z: 38, weapon: "shotgun" },
      { type: "weapon", x: -1, z: 90, weapon: "rocket" },
    ],
    gates: [
      { type: "multiply", z: 120, value: 2, lane: -1.5 },
      { type: "add", z: 120, value: 20, lane: 1.5 },
      { type: "multiply", z: 140, value: 2, lane: 0 },
    ],
    boss: { type: "shadow_lord", nameKo: "혼돈의 지배자", z: 175, health: 4500 },
    rewards: { coins: 1000 }
  },
  {
    id: 10, name: "최종 결전 - 서준이와 지노의 승리", length: 200,
    enemies: [
      { type: "red_box", x: 0, z: 15, damage: 15 },
      { type: "red_box", x: -2, z: 25, damage: 18 },
      { type: "red_box", x: 2, z: 35, damage: 20 },
      { type: "red_box", x: -1, z: 48, damage: 16 },
      { type: "red_box", x: 1, z: 60, damage: 22 },
      { type: "red_box", x: 0, z: 75, damage: 18 },
      { type: "red_box", x: -2, z: 90, damage: 20 },
      { type: "red_box", x: 2, z: 105, damage: 25 },
      { type: "zombie", x: -1, z: 55, health: 110 },
      { type: "zombie", x: 1, z: 70, health: 120 },
      { type: "zombie", x: 0, z: 88, health: 130 },
      { type: "zombie", x: -2, z: 108, health: 120 },
    ],
    collectibles: [
      { type: "ally", x: 0, z: 8 }, { type: "ally", x: -1, z: 12 },
      { type: "ally", x: 1, z: 18 }, { type: "ally", x: -2, z: 24 },
      { type: "ally", x: 2, z: 30 }, { type: "ally", x: 0, z: 40 },
      { type: "ally", x: -1, z: 48 }, { type: "ally", x: 1, z: 56 },
      { type: "ally", x: 0, z: 65 }, { type: "ally", x: -2, z: 72 },
      { type: "ally", x: 2, z: 82 }, { type: "ally", x: 0, z: 95 },
      { type: "ally", x: -1, z: 110 }, { type: "ally", x: 1, z: 118 },
      { type: "coin", x: 1, z: 20, value: 30 }, { type: "coin", x: -1, z: 45, value: 40 },
      { type: "coin", x: 0, z: 68, value: 40 }, { type: "coin", x: 2, z: 92, value: 50 },
      { type: "coin", x: -2, z: 115, value: 50 },
      { type: "weapon", x: 0, z: 32, weapon: "gun" },
      { type: "weapon", x: -1, z: 78, weapon: "shotgun" },
      { type: "weapon", x: 1, z: 120, weapon: "rocket" },
    ],
    gates: [
      { type: "multiply", z: 130, value: 2, lane: -1.5 },
      { type: "add", z: 130, value: 20, lane: 1.5 },
      { type: "multiply", z: 155, value: 2, lane: -1.5 },
      { type: "add", z: 155, value: 25, lane: 1.5 },
    ],
    boss: { type: "dragon_king", nameKo: "최종 보스 - 파멸의 용왕", z: 195, health: 6000 },
    rewards: { coins: 2000 }
  }
];

function generateStage(id) {
  const length = 100 + id * 15;
  const enemies = [];
  const collectibles = [];
  const gates = [];
  const numEnemies = Math.floor(4 + id * 0.8);
  const numAllies = Math.floor(6 + id * 0.5);
  const numCoins = Math.floor(2 + id * 0.3);

  for (let i = 0; i < numAllies; i++) {
    collectibles.push({ type: "ally", x: (Math.random() * 4 - 2) | 0, z: 8 + (i / numAllies) * length * 0.6 });
  }
  for (let i = 0; i < numCoins; i++) {
    collectibles.push({ type: "coin", x: (Math.random() * 4 - 2) | 0, z: 15 + Math.random() * length * 0.6, value: 10 + id * 3 });
  }
  const weapons = ["gun", "shotgun", "rocket"];
  collectibles.push({ type: "weapon", x: (Math.random() * 4 - 2) | 0, z: length * 0.4 + Math.random() * length * 0.2, weapon: weapons[Math.min(Math.floor(id / 3), 2)] });
  if (id > 8) {
    collectibles.push({ type: "weapon", x: (Math.random() * 4 - 2) | 0, z: length * 0.65 + Math.random() * length * 0.1, weapon: weapons[Math.min(Math.floor(id / 5), 2)] });
  }

  for (let i = 0; i < numEnemies; i++) {
    const z = 15 + (i / numEnemies) * length * 0.65;
    if (Math.random() < 0.6) {
      enemies.push({ type: "red_box", x: (Math.random() * 4 - 2) | 0, z, damage: Math.floor(5 + id * 1.2 + Math.random() * 5) });
    } else {
      enemies.push({ type: "zombie", x: (Math.random() * 4 - 2) | 0, z, health: Math.floor(20 + id * 8) });
    }
  }

  const gateZ = length * 0.7;
  gates.push({ type: "multiply", z: gateZ, value: 2, lane: -1.5 });
  gates.push({ type: "add", z: gateZ, value: Math.floor(5 + id * 1.5), lane: 1.5 });

  const bossTypes = [
    { type: "zombie_boss", nameKo: "좀비 군단장" },
    { type: "dark_knight", nameKo: "암흑 기사" },
    { type: "fire_demon", nameKo: "화염 마수" },
    { type: "shadow_lord", nameKo: "그림자 지배자" },
    { type: "dragon_king", nameKo: "죽음의 사신" },
    { type: "zombie_king", nameKo: "혼돈의 왕" },
    { type: "fire_demon", nameKo: "공허의 보행자" },
    { type: "dark_knight", nameKo: "폭풍의 거인" },
  ];
  const bt = bossTypes[(id - 1) % bossTypes.length];
  return {
    id, name: `스테이지 ${id}`, length, enemies, collectibles, gates,
    boss: { ...bt, z: length - 5, health: Math.floor(300 * Math.pow(id, 1.2)) },
    rewards: { coins: 50 * id }
  };
}

function getStage(id) {
  if (id <= STAGES.length) return STAGES[id - 1];
  return generateStage(id);
}

// ============================================================
//  UPGRADE DEFINITIONS (Korean)
// ============================================================
const UPGRADE_DEFS = [
  {
    key: "startAllies", name: "시작 동료 수", maxLevel: 10,
    desc: (lvl) => `시작 시 동료 ${5 + lvl * 2}명`,
    cost: (lvl) => Math.floor(100 * Math.pow(1.8, lvl)),
    effect: (lvl) => 5 + lvl * 2
  },
  {
    key: "attackPower", name: "공격력", maxLevel: 10,
    desc: (lvl) => `기본 공격력: ${10 + lvl * 5}`,
    cost: (lvl) => Math.floor(150 * Math.pow(1.8, lvl)),
    effect: (lvl) => 10 + lvl * 5
  },
  {
    key: "weaponBonus", name: "무기 효과", maxLevel: 10,
    desc: (lvl) => `무기 보너스: +${50 + lvl * 15}%`,
    cost: (lvl) => Math.floor(200 * Math.pow(1.8, lvl)),
    effect: (lvl) => 0.5 + lvl * 0.15
  },
  {
    key: "coinBonus", name: "코인 보너스", maxLevel: 5,
    desc: (lvl) => `코인 획득: +${10 + lvl * 10}%`,
    cost: (lvl) => Math.floor(300 * Math.pow(2, lvl)),
    effect: (lvl) => 1 + (10 + lvl * 10) / 100
  },
  {
    key: "health", name: "체력", maxLevel: 10,
    desc: (lvl) => `피해 감소: -${5 + lvl * 3}%`,
    cost: (lvl) => Math.floor(250 * Math.pow(1.8, lvl)),
    effect: (lvl) => 1 - (5 + lvl * 3) / 100
  }
];

// ============================================================
//  SAVE / LOAD
// ============================================================
const DEFAULT_SAVE = {
  currentStage: 1, maxStage: 1, coins: 0,
  upgrades: { startAllies: 0, attackPower: 0, weaponBonus: 0, coinBonus: 0, health: 0 }
};

function loadGameData() {
  try {
    const data = localStorage.getItem('crowdRunnerSave');
    if (data) return { ...DEFAULT_SAVE, ...JSON.parse(data) };
  } catch (e) { /* ignore */ }
  return { ...DEFAULT_SAVE };
}

function saveGameData(data) {
  try { localStorage.setItem('crowdRunnerSave', JSON.stringify(data)); } catch (e) { /* ignore */ }
}

let gameData = loadGameData();

// ============================================================
//  DOM
// ============================================================
const $ = (id) => document.getElementById(id);

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('hud').classList.remove('active');
  $('bossHpBar').classList.remove('active');
  $('touchArea').style.display = 'none';

  if (name === 'menu') {
    $('mainMenu').classList.add('active');
    $('menuCoins').textContent = `${gameData.coins} 코인`;
    $('menuLevel').textContent = `Lv. ${Math.floor(gameData.maxStage / 5) + 1}`;
    $('stageLabel').textContent = `스테이지 ${gameData.currentStage}`;
    sound.startBGM('menu');
  } else if (name === 'game') {
    $('hud').classList.add('active');
    $('touchArea').style.display = 'block';
    $('stageIndicator').textContent = `스테이지 ${gameData.currentStage}`;
    sound.startBGM('game');
  } else if (name === 'complete') {
    $('stageComplete').classList.add('active');
    sound.stopBGM();
  } else if (name === 'fail') {
    $('stageFail').classList.add('active');
    sound.stopBGM();
  } else if (name === 'upgrade') {
    $('upgradeScreen').classList.add('active');
    renderUpgrades();
  }
}

// ============================================================
//  ENDING CREDIT (after stage 10)
// ============================================================
const FINAL_STAGE = 10;

function showEndingCredit(totalCoins, stars, survivedAllies, startAllies) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('hud').classList.remove('active');
  $('bossHpBar').classList.remove('active');
  $('touchArea').style.display = 'none';
  sound.stopBGM();

  // Play special ending music
  sound.playVictory();
  setTimeout(() => sound.playVictory(), 600);

  // Stats
  const statsEl = $('endingStats');
  statsEl.innerHTML = `
    <div class="stat-title">최종 기록</div>
    <div class="stat-item">획득 코인: ${totalCoins}</div>
    <div class="stat-item">생존 동료: ${survivedAllies}/${startAllies}명</div>
    <div class="stat-item">총 보유 코인: ${gameData.coins}</div>
    <div class="stat-item">별: ${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
  `;

  $('endingCredit').classList.add('active');
  spawnConfetti();
  setTimeout(spawnConfetti, 1500);
  setTimeout(spawnConfetti, 3000);
}

function renderUpgrades() {
  $('upgradeCoins').textContent = `${gameData.coins} 코인`;
  const list = $('upgradeList');
  list.innerHTML = '';

  UPGRADE_DEFS.forEach(def => {
    const lvl = gameData.upgrades[def.key] || 0;
    const isMaxed = lvl >= def.maxLevel;
    const cost = isMaxed ? 0 : def.cost(lvl);
    const canAfford = gameData.coins >= cost;
    const item = document.createElement('div');
    item.className = 'upgrade-item';
    item.innerHTML = `
      <div class="upgrade-info">
        <h3>${def.name}</h3>
        <p>${def.desc(lvl)}</p>
        <div class="upgrade-level">레벨 ${lvl}/${def.maxLevel}</div>
      </div>
      <button class="btn-buy ${isMaxed ? 'maxed' : ''}" ${isMaxed || !canAfford ? 'disabled' : ''}>
        ${isMaxed ? '최대' : `${cost} 코인`}
      </button>
    `;
    if (!isMaxed && canAfford) {
      item.querySelector('.btn-buy').addEventListener('click', () => {
        gameData.coins -= cost;
        gameData.upgrades[def.key] = lvl + 1;
        saveGameData(gameData);
        sound.playUpgrade();
        renderUpgrades();
      });
    }
    list.appendChild(item);
  });
}

// ============================================================
//  THREE.JS SETUP
// ============================================================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x6eb5d9);
document.body.insertBefore(renderer.domElement, document.body.firstChild);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x6eb5d9, 40, 80);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 7, -7);
camera.lookAt(0, 0, 5);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 15, -5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 80;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
scene.add(dirLight);

// ============================================================
//  SHARED MATERIALS & GEOMETRIES
// ============================================================
const MAT = {
  ground: new THREE.MeshStandardMaterial({ color: 0x3d6b4a }),
  road: new THREE.MeshStandardMaterial({ color: 0x444444 }),
  roadLine: new THREE.MeshStandardMaterial({ color: 0xeeeeee }),
  redBox: new THREE.MeshStandardMaterial({ color: 0xef5350 }),
  weapon: new THREE.MeshStandardMaterial({ color: 0xff9800, emissive: 0xff6600, emissiveIntensity: 0.3 }),
  coin: new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 0.3 }),
  gateMultiply: new THREE.MeshStandardMaterial({ color: 0x4caf50, transparent: true, opacity: 0.7 }),
  gateAdd: new THREE.MeshStandardMaterial({ color: 0x7c4dff, transparent: true, opacity: 0.7 }),
  bullet: new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.9 }),
  // Villain materials
  zombieBody: new THREE.MeshStandardMaterial({ color: 0x556b2f, roughness: 0.8 }),
  zombieHead: new THREE.MeshStandardMaterial({ color: 0x6b8e23 }),
  zombieArm: new THREE.MeshStandardMaterial({ color: 0x4a5d23 }),
  zombieEye: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
  bossBody: new THREE.MeshStandardMaterial({ color: 0x4a0072, roughness: 0.6, metalness: 0.3 }),
  bossArmor: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.2 }),
  bossEye: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
  bossHorn: new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 }),
  fireBody: new THREE.MeshStandardMaterial({ color: 0x8b0000, emissive: 0xff2200, emissiveIntensity: 0.3 }),
  fireGlow: new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff6600, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 }),
  shadowBody: new THREE.MeshStandardMaterial({ color: 0x1a0033, emissive: 0x220044, emissiveIntensity: 0.2 }),
  shadowCloak: new THREE.MeshStandardMaterial({ color: 0x0a0015, transparent: true, opacity: 0.85 }),
  dragonBody: new THREE.MeshStandardMaterial({ color: 0x2d1b00, metalness: 0.4, roughness: 0.5 }),
  dragonScale: new THREE.MeshStandardMaterial({ color: 0x8b4513, metalness: 0.6, roughness: 0.3 }),
  dragonWing: new THREE.MeshStandardMaterial({ color: 0x4a0000, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
};

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(0.3, 12, 12),
  sphereLarge: new THREE.SphereGeometry(0.5, 12, 12),
  cylinder: new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8),
  coin: new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16),
  bullet: new THREE.SphereGeometry(0.2, 8, 8),
  cone: new THREE.ConeGeometry(0.2, 0.6, 8),
};

// ============================================================
//  3D VILLAIN BUILDERS
// ============================================================
function createZombieEnemy(data) {
  const group = new THREE.Group();
  const zombieSkin = new THREE.MeshLambertMaterial({ color: 0x5a7a3a });
  const zombieDark = new THREE.MeshLambertMaterial({ color: 0x3d5a2a });
  const clothMat = new THREE.MeshLambertMaterial({ color: 0x4a3728 });

  // Torso (torn clothes)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.3), clothMat);
  torso.position.y = 0.72;
  torso.castShadow = true;
  group.add(torso);
  // Exposed belly
  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.15), zombieSkin);
  belly.position.set(0.05, 0.55, 0.12);
  group.add(belly);

  // Head (tilted)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), zombieSkin);
  head.position.set(0.05, 1.25, 0.03);
  head.rotation.z = 0.2;
  head.castShadow = true;
  group.add(head);
  // Jaw
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.1), zombieDark);
  jaw.position.set(0.05, 1.08, 0.15);
  group.add(jaw);

  // Glowing red eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), eyeMat);
  eyeL.position.set(-0.06, 1.29, 0.17);
  group.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.set(0.1, 1.29, 0.17);
  group.add(eyeR);

  // Arms reaching forward
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), zombieSkin);
  armL.position.set(-0.35, 0.75, 0.2);
  armL.rotation.x = -0.8;
  armL.rotation.z = 0.15;
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), zombieSkin);
  armR.position.set(0.35, 0.85, 0.15);
  armR.rotation.x = -0.6;
  armR.rotation.z = -0.1;
  group.add(armR);

  // Legs (shuffling pose)
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.4, 0.13), clothMat);
  legL.position.set(-0.1, 0.2, 0.05);
  legL.rotation.x = -0.1;
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.4, 0.13), clothMat);
  legR.position.set(0.12, 0.2, -0.05);
  group.add(legR);

  // HP label
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`HP ${data.health}`, 64, 45);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  sprite.scale.set(1.0, 0.5, 1);
  sprite.position.y = 1.7;
  group.add(sprite);

  group.position.set(data.x, 0, data.z);
  return group;
}

function createBoss3D(bossData) {
  const bossType = bossData.type;
  const group = new THREE.Group();

  if (bossType === 'zombie_boss' || bossType === 'zombie_king') {
    // Large zombie boss
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2, 1), MAT.zombieBody);
    torso.position.y = 1.5;
    torso.castShadow = true;
    group.add(torso);

    // Armor plates
    const armor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.1), MAT.bossArmor);
    armor.position.y = 2;
    group.add(armor);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), MAT.zombieHead);
    head.position.y = 3;
    head.castShadow = true;
    group.add(head);

    // Crown for zombie_king
    if (bossType === 'zombie_king') {
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(GEO.cone, new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8 }));
        const angle = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.35, 3.5, Math.sin(angle) * 0.35);
        spike.scale.set(0.5, 0.5, 0.5);
        group.add(spike);
      }
    }

    // Glowing eyes
    const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, MAT.bossEye);
    eyeL.position.set(-0.2, 3.1, 0.4);
    group.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.set(0.2, 3.1, 0.4);
    group.add(eyeR);

    // Big arms
    const armGeo = new THREE.BoxGeometry(0.4, 0.4, 1.2);
    const armL = new THREE.Mesh(armGeo, MAT.zombieArm);
    armL.position.set(-1, 2, 0.4);
    armL.rotation.x = -0.4;
    group.add(armL);
    const armR = new THREE.Mesh(armGeo, MAT.zombieArm);
    armR.position.set(1, 2, 0.4);
    armR.rotation.x = -0.4;
    group.add(armR);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.45, 0.8, 0.4);
    const legL = new THREE.Mesh(legGeo, MAT.zombieBody);
    legL.position.set(-0.35, 0.4, 0);
    group.add(legL);
    const legR = new THREE.Mesh(legGeo, MAT.zombieBody);
    legR.position.set(0.35, 0.4, 0);
    group.add(legR);

  } else if (bossType === 'fire_demon') {
    // Fire demon - bulky with flames
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 1.2), MAT.fireBody);
    torso.position.y = 1.6;
    torso.castShadow = true;
    group.add(torso);

    // Head with horns
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), MAT.fireBody);
    head.position.y = 3.2;
    group.add(head);

    const hornGeo = new THREE.ConeGeometry(0.12, 0.8, 6);
    const hornL = new THREE.Mesh(hornGeo, MAT.bossHorn);
    hornL.position.set(-0.35, 3.7, 0);
    hornL.rotation.z = 0.3;
    group.add(hornL);
    const hornR = new THREE.Mesh(hornGeo, MAT.bossHorn);
    hornR.position.set(0.35, 3.7, 0);
    hornR.rotation.z = -0.3;
    group.add(hornR);

    // Fire glow around body
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 12), MAT.fireGlow);
    glow.position.y = 1.8;
    group.add(glow);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.2, 3.3, 0.45);
    group.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.set(0.2, 3.3, 0.45);
    group.add(eyeR);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.5, 0.5, 1.3);
    const armL = new THREE.Mesh(armGeo, MAT.fireBody);
    armL.position.set(-1.2, 2, 0.3);
    group.add(armL);
    const armR = new THREE.Mesh(armGeo, MAT.fireBody);
    armR.position.set(1.2, 2, 0.3);
    group.add(armR);

  } else if (bossType === 'shadow_lord') {
    // Shadow lord - tall, cloaked
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.5, 8), MAT.shadowCloak);
    cloak.position.y = 1.75;
    cloak.castShadow = true;
    group.add(cloak);

    // Inner body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.5, 0.6), MAT.shadowBody);
    body.position.y = 1.8;
    group.add(body);

    // Floating head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), MAT.shadowBody);
    head.position.y = 3.8;
    group.add(head);

    // Glowing eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xcc00ff });
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.15, 3.85, 0.38);
    group.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.set(0.15, 3.85, 0.38);
    group.add(eyeR);

    // Shadow orbs floating around
    for (let i = 0; i < 3; i++) {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x6600cc, transparent: true, opacity: 0.7 })
      );
      const angle = (i / 3) * Math.PI * 2;
      orb.position.set(Math.cos(angle) * 1.5, 2 + i * 0.3, Math.sin(angle) * 1.5);
      orb.userData.orbIndex = i;
      group.add(orb);
    }

  } else if (bossType === 'dragon_king' || bossType === 'dark_knight') {
    // Dragon / Knight - massive with wings/armor
    const torso = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 1.5), MAT.dragonBody);
    torso.position.y = 1.8;
    torso.castShadow = true;
    group.add(torso);

    // Scale armor
    const scale1 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.3, 1.6), MAT.dragonScale);
    scale1.position.y = 2.3;
    group.add(scale1);
    const scale2 = scale1.clone();
    scale2.position.y = 1.8;
    group.add(scale2);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 12), MAT.dragonBody);
    head.position.y = 3.5;
    head.castShadow = true;
    group.add(head);

    // Snout
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.6), MAT.dragonScale);
    snout.position.set(0, 3.35, 0.6);
    group.add(snout);

    // Horns
    const hornGeo = new THREE.ConeGeometry(0.1, 0.7, 6);
    const hornL = new THREE.Mesh(hornGeo, MAT.bossHorn);
    hornL.position.set(-0.4, 4.0, -0.1);
    hornL.rotation.z = 0.3;
    group.add(hornL);
    const hornR = new THREE.Mesh(hornGeo, MAT.bossHorn);
    hornR.position.set(0.4, 4.0, -0.1);
    hornR.rotation.z = -0.3;
    group.add(hornR);

    // Wings
    const wingGeo = new THREE.PlaneGeometry(2.5, 2);
    const wingL = new THREE.Mesh(wingGeo, MAT.dragonWing);
    wingL.position.set(-2, 2.5, -0.3);
    wingL.rotation.y = 0.5;
    wingL.rotation.z = 0.3;
    group.add(wingL);
    const wingR = new THREE.Mesh(wingGeo, MAT.dragonWing);
    wingR.position.set(2, 2.5, -0.3);
    wingR.rotation.y = -0.5;
    wingR.rotation.z = -0.3;
    group.add(wingR);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.22, 3.6, 0.5);
    group.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.set(0.22, 3.6, 0.5);
    group.add(eyeR);

    // Tail
    const tailSegments = 5;
    for (let i = 0; i < tailSegments; i++) {
      const s = 0.3 - i * 0.04;
      const tail = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 8), MAT.dragonScale);
      tail.position.set(0, 0.6 + i * 0.1, -1 - i * 0.5);
      group.add(tail);
    }

    // Legs
    const legGeo = new THREE.BoxGeometry(0.5, 1, 0.5);
    const legL = new THREE.Mesh(legGeo, MAT.dragonBody);
    legL.position.set(-0.5, 0.5, 0);
    group.add(legL);
    const legR = new THREE.Mesh(legGeo, MAT.dragonBody);
    legR.position.set(0.5, 0.5, 0);
    group.add(legR);

  } else {
    // Default boss fallback
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 1.5), MAT.bossBody);
    body.position.y = 1.25;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), MAT.bossBody);
    head.position.y = 3;
    head.castShadow = true;
    group.add(head);
    const eyeGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, MAT.bossEye);
    eyeL.position.set(-0.2, 3.1, 0.4);
    group.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.set(0.2, 3.1, 0.4);
    group.add(eyeR);
  }

  group.position.set(0, 0, bossData.z);
  return group;
}

// ============================================================
//  FALLBACK CHARACTER (when model fails to load)
// ============================================================
function createFallbackCharacter(color, scale = 1.0) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.2), mat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), skinMat);
  head.position.y = 1.0;
  head.castShadow = true;
  group.add(head);
  // Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 4), eyeMat);
  eyeL.position.set(-0.05, 1.03, 0.13);
  group.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.set(0.05, 1.03, 0.13);
  group.add(eyeR);
  // Legs
  const legMat = new THREE.MeshLambertMaterial({ color: 0x1565C0 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), legMat);
  legL.position.set(-0.08, 0.15, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), legMat);
  legR.position.set(0.08, 0.15, 0);
  group.add(legR);
  // Arms
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), skinMat);
  armL.position.set(-0.24, 0.55, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), skinMat);
  armR.position.set(0.24, 0.55, 0);
  group.add(armR);

  group.userData.legL = legL;
  group.userData.legR = legR;
  group.userData.armL = armL;
  group.userData.armR = armR;

  group.scale.set(scale, scale, scale);
  return group;
}

// ============================================================
//  GAME CLASS
// ============================================================
let game = null;

class Game {
  constructor(stageId) {
    this.stageId = stageId;
    this.stageData = getStage(stageId);
    this.isRunning = false;
    this.isFinished = false;
    this.isBossFight = false;
    this.bossDefeated = false;

    this.allies = UPGRADE_DEFS[0].effect(gameData.upgrades.startAllies);
    this.startAllies = this.allies;
    this.baseAttack = UPGRADE_DEFS[1].effect(gameData.upgrades.attackPower);
    this.weaponBonusMult = UPGRADE_DEFS[2].effect(gameData.upgrades.weaponBonus);
    this.healthMult = UPGRADE_DEFS[4].effect(gameData.upgrades.health);
    this.weapon = "fist";
    this.weaponMultiplier = 1.0;
    this.attackPower = this.baseAttack;

    this.playerX = 0;
    this.targetX = 0;
    this.playerZ = 0;
    this.speed = 5;
    this.coinsCollected = 0;

    this.objects = new THREE.Group();
    scene.add(this.objects);

    this.playerMesh = null;
    this.playerMixer = null;
    this.allyMeshes = [];
    this.allyMixers = [];
    this.obstacleObjects = [];
    this.collectibleObjects = [];
    this.gateObjects = [];
    this.bossObject = null;
    this.bossHealth = 0;
    this.bossMaxHealth = 0;
    this.bullets = [];
    this.particles = [];

    this.bossFightTimer = 0;
    this.bossAttackInterval = 0.5;
    this.autoAttackTimer = 0;
    this.autoAttackInterval = 0.4;

    this.buildScene();
  }

  buildScene() {
    const roadLength = this.stageData.length + 30;

    // Road
    const road = new THREE.Mesh(new THREE.PlaneGeometry(8, roadLength), MAT.road);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.01, roadLength / 2 - 5);
    road.receiveShadow = true;
    this.objects.add(road);

    // Road lines
    for (let z = 0; z < roadLength; z += 4) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 2), MAT.roadLine);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0, z);
      this.objects.add(line);
    }

    // Side ground
    const sideGeo = new THREE.PlaneGeometry(20, roadLength);
    const sideL = new THREE.Mesh(sideGeo, MAT.ground);
    sideL.rotation.x = -Math.PI / 2;
    sideL.position.set(-14, -0.02, roadLength / 2 - 5);
    sideL.receiveShadow = true;
    this.objects.add(sideL);
    const sideR = new THREE.Mesh(sideGeo, MAT.ground);
    sideR.rotation.x = -Math.PI / 2;
    sideR.position.set(14, -0.02, roadLength / 2 - 5);
    sideR.receiveShadow = true;
    this.objects.add(sideR);

    // === ENVIRONMENT: Trees, buildings, street lights ===
    const treeTrunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const treeLeafMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    const treeLeafDark = new THREE.MeshLambertMaterial({ color: 0x1a6b1a });
    const buildingMats = [
      new THREE.MeshLambertMaterial({ color: 0x607D8B }),
      new THREE.MeshLambertMaterial({ color: 0x78909C }),
      new THREE.MeshLambertMaterial({ color: 0x546E7A }),
      new THREE.MeshLambertMaterial({ color: 0x455A64 }),
    ];
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffeeaa });

    for (let z = 0; z < roadLength; z += 8) {
      // Trees on both sides
      for (const side of [-1, 1]) {
        const x = side * (5 + Math.random() * 3);
        const tree = new THREE.Group();
        // Trunk
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 1.5, 6), treeTrunkMat);
        trunk.position.y = 0.75;
        trunk.castShadow = true;
        tree.add(trunk);
        // Foliage layers
        const leafSize = 0.6 + Math.random() * 0.4;
        const leaf1 = new THREE.Mesh(new THREE.SphereGeometry(leafSize, 8, 6), Math.random() > 0.5 ? treeLeafMat : treeLeafDark);
        leaf1.position.y = 1.8;
        leaf1.castShadow = true;
        tree.add(leaf1);
        const leaf2 = new THREE.Mesh(new THREE.SphereGeometry(leafSize * 0.7, 7, 5), treeLeafMat);
        leaf2.position.set(0.2, 2.2, 0.1);
        tree.add(leaf2);
        tree.position.set(x, 0, z + Math.random() * 4);
        this.objects.add(tree);
      }

      // Buildings further back (every other segment)
      if (z % 16 === 0) {
        for (const side of [-1, 1]) {
          const x = side * (10 + Math.random() * 4);
          const bldgH = 3 + Math.random() * 5;
          const bldgW = 2 + Math.random() * 2;
          const bldg = new THREE.Group();
          const body = new THREE.Mesh(
            new THREE.BoxGeometry(bldgW, bldgH, 2),
            buildingMats[Math.floor(Math.random() * buildingMats.length)]
          );
          body.position.y = bldgH / 2;
          body.castShadow = true;
          body.receiveShadow = true;
          bldg.add(body);
          // Windows
          const rows = Math.floor(bldgH / 1.2);
          const cols = Math.floor(bldgW / 0.8);
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (Math.random() > 0.3) {
                const win = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), windowMat);
                win.position.set(
                  (c - (cols - 1) / 2) * 0.7,
                  0.8 + r * 1.1,
                  side > 0 ? -1.01 : 1.01
                );
                if (side > 0) win.rotation.y = Math.PI;
                bldg.add(win);
              }
            }
          }
          bldg.position.set(x, 0, z + Math.random() * 8);
          this.objects.add(bldg);
        }
      }

      // Street lights along road edges
      if (z % 12 === 0) {
        for (const side of [-1, 1]) {
          const lamp = new THREE.Group();
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.5, 6), lampMat);
          pole.position.y = 1.25;
          lamp.add(pole);
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.04), lampMat);
          arm.position.set(side * -0.2, 2.5, 0);
          lamp.add(arm);
          const light = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), lampGlowMat);
          light.position.set(side * -0.4, 2.45, 0);
          lamp.add(light);
          lamp.position.set(side * 4.3, 0, z);
          this.objects.add(lamp);
        }
      }
    }

    // Player (try 3D model, fallback to block character)
    this.playerMesh = cloneSoldier(1.0);
    if (this.playerMesh) {
      this.playerMixer = createSoldierMixer(this.playerMesh);
      if (this.playerMixer) playAnimation(this.playerMixer, 'run');
    } else {
      this.playerMesh = createFallbackCharacter(0x2196F3, 1.0);
    }
    this.playerMesh.position.set(0, 0, 0);
    this.playerMesh.rotation.y = Math.PI; // 캐릭터가 앞(+Z)을 바라보도록 회전
    this.objects.add(this.playerMesh);

    // Player name label above head
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256; labelCanvas.height = 64;
    const labelCtx = labelCanvas.getContext('2d');
    labelCtx.fillStyle = '#00ff88';
    labelCtx.font = 'bold 32px Arial';
    labelCtx.textAlign = 'center';
    labelCtx.fillText('서준 & 지노', 128, 42);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, depthTest: false }));
    labelSprite.scale.set(1.4, 0.4, 1);
    labelSprite.position.y = 1.5;
    this.playerMesh.add(labelSprite);

    // Green arrow indicator
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const arrowMesh = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 6), arrowMat);
    arrowMesh.position.y = 1.3;
    arrowMesh.rotation.x = Math.PI;
    this.playerMesh.add(arrowMesh);
    this._playerArrow = arrowMesh;

    // Reset camera
    camera.position.set(0, 7, -7);
    camera.lookAt(0, 0, 5);

    // Allies
    this.rebuildAllyMeshes();

    // Obstacles
    this.stageData.enemies.forEach((e, i) => {
      let obj;
      if (e.type === "red_box") {
        obj = this.createRedBox(e);
      } else {
        obj = createZombieEnemy(e);
      }
      obj.userData = { ...e, index: i, collected: false };
      this.objects.add(obj);
      this.obstacleObjects.push(obj);
    });

    // Collectibles
    this.stageData.collectibles.forEach((c, i) => {
      let obj;
      if (c.type === "ally") {
        obj = this.createAllyPickup(c);
      } else if (c.type === "coin") {
        obj = this.createCoinPickup(c);
      } else if (c.type === "weapon") {
        obj = this.createWeaponPickup(c);
      }
      if (obj) {
        obj.userData = { ...c, index: i, collected: false };
        this.objects.add(obj);
        this.collectibleObjects.push(obj);
      }
    });

    // Gates
    this.stageData.gates.forEach((g, i) => {
      const obj = this.createGate(g);
      obj.userData = { ...g, index: i, collected: false };
      this.objects.add(obj);
      this.gateObjects.push(obj);
    });

    // Boss
    const boss = this.stageData.boss;
    this.bossObject = createBoss3D(boss);
    this.bossObject.userData = { ...boss };
    this.bossHealth = boss.health;
    this.bossMaxHealth = boss.health;
    this.objects.add(this.bossObject);
  }

  createRedBox(data) {
    const group = new THREE.Group();
    // Barricade with warning stripes
    const barricadeMat = new THREE.MeshLambertMaterial({ color: 0xcc2222 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 1.4), barricadeMat);
    base.position.y = 0.075;
    group.add(base);
    // Metal spikes
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 });
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 6), spikeMat);
      const angle = (i / 5) * Math.PI * 2;
      spike.position.set(Math.cos(angle) * 0.4, 0.45, Math.sin(angle) * 0.4);
      spike.castShadow = true;
      group.add(spike);
    }
    const centerSpike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 6), spikeMat);
    centerSpike.position.y = 0.55;
    centerSpike.castShadow = true;
    group.add(centerSpike);
    // Warning glow
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.3 });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), glowMat);
    glow.position.y = 0.4;
    group.add(glow);
    // Damage label
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`-${data.damage}`, 64, 45);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    sprite.scale.set(1.0, 0.5, 1);
    sprite.position.y = 1.3;
    group.add(sprite);

    group.position.set(data.x, 0, data.z);
    return group;
  }

  createAllyPickup(data) {
    const group = new THREE.Group();
    {
      const fb = cloneSoldier(0.8) || createFallbackCharacter(0x64b5f6, 0.8);
      group.add(fb);
    }

    // + label
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4fc3f7';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('+1', 32, 48);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    sprite.scale.set(0.6, 0.6, 1);
    sprite.position.y = 1.5;
    group.add(sprite);

    group.position.set(data.x, 0, data.z);
    group.userData.floatPhase = Math.random() * Math.PI * 2;
    return group;
  }

  createCoinPickup(data) {
    const mesh = new THREE.Mesh(GEO.coin, MAT.coin);
    mesh.position.set(data.x, 0.6, data.z);
    mesh.rotation.x = Math.PI / 2;
    mesh.userData.floatPhase = Math.random() * Math.PI * 2;
    return mesh;
  }

  createWeaponPickup(data) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(GEO.cylinder, MAT.weapon);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.6;
    group.add(body);

    const weaponNames = { gun: "권총", shotgun: "샷건", rocket: "로켓" };
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff9800';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(weaponNames[data.weapon] || "무기", 64, 45);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    sprite.scale.set(1.5, 0.6, 1);
    sprite.position.y = 1.3;
    group.add(sprite);

    group.position.set(data.x, 0, data.z);
    group.userData.floatPhase = Math.random() * Math.PI * 2;
    return group;
  }

  createGate(data) {
    const group = new THREE.Group();
    const material = data.type === "multiply" ? MAT.gateMultiply : MAT.gateAdd;
    const pillar = new THREE.Mesh(GEO.box, material);
    pillar.scale.set(0.3, 3, 0.3);
    pillar.position.set(-1.2, 1.5, 0);
    group.add(pillar);
    const pillar2 = pillar.clone();
    pillar2.position.set(1.2, 1.5, 0);
    group.add(pillar2);
    const bar = new THREE.Mesh(GEO.box, material);
    bar.scale.set(2.7, 0.3, 0.3);
    bar.position.set(0, 3, 0);
    group.add(bar);

    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = data.type === "multiply" ? '#4caf50' : '#7c4dff';
    ctx.font = 'bold 44px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(data.type === "multiply" ? `x${data.value}` : `+${data.value}`, 64, 48);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    sprite.scale.set(2, 1, 1);
    sprite.position.y = 1.5;
    group.add(sprite);

    group.position.set(data.lane, 0, data.z);
    return group;
  }

  rebuildAllyMeshes() {
    this.allyMeshes.forEach(m => this.objects.remove(m));
    this.allyMixers = [];
    this.allyMeshes = [];

    const count = Math.min(this.allies, 40);
    for (let i = 0; i < count; i++) {
      let allyMesh = cloneSoldier(0.8);
      let mixer = null;
      if (allyMesh) {
        mixer = createSoldierMixer(allyMesh);
        if (mixer) playAnimation(mixer, 'run');
      } else {
        allyMesh = createFallbackCharacter(0x42a5f5, 0.8);
      }

      const row = Math.floor(i / 5);
      const col = (i % 5) - 2;
      allyMesh.userData.offsetX = col * 0.6 + (Math.random() - 0.5) * 0.2;
      allyMesh.userData.offsetZ = -(row + 1) * 0.7 + (Math.random() - 0.5) * 0.2;
      allyMesh.userData.bobPhase = Math.random() * Math.PI * 2;
      allyMesh.rotation.y = Math.PI; // 아군도 앞(+Z)을 바라보도록 회전

      this.objects.add(allyMesh);
      this.allyMeshes.push(allyMesh);
      this.allyMixers.push(mixer);
    }
  }

  setWeapon(weaponType) {
    this.weapon = weaponType;
    const bonusMap = { fist: 1.0, gun: 1.5, shotgun: 2.0, rocket: 3.0 };
    this.weaponMultiplier = bonusMap[weaponType] || 1.0;
    this.weaponMultiplier = 1 + (this.weaponMultiplier - 1) * (1 + this.weaponBonusMult);
    this.attackPower = this.baseAttack * this.weaponMultiplier;

    const weaponNamesKo = { fist: "주먹", gun: "권총", shotgun: "샷건", rocket: "로켓" };
    $('weaponDisplay').textContent = `${weaponNamesKo[weaponType] || "주먹"}`;
  }

  addAllies(count) {
    this.allies = Math.min(this.allies + count, 100);
    this.rebuildAllyMeshes();
    this.updateHUD();
  }

  loseAllies(count) {
    const actualDamage = Math.max(1, Math.floor(count * this.healthMult));
    this.allies = Math.max(0, this.allies - actualDamage);
    this.rebuildAllyMeshes();
    this.updateHUD();
    if (this.allies <= 0) this.gameFail();
  }

  updateHUD() {
    const allyEl = $('allyCount');
    allyEl.textContent = `${this.allies}명`;
    // Pulse animation on change
    allyEl.classList.remove('pulse');
    void allyEl.offsetWidth; // reflow to restart animation
    allyEl.classList.add('pulse');
    const progress = Math.min(100, (this.playerZ / this.stageData.length) * 100);
    $('progressFill').style.width = `${progress}%`;
  }

  spawnParticle(x, y, z, color, count = 5) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 4, 4),
        new THREE.MeshBasicMaterial({ color })
      );
      mesh.position.set(x, y, z);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 5 + 2, (Math.random() - 0.5) * 4);
      this.objects.add(mesh);
      this.particles.push({ mesh, vel, life: 1.0 });
    }
  }

  spawnDamageNumber(x, y, z, text, type = 'damage') {
    const div = document.createElement('div');
    div.className = `damage-number ${type}`;
    div.textContent = text;
    const pos = new THREE.Vector3(x, y, z);
    pos.project(camera);
    div.style.left = ((pos.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    div.style.top = ((-pos.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 800);
  }

  spawnBullet(fromX, fromY, fromZ, toX, toY, toZ) {
    const group = new THREE.Group();
    // Bullet core (bright yellow)
    const core = new THREE.Mesh(GEO.bullet, MAT.bullet);
    group.add(core);
    // Glow effect (orange halo)
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.4 });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), glowMat);
    group.add(glow);
    group.position.set(fromX, fromY, fromZ);
    const dir = new THREE.Vector3(toX - fromX, toY - fromY, toZ - fromZ).normalize();
    this.objects.add(group);
    this.bullets.push({ mesh: group, dir, speed: 25, life: 1.2 });
  }

  update(dt) {
    if (!this.isRunning || this.isFinished) return;
    const time = performance.now() / 1000;

    // Update animation mixers
    if (this.playerMixer) this.playerMixer.update(dt);
    this.allyMixers.forEach(m => { if (m) m.update(dt); });

    // Update collectible ally mixers
    this.collectibleObjects.forEach(obj => {
      if (obj.userData.collected) return;
      if (obj.userData.mixer) obj.userData.mixer.update(dt);
    });

    if (!this.isBossFight) {
      this.playerZ += this.speed * dt;
      this.playerX += (this.targetX - this.playerX) * 8 * dt;
      this.playerX = Math.max(-3, Math.min(3, this.playerX));

      if (this.playerMesh) {
        this.playerMesh.position.set(this.playerX, 0, this.playerZ);
        // Walk animation for fallback character
        const walkSpeed = 8;
        if (this.playerMesh.userData.legL) {
          const swing = Math.sin(time * walkSpeed) * 0.4;
          this.playerMesh.userData.legL.rotation.x = swing;
          this.playerMesh.userData.legR.rotation.x = -swing;
          this.playerMesh.userData.armL.rotation.x = -swing;
          this.playerMesh.userData.armR.rotation.x = swing;
        }
      }

      this.allyMeshes.forEach((m) => {
        m.position.x = this.playerX + m.userData.offsetX;
        m.position.z = this.playerZ + m.userData.offsetZ;
        // Ally walk animation
        if (m.userData.legL) {
          const phase = m.userData.bobPhase || 0;
          const swing = Math.sin(time * 8 + phase) * 0.4;
          m.userData.legL.rotation.x = swing;
          m.userData.legR.rotation.x = -swing;
          m.userData.armL.rotation.x = -swing;
          m.userData.armR.rotation.x = swing;
        }
      });

      // Auto-attack nearby zombies
      this.autoAttackTimer += dt;
      if (this.autoAttackTimer >= this.autoAttackInterval) {
        this.autoAttackTimer = 0;
        for (const obj of this.obstacleObjects) {
          if (obj.userData.collected || obj.userData.type !== "zombie") continue;
          const dx = this.playerX - obj.position.x;
          const dz = this.playerZ - obj.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          // Attack zombies within range (ahead of player)
          if (dz < 0 && dz > -10 && Math.abs(dx) < 3) {
            // Initialize HP tracking
            if (obj.userData.currentHP === undefined) obj.userData.currentHP = obj.userData.health;
            const dmg = Math.floor(this.attackPower * (1 + this.allies * 0.1));
            obj.userData.currentHP -= dmg;
            // Fire bullets toward zombie
            const bulletCount = Math.min(3, Math.ceil(this.allies / 3));
            for (let b = 0; b < bulletCount; b++) {
              this.spawnBullet(
                this.playerX + (Math.random() - 0.5) * 1.5, 0.8, this.playerZ + 0.3,
                obj.position.x + (Math.random() - 0.5) * 0.3, 0.7, obj.position.z
              );
            }
            sound.playShoot();
            this.spawnDamageNumber(obj.position.x, 2, obj.position.z, `-${dmg}`);

            // Zombie hit flash
            obj.traverse(c => {
              if (c.isMesh && c.material && c.material.emissive) {
                c.material.emissive.setHex(0xff0000);
                setTimeout(() => { if (c.material) c.material.emissive.setHex(0x000000); }, 100);
              }
            });

            if (obj.userData.currentHP <= 0) {
              obj.userData.collected = true;
              obj.visible = false;
              this.spawnParticle(obj.position.x, 0.8, obj.position.z, 0x66bb6a, 12);
              sound.playHit();
              screenShake.trigger(0.2, 0.15);
              // Reward: sometimes drop coins
              this.coinsCollected += 5;
              this.spawnDamageNumber(obj.position.x, 2.5, obj.position.z, '+5', 'coin');
            }
            break; // Attack one zombie at a time
          }
        }
      }

      // Obstacle collisions (contact damage)
      for (const obj of this.obstacleObjects) {
        if (obj.userData.collected) continue;
        const dx = this.playerX - obj.position.x;
        const dz = this.playerZ - obj.position.z;
        if (Math.abs(dx) < 1.0 && Math.abs(dz) < 0.8) {
          if (obj.userData.type === "red_box") {
            obj.userData.collected = true;
            this.loseAllies(obj.userData.damage);
            this.spawnParticle(obj.position.x, 0.5, obj.position.z, 0xff0000, 8);
            this.spawnDamageNumber(obj.position.x, 2, obj.position.z, `-${obj.userData.damage}`);
            sound.playHit();
            screenShake.trigger(0.3, 0.2);
            obj.visible = false;
          } else if (obj.userData.type === "zombie") {
            // Touching zombie = take damage (didn't kill in time)
            if (obj.userData.currentHP === undefined) obj.userData.currentHP = obj.userData.health;
            const zombieDmg = Math.max(1, Math.ceil(obj.userData.currentHP / this.attackPower));
            obj.userData.collected = true;
            this.loseAllies(zombieDmg);
            this.spawnParticle(obj.position.x, 0.5, obj.position.z, 0xff4444, 8);
            this.spawnDamageNumber(obj.position.x, 2, obj.position.z, `-${zombieDmg}`);
            sound.playHit();
            screenShake.trigger(0.4, 0.25);
            obj.visible = false;
          }
        }
      }

      // Collectible collisions
      for (const obj of this.collectibleObjects) {
        if (obj.userData.collected) continue;
        const dx = this.playerX - obj.position.x;
        const dz = this.playerZ - obj.position.z;
        if (Math.abs(dx) < 1.5 && Math.abs(dz) < 1.5) {
          obj.userData.collected = true;
          if (obj.userData.type === "ally") {
            this.addAllies(1);
            this.spawnParticle(obj.position.x, 0.5, obj.position.z, 0x42a5f5, 5);
            this.spawnDamageNumber(obj.position.x, 2, obj.position.z, '+1', 'heal');
            sound.playAllyPickup();
          } else if (obj.userData.type === "coin") {
            this.coinsCollected += obj.userData.value;
            this.spawnParticle(obj.position.x, 0.8, obj.position.z, 0xffd700, 5);
            this.spawnDamageNumber(obj.position.x, 2, obj.position.z, `+${obj.userData.value}`, 'coin');
            sound.playCoin();
          } else if (obj.userData.type === "weapon") {
            this.setWeapon(obj.userData.weapon);
            this.spawnParticle(obj.position.x, 0.8, obj.position.z, 0xff9800, 8);
            sound.playWeapon();
          }
          obj.visible = false;
        }
      }

      // Gate collisions
      for (const obj of this.gateObjects) {
        if (obj.userData.collected) continue;
        const dx = this.playerX - obj.position.x;
        const dz = this.playerZ - obj.position.z;
        if (Math.abs(dx) < 1.5 && Math.abs(dz) < 1.0) {
          obj.userData.collected = true;
          if (obj.userData.type === "multiply") {
            const before = this.allies;
            this.allies = Math.min(this.allies * obj.userData.value, 100);
            const gained = this.allies - before;
            this.rebuildAllyMeshes();
            this.updateHUD();
            this.spawnParticle(obj.position.x, 1, obj.position.z, 0x4caf50, 12);
            if (gained > 0) this.spawnDamageNumber(obj.position.x, 3, obj.position.z, `+${gained}`, 'heal');
            sound.playGate();
          } else if (obj.userData.type === "add") {
            this.addAllies(obj.userData.value);
            this.spawnParticle(obj.position.x, 1, obj.position.z, 0x7c4dff, 10);
            this.spawnDamageNumber(obj.position.x, 3, obj.position.z, `+${obj.userData.value}`, 'heal');
            sound.playGate();
          }
          obj.traverse(c => {
            if (c.material && typeof c.material.clone === 'function') {
              c.material = c.material.clone();
              c.material.opacity = 0.2;
              c.material.transparent = true;
            }
          });
        }
      }

      // Coin float animation
      for (const obj of this.collectibleObjects) {
        if (obj.userData.collected) continue;
        if (obj.userData.type === "coin") {
          obj.rotation.y += dt * 3;
          obj.position.y = 0.6 + Math.sin(time * 3 + (obj.userData.floatPhase || 0)) * 0.15;
        }
      }

      // Player arrow bob
      if (this._playerArrow) {
        this._playerArrow.position.y = 1.3 + Math.sin(time * 4) * 0.1;
      }

      if (this.playerZ >= this.stageData.boss.z - 5) {
        this.startBossFight();
      }

      this.updateHUD();

    } else {
      // Boss fight
      this.bossFightTimer += dt;

      if (this.playerMesh) this.playerMesh.position.set(this.playerX, 0, this.playerZ);
      this.allyMeshes.forEach((m) => {
        m.position.x = this.playerX + m.userData.offsetX;
        m.position.z = this.playerZ + m.userData.offsetZ;
      });

      if (this.bossFightTimer >= this.bossAttackInterval) {
        this.bossFightTimer = 0;

        const dmg = Math.floor(this.allies * this.attackPower * 0.1);
        this.bossHealth -= dmg;

        this.spawnDamageNumber(this.bossObject.position.x, 4, this.bossObject.position.z, `-${dmg}`);
        sound.playBossHit();
        sound.playShoot();
        screenShake.trigger(0.15, 0.1);

        const bulletCount = Math.min(this.allies, 8);
        for (let i = 0; i < bulletCount; i++) {
          const fromX = this.playerX + (Math.random() - 0.5) * 2.5;
          const fromZ = this.playerZ + 0.3;
          this.spawnBullet(fromX, 0.8, fromZ,
            this.bossObject.position.x + (Math.random() - 0.5) * 0.8,
            1.2, this.bossObject.position.z);
        }

        // Boss hit flash
        this.bossObject.traverse(c => {
          if (c.isMesh && c.material) {
            const origEmissive = c.material.emissiveIntensity || 0;
            c.material.emissiveIntensity = 1.0;
            setTimeout(() => { c.material.emissiveIntensity = origEmissive; }, 100);
          }
        });

        const bossAtk = Math.max(1, Math.floor(this.stageId * 0.3 + 1));
        this.allies = Math.max(0, this.allies - bossAtk);
        this.rebuildAllyMeshes();
        this.updateHUD();
        if (bossAtk > 0) {
          this.spawnDamageNumber(this.playerX, 2, this.playerZ, `-${bossAtk}`);
        }

        const hpPercent = Math.max(0, this.bossHealth / this.bossMaxHealth * 100);
        $('bossHpFill').style.width = `${hpPercent}%`;

        if (this.bossHealth <= 0) {
          this.bossDefeated = true;
          this.gameVictory();
        } else if (this.allies <= 0) {
          this.gameFail();
        }
      }

      // Boss idle animation
      this.bossObject.position.y = Math.sin(time * 2) * 0.2;
      this.bossObject.rotation.y = Math.sin(time * 0.5) * 0.1;

      // Animate shadow orbs if present
      this.bossObject.traverse(c => {
        if (c.userData.orbIndex !== undefined) {
          const angle = time * 1.5 + (c.userData.orbIndex / 3) * Math.PI * 2;
          c.position.x = Math.cos(angle) * 1.5;
          c.position.z = Math.sin(angle) * 1.5;
        }
      });
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vel.y -= 9.8 * dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.life -= dt * 1.5;
      p.mesh.material.opacity = p.life;
      p.mesh.material.transparent = true;
      if (p.life <= 0) {
        this.objects.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }

    // Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.mesh.position.add(b.dir.clone().multiplyScalar(b.speed * dt));
      b.life -= dt * 2;
      if (b.life <= 0) {
        this.objects.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }

    // Screen shake update
    screenShake.update(dt);

    // Camera - behind & above
    const camTargetX = this.playerX * 0.3;
    const camTargetZ = this.playerZ - 7;
    camera.position.x += (camTargetX - camera.position.x) * 3 * dt;
    camera.position.z += (camTargetZ - camera.position.z) * 3 * dt;
    camera.position.y = 7;
    camera.position.x += screenShake.offsetX;
    camera.position.y += screenShake.offsetY;
    camera.lookAt(this.playerX * 0.3, 0, this.playerZ + 5);

    dirLight.position.set(this.playerX + 5, 15, this.playerZ - 5);
    dirLight.target.position.set(this.playerX, 0, this.playerZ);
    dirLight.target.updateMatrixWorld();
  }

  startBossFight() {
    if (this.isBossFight) return;
    this.isBossFight = true;
    this.speed = 0;
    this.bossFightTimer = 0;

    // Switch player to idle animation
    if (this.playerMixer) {
      this.playerMixer.stopAllAction();
      playAnimation(this.playerMixer, 'idle');
    }
    this.allyMixers.forEach(m => {
      if (m) { m.stopAllAction(); playAnimation(m, 'idle'); }
    });

    $('bossHpBar').classList.add('active');
    $('bossName').textContent = this.stageData.boss.nameKo;
    $('bossHpFill').style.width = '100%';
  }

  gameVictory() {
    this.isFinished = true;
    this.isRunning = false;

    this.spawnParticle(this.bossObject.position.x, 2, this.bossObject.position.z, 0x9c27b0, 30);
    this.bossObject.visible = false;
    sound.playVictory();
    screenShake.trigger(0.5, 0.4);

    const coinBonus = UPGRADE_DEFS[3].effect(gameData.upgrades.coinBonus);
    const baseCoins = this.stageData.rewards.coins + this.coinsCollected;
    const totalCoins = Math.floor(baseCoins * coinBonus);

    const survivalRate = this.allies / this.startAllies;
    let stars = 1;
    if (survivalRate >= 0.7) stars = 3;
    else if (survivalRate >= 0.4) stars = 2;

    gameData.coins += totalCoins;
    if (gameData.currentStage === gameData.maxStage) gameData.maxStage++;
    gameData.currentStage = Math.min(gameData.currentStage + 1, gameData.maxStage);
    saveGameData(gameData);

    const clearedStage = this.stageId;
    setTimeout(() => {
      if (clearedStage >= 10) {
        // Show ending credits!
        showEndingCredit(totalCoins, stars, this.allies, this.startAllies);
      } else {
        $('starsDisplay').textContent = '\u2B50'.repeat(stars) + '\u2606'.repeat(3 - stars);
        $('rewardText').textContent = `+${totalCoins} 코인`;
        showScreen('complete');
        spawnConfetti();
      }
    }, 1000);
  }

  gameFail() {
    this.isFinished = true;
    this.isRunning = false;
    $('failReason').textContent = '모든 동료가 쓰러졌습니다!';
    sound.playFail();
    screenShake.trigger(0.6, 0.5);
    setTimeout(() => showScreen('fail'), 500);
  }

  destroy() {
    scene.remove(this.objects);
    // Only dispose dynamically created geometries/materials, not shared ones
    const sharedGeos = new Set(Object.values(GEO));
    const sharedMats = new Set(Object.values(MAT));
    this.objects.traverse(obj => {
      if (obj.geometry && !sharedGeos.has(obj.geometry)) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => {
          if (!sharedMats.has(m)) {
            if (m.map) m.map.dispose();
            m.dispose();
          }
        });
      }
    });
    this.playerMesh = null;
    this.playerMixer = null;
    this.allyMeshes = [];
    this.allyMixers = [];
  }
}

// ============================================================
//  INPUT
// ============================================================
const touchArea = $('touchArea');
let inputActive = false;
let lastInputX = 0;

function onInputStart(clientX) {
  if (!game || !game.isRunning) return;
  inputActive = true;
  lastInputX = clientX;
}
function onInputMove(clientX) {
  if (!game || !game.isRunning || !inputActive) return;
  const dx = clientX - lastInputX;
  lastInputX = clientX;
  game.targetX += dx * 0.015;
  game.targetX = Math.max(-3, Math.min(3, game.targetX));
}
function onInputEnd() { inputActive = false; }

touchArea.addEventListener('mousedown', (e) => onInputStart(e.clientX));
touchArea.addEventListener('mousemove', (e) => onInputMove(e.clientX));
touchArea.addEventListener('mouseup', onInputEnd);
touchArea.addEventListener('mouseleave', onInputEnd);
touchArea.addEventListener('touchstart', (e) => { e.preventDefault(); onInputStart(e.touches[0].clientX); }, { passive: false });
touchArea.addEventListener('touchmove', (e) => { e.preventDefault(); onInputMove(e.touches[0].clientX); }, { passive: false });
touchArea.addEventListener('touchend', onInputEnd);

document.addEventListener('keydown', (e) => {
  if (!game || !game.isRunning) return;
  if (e.key === 'ArrowLeft' || e.key === 'a') game.targetX -= 0.5;
  if (e.key === 'ArrowRight' || e.key === 'd') game.targetX += 0.5;
  game.targetX = Math.max(-3, Math.min(3, game.targetX));
});

// ============================================================
//  BUTTON HANDLERS
// ============================================================
// ============================================================
//  MENU PARTICLES
// ============================================================
function createMenuParticles() {
  const container = $('menuParticles');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    const size = 2 + Math.random() * 4;
    p.style.cssText = `
      position: absolute; width: ${size}px; height: ${size}px; border-radius: 50%;
      background: rgba(100,255,218,${0.1 + Math.random() * 0.3});
      left: ${Math.random() * 100}%; top: ${Math.random() * 100}%;
      animation: menuFloat ${5 + Math.random() * 10}s ease-in-out infinite;
      animation-delay: ${-Math.random() * 10}s;
    `;
    container.appendChild(p);
  }

  // Add keyframes if not already added
  if (!document.getElementById('menuFloatStyle')) {
    const style = document.createElement('style');
    style.id = 'menuFloatStyle';
    style.textContent = `
      @keyframes menuFloat {
        0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
        25% { transform: translateY(-30px) translateX(15px); opacity: 0.7; }
        50% { transform: translateY(-10px) translateX(-10px); opacity: 0.5; }
        75% { transform: translateY(-40px) translateX(5px); opacity: 0.6; }
      }
    `;
    document.head.appendChild(style);
  }
}

// ============================================================
//  CONFETTI EFFECT (victory)
// ============================================================
function spawnConfetti() {
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const pieces = [];
  const colors = ['#ffd700', '#ff4444', '#4fc3f7', '#64ffda', '#ff9800', '#e040fb'];
  for (let i = 0; i < 80; i++) {
    pieces.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 15 - 5,
      w: 6 + Math.random() * 8,
      h: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3,
      life: 1,
    });
  }

  let frame = 0;
  function drawConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pieces.forEach(p => {
      if (p.life <= 0) return;
      alive = true;
      p.vy += 0.3;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotSpeed;
      p.life -= 0.008;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    frame++;
    if (alive && frame < 180) {
      requestAnimationFrame(drawConfetti);
    } else {
      canvas.remove();
    }
  }
  drawConfetti();
}

// ============================================================
//  TUTORIAL
// ============================================================
let tutorialShown = false;
try {
  tutorialShown = localStorage.getItem('crowdRunnerTutorial') === 'done';
} catch (e) { /* ignore */ }

function showTutorial() {
  $('tutorial').classList.add('active');
}

$('btnTutorialOk').addEventListener('click', () => {
  sound.playClick();
  $('tutorial').classList.remove('active');
  try { localStorage.setItem('crowdRunnerTutorial', 'done'); } catch (e) { /* */ }
  tutorialShown = true;
  startGame(gameData.currentStage);
});

// ============================================================
//  STAGE INTRO
// ============================================================
function showStageIntro(stageId, stageName, callback) {
  const introScreen = $('stageIntro');
  $('stageIntroText').textContent = `스테이지 ${stageId}`;
  $('stageIntroName').textContent = stageName;
  introScreen.classList.add('active');

  // Re-trigger animation
  $('stageIntroText').style.animation = 'none';
  $('stageIntroName').style.animation = 'none';
  requestAnimationFrame(() => {
    $('stageIntroText').style.animation = '';
    $('stageIntroName').style.animation = '';
  });

  setTimeout(() => {
    introScreen.classList.remove('active');
    if (callback) callback();
  }, 1500);
}

function startGame(stageId) {
  if (game) game.destroy();
  game = null; // Clear reference before creating new
  game = new Game(stageId);
  game.setWeapon('fist');
  game.updateHUD();
  showScreen('game');

  const stageData = getStage(stageId);
  game.isRunning = false;
  showStageIntro(stageId, stageData.name, () => {
    game.isRunning = true;
  });
}

function initSound() {
  sound.init();
  sound.resume();
}

$('btnPlay').addEventListener('click', () => {
  initSound(); sound.playClick();
  if (!tutorialShown) {
    showTutorial();
    return;
  }
  startGame(gameData.currentStage);
});
$('btnUpgrade').addEventListener('click', () => { initSound(); sound.playClick(); showScreen('upgrade'); });
$('btnUpgradeBack').addEventListener('click', () => { sound.playClick(); showScreen('menu'); });
$('btnNext').addEventListener('click', () => { sound.playClick(); startGame(gameData.currentStage); });
$('btnReplay').addEventListener('click', () => {
  sound.playClick();
  gameData.currentStage = Math.max(1, gameData.currentStage - 1);
  startGame(gameData.currentStage);
});
$('btnCompleteMenu').addEventListener('click', () => { sound.playClick(); if (game) game.destroy(); game = null; showScreen('menu'); });
$('btnRetry').addEventListener('click', () => { sound.playClick(); startGame(gameData.currentStage); });
$('btnFailMenu').addEventListener('click', () => { sound.playClick(); if (game) game.destroy(); game = null; showScreen('menu'); });
$('btnEndingMenu').addEventListener('click', () => { sound.playClick(); if (game) game.destroy(); game = null; showScreen('menu'); });
$('btnSound').addEventListener('click', () => {
  initSound();
  const enabled = sound.toggle();
  $('btnSound').textContent = enabled ? '🔊' : '🔇';
  $('btnSound').classList.toggle('muted', !enabled);
});

// ============================================================
//  GAME LOOP
// ============================================================
let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  if (game) game.update(dt);
  renderer.render(scene, camera);
}

// ============================================================
//  RESIZE
// ============================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
//  INIT - Load model then start
// ============================================================
const loadingFill = document.querySelector('.loading-bar-fill');
const loadingText = $('loadingText');

let appStarted = false;
function startApp() {
  if (appStarted) return;
  appStarted = true;
  $('loadingScreen').style.display = 'none';
  createMenuParticles();
  showScreen('menu');
  animate(performance.now());
}

// Start app immediately - don't wait for model
if (loadingFill) loadingFill.style.width = '100%';
if (loadingText) loadingText.textContent = '시작합니다...';
setTimeout(startApp, 500);

// Load 3D model in background (will be used when available)
loadSoldierModelBackground();
