import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

const floorEl = document.getElementById("floor");
const canvas = document.getElementById("scene");
const labelsEl = document.getElementById("labels");
const feed = document.getElementById("feed");
const updatedAt = document.getElementById("updatedAt");

const layoutOrder = [
  "builder",
  "pm",
  "research",
  "craigo",
  "qa",
  "growth",
  "ops",
  "content"
];

const statusColors = {
  idle: new THREE.Color("#94a3b8"),
  busy: new THREE.Color("#4ade80"),
  blocked: new THREE.Color("#f87171")
};

const labelColors = {
  idle: "#94a3b8",
  busy: "#4ade80",
  blocked: "#f87171"
};

let scene, camera, renderer, clock;
let agentsById = new Map();
let bots = new Map();
const coolerPosition = new THREE.Vector3(0, 0, 0);

function initScene() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#0f1115", 10, 30);

  const width = floorEl.clientWidth;
  const height = floorEl.clientHeight;

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 10, 16);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(6, 10, 6);
  scene.add(key);

  const floorGeo = new THREE.PlaneGeometry(20, 12);
  const floorMat = new THREE.MeshStandardMaterial({
    color: "#111827",
    roughness: 0.85,
    metalness: 0.05
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -0.5;
  scene.add(floorMesh);

  const grid = new THREE.GridHelper(20, 10, "#1f2937", "#111827");
  grid.position.y = -0.49;
  scene.add(grid);

  addDeskLayout();
  addWaterCooler();

  clock = new THREE.Clock();

  window.addEventListener("resize", resizeScene);
}

function resizeScene() {
  const width = floorEl.clientWidth;
  const height = floorEl.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function layoutPositions() {
  const positions = new Map();
  const cols = 3;
  const spacingX = 6;
  const spacingZ = 4;

  layoutOrder.forEach((id, idx) => {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const x = (col - 1) * spacingX;
    const z = (row - 1) * spacingZ;

    positions.set(id, new THREE.Vector3(x, 0, z));
  });

  return positions;
}

function addDeskLayout() {
  const positions = layoutPositions();
  const deskTopMat = new THREE.MeshStandardMaterial({
    color: "#1f2937",
    roughness: 0.6,
    metalness: 0.2
  });
  const legMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.9 });
  const monitorMat = new THREE.MeshStandardMaterial({ color: "#0b1020", roughness: 0.4 });

  positions.forEach((pos) => {
    const desk = new THREE.Group();

    const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 1.0), deskTopMat);
    top.position.y = 0.1;
    desk.add(top);

    const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
    const offsets = [
      [-0.8, -0.15, -0.4],
      [0.8, -0.15, -0.4],
      [-0.8, -0.15, 0.4],
      [0.8, -0.15, 0.4]
    ];
    offsets.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, y, z);
      desk.add(leg);
    });

    const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.05), monitorMat);
    monitor.position.set(0, 0.45, -0.3);
    desk.add(monitor);

    desk.position.set(pos.x, -0.2, pos.z);
    scene.add(desk);
  });
}

function addWaterCooler() {
  const cooler = new THREE.Group();

  const baseMat = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.5 });
  const waterMat = new THREE.MeshStandardMaterial({ color: "#38bdf8", transparent: true, opacity: 0.65 });
  const topMat = new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.4 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.0, 16), baseMat);
  base.position.y = 0.2;
  cooler.add(base);

  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.55, 16), waterMat);
  water.position.y = 0.8;
  cooler.add(water);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), topMat);
  cap.position.y = 1.1;
  cooler.add(cap);

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.2, 12), topMat);
  cup.position.set(0.4, 0.2, 0.0);
  cooler.add(cup);

  cooler.position.copy(coolerPosition);
  scene.add(cooler);
}

function createBot(id, basePosition) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: statusColors.idle.clone(),
    roughness: 0.35,
    metalness: 0.15
  });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.8, 16), bodyMat);
  torso.position.y = 0.5;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), bodyMat);
  head.position.y = 1.05;
  group.add(head);

  const eyeGeo = new THREE.SphereGeometry(0.06, 12, 12);
  const eyeMat = new THREE.MeshStandardMaterial({ color: "#0f172a" });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.12, 1.08, 0.3);
  const rightEye = leftEye.clone();
  rightEye.position.set(0.12, 1.08, 0.3);
  group.add(leftEye, rightEye);

  const legGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.35, 10);
  const legMat = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.7 });
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.18, 0.05, 0);
  const rightLeg = leftLeg.clone();
  rightLeg.position.set(0.18, 0.05, 0);
  group.add(leftLeg, rightLeg);

  group.position.copy(basePosition);
  group.userData = {
    id,
    base: basePosition.clone(),
    status: "idle",
    phase: Math.random() * Math.PI * 2,
    speed: 0.4 + Math.random() * 0.4
  };

  scene.add(group);
  return group;
}

function ensureBots(data) {
  const positions = layoutPositions();

  data.agents.forEach((agent) => {
    if (!positions.has(agent.id)) return;
    if (bots.has(agent.id)) return;

    const bot = createBot(agent.id, positions.get(agent.id));
    bots.set(agent.id, bot);
  });
}

function updateBots() {
  const elapsed = clock.getElapsedTime();
  bots.forEach((bot, id) => {
    const agent = agentsById.get(id);
    if (!agent) return;

    const status = agent.status || "idle";
    if (bot.userData.status !== status) {
      bot.children[0].material.color = statusColors[status] || statusColors.idle;
      bot.children[1].material.color = statusColors[status] || statusColors.idle;
      bot.userData.status = status;
    }

    const base = bot.userData.base;
    const target = status === "busy" ? coolerPosition : base;
    const roamRadius = status === "busy" ? 1.4 : status === "blocked" ? 0.1 : 0.35;
    const speed = status === "busy" ? 1.2 : status === "blocked" ? 0.3 : 0.6;
    const phase = bot.userData.phase;

    bot.position.x = target.x + Math.sin(elapsed * speed + phase) * roamRadius;
    bot.position.z = target.z + Math.cos(elapsed * speed + phase) * roamRadius;
    bot.position.y = Math.sin(elapsed * speed * 2 + phase) * 0.05;

    if (status === "blocked") {
      bot.rotation.y = Math.sin(elapsed * 2 + phase) * 0.3;
    } else {
      bot.rotation.y = Math.sin(elapsed * 0.8 + phase) * 0.15;
    }
  });
}

function updateLabels() {
  labelsEl.innerHTML = "";

  bots.forEach((bot, id) => {
    const agent = agentsById.get(id);
    if (!agent) return;

    const vector = bot.position.clone();
    vector.y += 1.2;
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * floorEl.clientWidth;
    const y = (-vector.y * 0.5 + 0.5) * floorEl.clientHeight;

    const label = document.createElement("div");
    label.className = "label";
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = labelColors[agent.status] || labelColors.idle;

    const name = document.createElement("span");
    name.textContent = `${agent.name} • ${agent.role}`;

    label.append(dot, name);
    labelsEl.appendChild(label);
  });
}

function renderLoop() {
  requestAnimationFrame(renderLoop);
  updateBots();
  updateLabels();
  renderer.render(scene, camera);
}

function renderFeed(data) {
  const logs = data.agents
    .flatMap((agent) =>
      (agent.logs || []).map((log) => ({
        agent: agent.name,
        ts: log.ts,
        text: log.text
      }))
    )
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))
    .slice(0, 20);

  feed.innerHTML = logs
    .map(
      (item) => `
      <div class="feed-item">
        <div class="meta">${item.agent} • ${new Date(item.ts).toLocaleTimeString()}</div>
        <div class="text">${item.text}</div>
      </div>
    `
    )
    .join("");
}

function render(data) {
  if (!data) return;
  if (data.updatedAt) {
    updatedAt.textContent = `Last update: ${new Date(data.updatedAt).toLocaleString()}`;
  }

  agentsById = new Map(data.agents.map((agent) => [agent.id, agent]));
  ensureBots(data);
  renderFeed(data);
}

async function init() {
  initScene();
  renderLoop();

  const res = await fetch("/api/agents");
  const data = await res.json();
  render(data);

  const stream = new EventSource("/api/stream");
  stream.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    render(payload);
  };
}

init();
