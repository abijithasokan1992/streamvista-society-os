# StreamVista Society OS — Vista Core

This repository is the canonical source for StreamVista Society OS control-plane work. V2 evolves the original Vista OS command center around one fail-closed execution contract:

**Identity → Command → Plan → Policy → Approval → Agent → Connector → Verify → Audit → Memory → Report**

## V2 implemented foundation

- Next.js command center UI
- Supabase session verification for the web command API
- Founder/Admin/Operator/Viewer RBAC
- Risk classification and explicit approval gates
- Five-minute HMAC approval tokens bound to actor + exact command + risk
- Nine-agent canonical registry: CEO, Founder, Research, Rights, Licensing, Finance, Sales, Communication, QA/Security
- Multi-intent deterministic planner with optional structured AI reasoning bridge
- GitHub, Mail, Calendar, Deployment and Business connector boundaries
- Per-connector credentials with legacy shared-token fallback
- Explicit bridge verification contract (`verified: true` required)
- Supabase audit + persistent memory schema with RLS and revoked client access
- iPhone/voice shortcut gateway restricted to operator role
- CI typecheck + control-plane regression tests + production build
- Health/status endpoints that keep production promotion fail closed

## Execution architecture

```text
Web / iPhone / Voice
        ↓
Identity + RBAC
        ↓
Vista Core Command API
        ↓
Planner / optional reasoning bridge
        ↓
Risk policy + approval engine
        ↓
Canonical agent registry
        ↓
Connector bridges
        ↓
Explicit verification evidence
        ↓
Audit + persistent memory
        ↓
Report
```

## Lifecycle truth

Implemented is not production. Bound is not verified. A successful HTTP response is not verification. `/api/status` therefore keeps `productionPromotionAllowed: false` until authenticated end-to-end runtime evidence and the production gates exist.

## Runtime endpoints

- `GET /api/status` — lifecycle, modules, connector readiness
- `GET /api/integrations` — connector binding state; never claims production verification
- `GET /api/me` — authenticated actor + resolved role
- `POST /api/command` — authenticated command planning/execution
- `POST /api/approval` — explicit short-lived approval for an exact mutating command
- `POST /api/shortcut` — secret-protected iPhone/voice gateway, operator role only

## Data migration

Apply `supabase/migrations/20260808_society_os_control_plane.sql` to the intended Society OS Supabase project before setting `VISTA_AUDIT_REQUIRED=true` or `VISTA_MEMORY_REQUIRED=true`.

## Local verification

```bash
npm install
npm run check
```

See `.env.example`, `docs/SECURITY.md`, and `docs/DEPLOYMENT.md` before binding external connectors.
