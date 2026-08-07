# Vista OS — StreamVista Command Center

Vista OS is the canonical full-stack AI operating layer for StreamVista workflows. V1 is designed around one execution contract:

**Command → Route → Agent → Execute → Verify → Report**

## V1 modules

- Next.js Command Center UI
- Server-side command API
- Intent router and agent orchestrator
- GitHub/mail/calendar/deployment/business agent routing boundaries
- Service status endpoint
- CI build verification
- Mobile-first responsive control surface

## Architecture

```text
Voice / iPhone / Web
        ↓
Vista Command Center
        ↓
Command API
        ↓
Agent Orchestrator
        ↓
Connector Adapters
        ↓
External execution
        ↓
Verification + audit result
```

V1 deliberately keeps connector execution behind server-side adapters. A command is never reported as externally verified until the corresponding connector has executed and returned evidence.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production build

```bash
npm run build
npm start
```

## API

`POST /api/command`

```json
{
  "command": "Check GitHub and show deployment blockers",
  "source": "web"
}
```

`GET /api/status` returns service status.

## Build policy

Reuse → repair → extend → create new only when necessary. The repository is the canonical home for Vista OS application, orchestration, connectors, infrastructure and device bridges.
