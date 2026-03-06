import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es';

const sceneRoot = document.getElementById('scene');
const result = document.getElementById('result');
const button = document.getElementById('rollButton');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
sceneRoot.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#152033');

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 5, 8);
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

const tableGeo = new THREE.BoxGeometry(9, 0.5, 9);
const tableMat = new THREE.MeshStandardMaterial({ color: '#344966', roughness: 0.9, metalness: 0.05 });
const tableMesh = new THREE.Mesh(tableGeo, tableMat);
tableMesh.position.set(0, -0.25, 0);
scene.add(tableMesh);

const tableBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(4.5, 0.25, 4.5)) });
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
const diceMesh = new THREE.Mesh(new THREE.BoxGeometry(diceSize, diceSize, diceSize), materials);
scene.add(diceMesh);

const diceBody = new CANNON.Body({
  mass: 1,
  shape: new CANNON.Box(new CANNON.Vec3(diceSize / 2, diceSize / 2, diceSize / 2)),
  material: new CANNON.Material('dice'),
  linearDamping: 0.25,
  angularDamping: 0.2,
  sleepTimeLimit: 0.5,
  sleepSpeedLimit: 0.12,
});
world.addBody(diceBody);

const worldUp = new CANNON.Vec3(0, 1, 0);
const localNormals = {
  1: new CANNON.Vec3(1, 0, 0),
  2: new CANNON.Vec3(0, 1, 0),
  3: new CANNON.Vec3(0, 0, 1),
  4: new CANNON.Vec3(0, 0, -1),
  5: new CANNON.Vec3(0, -1, 0),
  6: new CANNON.Vec3(-1, 0, 0),
};

function topFaceValue() {
  let best = 1;
  let maxDot = -Infinity;

  for (const [face, normal] of Object.entries(localNormals)) {
    const worldNormal = diceBody.quaternion.vmult(normal);
    const dot = worldNormal.dot(worldUp);
    if (dot > maxDot) {
      maxDot = dot;
      best = Number(face);
    }
  }

  return best;
}

let announcedSleep = false;

function rollDice() {
  announcedSleep = false;
  result.textContent = '結果: ...';

  diceBody.wakeUp();
  diceBody.position.set((Math.random() - 0.5) * 1.2, 5.2, (Math.random() - 0.5) * 1.2);
  diceBody.velocity.set((Math.random() - 0.5) * 2.6, -1.5, (Math.random() - 0.5) * 2.6);
  diceBody.angularVelocity.set((Math.random() * 2 + 10) * (Math.random() < 0.5 ? -1 : 1), (Math.random() * 2 + 12) * (Math.random() < 0.5 ? -1 : 1), (Math.random() * 2 + 8) * (Math.random() < 0.5 ? -1 : 1));
  diceBody.quaternion.setFromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
}

button.addEventListener('click', rollDice);

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

  diceMesh.position.copy(diceBody.position);
  diceMesh.quaternion.copy(diceBody.quaternion);

  if (!announcedSleep && diceBody.sleepState === CANNON.Body.SLEEPING) {
    announcedSleep = true;
    result.textContent = `結果: ${topFaceValue()}`;
  }

  renderer.render(scene, camera);
}

rollDice();
requestAnimationFrame(animate);
