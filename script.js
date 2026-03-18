import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { FBXLoader } from 'https://unpkg.com/three@0.161.0/examples/jsm/loaders/FBXLoader.js';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es';

const sceneRoot = document.getElementById('scene');
const result = document.getElementById('result');
const button = document.getElementById('rollButton');
const diceCountInput = document.getElementById('diceCount');
const wallTransparencyToggle = document.getElementById('wallTransparencyToggle');
const soundVolumeInput = document.getElementById('soundVolume');
const soundVolumeValue = document.getElementById('soundVolumeValue');
const d6Button = document.getElementById('d6Button');
const d10Button = document.getElementById('d10Button');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
sceneRoot.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#000000');

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 7, 12);
camera.lookAt(0, 1, 0);

const cameraSettings = {
  minDistance: 10,
  maxDistance: 20,
  padding: 1.35,
  verticalOffset: 2.4,
  followLerp: 0.085,
  lookLerp: 0.11,
};
const cameraState = {
  currentPosition: camera.position.clone(),
  currentLookTarget: new THREE.Vector3(0, 1, 0),
};

const hemi = new THREE.HemisphereLight(0xdde8ff, 0x182033, 0.05);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 0.1);
dir.position.set(5, 10, 4);
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
dir.shadow.camera.near = 1;
dir.shadow.camera.far = 30;
dir.shadow.camera.left = -12;
dir.shadow.camera.right = 12;
dir.shadow.camera.top = 12;
dir.shadow.camera.bottom = -12;
scene.add(dir);

const tableSpotLight = new THREE.SpotLight(0xfff3d6, 15.5, 35, Math.PI * 0.2, 0.15, 0.5);
tableSpotLight.position.set(0, 18, 0);
tableSpotLight.target.position.set(0, 0, 0);
tableSpotLight.castShadow = true;
tableSpotLight.shadow.mapSize.set(2048, 2048);
tableSpotLight.shadow.camera.near = 1;
tableSpotLight.shadow.camera.far = 35;
tableSpotLight.shadow.focus = 1;
tableSpotLight.shadow.bias = -0.00008;
scene.add(tableSpotLight);
scene.add(tableSpotLight.target);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -18, 0) });
world.allowSleep = true;
world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.friction = 0.45;
world.defaultContactMaterial.restitution = 0.35;

const tableSize = 30;
const textureLoader = new THREE.TextureLoader();
const tableTexture = textureLoader.load('walnut_wood_grain_and_knots.jpg');
const tableNormalMap = textureLoader.load('walnut_wood_grain_and_knots_normal_map.png');
tableTexture.colorSpace = THREE.SRGBColorSpace;
tableTexture.wrapS = THREE.ClampToEdgeWrapping;
tableTexture.wrapT = THREE.ClampToEdgeWrapping;
tableTexture.repeat.set(1, 1);
tableNormalMap.wrapS = THREE.ClampToEdgeWrapping;
tableNormalMap.wrapT = THREE.ClampToEdgeWrapping;
tableNormalMap.repeat.set(1, 1);

const tableGeo = new THREE.BoxGeometry(tableSize, 0.5, tableSize);
const tableMat = new THREE.MeshStandardMaterial({
  map: tableTexture,
  normalMap: tableNormalMap,
  normalScale: new THREE.Vector2(1, 1),
  roughness: 0.9,
  metalness: 0.05,
});
const tableMesh = new THREE.Mesh(tableGeo, tableMat);
tableMesh.position.set(0, -0.25, 0);
tableMesh.receiveShadow = true;
scene.add(tableMesh);

const tableHalfSize = tableSize / 2;
const tableBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(tableHalfSize, 0.25, tableHalfSize)) });
tableBody.position.set(0, -0.25, 0);
world.addBody(tableBody);

const wallHeight = 3;
const wallThickness = 0.8;
const wallMat = new THREE.MeshStandardMaterial({ color: '#8fb7ff', transparent: true, opacity: 1, roughness: 0.6, metalness: 0 });
let isWallTransparencyEnabled = false;

function setWallTransparency(isTransparent) {
  isWallTransparencyEnabled = isTransparent;
  wallMat.opacity = isTransparent ? 0 : 1;
  wallTransparencyToggle.textContent = `壁: 透過${isTransparent ? 'ON' : 'OFF'}`;
}

function addBoundaryWall(width, depth, x, z) {
  const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, depth), wallMat);
  wallMesh.position.set(x, wallHeight / 2, z);
  wallMesh.receiveShadow = true;
  wallMesh.castShadow = true;
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

function createFaceTexture(value, { shape = 'square', rotation = 0 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f7fbff';
  ctx.fillRect(0, 0, 256, 256);
  ctx.save();
  ctx.translate(128, 128);
  ctx.rotate(rotation);
  ctx.translate(-128, -128);
  ctx.strokeStyle = '#1a2a44';
  ctx.lineWidth = 10;

  if (shape === 'kite') {
    ctx.beginPath();
    ctx.moveTo(128, 18);
    ctx.lineTo(228, 112);
    ctx.lineTo(128, 238);
    ctx.lineTo(28, 112);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.strokeRect(8, 8, 240, 240);
  }

  ctx.fillStyle = '#111';
  ctx.font = 'bold 122px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), 128, 138);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

const d6FaceOrder = [1, 6, 2, 5, 3, 4];
const d6Materials = d6FaceOrder.map((value) => new THREE.MeshStandardMaterial({ map: createFaceTexture(value), roughness: 0.3, metalness: 0 }));

const diceSize = 1.2;
const worldUp = new CANNON.Vec3(0, 1, 0);
const fbxLoader = new FBXLoader();
let d6ModelTemplate = null;
let currentDiceType = 'd6';
const diceSet = [];
let announcedSleep = false;

const d10Values = [1, 7, 3, 9, 5, 10, 4, 8, 2, 6];
const d10FaceMaterials = d10Values.map((value) => new THREE.MeshStandardMaterial({
  map: createFaceTexture(value, { shape: 'kite' }),
  roughness: 0.28,
  metalness: 0.02,
  side: THREE.DoubleSide,
}));

function buildD10Geometry() {
  const radius = diceSize * 0.72;
  const topY = diceSize * 0.78;
  const bottomY = -topY;
  const ringOffset = diceSize * 0.16;
  const top = new THREE.Vector3(0, topY, 0);
  const bottom = new THREE.Vector3(0, bottomY, 0);
  const upperRing = [];
  const lowerRing = [];

  for (let index = 0; index < 5; index += 1) {
    const angle = (Math.PI * 2 * index) / 5;
    upperRing.push(new THREE.Vector3(Math.cos(angle) * radius, ringOffset, Math.sin(angle) * radius));
    const lowerAngle = angle + Math.PI / 5;
    lowerRing.push(new THREE.Vector3(Math.cos(lowerAngle) * radius, -ringOffset, Math.sin(lowerAngle) * radius));
  }

  const faces = [];
  for (let index = 0; index < 5; index += 1) {
    faces.push([top, upperRing[index], lowerRing[index], upperRing[(index + 1) % 5]]);
  }
  for (let index = 0; index < 5; index += 1) {
    faces.push([bottom, lowerRing[(index + 1) % 5], upperRing[(index + 1) % 5], lowerRing[index]]);
  }

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const groups = [];
  let vertexOffset = 0;

  faces.forEach((face, faceIndex) => {
    const a = face[0];
    const b = face[1];
    const c = face[2];
    const d = face[3];
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const localUv = [
      [0.5, 0.05],
      [0.95, 0.42],
      [0.5, 0.95],
      [0.05, 0.42],
    ];

    [a, b, c, d].forEach((vertex, vertexIndex) => {
      positions.push(vertex.x, vertex.y, vertex.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(localUv[vertexIndex][0], localUv[vertexIndex][1]);
    });

    indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3);
    groups.push({ start: faceIndex * 6, count: 6, materialIndex: faceIndex });
    vertexOffset += 4;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.clearGroups();
  groups.forEach((group) => geometry.addGroup(group.start, group.count, group.materialIndex));
  geometry.computeBoundingSphere();

  const physicsVertices = [
    [0, topY, 0],
    ...upperRing.map((vertex) => [vertex.x, vertex.y, vertex.z]),
    ...lowerRing.map((vertex) => [vertex.x, vertex.y, vertex.z]),
    [0, bottomY, 0],
  ].map(([x, y, z]) => new CANNON.Vec3(x, y, z));

  const upperStart = 1;
  const lowerStart = 6;
  const bottomIndex = 11;
  const physicsFaces = [];
  const faceNormals = {};

  for (let index = 0; index < 5; index += 1) {
    const vertexIndices = [0, upperStart + index, lowerStart + index, upperStart + ((index + 1) % 5)];
    physicsFaces.push(vertexIndices);
    faceNormals[d10Values[index]] = vec3FromArray(normalFromFace(physicsVertices, vertexIndices));
  }

  for (let index = 0; index < 5; index += 1) {
    const vertexIndices = [bottomIndex, lowerStart + ((index + 1) % 5), upperStart + ((index + 1) % 5), lowerStart + index];
    physicsFaces.push(vertexIndices);
    faceNormals[d10Values[index + 5]] = vec3FromArray(normalFromFace(physicsVertices, vertexIndices));
  }

  return {
    geometry,
    faceNormals,
    shape: new CANNON.ConvexPolyhedron({ vertices: physicsVertices, faces: physicsFaces }),
  };
}


function vec3FromArray([x, y, z]) {
  return new CANNON.Vec3(x, y, z);
}

function normalFromFace(vertices, face) {
  const a = vertices[face[0]];
  const b = vertices[face[1]];
  const c = vertices[face[2]];
  const ab = b.vsub(a);
  const ac = c.vsub(a);
  const normal = ab.cross(ac);
  normal.normalize();
  return [normal.x, normal.y, normal.z];
}

const d10Data = buildD10Geometry();

const diceConfigs = {
  d6: {
    label: '6面ダイス',
    values: [1, 2, 3, 4, 5, 6],
    faceNormals: {
      1: new CANNON.Vec3(0, 1, 0),
      2: new CANNON.Vec3(1, 0, 0),
      3: new CANNON.Vec3(0, 0, 1),
      4: new CANNON.Vec3(-1, 0, 0),
      5: new CANNON.Vec3(0, -1, 0),
      6: new CANNON.Vec3(0, 0, -1),
    },
    createMesh() {
      const mesh = d6ModelTemplate
        ? d6ModelTemplate.clone(true)
        : new THREE.Mesh(new THREE.BoxGeometry(diceSize, diceSize, diceSize), d6Materials);
      mesh.scale.setScalar(1);
      return mesh;
    },
    shape: new CANNON.Box(new CANNON.Vec3(diceSize / 2, diceSize / 2, diceSize / 2)),
  },
  d10: {
    label: '10面ダイス',
    values: d10Values,
    faceNormals: d10Data.faceNormals,
    createMesh() {
      return new THREE.Mesh(d10Data.geometry.clone(), d10FaceMaterials);
    },
    shape: d10Data.shape,
  },
};

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
  if (!canPlayCollisionSound) return;
  const now = performance.now();
  if (now - lastCollisionSoundTime < collisionSoundIntervalMs) return;
  lastCollisionSoundTime = now;

  const context = ensureAudioContext();
  if (!context) return;

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
  const gain = context.createGain();
  const impactPeak = (0.055 + clampedStrength * 0.14) * collisionVolume;
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
  if (!event.contact) return;
  const impactVelocity = Math.abs(event.contact.getImpactVelocityAlongNormal());
  if (impactVelocity < 1.2) return;
  playCollisionSound((impactVelocity - 1.2) / 12);
}

function topFaceValue(body, faceNormals) {
  let best = 1;
  let maxDot = -Infinity;
  for (const [face, normal] of Object.entries(faceNormals)) {
    const worldNormal = body.quaternion.vmult(normal);
    const dot = worldNormal.dot(worldUp);
    if (dot > maxDot) {
      maxDot = dot;
      best = Number(face);
    }
  }
  return best;
}

function configureMesh(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.traverse?.((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  return mesh;
}

function createDie() {
  const config = diceConfigs[currentDiceType];
  const mesh = configureMesh(config.createMesh());
  scene.add(mesh);

  const body = new CANNON.Body({
    mass: currentDiceType === 'd10' ? 0.95 : 1,
    shape: config.shape,
    material: new CANNON.Material(`dice-${currentDiceType}`),
    linearDamping: 0.25,
    angularDamping: currentDiceType === 'd10' ? 0.17 : 0.2,
    sleepTimeLimit: 0.5,
    sleepSpeedLimit: 0.12,
  });
  body.addEventListener('collide', onDiceCollide);
  body.diceType = currentDiceType;
  world.addBody(body);
  return { mesh, body };
}

function disposeMeshResources(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry?.dispose?.();
    if (!Array.isArray(node.material) && node.material && !d6Materials.includes(node.material) && !d10FaceMaterials.includes(node.material)) {
      node.material.dispose?.();
    }
  });
}

function rebuildDiceForCurrentType() {
  const count = diceSet.length || Math.min(10, Math.max(1, Number.parseInt(diceCountInput.value, 10) || 1));
  while (diceSet.length > 0) {
    const die = diceSet.pop();
    die.body.removeEventListener('collide', onDiceCollide);
    world.removeBody(die.body);
    scene.remove(die.mesh);
    disposeMeshResources(die.mesh);
  }
  for (let index = 0; index < count; index += 1) {
    diceSet.push(createDie());
  }
}

function setDiceType(type) {
  if (!diceConfigs[type] || currentDiceType === type) {
    updateDiceTypeButtons();
    return;
  }
  currentDiceType = type;
  updateDiceTypeButtons();
  rebuildDiceForCurrentType();
  rollDice();
}

function updateDiceTypeButtons() {
  const isD6 = currentDiceType === 'd6';
  d6Button.classList.toggle('is-active', isD6);
  d10Button.classList.toggle('is-active', !isD6);
  d6Button.setAttribute('aria-pressed', String(isD6));
  d10Button.setAttribute('aria-pressed', String(!isD6));
}

async function loadD6Model() {
  try {
    const loaded = await fbxLoader.loadAsync('./Dice.fbx');
    const box = new THREE.Box3().setFromObject(loaded);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    const scale = diceSize / maxDimension;
    loaded.scale.setScalar(scale);
    loaded.updateMatrixWorld(true);
    const centered = new THREE.Box3().setFromObject(loaded);
    const center = new THREE.Vector3();
    centered.getCenter(center);
    loaded.position.sub(center);
    loaded.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    d6ModelTemplate = loaded;
    if (currentDiceType === 'd6') {
      rebuildDiceForCurrentType();
    }
  } catch (error) {
    console.warn('Dice.fbx の読み込みに失敗したため、立方体モデルを使用します。', error);
  }
}

function syncDiceCount() {
  const count = Math.min(10, Math.max(1, Number.parseInt(diceCountInput.value, 10) || 1));
  diceCountInput.value = String(count);
  while (diceSet.length < count) diceSet.push(createDie());
  while (diceSet.length > count) {
    const die = diceSet.pop();
    die.body.removeEventListener('collide', onDiceCollide);
    world.removeBody(die.body);
    scene.remove(die.mesh);
    disposeMeshResources(die.mesh);
  }
}

function rollDice() {
  ensureAudioContext();
  canPlayCollisionSound = true;
  syncDiceCount();
  announcedSleep = false;
  result.textContent = `結果 (${diceConfigs[currentDiceType].label}): ...`;

  const cols = Math.ceil(Math.sqrt(diceSet.length));
  const spacing = currentDiceType === 'd10' ? 1.9 : 1.6;

  diceSet.forEach(({ body }, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const offsetX = (col - (cols - 1) / 2) * spacing;
    const offsetZ = (row - (Math.ceil(diceSet.length / cols) - 1) / 2) * spacing;
    body.wakeUp();
    body.position.set(offsetX + (Math.random() - 0.5) * 0.45, 5.2 + Math.random() * 0.7, offsetZ + (Math.random() - 0.5) * 0.45);
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
wallTransparencyToggle.addEventListener('click', () => setWallTransparency(!isWallTransparencyEnabled));
soundVolumeInput.addEventListener('input', () => setCollisionVolume(soundVolumeInput.value));
d6Button.addEventListener('click', () => setDiceType('d6'));
d10Button.addEventListener('click', () => setDiceType('d10'));

function resize() {
  const width = sceneRoot.clientWidth;
  const height = sceneRoot.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function updateCameraTracking() {
  if (diceSet.length === 0) {
    cameraState.currentPosition.lerp(new THREE.Vector3(0, 7, 12), cameraSettings.followLerp);
    cameraState.currentLookTarget.lerp(new THREE.Vector3(0, 1, 0), cameraSettings.lookLerp);
    camera.position.copy(cameraState.currentPosition);
    camera.lookAt(cameraState.currentLookTarget);
    return;
  }

  const center = new THREE.Vector3();
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const avgVelocity = new THREE.Vector3();

  for (const { body } of diceSet) {
    const p = body.position;
    const v = body.velocity;
    center.x += p.x; center.y += p.y; center.z += p.z;
    avgVelocity.x += v.x; avgVelocity.y += v.y; avgVelocity.z += v.z;
    min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y); min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y); max.z = Math.max(max.z, p.z);
  }

  center.multiplyScalar(1 / diceSet.length);
  avgVelocity.multiplyScalar(1 / diceSet.length);
  const lookAhead = avgVelocity.multiplyScalar(0.12);
  const targetLook = center.clone().add(lookAhead);
  targetLook.y = Math.max(0.8, targetLook.y);
  const spanX = max.x - min.x;
  const spanZ = max.z - min.z;
  const sceneSpan = Math.max(spanX, spanZ, 2);
  const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
  const requiredDistance = (sceneSpan * cameraSettings.padding) / Math.tan(halfFov);
  const clampedDistance = THREE.MathUtils.clamp(requiredDistance, cameraSettings.minDistance, cameraSettings.maxDistance);
  const targetPosition = new THREE.Vector3(targetLook.x, targetLook.y + cameraSettings.verticalOffset + clampedDistance * 0.55, targetLook.z + clampedDistance);
  cameraState.currentPosition.lerp(targetPosition, cameraSettings.followLerp);
  cameraState.currentLookTarget.lerp(targetLook, cameraSettings.lookLerp);
  camera.position.copy(cameraState.currentPosition);
  camera.lookAt(cameraState.currentLookTarget);
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
    const values = diceSet.map(({ body }) => topFaceValue(body, diceConfigs[body.diceType || currentDiceType].faceNormals));
    const total = values.reduce((sum, value) => sum + value, 0);
    result.textContent = `結果 (${diceConfigs[currentDiceType].label}): ${values.join(' + ')} = ${total}`;
  }

  updateCameraTracking();
  renderer.render(scene, camera);
}

syncDiceCount();
updateDiceTypeButtons();
setWallTransparency(false);
setCollisionVolume(soundVolumeInput.value);
rollDice();
loadD6Model();
requestAnimationFrame(animate);
