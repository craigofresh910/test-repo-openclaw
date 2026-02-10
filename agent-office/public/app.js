import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";

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

const defaultAgents = [
  { id: "builder", name: "Builder", role: "Senior Engineer" },
  { id: "pm", name: "PM", role: "Execution Planner" },
  { id: "research", name: "Research", role: "Analyst" },
  { id: "craigo", name: "Craigo (Lead)", role: "Lead / CTO" },
  { id: "qa", name: "QA", role: "Debugger" },
  { id: "growth", name: "Growth", role: "Revenue" },
  { id: "ops", name: "Ops", role: "DevOps" },
  { id: "content", name: "Content", role: "Content Engine" }
];

const roleColors = {
  builder: "#22d3ee",
  pm: "#f59e0b",
  research: "#60a5fa",
  craigo: "#a855f7",
  qa: "#f97316",
  growth: "#34d399",
  ops: "#38bdf8",
  content: "#f472b6"
};

let scene, camera, renderer, clock, controls;
let agentsById = new Map();
let modules = new Map();

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#0b0f17");
  scene.fog = new THREE.Fog("#0b0f17", 16, 50);

  const width = floorEl.clientWidth;
  const height = floorEl.clientHeight;
  const aspect = width / height;
  const viewSize = 10;

  camera = new THREE.OrthographicCamera(
    -viewSize * aspect,
    viewSize * aspect,
    viewSize,
    -viewSize,
    0.1,
    100
  );
  camera.position.set(11, 10, 11);
  camera.zoom = 1.15;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.minZoom = 0.7;
  controls.maxZoom = 2.5;
  controls.minDistance = 6;
  controls.maxDistance = 30;
  controls.target.set(0, 0, 0);
  controls.update();

  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r") {
      camera.position.set(11, 10, 11);
      camera.zoom = 1.15;
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.update();
    }
  });

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(8, 12, 6);
  scene.add(key);

  const fill = new THREE.PointLight(0x4f46e5, 0.3, 50);
  fill.position.set(-8, 8, -6);
  scene.add(fill);

  const baseGeo = new THREE.PlaneGeometry(30, 20);
  const baseMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.9 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.6;
  scene.add(base);

  clock = new THREE.Clock();

  window.addEventListener("resize", resizeScene);
}

function resizeScene() {
  const width = floorEl.clientWidth;
  const height = floorEl.clientHeight;
  const aspect = width / height;
  const viewSize = 10;

  camera.left = -viewSize * aspect;
  camera.right = viewSize * aspect;
  camera.top = viewSize;
  camera.bottom = -viewSize;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function layoutPositions() {
  const positions = new Map();
  const cols = 3;
  const spacingX = 7;
  const spacingZ = 5;

  layoutOrder.forEach((id, idx) => {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const x = (col - 1) * spacingX;
    const z = (row - 1) * spacingZ;

    positions.set(id, new THREE.Vector3(x, 0, z));
  });

  return positions;
}

function createWorkspace(agent, position) {
  const accent = new THREE.Color(roleColors[agent.id] || "#38bdf8");
  const group = new THREE.Group();

  const floorMat = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.8 });
  const wallMat = new THREE.MeshStandardMaterial({ color: "#151a28", roughness: 0.9 });
  const deskMat = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.5 });
  const chairMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.6 });
  const metalMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.3, metalness: 0.4 });

  const platform = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.3, 3.6), floorMat);
  platform.position.y = -0.45;
  group.add(platform);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.6, 0.2), wallMat);
  backWall.position.set(0, 0.7, -1.7);
  group.add(backWall);

  const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 3.6), wallMat);
  sideWall.position.set(-2.15, 0.7, 0);
  group.add(sideWall);

  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.9), deskMat);
  deskTop.position.set(0.6, 0.15, 0.2);
  group.add(deskTop);

  const deskLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 10), metalMat);
  [-0.1, 1.3].forEach((x) => {
    [-0.1, 0.5].forEach((z) => {
      const leg = deskLeg.clone();
      leg.position.set(x, -0.1, z);
      group.add(leg);
    });
  });

  const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.7), chairMat);
  chairSeat.position.set(0.6, 0.05, 0.9);
  group.add(chairSeat);

  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.1), chairMat);
  chairBack.position.set(0.6, 0.35, 1.2);
  group.add(chairBack);

  const monitorMat = new THREE.MeshStandardMaterial({ color: "#0b1020", roughness: 0.2 });
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.05), monitorMat);
  monitor.position.set(0.35, 0.45, -0.05);
  const monitor2 = monitor.clone();
  monitor2.position.set(0.9, 0.45, -0.05);
  group.add(monitor, monitor2);

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.4), metalMat);
  shelf.position.set(-1.1, 1.1, -1.5);
  group.add(shelf);

  const neonStripMat = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.9
  });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.05), neonStripMat);
  strip.position.set(0, 2.0, -1.6);
  group.add(strip);

  const iconMat = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 1.2
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 12, 24), iconMat);
  ring.position.set(-1.6, 0.9, -1.55);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), iconMat);
  orb.position.set(-1.1, 0.9, -1.55);
  group.add(orb);

  const glow = new THREE.PointLight(accent, 0.8, 6);
  glow.position.set(-1.2, 1.2, -1.0);
  group.add(glow);

  group.position.copy(position);
  group.userData = {
    id: agent.id,
    accent,
    glow: [strip, ring, orb, glow]
  };

  scene.add(group);
  return group;
}

function ensureModules(data) {
  const positions = layoutPositions();

  data.agents.forEach((agent) => {
    if (!positions.has(agent.id)) return;
    if (modules.has(agent.id)) return;

    const module = createWorkspace(agent, positions.get(agent.id));
    modules.set(agent.id, module);
  });
}

function updateModules() {
  const elapsed = clock.getElapsedTime();
  modules.forEach((module, id) => {
    const agent = agentsById.get(id);
    if (!agent) return;

    const pulse = 0.6 + Math.sin(elapsed * 2 + id.length) * 0.2;
    module.userData.glow.forEach((mesh) => {
      if (mesh.material) {
        mesh.material.emissiveIntensity = pulse + 0.2;
      }
      if (mesh.isLight) {
        mesh.intensity = 0.6 + pulse * 0.6;
      }
    });
  });
}

function updateLabels() {
  labelsEl.innerHTML = "";

  modules.forEach((module, id) => {
    const agent = agentsById.get(id);
    if (!agent) return;

    const vector = module.position.clone();
    vector.y += 2.4;
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * floorEl.clientWidth;
    const y = (-vector.y * 0.5 + 0.5) * floorEl.clientHeight;

    const label = document.createElement("div");
    label.className = "label";
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = roleColors[agent.id] || "#38bdf8";

    const name = document.createElement("span");
    name.textContent = `${agent.name} • ${agent.role}`;

    label.append(dot, name);
    labelsEl.appendChild(label);
  });
}

function renderLoop() {
  requestAnimationFrame(renderLoop);
  updateModules();
  updateLabels();
  if (controls) controls.update();
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
  ensureModules(data);
  renderFeed(data);
}

async function init() {
  initScene();
  renderLoop();

  // bootstrap modules even if auth blocks fetch
  const bootstrap = { agents: defaultAgents };
  agentsById = new Map(defaultAgents.map((agent) => [agent.id, agent]));
  ensureModules(bootstrap);

  try {
    const res = await fetch("/api/agents", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      render(data);
    }
  } catch (err) {
    console.warn("Agent fetch failed", err);
  }

  const stream = new EventSource("/api/stream");
  stream.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    render(payload);
  };
}

init();
