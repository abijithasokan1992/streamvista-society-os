# Vista OS V1 Deployment

The application is build-verified on GitHub Actions.

## Runtime endpoints
- `GET /api/status` — core/module health
- `GET /api/integrations` — connector readiness
- `POST /api/command` — web command execution
- `POST /api/shortcut` — iPhone/voice gateway (requires `VISTA_COMMAND_SECRET`)

## Connector bindings
Configure server-side bridge URLs for GitHub, Mail, Calendar, Deployment and Business connectors. External execution is only marked verified after a bridge returns successful evidence.

## Deployment state
Vercel direct deployment is currently blocked by the account free-tier daily API deployment quota. Retry after quota reset; no paid upgrade is required by this repository.
