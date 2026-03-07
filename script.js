import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es';

const sceneRoot = document.getElementById('scene');
const result = document.getElementById('result');
const button = document.getElementById('rollButton');
const diceCountInput = document.getElementById('diceCount');

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
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(diceSize, diceSize, diceSize), materials);
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
    world.removeBody(die.body);
    scene.remove(die.mesh);
    die.mesh.geometry.dispose();
  }
}

function rollDice() {
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

syncDiceCount();
rollDice();
requestAnimationFrame(animate);
