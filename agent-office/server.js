import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3030;
const DATA_PATH = path.join(__dirname, "data", "agents.json");

const OFFICE_USER = process.env.OFFICE_USER;
const OFFICE_PASS = process.env.OFFICE_PASS;

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  if (req.path.startsWith("/vendor/") || req.path.startsWith("/models/") || req.path === "/favicon.ico") {
    return next();
  }

  const isLocal =
    req.ip === "127.0.0.1" ||
    req.ip === "::1" ||
    req.ip === "::ffff:127.0.0.1";

  if (!OFFICE_USER || !OFFICE_PASS) {
    if (isLocal) return next();
    res.setHeader("WWW-Authenticate", "Basic realm=\"Agent Office\"");
    return res.status(401).send("Set OFFICE_USER and OFFICE_PASS to access remotely.");
  }

  const auth = req.headers.authorization || "";
  const token = auth.split(" ")[1];
  if (!token) {
    res.setHeader("WWW-Authenticate", "Basic realm=\"Agent Office\"");
    return res.status(401).send("Auth required");
  }

  const [user, pass] = Buffer.from(token, "base64").toString("utf8").split(":");
  if (user === OFFICE_USER && pass === OFFICE_PASS) return next();

  res.setHeader("WWW-Authenticate", "Basic realm=\"Agent Office\"");
  return res.status(401).send("Invalid credentials");
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/models", express.static(path.join(__dirname, "models")));

const clients = new Set();

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return { updatedAt: "", agents: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    res.write(payload);
  }
}

app.get("/api/agents", (req, res) => {
  res.json(loadData());
});

app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  clients.add(res);
  res.write(`data: ${JSON.stringify(loadData())}\n\n`);

  req.on("close", () => {
    clients.delete(res);
  });
});

app.post("/api/agents/:id", (req, res) => {
  const data = loadData();
  const agent = data.agents.find((a) => a.id === req.params.id);

  if (!agent) {
    return res.status(404).json({ error: "agent_not_found" });
  }

  const { status, task, lastMessage, filesChanged, log } = req.body || {};

  if (status) agent.status = status;
  if (task !== undefined) agent.task = task;
  if (lastMessage !== undefined) agent.lastMessage = lastMessage;
  if (Array.isArray(filesChanged)) agent.filesChanged = filesChanged;
  if (log) {
    agent.logs = [...agent.logs, { ts: new Date().toISOString(), text: log }].slice(-50);
  }

  data.updatedAt = new Date().toISOString();
  saveData(data);
  broadcast(data);

  res.json({ ok: true, agent });
});

app.post("/api/agents/:id/log", (req, res) => {
  const data = loadData();
  const agent = data.agents.find((a) => a.id === req.params.id);

  if (!agent) {
    return res.status(404).json({ error: "agent_not_found" });
  }

  const { text } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: "log_text_required" });
  }

  agent.logs = [...agent.logs, { ts: new Date().toISOString(), text }].slice(-50);
  data.updatedAt = new Date().toISOString();
  saveData(data);
  broadcast(data);

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Agent Office running at http://localhost:${PORT}`);
});
