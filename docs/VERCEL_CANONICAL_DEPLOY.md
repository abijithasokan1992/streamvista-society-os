# Canonical Vercel deployment circuit breaker

Society OS was linked to multiple Vercel projects, causing every Git push to fan out into duplicate builds and consume team build capacity.

## Circuit breaker

`vercel.json` disables automatic Git deployments for this repository. GitHub remains the source CI gate.

## Canonical preview tool

Use the manually dispatched GitHub workflow `society-os-canonical-vercel-preview` only after one Vercel project has been chosen as canonical and the repository secrets below point to that exact project:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The workflow:

1. verifies the three explicit credentials exist;
2. runs install, typecheck, and tests on GitHub;
3. pulls settings for only the configured Vercel project;
4. runs `vercel build` on the GitHub runner;
5. uploads the already-built artifact with `vercel deploy --prebuilt`.

This avoids eight automatic remote builds and makes the target project explicit by ID.

## Safety

- The workflow is manual only.
- It creates a preview deployment only; it does not use `--prod`.
- Production promotion remains blocked until the Society OS production gate is explicitly opened.
- Do not re-enable automatic Git deployments while duplicate Vercel project links remain.
