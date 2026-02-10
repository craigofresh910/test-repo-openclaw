# Agent Office (Local)

Visual floor‑plan dashboard for your agent team.

## Run

```bash
cd /Users/craigofresh/.openclaw/workspace/agent-office
npm install

# set access for remote viewing
export OFFICE_USER="fresh"
export OFFICE_PASS="<your-strong-password>"

npm run dev
```

Open: http://localhost:3030

## Update agent status (examples)

```bash
curl -X POST http://localhost:3030/api/agents/builder \
  -H "Content-Type: application/json" \
  -d '{
    "status": "busy",
    "task": "Implement billing flow",
    "lastMessage": "Starting checkout wiring",
    "filesChanged": ["apps/web/pages/pricing.tsx"],
    "log": "Pulled latest branch, starting work"
  }'
```

Append a log line:

```bash
curl -X POST http://localhost:3030/api/agents/qa/log \
  -H "Content-Type: application/json" \
  -d '{"text": "Reproduced auth redirect issue"}'
```

## Notes
- This is a local‑only dashboard (no external traffic).
- Next step: hook updates to OpenClaw events so each agent updates automatically.
