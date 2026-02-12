import * as THREE from "/vendor/three.module.js";
import { OrbitControls } from "/vendor/OrbitControls.js";
import { GLTFLoader } from "/vendor/GLTFLoader.js";
import { FBXLoader } from "/vendor/FBXLoader.js";

const floorEl = document.getElementById("floor");
const canvas = document.getElementById("scene");
const feed = document.getElementById("feed");
const updatedAt = document.getElementById("updatedAt");
const capabilitiesEl = document.getElementById("capabilities");
const dispatchTarget = document.getElementById("dispatchTarget");
const dispatchFanout = document.getElementById("dispatchFanout");
const dispatchText = document.getElementById("dispatchText");
const dispatchReturn = document.getElementById("dispatchReturn");
const dispatchSend = document.getElementById("dispatchSend");
const dispatchReport = document.getElementById("dispatchReport");
const dispatchOutput = document.getElementById("dispatchOutput");
const focusToggle = document.getElementById("focusToggle");
const statusStrip = document.getElementById("statusStrip");
const searchQuery = document.getElementById("searchQuery");
const searchScope = document.getElementById("searchScope");
const searchRun = document.getElementById("searchRun");
const searchOutput = document.getElementById("searchOutput");
const journalText = document.getElementById("journalText");
const journalAdd = document.getElementById("journalAdd");
const journalOutput = document.getElementById("journalOutput");
const councilPrompt = document.getElementById("councilPrompt");
const councilModels = document.getElementById("councilModels");
const councilRun = document.getElementById("councilRun");
const councilOutput = document.getElementById("councilOutput");

const debugEnabled = new URLSearchParams(window.location.search).has("debug");
const debugEl = document.createElement("div");

function setDebug(text) {
  if (debugEnabled) {
    debugEl.textContent = text;
  }
}

if (debugEnabled) {
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
    setDebug(`error: ${event.message}`);
  });

  window.addEventListener("unhandledrejection", (event) => {
    setDebug(`promise: ${event.reason}`);
  });
}

const layoutOrder = [
  "craigo",
  "pm",
  "research",
  "builder",
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

const statusColors = {
  idle: "#64748b",
  working: "#22c55e",
  walking: "#f59e0b",
  returning: "#38bdf8"
};

let scene, camera, renderer, clock, controls;
let agentsById = new Map();
let modules = new Map();
let avatars = new Map();

const loader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const modelCache = new Map();

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#0b0f17");
  scene.fog = new THREE.Fog("#0b0f17", 16, 50);
  setDebug("debug: scene initialized");

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
  camera.zoom = 1.3;
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
      camera.zoom = 1.3;
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
  addCopyMachine();
  addWaterCooler();
  addNeonBanner();

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

function addCopyMachine() {
  const bodyMat = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.5 });
  const panelMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.4 });
  const accentMat = new THREE.MeshStandardMaterial({ color: "#38bdf8", emissive: "#38bdf8", emissiveIntensity: 0.4 });

  const group = new THREE.Group();

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 0.9), bodyMat);
  base.position.y = 0.5;
  group.add(base);

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.2, 0.95), panelMat);
  top.position.y = 1.05;
  group.add(top);

  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.5), panelMat);
  tray.position.set(0, 0.85, 0.4);
  group.add(tray);

  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.02), accentMat);
  screen.position.set(0.35, 1.1, 0.48);
  screen.rotation.x = -0.2;
  group.add(screen);

  group.position.set(-14.2, -0.45, -8.4);
  scene.add(group);
}

function addWaterCooler() {
  const baseMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.5 });
  const tankMat = new THREE.MeshStandardMaterial({ color: "#38bdf8", roughness: 0.2, metalness: 0.1, emissive: "#38bdf8", emissiveIntensity: 0.2 });

  const group = new THREE.Group();

  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.9, 16), baseMat);
  stand.position.y = 0.45;
  group.add(stand);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.15, 12), baseMat);
  neck.position.y = 0.95;
  group.add(neck);

  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.55, 16), tankMat);
  tank.position.y = 1.25;
  group.add(tank);

  const tap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.06), tankMat);
  tap.position.set(0, 0.7, 0.3);
  group.add(tap);

  group.position.set(-11.8, -0.6, -8.4);
  scene.add(group);
}

function addNeonBanner() {
  const frameMat = new THREE.MeshStandardMaterial({ color: "#0f172a", emissive: "#0f172a", roughness: 0.4 });
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.9, 0.2), frameMat);
  group.add(frame);

  const texture = new THREE.TextureLoader().load("/assets/duck-banner.svg");
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    emissive: "#38bdf8",
    emissiveIntensity: 1.1,
    transparent: true
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.4), mat);
  panel.position.set(0, 0.1, 0.16);
  group.add(panel);

  group.position.set(0, 2.0, -9.2);
  group.rotation.y = 0;
  scene.add(group);
}

// water cooler hub removed for minimal scene

function createNameplate(text, subtitle, model, accent) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = accent.getStyle();
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "600 40px 'Inter', 'Segoe UI', sans-serif";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 - 10);

  if (subtitle) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 24px 'Inter', 'Segoe UI', sans-serif";
    ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 20);
  }

  if (model) {
    ctx.fillStyle = "#64748b";
    ctx.font = "500 20px 'Inter', 'Segoe UI', sans-serif";
    ctx.fillText(model, canvas.width / 2, canvas.height / 2 + 46);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    roughness: 0.6,
    metalness: 0.1
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), mat);
  return plate;
}

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

  const nameplate = createNameplate(agent.name, agent.role, agent.model, accent);
  if (nameplate) {
    nameplate.position.set(0, 1.55, -1.59);
    group.add(nameplate);
  }

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

  const statusOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 18, 18),
    new THREE.MeshStandardMaterial({
      color: statusColors.idle,
      emissive: statusColors.idle,
      emissiveIntensity: 0.9,
      roughness: 0.3
    })
  );
  statusOrb.position.set(1.6, 0.65, -0.9);
  group.add(statusOrb);

  group.position.copy(position);
  group.userData = {
    id: agent.id,
    accent,
    glow: [strip, strip2, glow],
    statusOrb
  };

  scene.add(group);
  return group;
}

const rolePosture = {
  craigo: { scale: 1.05, lean: -0.06, stanceX: 0 },
  builder: { scale: 1.0, lean: -0.04, stanceX: -0.02 },
  pm: { scale: 1.0, lean: 0.0, stanceX: 0.0 },
  qa: { scale: 1.0, lean: -0.03, stanceX: 0.02 },
  ops: { scale: 1.0, lean: -0.02, stanceX: -0.01 },
  research: { scale: 1.0, lean: -0.01, stanceX: 0.0 },
  growth: { scale: 1.0, lean: -0.01, stanceX: 0.04 },
  content: { scale: 1.0, lean: -0.01, stanceX: 0.0 }
};

const modelMap = {
  craigo: null,
  builder: null,
  pm: null,
  qa: null,
  ops: null,
  research: null,
  growth: null,
  content: null
};

function loadModel(url) {
  if (!url) return Promise.reject(new Error("missing model url"));
  if (modelCache.has(url)) return modelCache.get(url);

  const promise = new Promise((resolve, reject) => {
    if (url.toLowerCase().endsWith(".fbx")) {
      fbxLoader.load(url, (obj) => resolve({ scene: obj }), undefined, reject);
    } else {
      loader.load(url, (gltf) => resolve(gltf), undefined, reject);
    }
  });
  modelCache.set(url, promise);
  return promise;
}

function fitModelToHeight(model, targetHeight) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (!size.y || !isFinite(size.y) || size.y < 0.1) {
    model.scale.setScalar(1);
    return false;
  }

  const scale = targetHeight / size.y;
  model.scale.setScalar(scale);
  const newBox = new THREE.Box3().setFromObject(model);
  const minY = newBox.min.y;
  model.position.set(0, -minY, 0);
  return true;
}

function createAvatar(agent, modulePosition) {
  const profile = rolePosture[agent.id] || { scale: 1, lean: 0, stanceX: 0 };
  const group = new THREE.Group();

  const standBase = modulePosition.clone().add(new THREE.Vector3(0.55, -0.12, 0.95));
  const seatBase = modulePosition.clone().add(new THREE.Vector3(0.55, -0.12, 0.95));
  group.position.copy(standBase);
  group.scale.setScalar(profile.scale * 1.0);

  const fallback = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.34, 6, 10),
    new THREE.MeshStandardMaterial({ color: roleColors[agent.id] || "#94a3b8", roughness: 0.7 })
  );
  fallback.position.y = 0.35;
  group.add(fallback);

  const modelSpec = modelMap[agent.id];
  const modelUrl = modelSpec?.url || modelSpec;
  const targetHeight = modelSpec?.height ?? 1.2;

  group.userData = {
    id: agent.id,
    standBase,
    seatBase,
    base: standBase,
    target: standBase.clone(),
    state: "idle",
    phase: Math.random() * Math.PI * 2,
    baseLean: profile.lean,
    modelLoaded: false
  };

  scene.add(group);

  if (!modelUrl) {
    return group;
  }
  loadModel(modelUrl)
    .then((gltf) => {
      const model = gltf.scene;
      let meshCount = 0;
      model.traverse((node) => {
        if (node.isMesh || node.isSkinnedMesh) {
          meshCount += 1;
          const color = roleColors[agent.id] || "#e2e8f0";
          if (!node.material) {
            node.material = new THREE.MeshStandardMaterial({
              color,
              roughness: 0.7,
              metalness: 0.0
            });
          }
          if (node.isSkinnedMesh && node.material) {
            node.material.skinning = true;
          }
          node.castShadow = false;
          node.receiveShadow = false;
          node.frustumCulled = false;
        }
      });
      const fitted = fitModelToHeight(model, targetHeight);
      model.rotation.y = Math.PI;
      model.position.set(0, 0, 0);
      model.scale.multiplyScalar(1.2);
      if (!fitted) {
        model.visible = false;
      }
      group.add(model);
      if (meshCount > 0 && fitted) {
        fallback.visible = false;
      }
      group.userData.modelLoaded = true;
    })
    .catch((err) => {
      console.warn("model load failed", modelUrl, err);
    });

  return group;
}

function getDeskAnchor(agentId) {
  const positions = layoutPositions();
  const base = positions.get(agentId) || new THREE.Vector3(0, 0, 0);
  return base.clone().add(new THREE.Vector3(0.55, -0.12, 0.95));
}

function resolveTarget(agent, avatar) {
  if (agent.targetDesk && agent.targetDesk !== agent.id) {
    return getDeskAnchor(agent.targetDesk);
  }
  if (agent.collabWith && agent.collabWith !== agent.id) {
    return getDeskAnchor(agent.collabWith);
  }
  return avatar.userData.seatBase.clone();
}

function deriveState(agent, avatar) {
  const status = agent.status || "idle";
  const target = resolveTarget(agent, avatar);
  const distance = avatar.position.distanceTo(target);

  if (status === "returning") return "returning";
  if ((agent.collabWith || agent.targetDesk) && distance > 0.25) return "walking";
  if (status === "working" || agent.collabWith || agent.targetDesk) return "working";
  if (status === "walking") return "walking";
  return "idle";
}

function updateAvatars(elapsed) {
  avatars.forEach((avatar, id) => {
    const agent = agentsById.get(id);
    if (!agent) return;

    const state = deriveState(agent, avatar);
    avatar.userData.state = state;

    const target = resolveTarget(agent, avatar);
    if (state === "returning" || (!agent.collabWith && !agent.targetDesk)) {
      avatar.userData.base.copy(avatar.userData.seatBase);
      avatar.userData.target.copy(avatar.userData.seatBase);
    } else {
      avatar.userData.base.copy(target);
      avatar.userData.target.copy(target);
    }

    const moveSpeed = state === "walking" || state === "returning" ? 0.05 : 0.12;
    avatar.position.lerp(avatar.userData.target, moveSpeed);

    const idleBreath = Math.sin(elapsed * 1.2 + avatar.userData.phase) * 0.01;
    avatar.position.y = avatar.userData.base.y + idleBreath;

    if (state === "idle") {
      avatar.rotation.y = Math.sin(elapsed * 0.4 + avatar.userData.phase) * 0.15;
      avatar.rotation.x = -0.18;
    } else if (state === "working") {
      avatar.rotation.y = 0.2;
      avatar.rotation.x = -0.18;
    } else if (state === "walking" || state === "returning") {
      avatar.rotation.x = 0;
      const dir = avatar.userData.target.clone().sub(avatar.position);
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

    const state = agent.status || "idle";
    const working = state === "working";
    const active = working || state === "walking" || state === "returning";
    const pulse = 0.6 + Math.sin(elapsed * 2 + id.length) * 0.2;
    const blink = working ? (Math.sin(elapsed * 6) > 0 ? 1.3 : 0.2) : 0;
    const baseGlow = active ? 0.9 : 0.15;
    const baseLight = active ? 1.0 : 0.2;
    const blinkColor = working ? new THREE.Color("#22c55e") : null;

    module.userData.glow.forEach((mesh) => {
      if (mesh.material) {
        if (blinkColor) {
          mesh.material.emissive = blinkColor;
        }
        mesh.material.emissiveIntensity = baseGlow + pulse * 0.4 + blink;
      }
      if (mesh.isLight) {
        if (blinkColor) {
          mesh.color = blinkColor;
        }
        mesh.intensity = baseLight + pulse * (active ? 0.6 : 0.2) + blink * 0.6;
      }
    });

    const color = new THREE.Color(statusColors[state] || statusColors.idle);
    if (module.userData.statusOrb?.material) {
      module.userData.statusOrb.material.color = color;
      module.userData.statusOrb.material.emissive = color;
      module.userData.statusOrb.material.emissiveIntensity = state === "working" ? 1.4 : 0.9;
    }
  });

  updateAvatars(elapsed);
}

function renderLoop() {
  requestAnimationFrame(renderLoop);
  updateModules();
  if (controls) controls.update();

  const loaded = [];
  const missing = [];
  avatars.forEach((avatar, id) => {
    if (avatar.userData.modelLoaded) {
      loaded.push(id);
    } else {
      missing.push(id);
    }
  });
  setDebug(`debug: modules ${modules.size}, avatars ${avatars.size}, loaded ${loaded.length}, missing ${missing.join(", ")}`);

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
    .slice(0, 3);

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

function renderDispatchOptions(data) {
  if (!dispatchTarget) return;
  dispatchTarget.innerHTML = "";
  data.agents.forEach((agent) => {
    const option = document.createElement("option");
    option.value = agent.id;
    option.textContent = `${agent.name}`;
    dispatchTarget.appendChild(option);
  });
}

function renderStatusStrip(data) {
  if (!statusStrip) return;
  statusStrip.innerHTML = "";
  data.agents.forEach((agent) => {
    const status = (agent.status || "idle").toLowerCase();
    const chip = document.createElement("div");
    chip.className = `status-chip status-${status}`;
    chip.innerHTML = `<span class="dot"></span>${agent.name}`;
    statusStrip.appendChild(chip);
  });
}

async function sendDispatch(message, override = {}) {
  if (!dispatchOutput) return;
  dispatchOutput.textContent = "Sending...";

  const body = {
    to: dispatchTarget?.value || "craigo",
    text: message,
    meta: {
      fanout: dispatchFanout?.value || "",
      autoFanout: !(dispatchFanout?.value || "").trim(),
      returnOnComplete: dispatchReturn?.checked ?? true,
      ...override
    }
  };

  const res = await fetch("/api/office/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  dispatchOutput.textContent = JSON.stringify(data, null, 2);
}

async function runSearch() {
  if (!searchOutput) return;
  const query = searchQuery?.value?.trim();
  if (!query) return;

  searchOutput.textContent = "Searching...";
  const scope = searchScope?.value || "memory";
  const params = new URLSearchParams({ q: query, scope });

  const res = await fetch(`/api/search?${params.toString()}`);
  const data = await res.json();
  searchOutput.textContent = JSON.stringify(data, null, 2);
}

async function addJournalEntry() {
  if (!journalOutput) return;
  const entry = journalText?.value?.trim();
  if (!entry) return;

  journalOutput.textContent = "Saving...";
  const res = await fetch("/api/journal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: entry })
  });
  const data = await res.json();
  journalOutput.textContent = JSON.stringify(data, null, 2);
  if (res.ok && journalText) journalText.value = "";
}

async function runCouncil() {
  if (!councilOutput) return;
  const prompt = councilPrompt?.value?.trim();
  if (!prompt) return;

  councilOutput.textContent = "Running council...";
  const models = councilModels?.value?.trim() || "";
  const res = await fetch("/api/council", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, models })
  });
  const data = await res.json();
  councilOutput.textContent = JSON.stringify(data, null, 2);
}

function wireDispatch() {
  if (dispatchSend) {
    dispatchSend.addEventListener("click", async () => {
      if (!dispatchText?.value) return;
      await sendDispatch(dispatchText.value);
    });
  }

  if (dispatchReport) {
    dispatchReport.addEventListener("click", async () => {
      const prompt = "Generate a concise report of current agent tasks, latest replies, and next steps.";
      await sendDispatch(prompt, { fanout: "builder,qa,pm,research,ops", report: true });
    });
  }
}

function wireToolbox() {
  if (searchRun) {
    searchRun.addEventListener("click", async () => {
      await runSearch();
    });
  }

  if (journalAdd) {
    journalAdd.addEventListener("click", async () => {
      await addJournalEntry();
    });
  }

  if (councilRun) {
    councilRun.addEventListener("click", async () => {
      await runCouncil();
    });
  }
}

function applyFocusMode(enabled) {
  document.body.classList.toggle("focus-mode", enabled);
  if (focusToggle) {
    focusToggle.classList.toggle("active", enabled);
    focusToggle.textContent = enabled ? "Exit focus" : "Focus mode";
  }
}

function wireFocusToggle() {
  if (!focusToggle) return;
  const saved = localStorage.getItem("officeFocusMode") === "1";
  if (saved) applyFocusMode(true);
  focusToggle.addEventListener("click", () => {
    const enabled = !document.body.classList.contains("focus-mode");
    applyFocusMode(enabled);
    localStorage.setItem("officeFocusMode", enabled ? "1" : "0");
  });
}

function wireAccordion() {
  const items = Array.from(document.querySelectorAll(".accordion-item"));
  items.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      items.forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });
}

function render(data) {
  if (!data) return;
  if (data.updatedAt) {
    updatedAt.textContent = `Last update: ${new Date(data.updatedAt).toLocaleString()}`;
  }

  agentsById = new Map(data.agents.map((agent) => [agent.id, agent]));
  ensureModules(data);
  renderDispatchOptions(data);
  renderStatusStrip(data);
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
  renderDispatchOptions(bootstrap);
  renderStatusStrip(bootstrap);
  wireDispatch();
  wireToolbox();
  wireFocusToggle();
  wireAccordion();
  setDebug(`debug: modules ${modules.size}, avatars ${avatars.size}`);

  try {
    const res = await fetch("/api/agents", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      render(data);
      wireDispatch();
      wireToolbox();
    }
  } catch (err) {
    console.warn("Agent fetch failed", err);
  }

  let stream;
  let pollTimer;
  const poll = async () => {
    try {
      const res = await fetch("/api/agents", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        render(data);
      }
    } catch (err) {
      // ignore polling errors
    }
  };

  const startPolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(poll, 5000);
  };

  const openStream = () => {
    stream = new EventSource("/api/stream");
    stream.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      render(payload);
    };
    stream.onerror = () => {
      if (stream) stream.close();
      startPolling();
      setTimeout(openStream, 2000);
    };
  };

  startPolling();
  openStream();
}

init();
