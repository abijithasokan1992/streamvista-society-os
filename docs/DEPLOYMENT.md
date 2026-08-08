# StreamVista Society OS V2 deployment gate

## Required sequence

1. Apply the Society OS Supabase migration.
2. Configure public Supabase Auth URL/publishable key and server persistence credentials.
3. Configure `VISTA_FOUNDER_EMAILS` and a strong `VISTA_APPROVAL_SECRET`.
4. Set `VISTA_AUDIT_REQUIRED=true` before enabling any mutating connector.
5. Configure connector URLs and separate connector tokens.
6. Optionally bind the structured reasoning bridge; deterministic multi-intent planning remains the degraded fallback.
7. Run `npm run typecheck`, `npm test`, and `npm run build` in CI.
8. Deploy exactly one canonical Vercel project for this repository.
9. Verify `/api/status`, authenticated `/api/me`, read-only command execution, approval-required behavior, approved mutation in a non-production target, audit persistence, and explicit bridge verification evidence.
10. Only after security review and runtime evidence should a separate production-promotion change be considered.

## Duplicate deployment warning

Multiple Vercel projects connected to the same repository create duplicate builds and can consume deployment quota. Keep a single canonical Vercel project; do not treat generated suffix projects as separate Society OS codebases.

## Current state

V2 source implementation exists on a feature branch. Production promotion remains explicitly disabled in code. No connector should be considered production verified from configuration alone.
