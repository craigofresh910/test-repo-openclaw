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
  // auth disabled per user request
  return next();
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

  const { status, task, lastMessage, filesChanged, log, collabWith, targetDesk } = req.body || {};

  if (status) agent.status = status;
  if (task !== undefined) agent.task = task;
  if (lastMessage !== undefined) agent.lastMessage = lastMessage;
  if (Array.isArray(filesChanged)) agent.filesChanged = filesChanged;
  if (collabWith !== undefined) agent.collabWith = collabWith;
  if (targetDesk !== undefined) agent.targetDesk = targetDesk;
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
