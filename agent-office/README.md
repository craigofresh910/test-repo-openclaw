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

## Global search

```bash
curl "http://localhost:3030/api/search?q=memory&scope=memory"
curl "http://localhost:3030/api/search?q=agent%20office&scope=workspace"
```

Scopes: `memory` (default), `office`, `workspace`, `all`.

## Daily journal

```bash
curl -X POST http://localhost:3030/api/journal   -H "Content-Type: application/json"   -d '{"text": "Wrapped sprint planning and sent build notes"}'
```

## Council (multi-model)

```bash
curl -X POST http://localhost:3030/api/council   -H "Content-Type: application/json"   -d '{"prompt": "How should we structure the next sprint?"}'
```

Optional models override:

```bash
curl -X POST http://localhost:3030/api/council   -H "Content-Type: application/json"   -d '{"prompt": "Audit the release checklist.", "models": "llama3.1:8b,deepseek-coder:6.7b-instruct"}'
```

Environment:
- `OFFICE_COUNCIL_MODELS="llama3.1:8b,deepseek-coder:6.7b-instruct"`
- `OLLAMA_HOST`, `OLLAMA_MODEL`


## Notes
- This is a local‑only dashboard (no external traffic).
- Next step: hook updates to OpenClaw events so each agent updates automatically.
