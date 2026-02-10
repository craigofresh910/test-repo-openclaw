const floor = document.getElementById("floor");
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

function render(data) {
  if (!data) return;
  if (data.updatedAt) {
    updatedAt.textContent = `Last update: ${new Date(data.updatedAt).toLocaleString()}`;
  }

  const agentsById = new Map(data.agents.map((agent) => [agent.id, agent]));
  floor.innerHTML = "";

  layoutOrder.forEach((id) => {
    const agent = agentsById.get(id);
    if (!agent) return;

    const desk = document.createElement("div");
    desk.className = `desk ${agent.id === "craigo" ? "center" : ""}`;

    desk.innerHTML = `
      <div class="agent-title">
        <span>${agent.name}</span>
        <span class="badge ${agent.status}">${agent.status || "idle"}</span>
      </div>
      <div class="role">${agent.role || ""}</div>
      <div class="task">${agent.task || "No active task"}</div>
      <div class="last-message">${agent.lastMessage || "No updates yet"}</div>
      <div class="files">${(agent.filesChanged || [])
        .map((file) => `<span>${file}</span>`)
        .join("")}</div>
    `;

    floor.appendChild(desk);
  });

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

async function init() {
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
