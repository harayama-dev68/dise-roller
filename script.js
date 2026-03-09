import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es';

const sceneRoot = document.getElementById('scene');
const result = document.getElementById('result');
const button = document.getElementById('rollButton');
const diceCountInput = document.getElementById('diceCount');
const wallTransparencyToggle = document.getElementById('wallTransparencyToggle');
const soundVolumeInput = document.getElementById('soundVolume');
const soundVolumeValue = document.getElementById('soundVolumeValue');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
sceneRoot.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#152033');

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 7, 12);
camera.lookAt(0, 1, 0);

const hemi = new THREE.HemisphereLight(0xdde8ff, 0x182033, 1.0);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(5, 9, 4);
scene.add(dir);

const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -18, 0),
});
world.allowSleep = true;
world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.friction = 0.45;
world.defaultContactMaterial.restitution = 0.35;

const tableSize = 18;
const tableGeo = new THREE.BoxGeometry(tableSize, 0.5, tableSize);
const tableMat = new THREE.MeshStandardMaterial({ color: '#344966', roughness: 0.9, metalness: 0.05 });
const tableMesh = new THREE.Mesh(tableGeo, tableMat);
tableMesh.position.set(0, -0.25, 0);
scene.add(tableMesh);

const tableHalfSize = tableSize / 2;
const tableBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(tableHalfSize, 0.25, tableHalfSize)) });
tableBody.position.set(0, -0.25, 0);
world.addBody(tableBody);

const wallHeight = 3;
const wallThickness = 0.8;
const wallMat = new THREE.MeshStandardMaterial({
  color: '#8fb7ff',
  transparent: true,
  opacity: 1,
  roughness: 0.6,
  metalness: 0,
});
let isWallTransparencyEnabled = false;

function setWallTransparency(isTransparent) {
  isWallTransparencyEnabled = isTransparent;
  wallMat.opacity = isTransparent ? 0 : 1;
  wallTransparencyToggle.textContent = `壁: 透過${isTransparent ? 'ON' : 'OFF'}`;
}

function addBoundaryWall(width, depth, x, z) {
  const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, depth), wallMat);
  wallMesh.position.set(x, wallHeight / 2, z);
  scene.add(wallMesh);

  const wallBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(width / 2, wallHeight / 2, depth / 2)),
  });
  wallBody.position.set(x, wallHeight / 2, z);
  world.addBody(wallBody);
}

addBoundaryWall(tableSize + wallThickness * 2, wallThickness, 0, tableHalfSize + wallThickness / 2);
addBoundaryWall(tableSize + wallThickness * 2, wallThickness, 0, -(tableHalfSize + wallThickness / 2));
addBoundaryWall(wallThickness, tableSize + wallThickness * 2, tableHalfSize + wallThickness / 2, 0);
addBoundaryWall(wallThickness, tableSize + wallThickness * 2, -(tableHalfSize + wallThickness / 2), 0);

function createFaceTexture(value) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f7fbff';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#1a2a44';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 240, 240);
  ctx.fillStyle = '#111';
  ctx.font = 'bold 150px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), 128, 138);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

const faceOrder = [1, 6, 2, 5, 3, 4];
const materials = faceOrder.map((n) => new THREE.MeshStandardMaterial({ map: createFaceTexture(n), roughness: 0.3, metalness: 0 }));

const diceSize = 1.2;
const worldUp = new CANNON.Vec3(0, 1, 0);
const localNormals = {
  1: new CANNON.Vec3(1, 0, 0),
  2: new CANNON.Vec3(0, 1, 0),
  3: new CANNON.Vec3(0, 0, 1),
  4: new CANNON.Vec3(0, 0, -1),
  5: new CANNON.Vec3(0, -1, 0),
  6: new CANNON.Vec3(-1, 0, 0),
};

const diceSet = [];
let announcedSleep = false;
const gltfLoader = new GLTFLoader();
let diceModelTemplate = null;

function loadDiceModel() {
  return new Promise((resolve) => {
    gltfLoader.load(
      './DICE.glb',
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
          }
        });

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxAxis = Math.max(size.x, size.y, size.z) || 1;
        const scale = diceSize / maxAxis;
        model.scale.setScalar(scale);

        const centeredBox = new THREE.Box3().setFromObject(model);
        const center = centeredBox.getCenter(new THREE.Vector3());
        model.position.sub(center);

        diceModelTemplate = model;
        resolve();
      },
      undefined,
      () => {
        diceModelTemplate = null;
        resolve();
      },
    );
  });
}

let audioContext = null;
let canPlayCollisionSound = false;
let lastCollisionSoundTime = 0;
const collisionSoundIntervalMs = 35;
let collisionVolume = (Number.parseInt(soundVolumeInput.value, 10) || 80) / 100;

function setCollisionVolume(value) {
  const bounded = Math.min(100, Math.max(0, Number.parseInt(value, 10) || 0));
  collisionVolume = bounded / 100;
  soundVolumeInput.value = String(bounded);
  soundVolumeValue.textContent = `${bounded}%`;
}

function ensureAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  return audioContext;
}

function playCollisionSound(strength) {
  if (!canPlayCollisionSound) {
    return;
  }

  const now = performance.now();
  if (now - lastCollisionSoundTime < collisionSoundIntervalMs) {
    return;
  }
  lastCollisionSoundTime = now;

  const context = ensureAudioContext();
  if (!context) {
    return;
  }

  const clampedStrength = Math.min(1, Math.max(0, strength));
  const duration = 0.032 + clampedStrength * 0.038;
  const start = context.currentTime;
  const end = start + duration;

  const bufferSize = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    const t = i / bufferSize;
    const decay = 1 - t;
    data[i] = (Math.random() * 2 - 1) * decay * decay;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;

  const highpass = context.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 1100 + clampedStrength * 900;

  const bandpass = context.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 2100 + clampedStrength * 1700;
  bandpass.Q.value = 2.2;

  const impactPeak = (0.055 + clampedStrength * 0.14) * collisionVolume;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, impactPeak), start + 0.0014);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  source.connect(highpass);
  highpass.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(context.destination);

  const click = context.createOscillator();
  const clickGain = context.createGain();
  click.type = 'triangle';
  click.frequency.setValueAtTime(2600 + clampedStrength * 1400, start);
  click.frequency.exponentialRampToValueAtTime(900, start + 0.012);
  const clickPeak = (0.028 + clampedStrength * 0.04) * collisionVolume;
  clickGain.gain.setValueAtTime(0.0001, start);
  clickGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, clickPeak), start + 0.0008);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.015);

  click.connect(clickGain);
  clickGain.connect(context.destination);

  source.start(start);
  source.stop(end);
  click.start(start);
  click.stop(start + 0.016);
}

function onDiceCollide(event) {
  if (!event.contact) {
    return;
  }

  const impactVelocity = Math.abs(event.contact.getImpactVelocityAlongNormal());
  if (impactVelocity < 1.2) {
    return;
  }

  const normalized = (impactVelocity - 1.2) / 12;
  playCollisionSound(normalized);
}

function topFaceValue(body) {
  let best = 1;
  let maxDot = -Infinity;

  for (const [face, normal] of Object.entries(localNormals)) {
    const worldNormal = body.quaternion.vmult(normal);
    const dot = worldNormal.dot(worldUp);
    if (dot > maxDot) {
      maxDot = dot;
      best = Number(face);
    }
  }

  return best;
}

function createDie() {
  const mesh = diceModelTemplate
    ? diceModelTemplate.clone(true)
    : new THREE.Mesh(new THREE.BoxGeometry(diceSize, diceSize, diceSize), materials);
  scene.add(mesh);

  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Box(new CANNON.Vec3(diceSize / 2, diceSize / 2, diceSize / 2)),
    material: new CANNON.Material('dice'),
    linearDamping: 0.25,
    angularDamping: 0.2,
    sleepTimeLimit: 0.5,
    sleepSpeedLimit: 0.12,
  });
  body.addEventListener('collide', onDiceCollide);
  world.addBody(body);

  return { mesh, body };
}

function syncDiceCount() {
  const count = Math.min(10, Math.max(1, Number.parseInt(diceCountInput.value, 10) || 1));
  diceCountInput.value = String(count);

  while (diceSet.length < count) {
    diceSet.push(createDie());
  }

  while (diceSet.length > count) {
    const die = diceSet.pop();
    die.body.removeEventListener('collide', onDiceCollide);
    world.removeBody(die.body);
    scene.remove(die.mesh);
    die.mesh.geometry.dispose();
  }
}

function rollDice() {
  ensureAudioContext();
  canPlayCollisionSound = true;
  syncDiceCount();
  announcedSleep = false;
  result.textContent = '結果: ...';

  const cols = Math.ceil(Math.sqrt(diceSet.length));
  const spacing = 1.6;

  diceSet.forEach(({ body }, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const offsetX = (col - (cols - 1) / 2) * spacing;
    const offsetZ = (row - (Math.ceil(diceSet.length / cols) - 1) / 2) * spacing;

    body.wakeUp();
    body.position.set(offsetX + (Math.random() - 0.5) * 0.4, 5.2 + Math.random() * 0.7, offsetZ + (Math.random() - 0.5) * 0.4);
    body.velocity.set((Math.random() - 0.5) * 3.6, -1.6, (Math.random() - 0.5) * 3.6);
    body.angularVelocity.set(
      (Math.random() * 2 + 10) * (Math.random() < 0.5 ? -1 : 1),
      (Math.random() * 2 + 12) * (Math.random() < 0.5 ? -1 : 1),
      (Math.random() * 2 + 8) * (Math.random() < 0.5 ? -1 : 1),
    );
    body.quaternion.setFromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  });
}

button.addEventListener('click', rollDice);
diceCountInput.addEventListener('change', () => {
  syncDiceCount();
  rollDice();
});
wallTransparencyToggle.addEventListener('click', () => {
  setWallTransparency(!isWallTransparencyEnabled);
});
soundVolumeInput.addEventListener('input', () => {
  setCollisionVolume(soundVolumeInput.value);
});

function resize() {
  const width = sceneRoot.clientWidth;
  const height = sceneRoot.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
window.addEventListener('resize', resize);
resize();

const fixedTimeStep = 1 / 60;
let last = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  world.step(fixedTimeStep, dt, 4);

  for (const { mesh, body } of diceSet) {
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
  }

  const allSleeping = diceSet.length > 0 && diceSet.every(({ body }) => body.sleepState === CANNON.Body.SLEEPING);
  if (!announcedSleep && allSleeping) {
    announcedSleep = true;
    const values = diceSet.map(({ body }) => topFaceValue(body));
    const total = values.reduce((sum, value) => sum + value, 0);
    result.textContent = `結果: ${values.join(' + ')} = ${total}`;
  }

  renderer.render(scene, camera);
}

loadDiceModel().finally(() => {
  syncDiceCount();
  setWallTransparency(false);
  setCollisionVolume(soundVolumeInput.value);
  rollDice();
  requestAnimationFrame(animate);
});
