import express from "express";
import { WebSocket } from "ws";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import path from "node:path";
import Database from "better-sqlite3";

const app = express();

// We want JSON parsing for most routes, but NOT for multipart upload proxy.
// Twilio webhooks send x-www-form-urlencoded, so route those through urlencoded.
const urlencoded = express.urlencoded({ extended: false });

app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/api/customer/uploads") return next();
  if (req.method === "POST" && req.path.startsWith("/api/twilio/")) {
    return urlencoded(req, res, next);
  }
  return express.json({ limit: "1mb" })(req, res, next);
});

// --- Config ---

const PORT = Number(process.env.CRAIGO_API_PORT || 8787);
const OPENCLAW_CONFIG_PATH =
  process.env.OPENCLAW_CONFIG_PATH ||
  `${os.homedir()}/.openclaw/openclaw.json`;

function getGatewayToken() {
  // Prefer explicit env var.
  const envToken = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (envToken && envToken.trim()) return envToken.trim();

  // Fall back to OpenClaw config.
  const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf8");
  const json = JSON.parse(raw);
  const token = json?.gateway?.auth?.token;
  if (!token || typeof token !== "string") {
    throw new Error(
      `Gateway token missing. Set OPENCLAW_GATEWAY_TOKEN or configure gateway.auth.token in ${OPENCLAW_CONFIG_PATH}`
    );
  }
  return token;
}

function getGatewayWsUrl() {
  // The gateway is loopback-only on this server.
  // If you change gateway port/bind later, update this.
  const port = Number(process.env.OPENCLAW_GATEWAY_PORT || 18789);
  const host = process.env.OPENCLAW_GATEWAY_HOST || "127.0.0.1";
  return `ws://${host}:${port}`;
}

function requireEnv(name, minLen = 1) {
  const v = process.env[name];
  if (!v || String(v).trim().length < minLen) throw new Error(`${name} not configured`);
  return String(v).trim();
}

function getMinimaxUrl() {
  const base = process.env.MINIMAX_API_URL || "https://api.minimax.chat/v1/text/chatcompletion";
  const groupId = process.env.MINIMAX_GROUP_ID || "";
  if (!groupId) return base;
  if (base.includes("GroupId=")) return base;
  return `${base}${base.includes("?") ? "&" : "?"}GroupId=${encodeURIComponent(groupId)}`;
}

async function minimaxChat({ messages, temperature = 0.2 }) {
  const apiKey = requireEnv("MINIMAX_API_KEY", 10);
  const model = process.env.MINIMAX_MODEL || "MiniMax-M2.5";
  const url = getMinimaxUrl();

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature }),
  });

  const text = await resp.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!resp.ok) {
    const msg = data?.error?.message || data?.message || text || "MiniMax error";
    throw new Error(msg);
  }

  return (
    data?.choices?.[0]?.message?.content ||
    data?.reply ||
    data?.result?.reply ||
    data?.data?.reply ||
    ""
  );
}

function escapeXml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clip(input, max = 600) {
  const s = String(input || "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 3)}...`;
}

function buildTwiML({ say, gather = true }) {
  const message = escapeXml(clip(say));
  if (!gather) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${message}</Say></Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${message}</Say><Gather input="speech" action="/api/twilio/voice" method="POST" speechTimeout="auto" timeout="5" /></Response>`;
}

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function hmacSha256(secret, data) {
  return crypto.createHmac("sha256", secret).update(data).digest();
}

function signJwt(payload, opts) {
  const secret = requireEnv("CRAIGO_JWT_SECRET", 16);
  const header = { alg: "HS256", typ: "JWT" };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + (opts?.ttlSeconds ?? 60 * 60 * 12);

  const fullPayload = { ...payload, iat, exp };

  const a = base64url(JSON.stringify(header));
  const b = base64url(JSON.stringify(fullPayload));
  const toSign = `${a}.${b}`;
  const sig = hmacSha256(secret, toSign);
  return `${toSign}.${base64url(sig)}`;
}

function verifyJwt(token) {
  const secret = requireEnv("CRAIGO_JWT_SECRET", 16);
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return { ok: false, error: "Bad token" };

  const [a, b, sig] = parts;
  const toSign = `${a}.${b}`;
  const expected = base64url(hmacSha256(secret, toSign));
  if (sig !== expected) return { ok: false, error: "Bad signature" };

  let payload;
  try {
    payload = JSON.parse(Buffer.from(b.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return { ok: false, error: "Bad payload" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload?.exp && Number(payload.exp) < now) return { ok: false, error: "Expired" };
  return { ok: true, payload };
}

function requireCustomer(req) {
  const auth = req.headers["authorization"] || "";
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  const token = m?.[1] || "";
  const v = verifyJwt(token);
  if (!v.ok) return { ok: false, status: 401, message: "Unauthorized" };
  return { ok: true, payload: v.payload };
}

function getDbPath() {
  const explicit = process.env.CRAIGO_DB_PATH;
  if (explicit && explicit.trim()) return explicit.trim();
  // Default to the pm-web sqlite file in this workspace.
  return path.resolve(process.cwd(), "../pm-web/dev.db");
}

let _db = null;
function ensureColumn(table, col, typeSql) {
  const cols = _db.prepare(`PRAGMA table_info(${table})`).all();
  const has = cols.some((r) => r && r.name === col);
  if (has) return;
  _db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${typeSql}`).run();
}

function ensureSchema() {
  // Soft-state fields (non-destructive)
  ensureColumn('Project', 'archivedAt', 'DATETIME');
  ensureColumn('Project', 'deletedAt', 'DATETIME');

  ensureColumn('Task', 'archivedAt', 'DATETIME');
  ensureColumn('Task', 'deletedAt', 'DATETIME');
  ensureColumn('Task', 'canceledAt', 'DATETIME');
}

function db() {
  if (_db) return _db;
  const p = getDbPath();
  _db = new Database(p, { fileMustExist: false });
  // Ensure FK constraints are enforced when possible.
  try {
    _db.pragma('foreign_keys = ON');
  } catch {}

  try {
    ensureSchema();
  } catch {
    // best-effort; don't prevent startup
  }

  return _db;
}

function rowToProject(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
    archivedAt: r.archivedAt ? new Date(r.archivedAt).toISOString() : null,
    deletedAt: r.deletedAt ? new Date(r.deletedAt).toISOString() : null,
    _count: { tasks: Number(r.tasksCount ?? 0) },
  };
}

function rowToTask(r) {
  if (!r) return null;
  return {
    id: r.id,
    projectId: r.projectId,
    title: r.title,
    description: r.description ?? null,
    status: r.status,
    priority: Number(r.priority ?? 0),
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
    archivedAt: r.archivedAt ? new Date(r.archivedAt).toISOString() : null,
    deletedAt: r.deletedAt ? new Date(r.deletedAt).toISOString() : null,
    canceledAt: r.canceledAt ? new Date(r.canceledAt).toISOString() : null,
  };
}

function rowToActivity(r) {
  if (!r) return null;
  return {
    id: r.id,
    projectId: r.projectId ?? null,
    taskId: r.taskId ?? null,
    type: r.type,
    message: r.message,
    metaJson: r.metaJson ?? null,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
  };
}

// --- Minimal Gateway RPC (WS) ---

function wsSend(ws, obj) {
  ws.send(JSON.stringify(obj));
}

async function gatewayCall({ sessionKey, method, params }) {
  const wsUrl = getGatewayWsUrl();
  const token = getGatewayToken();

  const ws = new WebSocket(wsUrl);

  const pending = new Map();

  const waitOpen = new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  const waitClose = new Promise((resolve) => {
    ws.once("close", resolve);
  });

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString("utf8"));
    } catch {
      return;
    }

    // We ignore events for MVP (including connect.challenge).
    if (msg?.type === "res" && typeof msg?.id === "string") {
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);

      if (msg.ok) entry.resolve(msg.payload ?? null);
      else {
        const errMsg = msg?.error?.value?.message || msg?.error?.message || "Gateway error";
        entry.reject(new Error(errMsg));
      }
    }
  });

  const call = (method, params) =>
    new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      pending.set(id, { resolve, reject });
      wsSend(ws, { type: "req", id, method, params });
    });

  // Node 22 has global crypto
  const crypto = globalThis.crypto ?? (await import("node:crypto")).webcrypto;

  try {
    await waitOpen;

    // connect
    await call("connect", {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        // The gateway validates this against known client shapes.
        // Using the webchat client identity keeps us compatible.
        id: "webchat-ui",
        displayName: "Craigo API",
        version: "0.1.0",
        platform: "server",
        mode: "webchat",
      },
      auth: { token },
    });

    // actual method
    const fullParams = { ...(params || {}) };
    if (sessionKey && typeof sessionKey === "string") {
      fullParams.sessionKey = sessionKey;
    }

    const payload = await call(method, fullParams);

    try {
      ws.close(1000, "done");
    } catch {
      // ignore
    }

    // ensure close
    await Promise.race([waitClose, new Promise((r) => setTimeout(r, 200))]);

    return payload;
  } finally {
    try {
      ws.terminate();
    } catch {
      // ignore
    }
  }
}

// --- HTTP API ---

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

// Health check for the /api ingress (Cloudflare routes /api -> this service)
app.get("/api/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

// --- Twilio Voice ---
app.post("/api/twilio/voice", async (req, res) => {
  try {
    const speech = String(req.body?.SpeechResult || "").trim();
    const systemPrompt =
      process.env.MINIMAX_SYSTEM_PROMPT ||
      "You are Craigo, an AI brother-in-arms. Be concise, direct, and helpful. Keep replies under 2 sentences.";

    if (!speech) {
      const greeting = process.env.MINIMAX_TWILIO_GREETING || "Hey Fresh, it’s Craigo. Tell me what you need.";
      res.type("text/xml").send(buildTwiML({ say: greeting, gather: true }));
      return;
    }

    const reply = await minimaxChat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: speech },
      ],
      temperature: Number(process.env.MINIMAX_TEMPERATURE || 0.2),
    });

    const spoken = reply?.trim()
      ? reply
      : "I didn’t catch that. Say it again, slower.";

    res.type("text/xml").send(buildTwiML({ say: spoken, gather: true }));
  } catch (err) {
    const fallback = "I hit a snag. Try again in a moment.";
    res.type("text/xml").send(buildTwiML({ say: fallback, gather: true }));
  }
});

// --- Customer auth (B) ---
// POST /api/auth/token { email, password } -> { token }
// NOTE: /api/auth/login was observed to be swallowed by the SPA at the edge; avoid that path.
app.post("/api/auth/token", async (req, res) => {
  try {
    const body = req.body || {};
    const email = String(body.email || "").trim();
    const password = String(body.password || "");

    const expected = requireEnv("CRAIGO_CUSTOMER_PASSWORD", 8);
    if (password !== expected) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signJwt({ sub: email || "customer", scope: "customer" }, { ttlSeconds: 60 * 60 * 24 * 30 });
    return res.status(200).json({ token });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

// --- Customer data (read-only, direct SQLite; avoids Prisma flakiness in pm-web prod builds) ---
app.get("/api/customer/projects", async (req, res) => {
  const auth = requireCustomer(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    const includeArchived = String(req.query?.includeArchived || "").toLowerCase() === "1";
    const includeDeleted = String(req.query?.includeDeleted || "").toLowerCase() === "1";

    const where = ["1=1"];
    if (!includeDeleted) where.push("p.deletedAt IS NULL");
    if (!includeArchived) where.push("p.archivedAt IS NULL");

    const rows = db()
      .prepare(
        `
        SELECT
          p.id,
          p.name,
          p.createdAt,
          p.updatedAt,
          p.archivedAt,
          p.deletedAt,
          (
            SELECT COUNT(1)
            FROM Task t
            WHERE t.projectId = p.id AND t.deletedAt IS NULL
          ) AS tasksCount
        FROM Project p
        WHERE ${where.join(" AND ")}
        ORDER BY p.updatedAt DESC
        `
      )
      .all();

    return res.status(200).json({ projects: rows.map(rowToProject) });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get("/api/customer/projects/:projectId", async (req, res) => {
  const auth = requireCustomer(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    const projectId = String(req.params.projectId || "");
    const includeArchivedTasks = String(req.query?.includeArchivedTasks || "").toLowerCase() === "1";
    const includeDeletedTasks = String(req.query?.includeDeletedTasks || "").toLowerCase() === "1";

    const p = db()
      .prepare(
        `
        SELECT
          p.id,
          p.name,
          p.createdAt,
          p.updatedAt,
          p.archivedAt,
          p.deletedAt,
          (
            SELECT COUNT(1)
            FROM Task t
            WHERE t.projectId = p.id AND t.deletedAt IS NULL
          ) AS tasksCount
        FROM Project p
        WHERE p.id = ?
        LIMIT 1
        `
      )
      .get(projectId);

    if (!p) return res.status(404).json({ error: "Not found" });

    const where = ["projectId = ?"];
    if (!includeDeletedTasks) where.push("deletedAt IS NULL");
    if (!includeArchivedTasks) where.push("archivedAt IS NULL");

    const tasks = db()
      .prepare(
        `
        SELECT id, projectId, title, description, status, priority, updatedAt, archivedAt, deletedAt, canceledAt
        FROM Task
        WHERE ${where.join(" AND ")}
        ORDER BY status ASC, priority DESC, updatedAt DESC
        `
      )
      .all(projectId);

    return res.status(200).json({ project: rowToProject(p), tasks: tasks.map(rowToTask) });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get("/api/customer/activity", async (req, res) => {
  const auth = requireCustomer(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    const projectId = req.query?.projectId ? String(req.query.projectId) : null;
    const limitRaw = req.query?.limit ? Number(req.query.limit) : 200;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 200;

    const rows = projectId
      ? db()
          .prepare(
            `
            SELECT id, projectId, taskId, type, message, metaJson, createdAt
            FROM Activity
            WHERE projectId = ?
            ORDER BY createdAt DESC
            LIMIT ?
            `
          )
          .all(projectId, limit)
      : db()
          .prepare(
            `
            SELECT id, projectId, taskId, type, message, metaJson, createdAt
            FROM Activity
            ORDER BY createdAt DESC
            LIMIT ?
            `
          )
          .all(limit);

    return res.status(200).json({ activities: rows.map(rowToActivity) });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

// Live activity stream (SSE)
// GET /api/customer/activity/stream
app.get("/api/customer/activity/stream", async (req, res) => {
  // EventSource can't send Authorization headers reliably, so we allow token via query param here.
  const authHeader = req.headers["authorization"] || "";
  const m = String(authHeader).match(/^Bearer\s+(.+)$/i);
  const token = m?.[1] || (req.query?.token ? String(req.query.token) : "");
  const v = verifyJwt(token);
  if (!v.ok) return res.status(401).json({ error: "Unauthorized" });

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let closed = false;

  // Start at last 10s to avoid flooding on connect
  let cursor = new Date(Date.now() - 10_000);

  const ping = setInterval(() => {
    res.write(`event: ping\ndata: {}\n\n`);
  }, 15_000);

  const poll = setInterval(() => {
    if (closed) return;
    try {
      const rows = db()
        .prepare(
          `
          SELECT id, projectId, taskId, type, message, metaJson, createdAt
          FROM Activity
          WHERE createdAt > ?
          ORDER BY createdAt ASC
          LIMIT 200
          `
        )
        .all(cursor.toISOString().replace('T', ' ').replace('Z', ''));

      if (rows.length) {
        const last = rows[rows.length - 1];
        cursor = new Date(last.createdAt);

        for (const r of rows) {
          const row = rowToActivity(r);
          res.write(`id: ${row.id}\n`);
          res.write(`event: activity\n`);
          res.write(`data: ${JSON.stringify(row)}\n\n`);
        }
      }
    } catch {
      // ignore
    }
  }, 1000);

  req.on("close", () => {
    closed = true;
    clearInterval(poll);
    clearInterval(ping);
  });
});

// Global status (derived from latest STATUS activity)
app.get("/api/customer/status", async (req, res) => {
  const auth = requireCustomer(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    const row = db()
      .prepare(
        `
        SELECT id, projectId, taskId, type, message, metaJson, createdAt
        FROM Activity
        WHERE type = 'STATUS'
        ORDER BY createdAt DESC
        LIMIT 1
        `
      )
      .get();

    if (!row) return res.status(200).json({ status: null });

    let meta = null;
    try {
      meta = row.metaJson ? JSON.parse(row.metaJson) : null;
    } catch {
      meta = null;
    }

    return res.status(200).json({ status: { ...rowToActivity(row), meta } });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

function nowIso() {
  return new Date().toISOString();
}

function insertActivity({ projectId = null, taskId = null, type = 'NOTE', message, meta = null }) {
  const id = crypto.randomUUID();
  const metaJson = meta ? JSON.stringify(meta) : null;
  db()
    .prepare(
      `INSERT INTO Activity (id, projectId, taskId, type, message, metaJson, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .run(id, projectId, taskId, type, message, metaJson);
  return id;
}

// --- Customer writes (projects + tasks) ---
app.post('/api/customer/projects', async (req, res) => {
  const auth = requireCustomer(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message })

  try {
    const name = String(req.body?.name ?? '').trim()
    if (!name) return res.status(400).json({ error: 'name is required' })

    const id = crypto.randomUUID()

    db()
      .prepare(
        `INSERT INTO Project (id, name, createdAt, updatedAt, archivedAt, deletedAt)
         VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL)`
      )
      .run(id, name)

    insertActivity({
      projectId: id,
      type: 'PROJECT_CREATED',
      message: `Project created: ${name}`,
      meta: { kind: 'project', id, name },
    })

    return res.status(200).json({ project: { id, name, updatedAt: nowIso(), archivedAt: null, deletedAt: null, _count: { tasks: 0 } } })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

app.post('/api/customer/tasks', async (req, res) => {
  const auth = requireCustomer(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message })

  try {
    const projectId = String(req.body?.projectId ?? '').trim()
    const title = String(req.body?.title ?? '').trim()
    const description = typeof req.body?.description === 'string' ? String(req.body.description).trim() : null
    const status = String(req.body?.status ?? 'TODO').trim() || 'TODO'
    const priorityRaw = Number(req.body?.priority ?? 0)
    const priority = Number.isFinite(priorityRaw) ? Math.max(0, Math.min(10, Math.floor(priorityRaw))) : 0

    if (!projectId) return res.status(400).json({ error: 'projectId is required' })
    if (!title) return res.status(400).json({ error: 'title is required' })

    const project = db().prepare('SELECT id, name FROM Project WHERE id = ? AND deletedAt IS NULL LIMIT 1').get(projectId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const id = crypto.randomUUID()

    db()
      .prepare(
        `INSERT INTO Task (id, projectId, title, description, status, priority, createdAt, updatedAt, archivedAt, deletedAt, canceledAt)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL, NULL)`
      )
      .run(id, projectId, title, description, status, priority)

    // Touch project updatedAt
    db().prepare('UPDATE Project SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(projectId)

    insertActivity({
      projectId,
      taskId: id,
      type: 'TASK_CREATED',
      message: `Task created: ${title}`,
      meta: { kind: 'task', id, projectId, title, status, priority },
    })

    return res.status(200).json({
      task: { id, projectId, title, description, status, priority, updatedAt: nowIso(), archivedAt: null, deletedAt: null, canceledAt: null },
    })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// --- Customer edits + lifecycle ---
app.patch('/api/customer/projects/:projectId', async (req, res) => {
  const auth = requireCustomer(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message })

  try {
    const projectId = String(req.params.projectId || '')
    const name = typeof req.body?.name === 'string' ? String(req.body.name).trim() : null
    const archived = typeof req.body?.archived === 'boolean' ? req.body.archived : null
    const restore = Boolean(req.body?.restore)

    const exists = db().prepare('SELECT id, name FROM Project WHERE id = ? LIMIT 1').get(projectId)
    if (!exists) return res.status(404).json({ error: 'Not found' })

    if (name && name !== exists.name) {
      db().prepare('UPDATE Project SET name = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(name, projectId)
      insertActivity({ projectId, type: 'STATUS', message: `Project renamed: ${name}`, meta: { kind: 'project.rename', name } })
    }

    if (archived !== null) {
      // SQLite doesn't accept CURRENT_TIMESTAMP as a bound value; use two statements.
      if (archived) {
        db().prepare('UPDATE Project SET archivedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(projectId)
        insertActivity({ projectId, type: 'STATUS', message: 'Project archived', meta: { kind: 'project.archive' } })
      } else {
        db().prepare('UPDATE Project SET archivedAt = NULL, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(projectId)
        insertActivity({ projectId, type: 'STATUS', message: 'Project unarchived', meta: { kind: 'project.unarchive' } })
      }
    }

    if (restore) {
      db().prepare('UPDATE Project SET deletedAt = NULL, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(projectId)
      insertActivity({ projectId, type: 'STATUS', message: 'Project restored', meta: { kind: 'project.restore' } })
    }

    const row = db().prepare(`
      SELECT p.id,p.name,p.createdAt,p.updatedAt,p.archivedAt,p.deletedAt,
      (SELECT COUNT(1) FROM Task t WHERE t.projectId = p.id AND t.deletedAt IS NULL) AS tasksCount
      FROM Project p WHERE p.id = ? LIMIT 1
    `).get(projectId)

    return res.status(200).json({ project: rowToProject(row) })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// Soft delete project (keeps rows; hide by default)
app.delete('/api/customer/projects/:projectId', async (req, res) => {
  const auth = requireCustomer(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message })

  try {
    const projectId = String(req.params.projectId || '')
    const exists = db().prepare('SELECT id FROM Project WHERE id = ? LIMIT 1').get(projectId)
    if (!exists) return res.status(404).json({ error: 'Not found' })

    db().prepare('UPDATE Project SET deletedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(projectId)
    insertActivity({ projectId, type: 'STATUS', message: 'Project deleted (soft)', meta: { kind: 'project.delete' } })

    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// Permanent delete project
app.delete('/api/customer/projects/:projectId/permanent', async (req, res) => {
  const auth = requireCustomer(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message })

  try {
    const projectId = String(req.params.projectId || '')

    // Delete dependents first (in case FK isn't enforced)
    db().prepare('DELETE FROM Activity WHERE projectId = ?').run(projectId)
    db().prepare('DELETE FROM Task WHERE projectId = ?').run(projectId)
    const info = db().prepare('DELETE FROM Project WHERE id = ?').run(projectId)

    return res.status(200).json({ ok: true, deleted: info.changes })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

app.patch('/api/customer/tasks/:taskId', async (req, res) => {
  const auth = requireCustomer(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message })

  try {
    const taskId = String(req.params.taskId || '')
    const t = db().prepare('SELECT * FROM Task WHERE id = ? LIMIT 1').get(taskId)
    if (!t) return res.status(404).json({ error: 'Not found' })

    const title = typeof req.body?.title === 'string' ? String(req.body.title).trim() : null
    const description = typeof req.body?.description === 'string' ? String(req.body.description).trim() : null
    const status = typeof req.body?.status === 'string' ? String(req.body.status).trim() : null
    const priority = typeof req.body?.priority === 'number' ? Math.max(0, Math.min(10, Math.floor(req.body.priority))) : null

    if (title) db().prepare('UPDATE Task SET title = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(title, taskId)
    if (description !== null) db().prepare('UPDATE Task SET description = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(description, taskId)
    if (status) {
      if (status === 'CANCELED') {
        db().prepare('UPDATE Task SET status = ?, canceledAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(status, taskId)
      } else {
        db().prepare('UPDATE Task SET status = ?, canceledAt = NULL, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(status, taskId)
      }
    }
    if (priority !== null) db().prepare('UPDATE Task SET priority = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(priority, taskId)

    // Touch project
    db().prepare('UPDATE Project SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(t.projectId)

    insertActivity({ projectId: t.projectId, taskId, type: 'TASK_UPDATED', message: `Task updated: ${title || t.title}`, meta: { kind: 'task.update' } })

    const row = db().prepare('SELECT id, projectId, title, description, status, priority, updatedAt, archivedAt, deletedAt, canceledAt FROM Task WHERE id = ? LIMIT 1').get(taskId)
    return res.status(200).json({ task: rowToTask(row) })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// Soft delete task
app.delete('/api/customer/tasks/:taskId', async (req, res) => {
  const auth = requireCustomer(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message })

  try {
    const taskId = String(req.params.taskId || '')
    const t = db().prepare('SELECT id, projectId, title FROM Task WHERE id = ? LIMIT 1').get(taskId)
    if (!t) return res.status(404).json({ error: 'Not found' })

    db().prepare('UPDATE Task SET deletedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(taskId)
    db().prepare('UPDATE Project SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(t.projectId)
    insertActivity({ projectId: t.projectId, taskId, type: 'TASK_UPDATED', message: `Task deleted (soft): ${t.title}`, meta: { kind: 'task.delete' } })

    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// Permanent delete task
app.delete('/api/customer/tasks/:taskId/permanent', async (req, res) => {
  const auth = requireCustomer(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message })

  try {
    const taskId = String(req.params.taskId || '')
    const t = db().prepare('SELECT id, projectId FROM Task WHERE id = ? LIMIT 1').get(taskId)
    if (!t) return res.status(404).json({ error: 'Not found' })

    db().prepare('DELETE FROM Activity WHERE taskId = ?').run(taskId)
    const info = db().prepare('DELETE FROM Task WHERE id = ?').run(taskId)
    db().prepare('UPDATE Project SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(t.projectId)

    return res.status(200).json({ ok: true, deleted: info.changes })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// --- Customer uploads proxy (multipart) ---
// POST /api/customer/uploads (multipart/form-data: file, note)
// We forward the body to pm-web /api/uploads and add the PM_API_TOKEN server-side.
app.post("/api/customer/uploads", async (req, res) => {
  const auth = requireCustomer(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    const pmToken = requireEnv("PM_API_TOKEN", 10);
    const pmBase = process.env.PM_WEB_ORIGIN || "http://127.0.0.1:3000";
    const target = `${pmBase.replace(/\/$/, "")}/api/uploads`;

    const ct = req.headers["content-type"] || "";
    if (!String(ct).toLowerCase().includes("multipart/form-data")) {
      return res.status(415).json({ error: "Expected multipart/form-data" });
    }

    const resp = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": String(ct),
        Authorization: `Bearer ${pmToken}`,
      },
      // Node/undici can stream the incoming request body directly.
      body: req,
      // required for streaming bodies in node fetch
      duplex: "half",
    });

    const text = await resp.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    return res.status(resp.status).json(json);
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

// POST /api/chat/send
// body: { sessionKey?: string, message: string }
app.post("/api/chat/send", async (req, res) => {
  try {
    const sessionKey = req.body?.sessionKey || "agent:main:main";
    const message = req.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    await gatewayCall({
      sessionKey,
      method: "chat.send",
      params: {
        message: message.trim(),
        idempotencyKey: (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`),
      },
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// GET /api/chat/history?sessionKey=...&limit=...
app.get("/api/chat/history", async (req, res) => {
  try {
    const sessionKey = (req.query.sessionKey || "agent:main:main").toString();
    const limit = Number(req.query.limit || 200);

    const payload = await gatewayCall({
      sessionKey,
      method: "chat.history",
      params: { limit },
    });

    const raw = payload?.value ?? payload ?? { messages: [] };

    // Tighten output for mobile clients:
    // - remove tool/toolResult frames
    // - map roles to Craigo/Fresh
    // - return simple string text only
    const msgs = Array.isArray(raw?.messages) ? raw.messages : [];
    const cleaned = msgs
      .filter((m) => m && (m.role === "user" || m.role === "assistant" || m.role === "system"))
      .map((m) => {
        const role = m.role === "assistant" ? "Craigo" : m.role === "user" ? "Fresh" : "System";
        const content = m.content;
        let text = "";
        if (typeof content === "string") {
          text = content;
        } else if (Array.isArray(content)) {
          text = content
            .filter((p) => p && p.type === "text")
            .map((p) => p.text || "")
            .join("");
        }
        return { role, text };
      })
      .filter((m) => typeof m.text === "string" && m.text.trim());

    res.status(200).json({ sessionKey, messages: cleaned.slice(-limit) });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Convenience: POST /api/chat
// body: { sessionKey?: string, message: string }
// response: { reply: string }
app.post("/api/chat", async (req, res) => {
  try {
    const sessionKey = req.body?.sessionKey || "agent:main:main";
    const message = req.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    await gatewayCall({
      sessionKey,
      method: "chat.send",
      params: {
        message: message.trim(),
        idempotencyKey: (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`),
      },
    });

    const history = await gatewayCall({
      sessionKey,
      method: "chat.history",
      params: { limit: 50 },
    });

    const raw = history?.value ?? history ?? { messages: [] };
    const msgs = Array.isArray(raw?.messages) ? raw.messages : [];

    const cleaned = msgs
      .filter((m) => m && (m.role === "user" || m.role === "assistant" || m.role === "system"))
      .map((m) => {
        const role = m.role === "assistant" ? "Craigo" : m.role === "user" ? "Fresh" : "System";
        const content = m.content;
        let text = "";
        if (typeof content === "string") {
          text = content;
        } else if (Array.isArray(content)) {
          text = content
            .filter((p) => p && p.type === "text")
            .map((p) => p.text || "")
            .join("");
        }
        return { role, text };
      })
      .filter((m) => typeof m.text === "string" && m.text.trim());

    const reply = (() => {
      const assistantMsgs = cleaned.filter((m) => m.role === "Craigo");
      return assistantMsgs.length ? assistantMsgs[assistantMsgs.length - 1].text : "";
    })();

    res.status(200).json({ reply, messages: cleaned });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[craigo-api] listening on http://127.0.0.1:${PORT}`);
});
