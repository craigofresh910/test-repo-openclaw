"use client";

import { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";

type Agent = {
  id: string;
  name: string;
  role: string;
  status: string;
  lastUpdate: string;
};

type Task = {
  id: string;
  title: string;
  status: string;
  agentId: string | null;
  prId: string | null;
  agent?: Agent | null;
};

type PR = {
  id: string;
  title: string;
  stage: string;
  status: string;
  repo?: string | null;
  branch?: string | null;
};

type Alert = {
  id: string;
  level: string;
  status: string;
  message: string;
  createdAt: string;
};

type FeedItem = {
  id: string;
  type: string;
  message: string;
  ts: string;
};

const defaultAgents: Array<Pick<Agent, "id" | "name" | "role">> = [
  { id: "builder", name: "Builder", role: "builder" },
  { id: "qa", name: "QA", role: "qa" },
  { id: "pm", name: "PM", role: "pm" },
  { id: "ops", name: "Ops", role: "ops" },
];

const prStages = ["spec", "build", "test", "review", "merge"];
const taskStages = ["queued", "running", "blocked", "done", "failed"];

export default function CommandCenter() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [prs, setPRs] = useState<PR[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [command, setCommand] = useState("");
  const [agentTarget, setAgentTarget] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);

  const agentOptions = useMemo(() => agents.map((agent) => agent.id), [agents]);

  useEffect(() => {
    const boot = async () => {
      await fetch("/api/socket");
      const socketClient = io({ path: "/api/socket" });
      setSocket(socketClient);

      socketClient.on("agent.updated", (payload: Agent) => {
        setAgents((prev) => upsert(prev, payload, "id"));
        pushFeed("agent", `${payload.name} (${payload.role}) → ${payload.status}`);
      });

      socketClient.on("task.created", (payload: Task) => {
        setTasks((prev) => [payload, ...prev]);
        pushFeed("task", `Task queued: ${payload.title}`);
      });

      socketClient.on("pr.created", (payload: PR) => {
        setPRs((prev) => [payload, ...prev]);
        pushFeed("pr", `PR created: ${payload.title}`);
      });

      socketClient.on("pr.updated", (payload: PR) => {
        setPRs((prev) => upsert(prev, payload, "id"));
        pushFeed("pr", `PR updated: ${payload.title} → ${payload.stage}`);
      });

      socketClient.on("alert.created", (payload: Alert) => {
        setAlerts((prev) => [payload, ...prev]);
        pushFeed("alert", `${payload.level.toUpperCase()}: ${payload.message}`);
      });
    };

    boot();

    return () => {
      socket?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const load = async () => {
      const [agentsRes, tasksRes, prsRes, alertsRes] = await Promise.all([
        fetch("/api/agents"),
        fetch("/api/tasks"),
        fetch("/api/prs"),
        fetch("/api/alerts"),
      ]);

      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(data.agents || []);
      }
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }
      if (prsRes.ok) {
        const data = await prsRes.json();
        setPRs(data.prs || []);
      }
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }
    };

    load();
  }, []);

  const pushFeed = (type: string, message: string) => {
    setFeed((prev) => [{ id: crypto.randomUUID(), type, message, ts: new Date().toISOString() }, ...prev].slice(0, 100));
  };

  const handleDispatch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!command.trim()) return;

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: command.trim(), agentId: agentTarget || null }),
    });

    if (res.ok) {
      setCommand("");
      pushFeed("command", `Dispatched: ${command}`);
    }
  };

  const seedAgents = async () => {
    await Promise.all(
      defaultAgents.map((agent) =>
        fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(agent),
        })
      )
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Mission Control</h1>
            <p className="text-sm text-slate-400">Command Center · Live Feed · PR + Task Pipeline</p>
          </div>
          <form onSubmit={handleDispatch} className="flex w-full max-w-xl items-center gap-2">
            <select
              className="h-10 rounded-md border border-slate-800 bg-slate-900 px-3 text-sm"
              value={agentTarget}
              onChange={(event) => setAgentTarget(event.target.value)}
            >
              <option value="">Any agent</option>
              {agentOptions.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
                </option>
              ))}
            </select>
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="@builder ship auth gating"
              className="flex-1 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
            />
            <button className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white">
              Dispatch
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1fr_1.2fr_0.9fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Live Feed</h2>
            <span className="text-xs text-slate-500">{feed.length} events</span>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            {feed.length === 0 ? (
              <p className="text-slate-500">No events yet. Dispatch a task to start the feed.</p>
            ) : (
              feed.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <div className="text-xs uppercase text-slate-500">{item.type}</div>
                  <div className="text-slate-200">{item.message}</div>
                  <div className="text-xs text-slate-600">{new Date(item.ts).toLocaleTimeString()}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Pipeline Board</h2>
            <div className="text-xs text-slate-500">PRs + Tasks</div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase text-slate-500">PR Stages</h3>
              <div className="mt-3 space-y-3">
                {prStages.map((stage) => (
                  <div key={stage} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-xs uppercase text-slate-500">{stage}</div>
                    <div className="mt-2 space-y-2">
                      {prs.filter((pr) => pr.stage === stage).map((pr) => (
                        <div key={pr.id} className="rounded-lg bg-slate-900/60 px-3 py-2 text-sm">
                          {pr.title}
                        </div>
                      ))}
                      {prs.filter((pr) => pr.stage === stage).length === 0 && (
                        <div className="text-xs text-slate-600">No PRs</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-slate-500">Task Status</h3>
              <div className="mt-3 space-y-3">
                {taskStages.map((stage) => (
                  <div key={stage} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-xs uppercase text-slate-500">{stage}</div>
                    <div className="mt-2 space-y-2">
                      {tasks.filter((task) => task.status === stage).map((task) => (
                        <div key={task.id} className="rounded-lg bg-slate-900/60 px-3 py-2 text-sm">
                          {task.title}
                        </div>
                      ))}
                      {tasks.filter((task) => task.status === stage).length === 0 && (
                        <div className="text-xs text-slate-600">No tasks</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Agents</h2>
              <button
                onClick={seedAgents}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300"
              >
                Seed Agents
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {agents.length === 0 ? (
                <p className="text-sm text-slate-500">No agents registered yet.</p>
              ) : (
                agents.map((agent) => (
                  <div key={agent.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{agent.name}</div>
                        <div className="text-xs uppercase text-slate-500">{agent.role}</div>
                      </div>
                      <span className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">
                        {agent.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Alerts</h2>
            <div className="mt-4 space-y-3">
              {alerts.length === 0 ? (
                <p className="text-sm text-slate-500">No alerts.</p>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-xs uppercase text-slate-500">{alert.level}</div>
                    <div className="text-sm text-slate-100">{alert.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function upsert<T extends Record<string, unknown>>(items: T[], next: T, key: keyof T) {
  const index = items.findIndex((item) => item[key] === next[key]);
  if (index === -1) {
    return [next, ...items];
  }
  const clone = [...items];
  clone[index] = { ...clone[index], ...next };
  return clone;
}
