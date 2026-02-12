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
    const targetIds = [...new Set([
      ...fanoutList,
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
          const response = await runAgent(
            target,
            `Lead request from ${agent.name}: ${text}\nReply with your status and a concise update.`,
            context
          );
          target.logs = [...target.logs, { ts, text: `Response: ${response.slice(0, 200)}` }].slice(-50);
          if (autoReturn) {
            markReturning(target);
          }
          return { id: target.id, name: target.name, reply: response };
        })
      );
      delegated = delegated.filter(Boolean);

      const summaryPrompt = `Summarize the following agent responses for ${agent.name}:
${delegated.map((item) => `- ${item.name}: ${item.reply}`).join("\n")}`;
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
