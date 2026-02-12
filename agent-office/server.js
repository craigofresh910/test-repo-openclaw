import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3030;
const DATA_PATH = path.join(__dirname, "data", "agents.json");
const WORKSPACE_ROOT = path.resolve(__dirname, "..");
const MEMORY_ROOT = path.join(WORKSPACE_ROOT, "memory");
const MEMORY_FILE = path.join(WORKSPACE_ROOT, "MEMORY.md");

const OFFICE_USER = process.env.OFFICE_USER;
const OFFICE_PASS = process.env.OFFICE_PASS;

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "agent-office", ts: new Date().toISOString() });
});

app.use((req, res, next) => {
  // auth disabled per user request
  return next();
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/models", express.static(path.join(__dirname, "models")));

const clients = new Set();

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";
const COUNCIL_MODELS = (process.env.OFFICE_COUNCIL_MODELS || "llama3.1:8b,deepseek-coder:6.7b-instruct")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);

const SEARCH_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".js",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml"
]);
const SEARCH_IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  ".venv",
  "dist",
  "build",
  "vendor"
]);
const SEARCH_MAX_RESULTS = 200;
const SEARCH_MAX_FILE_SIZE = 512 * 1024;

async function callOllama({ system, prompt, model = OLLAMA_MODEL }) {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ollama_error:${res.status} ${text}`);
  }

  const data = await res.json();
  return data?.message?.content || data?.response || "";
}

function buildSystemPrompt(agent) {
  const caps = (agent.capabilities || []).join(", ");
  return `You are ${agent.name} (${agent.role}). Capabilities: ${caps}. Respond concisely and clearly. Only use provided context; if unknown, say "No data". Do not invent people, tickets, or tasks.`;
}

async function runAgent(agent, text, context = "") {
  const prompt = context ? `${context}\n\n${text}` : text;
  return callOllama({ system: buildSystemPrompt(agent), prompt });
}

const VALID_STATUSES = new Set(["idle", "working", "walking", "returning", "done"]);

const FANOUT_RULES = [
  { agents: ["builder"], keywords: ["build", "implement", "feature", "api", "endpoint", "code", "refactor", "ship"] },
  { agents: ["qa"], keywords: ["bug", "issue", "error", "crash", "test", "qa", "regression", "fix"] },
  { agents: ["pm"], keywords: ["plan", "roadmap", "spec", "scope", "requirements", "milestone"] },
  { agents: ["research"], keywords: ["research", "compare", "evaluate", "benchmark", "market", "competitive"] },
  { agents: ["ops"], keywords: ["deploy", "docker", "infra", "server", "aws", "nginx", "monitor", "uptime"] },
  { agents: ["growth"], keywords: ["growth", "revenue", "pricing", "funnel", "sales", "conversion", "acquisition"] },
  { agents: ["content"], keywords: ["content", "write", "copy", "script", "blog", "post", "video", "tweet"] }
];

function inferFanout(text, agents) {
  const lower = String(text || "").toLowerCase();
  if (!lower) return [];
  const matches = new Set();
  FANOUT_RULES.forEach((rule) => {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      rule.agents.forEach((id) => matches.add(id));
    }
  });
  const available = new Set(agents.map((a) => a.id));
  return [...matches].filter((id) => available.has(id));
}

function validateAgentPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const status = typeof payload.status === "string" ? payload.status.toLowerCase() : "";
  if (!VALID_STATUSES.has(status)) return null;
  const update = typeof payload.update === "string" ? payload.update : "";
  const etaMinutes = Number.isFinite(payload.eta_minutes) ? payload.eta_minutes : null;
  return { status, update, eta_minutes: etaMinutes };
}

async function runAgentJson(agent, text, context = "") {
  const system = `${buildSystemPrompt(agent)} Respond ONLY with JSON in this schema: {"status":"idle|working|walking|returning|done","update":"string","eta_minutes":number|null}. No extra text.`;
  const prompt = context ? `${context}\n\n${text}` : text;
  const response = await callOllama({ system, prompt });
  try {
    const parsed = JSON.parse(response);
    return validateAgentPayload(parsed);
  } catch (err) {
    return null;
  }
}

function markWorking(agent, collabWith) {
  agent.status = "working";
  if (collabWith) agent.collabWith = collabWith;
}

function markReturning(agent) {
  agent.status = "returning";
  agent.collabWith = null;
  agent.targetDesk = null;
}

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

const LOCAL_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
const LOCAL_TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
});

function isSearchableFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SEARCH_EXTENSIONS.has(ext)) return false;
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    if (stat.size > SEARCH_MAX_FILE_SIZE) return false;
  } catch {
    return false;
  }
  return true;
}

function walkSearchTargets(targets, results) {
  for (const target of targets) {
    if (!target) continue;
    try {
      const stat = fs.statSync(target);
      if (stat.isFile()) {
        if (isSearchableFile(target)) results.push(target);
        continue;
      }
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }

    const queue = [target];
    while (queue.length) {
      const current = queue.pop();
      if (!current) continue;
      const name = path.basename(current);
      if (SEARCH_IGNORE_DIRS.has(name)) continue;
      let entries = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (!SEARCH_IGNORE_DIRS.has(entry.name)) queue.push(fullPath);
        } else if (entry.isFile()) {
          if (isSearchableFile(fullPath)) results.push(fullPath);
        }
      }
    }
  }
}

function searchFiles(targets, query) {
  const files = [];
  walkSearchTargets(targets, files);
  const matches = [];
  const lowered = query.toLowerCase();

  for (const file of files) {
    if (matches.length >= SEARCH_MAX_RESULTS) break;
    let content = "";
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/
?
/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.toLowerCase().includes(lowered)) continue;
      matches.push({
        file: path.relative(WORKSPACE_ROOT, file),
        line: i + 1,
        text: line.trim().slice(0, 240)
      });
      if (matches.length >= SEARCH_MAX_RESULTS) break;
    }
  }
  return matches;
}

function ensureDailyJournal(dateStamp) {
  if (!fs.existsSync(MEMORY_ROOT)) {
    fs.mkdirSync(MEMORY_ROOT, { recursive: true });
  }
  const filePath = path.join(MEMORY_ROOT, `${dateStamp}.md`);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `# ${dateStamp}

`);
  }
  return filePath;
}

app.get("/api/agents", (req, res) => {
  res.json(loadData());
});

app.get("/api/search", (req, res) => {
  const q = String(req.query.q || "").trim();
  const scope = String(req.query.scope || "memory").toLowerCase();
  if (!q) {
    return res.status(400).json({ ok: false, error: "missing_query" });
  }

  const targets = [];
  const addTarget = (value) => {
    if (value) targets.push(value);
  };
  const addMemory = () => {
    addTarget(MEMORY_ROOT);
    if (fs.existsSync(MEMORY_FILE)) addTarget(MEMORY_FILE);
  };

  if (scope === "workspace") {
    addTarget(WORKSPACE_ROOT);
  } else if (scope === "office") {
    addTarget(path.join(__dirname, "data"));
  } else if (scope === "all") {
    addMemory();
    addTarget(path.join(__dirname, "data"));
    addTarget(WORKSPACE_ROOT);
  } else {
    addMemory();
  }

  const results = searchFiles(targets, q);
  res.json({ ok: true, q, scope, count: results.length, results });
});

app.post("/api/journal", (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) {
    return res.status(400).json({ ok: false, error: "missing_text" });
  }

  const now = new Date();
  const dateStamp = LOCAL_DATE_FORMAT.format(now);
  const timeStamp = LOCAL_TIME_FORMAT.format(now);
  const filePath = ensureDailyJournal(dateStamp);
  fs.appendFileSync(filePath, `- [${timeStamp}] ${text}
`);

  res.json({
    ok: true,
    date: dateStamp,
    time: timeStamp,
    file: path.relative(WORKSPACE_ROOT, filePath)
  });
});

app.post("/api/council", async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim();
  if (!prompt) {
    return res.status(400).json({ ok: false, error: "missing_prompt" });
  }

  const providedModels = Array.isArray(req.body?.models)
    ? req.body.models
    : String(req.body?.models || "")
        .split(",")
        .map((model) => model.trim())
        .filter(Boolean);

  const models = providedModels.length ? providedModels : COUNCIL_MODELS;
  if (!models.length) {
    return res.status(400).json({ ok: false, error: "no_models_configured" });
  }

  try {
    const responses = await Promise.all(
      models.map(async (model) => {
        const system = "You are a specialist advisor. Respond with concise bullet points and a clear recommendation.";
        const reply = await callOllama({ system, prompt, model });
        return { model, reply };
      })
    );

    const summaryPrompt = `Prompt:
${prompt}

Responses:
${responses
      .map((item) => `- ${item.model}: ${item.reply.replace(/
/g, " ")}`)
      .join("
")}`;

    const summary = await callOllama({
      system: "You are the council chair. Summarize the best combined answer and list next steps.",
      prompt: summaryPrompt,
      model: models[0] || OLLAMA_MODEL
    });

    res.json({ ok: true, prompt, models, responses, summary });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
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

  if (status === "done") {
    markReturning(agent);
  } else if (status) {
    agent.status = status;
  }
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

app.post("/api/agents/:id/complete", (req, res) => {
  const data = loadData();
  const agent = data.agents.find((a) => a.id === req.params.id);

  if (!agent) {
    return res.status(404).json({ error: "agent_not_found" });
  }

  markReturning(agent);
  agent.logs = [...agent.logs, { ts: new Date().toISOString(), text: "Marked complete." }].slice(-50);
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

app.post("/api/office/message", async (req, res) => {
  const ts = new Date().toISOString();
  const { to, text, meta } = req.body || {};
  const fanoutList = Array.isArray(meta?.fanout)
    ? meta.fanout
    : typeof meta?.fanout === "string"
      ? meta.fanout.split(",").map((v) => v.trim()).filter(Boolean)
      : [];
  const autoFanout = meta?.autoFanout !== false;

  if (!to || !text) {
    return res.status(400).json({ ok: false, error: "missing_to_or_text", ts });
  }

  const data = loadData();
  const agent = data.agents.find((a) => a.id === to);
  if (!agent) {
    return res.status(404).json({ ok: false, error: `unknown_agent:${to}`, ts });
  }

  try {
    const lower = String(text).toLowerCase();
    const inferred = autoFanout && fanoutList.length === 0 ? inferFanout(text, data.agents) : [];
    const targetIds = [...new Set([
      ...fanoutList,
      ...inferred,
      ...data.agents.map((a) => a.id).filter((id) => id !== to && lower.includes(id))
    ])];

    let reply = "";
    let delegated = [];

    markWorking(agent);

    const context = `Context: Agents snapshot\n${data.agents
      .map(
        (a) =>
          `- ${a.name} (${a.id}): status=${a.status || "idle"}; task=${a.task || ""}; lastMessage=${
            a.lastMessage || ""
          }`
      )
      .join("\n")}`;

    const reportOnly = meta?.report === true;
    const autoReturn = meta?.returnOnComplete !== false;

    if ((reportOnly && targetIds.length === 0) || (targetIds.length === 0 && lower.includes("report"))) {
      reply = data.agents
        .map(
          (a) =>
            `${a.name} (${a.id}) — ${a.status || "idle"}${a.task ? ` — ${a.task}` : ""}`
        )
        .join("\n");
    } else if (targetIds.length > 0) {
      delegated = await Promise.all(
        targetIds.map(async (id) => {
          const target = data.agents.find((a) => a.id === id);
          if (!target) return null;
          markWorking(target, to);
          const response = await runAgentJson(
            target,
            `Lead request from ${agent.name}: ${text}\nReply with your status and a concise update.`,
            context
          );
          if (response) {
            target.status = response.status;
            target.lastMessage = response.update || "";
            if (response.status === "done" || response.status === "returning") {
              markReturning(target);
            }
          }
          target.logs = [...target.logs, { ts, text: `Response: ${response ? JSON.stringify(response) : "No data"}` }].slice(-50);
          if (autoReturn) {
            markReturning(target);
          }
          return {
            id: target.id,
            name: target.name,
            reply: response ? response.update || "No data" : "No data",
            status: response?.status || "unknown",
            eta_minutes: response?.eta_minutes ?? null
          };
        })
      );
      delegated = delegated.filter(Boolean);

      const summaryPrompt = `Summarize the following agent responses for ${agent.name} (use only provided updates, no inventions):
${delegated.map((item) => `- ${item.name} [${item.status}]: ${item.reply}`).join("\n")}`;
      reply = await runAgent(agent, summaryPrompt, context);
    } else {
      reply = await runAgent(agent, text, context);
    }

    if (autoReturn) {
      markReturning(agent);
    }

    agent.lastMessage = String(text).slice(0, 160);
    agent.logs = [...agent.logs, { ts, text: `Reply: ${reply.slice(0, 200)}` }].slice(-50);

    data.updatedAt = ts;
    saveData(data);

    const payload = {
      type: "office_message",
      to,
      text,
      reply,
      meta: meta || {},
      ts,
      agent: { id: agent.id, name: agent.name },
      delegated
    };

    broadcast({ ...data, officeMessage: payload });

    res.json({ ok: true, to, agent: { id: agent.id, name: agent.name }, reply, delegated, ts });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err), ts });
  }
});

app.listen(PORT, () => {
  console.log(`Agent Office running at http://localhost:${PORT}`);
});
