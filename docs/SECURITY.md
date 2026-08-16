# Society OS V2 security model

## Identity

`POST /api/command`, `POST /api/approval`, and `GET /api/me` require a valid Supabase access token. The server verifies the token against Supabase Auth before using the user identity. `VISTA_FOUNDER_EMAILS` is an environment-controlled allowlist that can elevate an already-authenticated matching email to the founder role.

Roles: `founder`, `admin`, `operator`, `viewer`.

- Founder: read + mutating + critical actions, subject to explicit approval where required.
- Admin: read + non-critical mutating actions, subject to explicit approval.
- Operator: read-only connector commands.
- Viewer: cannot execute connector commands.

## Approval

Mutations are classified as medium/high/critical risk. Approval tokens are HMAC signed, bound to the authenticated actor, exact normalized command hash and risk level, and expire after five minutes. Critical commands require the founder role.

## Connector trust

A 2xx response from a connector bridge does not automatically mean verified. The bridge must explicitly return JSON containing `verified: true`. Per-connector bridge tokens are preferred; the old shared `VISTA_BRIDGE_TOKEN` remains only as a compatibility fallback.

## Audit and memory

The Supabase migration creates `society_os_audit` and `society_os_memory`, enables RLS, and revokes table access from `anon` and `authenticated`. Server persistence uses a service-role key and stores redacted command previews plus hashes; raw credentials should never be written to these tables.

Set `VISTA_AUDIT_REQUIRED=true` in any environment where external mutations are allowed. When required audit persistence is unavailable, execution fails before connector side effects.

## Production gate

The status endpoint deliberately returns `productionPromotionAllowed: false`. Configuration is not production evidence. Promotion requires authenticated end-to-end execution, connector-specific verification evidence, security review, successful CI, and deployment/runtime health checks.
