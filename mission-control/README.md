# Mission Control

Local-only Mission Control for shipping PRs, running ops, and coordinating agents.

## Stack
- Next.js (App Router) + Tailwind
- Postgres + Prisma
- Socket.io (live feed)

## Setup

```bash
cd /Users/craigofresh/.openclaw/workspace/mission-control
npm install
```

### Configure DB

Create a local Postgres DB and set `.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mission_control?schema=public"
```

Then run:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

## Run

```bash
npm run dev
```

Open: http://localhost:3000

## Seed Agents

Click **Seed Agents** in the UI or POST to `/api/agents`:

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"id":"builder","name":"Builder","role":"builder"}'
```

## Socket.io
The client initializes the socket with `GET /api/socket` and listens on `path=/api/socket`.
