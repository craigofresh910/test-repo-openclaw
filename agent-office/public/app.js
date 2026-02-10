import * as THREE from "/vendor/three.module.js";
import { OrbitControls } from "/vendor/OrbitControls.js";

const floorEl = document.getElementById("floor");
const canvas = document.getElementById("scene");
const labelsEl = document.getElementById("labels");
const feed = document.getElementById("feed");
const updatedAt = document.getElementById("updatedAt");
const capabilitiesEl = document.getElementById("capabilities");

const debugEl = document.createElement("div");
debugEl.style.position = "absolute";
debugEl.style.left = "12px";
debugEl.style.bottom = "12px";
debugEl.style.background = "rgba(15, 23, 42, 0.85)";
debugEl.style.border = "1px solid rgba(56, 189, 248, 0.3)";
debugEl.style.color = "#e2e8f0";
debugEl.style.padding = "8px 10px";
debugEl.style.borderRadius = "10px";
debugEl.style.fontSize = "11px";
debugEl.style.maxWidth = "320px";
debugEl.style.zIndex = "10";
debugEl.textContent = "debug: booting";
floorEl.appendChild(debugEl);

window.addEventListener("error", (event) => {
  debugEl.textContent = `error: ${event.message}`;
});

window.addEventListener("unhandledrejection", (event) => {
  debugEl.textContent = `promise: ${event.reason}`;
});

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
  {
    id: "builder",
    name: "Builder",
    role: "Senior Engineer",
    model: "deepseek-coder",
    capabilities: ["Code implementation", "Infra automation", "API wiring"]
  },
  {
    id: "pm",
    name: "PM",
    role: "Execution Planner",
    model: "dolphin",
    capabilities: ["Spec breakdown", "Roadmaps", "Task sequencing"]
  },
  {
    id: "research",
    name: "Research",
    role: "Analyst",
    model: "dolphin",
    capabilities: ["Competitive scans", "Tech selection", "Synthesis"]
  },
  {
    id: "craigo",
    name: "Craigo (Lead)",
    role: "Lead / CTO",
    model: "gpt-4.1-mini",
    capabilities: ["Strategy", "Architectures", "Final decisions"]
  },
  {
    id: "qa",
    name: "QA",
    role: "Debugger",
    model: "dolphin",
    capabilities: ["Bug reproduction", "Test plans", "Edge-case checks"]
  },
  {
    id: "growth",
    name: "Growth",
    role: "Revenue",
    model: "dolphin",
    capabilities: ["Pricing", "Funnels", "Monetization"]
  },
  {
    id: "ops",
    name: "Ops",
    role: "DevOps",
    model: "dolphin",
    capabilities: ["Deploys", "Monitoring", "Scaling"]
  },
  {
    id: "content",
    name: "Content",
    role: "Content Engine",
    model: "dolphin",
    capabilities: ["Outlines", "Scripts", "Brand voice"]
  }
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
let avatars = new Map();

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#0b0f17");
  scene.fog = new THREE.Fog("#0b0f17", 16, 50);
  debugEl.textContent = "debug: scene initialized";

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

  const ambient = new THREE.AmbientLight(0x8aa0ff, 0.35);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 0.7);
  key.position.set(10, 14, 8);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x7c3aed, 0.5);
  rim.position.set(-10, 6, -8);
  scene.add(rim);

  const fill = new THREE.PointLight(0x38bdf8, 0.25, 40);
  fill.position.set(0, 6, -6);
  scene.add(fill);

  const baseGeo = new THREE.PlaneGeometry(30, 20);
  const baseMat = new THREE.MeshStandardMaterial({ color: "#0b1220", roughness: 0.9 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.6;
  scene.add(base);

  addWalkways();

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

function addWalkways() {
  const pathMat = new THREE.MeshStandardMaterial({
    color: "#1f2a44",
    roughness: 0.6,
    metalness: 0.05
  });
  const neonMat = new THREE.MeshStandardMaterial({
    color: "#38bdf8",
    emissive: "#38bdf8",
    emissiveIntensity: 0.6
  });

  const mainPath = new THREE.Mesh(new THREE.BoxGeometry(22, 0.08, 1.2), pathMat);
  mainPath.position.set(0, -0.45, 0);
  scene.add(mainPath);

  const crossPath = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 14), pathMat);
  crossPath.position.set(0, -0.45, 0);
  scene.add(crossPath);

  const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(22, 0.04, 0.08), neonMat);
  neonStrip.position.set(0, -0.4, 0.7);
  scene.add(neonStrip);
}

// water cooler hub removed for minimal scene

function createWorkspace(agent, position) {
  const accent = new THREE.Color(roleColors[agent.id] || "#38bdf8");
  const group = new THREE.Group();

  const floorMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.85 });
  const wallMat = new THREE.MeshStandardMaterial({ color: "#0b1220", roughness: 0.9 });
  const deskMat = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.5 });
  const chairMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.7 });
  const metalMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.3, metalness: 0.35 });
  const neonBlue = new THREE.MeshStandardMaterial({
    color: "#38bdf8",
    emissive: "#38bdf8",
    emissiveIntensity: 0.8
  });
  const neonPurple = new THREE.MeshStandardMaterial({
    color: "#7c3aed",
    emissive: "#7c3aed",
    emissiveIntensity: 0.7
  });

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

  const monitorMat = new THREE.MeshStandardMaterial({
    color: "#0b1020",
    emissive: "#1d4ed8",
    emissiveIntensity: 0.4,
    roughness: 0.2
  });
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.05), monitorMat);
  monitor.position.set(0.35, 0.45, -0.05);
  const monitor2 = monitor.clone();
  monitor2.position.set(0.9, 0.45, -0.05);
  group.add(monitor, monitor2);

  const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.18), metalMat);
  keyboard.position.set(0.6, 0.23, 0.25);
  group.add(keyboard);

  const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.1), metalMat);
  mouse.position.set(0.95, 0.23, 0.28);
  group.add(mouse);

  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 12), accent.clone());
  mug.position.set(0.2, 0.28, 0.3);
  group.add(mug);

  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.3), metalMat);
  tower.position.set(1.35, 0.2, 0.5);
  group.add(tower);

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.4), metalMat);
  shelf.position.set(-1.1, 1.1, -1.5);
  group.add(shelf);

  const strip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.05), neonBlue);
  strip.position.set(0, 2.0, -1.6);
  group.add(strip);

  const strip2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.05), neonPurple);
  strip2.position.set(-1.4, 0.2, 1.6);
  strip2.rotation.y = Math.PI / 2;
  group.add(strip2);

  const glow = new THREE.PointLight(accent, 0.7, 5);
  glow.position.set(0.2, 1.2, -0.8);
  group.add(glow);

  group.position.copy(position);
  group.userData = {
    id: agent.id,
    accent,
    glow: [strip, strip2, glow]
  };

  scene.add(group);
  return group;
}

const rolePosture = {
  craigo: { scale: 1.08, lean: -0.08, headTilt: 0.02, stanceX: 0 },
  builder: { scale: 1.0, lean: -0.05, headTilt: 0.0, stanceX: -0.02 },
  pm: { scale: 1.0, lean: 0.0, headTilt: 0.0, stanceX: 0.0 },
  qa: { scale: 1.0, lean: -0.04, headTilt: -0.05, stanceX: 0.02 },
  ops: { scale: 1.0, lean: -0.03, headTilt: 0.0, stanceX: -0.01 },
  research: { scale: 1.0, lean: -0.02, headTilt: 0.06, stanceX: 0.0 },
  growth: { scale: 1.0, lean: -0.02, headTilt: 0.0, stanceX: 0.04 },
  content: { scale: 1.0, lean: -0.02, headTilt: 0.02, stanceX: 0.0 }
};

function createAvatar(agent, modulePosition) {
  const accent = new THREE.Color(roleColors[agent.id] || "#38bdf8");
  const group = new THREE.Group();
  const profile = rolePosture[agent.id] || { scale: 1, lean: 0, headTilt: 0, stanceX: 0 };

  const bodyMat = new THREE.MeshStandardMaterial({
    color: accent.clone(),
    roughness: 0.75,
    metalness: 0.02
  });
  const limbMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.85 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.22, 6, 10), bodyMat);
  torso.position.y = 0.38;
  torso.rotation.x = profile.lean;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), bodyMat);
  head.position.y = 0.68;
  head.rotation.z = profile.headTilt;
  group.add(head);

  const handGeo = new THREE.SphereGeometry(0.09, 10, 10);
  const leftHand = new THREE.Mesh(handGeo, limbMat);
  leftHand.position.set(-0.18, 0.38, 0.05);
  const rightHand = leftHand.clone();
  rightHand.position.set(0.18, 0.38, 0.05);
  group.add(leftHand, rightHand);

  const legGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.18, 10);
  const leftLeg = new THREE.Mesh(legGeo, limbMat);
  leftLeg.position.set(-0.08, 0.08, 0);
  const rightLeg = leftLeg.clone();
  rightLeg.position.set(0.08, 0.08, 0);
  group.add(leftLeg, rightLeg);

  const standBase = modulePosition.clone().add(new THREE.Vector3(1.1 + profile.stanceX, -0.2, 0.9));
  const seatBase = modulePosition.clone().add(new THREE.Vector3(0.6, -0.12, 0.95));
  group.position.copy(standBase);
  group.scale.setScalar(profile.scale * 0.8);

  group.userData = {
    id: agent.id,
    standBase,
    seatBase,
    base: standBase,
    target: standBase.clone(),
    state: "idle",
    phase: Math.random() * Math.PI * 2,
    baseLean: profile.lean,
    head,
    torso,
    leftHand,
    rightHand,
    leftLeg,
    rightLeg
  };

  scene.add(group);
  return group;
}

function deriveState(agent, avatar) {
  const status = (agent.status || "idle").toLowerCase();
  const task = `${agent.task || ""} ${agent.lastMessage || ""}`.toLowerCase();
  const wantsCollab = status === "busy" && /(meet|sync|collab|review|handoff)/.test(task);

  if (wantsCollab) return "walking";
  if (avatar.userData.state === "walking" && !wantsCollab) return "returning";
  if (avatar.userData.state === "returning" && avatar.position.distanceTo(avatar.userData.base) > 0.2) {
    return "returning";
  }
  if (status === "busy") return "working";
  return "idle";
}

function updateAvatars(elapsed) {
  const hub = new THREE.Vector3(0, -0.2, 0);

  avatars.forEach((avatar, id) => {
    const agent = agentsById.get(id);
    if (!agent) return;

    const state = deriveState(agent, avatar);
    avatar.userData.state = state;

    if (state === "walking") {
      avatar.userData.target.copy(hub);
    } else if (state === "returning") {
      avatar.userData.base.copy(avatar.userData.standBase);
      avatar.userData.target.copy(avatar.userData.standBase);
    } else if (state === "working") {
      avatar.userData.base.copy(avatar.userData.standBase);
      avatar.userData.target.copy(avatar.userData.standBase);
    } else {
      avatar.userData.base.copy(avatar.userData.seatBase);
      avatar.userData.target.copy(avatar.userData.seatBase);
    }

    const target = avatar.userData.target;
    const moveSpeed = state === "walking" || state === "returning" ? 0.05 : 0.12;
    avatar.position.lerp(target, moveSpeed);

    const idleBreath = Math.sin(elapsed * 1.2 + avatar.userData.phase) * 0.01;
    avatar.position.y = avatar.userData.base.y + idleBreath;

    if (state === "idle") {
      avatar.rotation.y = Math.sin(elapsed * 0.4 + avatar.userData.phase) * 0.15;
      avatar.userData.torso.rotation.x = avatar.userData.baseLean + 0.12;
      avatar.userData.head.rotation.y = Math.sin(elapsed * 0.6) * 0.18;
      avatar.userData.leftHand.position.y = 0.42 + Math.sin(elapsed * 0.8) * 0.01;
      avatar.userData.rightHand.position.y = 0.42 + Math.cos(elapsed * 0.8) * 0.01;
      avatar.userData.leftLeg.rotation.x = 0.2;
      avatar.userData.rightLeg.rotation.x = 0.2;
    } else if (state === "working") {
      avatar.rotation.y = 0.2;
      avatar.userData.torso.rotation.x = avatar.userData.baseLean - 0.08;
      avatar.userData.leftHand.position.y = 0.5 + Math.sin(elapsed * 2.4) * 0.02;
      avatar.userData.rightHand.position.y = 0.5 + Math.cos(elapsed * 2.4) * 0.02;
      avatar.userData.leftLeg.rotation.x = 0;
      avatar.userData.rightLeg.rotation.x = 0;
    } else if (state === "walking" || state === "returning") {
      avatar.userData.torso.rotation.x = avatar.userData.baseLean;
      const stride = Math.sin(elapsed * 4 + avatar.userData.phase) * 0.08;
      avatar.userData.leftLeg.rotation.x = stride;
      avatar.userData.rightLeg.rotation.x = -stride;
      const dir = target.clone().sub(avatar.position);
      if (dir.length() > 0.01) {
        avatar.rotation.y = Math.atan2(dir.x, dir.z);
      }
    }
  });
}

function ensureModules(data) {
  const positions = layoutPositions();

  data.agents.forEach((agent) => {
    if (!positions.has(agent.id)) return;
    if (!modules.has(agent.id)) {
      const module = createWorkspace(agent, positions.get(agent.id));
      modules.set(agent.id, module);
    }

    if (!avatars.has(agent.id)) {
      const avatar = createAvatar(agent, positions.get(agent.id));
      avatars.set(agent.id, avatar);
    }
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

  updateAvatars(elapsed);
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
    const model = agent.model ? ` • ${agent.model}` : "";
    name.textContent = `${agent.name} • ${agent.role}${model}`;

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

function renderCapabilities(data) {
  capabilitiesEl.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "cap-list";

  data.agents.forEach((agent) => {
    const item = document.createElement("div");
    item.className = "cap-item";

    const title = document.createElement("h3");
    const model = agent.model ? ` • ${agent.model}` : "";
    title.textContent = `${agent.name}${model}`;

    const list = document.createElement("ul");
    (agent.capabilities || []).forEach((cap) => {
      const li = document.createElement("li");
      li.textContent = cap;
      list.appendChild(li);
    });

    item.append(title, list);
    wrapper.appendChild(item);
  });

  capabilitiesEl.appendChild(wrapper);
}

function render(data) {
  if (!data) return;
  if (data.updatedAt) {
    updatedAt.textContent = `Last update: ${new Date(data.updatedAt).toLocaleString()}`;
  }

  agentsById = new Map(data.agents.map((agent) => [agent.id, agent]));
  ensureModules(data);
  renderFeed(data);
  renderCapabilities(data);
}

async function init() {
  initScene();
  renderLoop();

  // bootstrap modules even if auth blocks fetch
  const bootstrap = { agents: defaultAgents };
  agentsById = new Map(defaultAgents.map((agent) => [agent.id, agent]));
  ensureModules(bootstrap);
  debugEl.textContent = `debug: modules ${modules.size}, avatars ${avatars.size}`;

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
