export type ConnectorId = 'github' | 'mail' | 'calendar' | 'deployment' | 'business';

export type ConnectorStatus = {
  id: ConnectorId;
  name: string;
  configured: boolean;
  tokenConfigured: boolean;
  mode: 'bridge' | 'unbound';
};

export type ConnectorExecution = {
  ok: boolean;
  verified: boolean;
  state: 'success' | 'unbound' | 'failed';
  message: string;
  evidence?: unknown;
};

export type ConnectorContext = {
  actor: { id: string; email: string; role: string };
  approved: boolean;
  risk: string;
  commandId: string;
};

const definitions: Record<ConnectorId, { name: string; urlEnv: string; tokenEnv: string }> = {
  github: { name: 'GitHub', urlEnv: 'VISTA_GITHUB_BRIDGE_URL', tokenEnv: 'VISTA_GITHUB_BRIDGE_TOKEN' },
  mail: { name: 'Mail', urlEnv: 'VISTA_MAIL_BRIDGE_URL', tokenEnv: 'VISTA_MAIL_BRIDGE_TOKEN' },
  calendar: { name: 'Calendar', urlEnv: 'VISTA_CALENDAR_BRIDGE_URL', tokenEnv: 'VISTA_CALENDAR_BRIDGE_TOKEN' },
  deployment: { name: 'Deployment', urlEnv: 'VISTA_DEPLOYMENT_BRIDGE_URL', tokenEnv: 'VISTA_DEPLOYMENT_BRIDGE_TOKEN' },
  business: { name: 'Business', urlEnv: 'VISTA_BUSINESS_BRIDGE_URL', tokenEnv: 'VISTA_BUSINESS_BRIDGE_TOKEN' },
};

function bridgeUrl(id: ConnectorId) {
  return process.env[definitions[id].urlEnv]?.trim();
}

function bridgeToken(id: ConnectorId) {
  return process.env[definitions[id].tokenEnv]?.trim() ?? process.env.VISTA_BRIDGE_TOKEN?.trim();
}

export function getConnectorStatuses(): ConnectorStatus[] {
  return (Object.keys(definitions) as ConnectorId[]).map((id) => ({
    id,
    name: definitions[id].name,
    configured: Boolean(bridgeUrl(id)),
    tokenConfigured: Boolean(bridgeToken(id)),
    mode: bridgeUrl(id) ? 'bridge' : 'unbound',
  }));
}

export async function executeConnector(id: ConnectorId, instruction: string, context: ConnectorContext): Promise<ConnectorExecution> {
  const url = bridgeUrl(id);
  if (!url) {
    return { ok: false, verified: false, state: 'unbound', message: `${definitions[id].name} connector is not bound in this deployment.` };
  }

  try {
    const token = bridgeToken(id);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        'x-vista-command-id': context.commandId,
        'x-vista-actor-id': context.actor.id,
        'x-vista-actor-role': context.actor.role,
      },
      body: JSON.stringify({
        instruction,
        connector: id,
        source: 'vista-os',
        actor: context.actor,
        approval: { approved: context.approved, risk: context.risk },
      }),
      cache: 'no-store',
    });

    const text = await response.text();
    let evidence: unknown = text || null;
    try {
      evidence = text ? JSON.parse(text) : null;
    } catch {
      // Preserve plain-text response for diagnostics, but it is not verified evidence.
    }

    if (!response.ok) {
      return { ok: false, verified: false, state: 'failed', message: `${definitions[id].name} bridge returned HTTP ${response.status}.`, evidence };
    }

    const explicitVerified = Boolean(
      evidence && typeof evidence === 'object' && (evidence as Record<string, unknown>).verified === true,
    );

    return {
      ok: true,
      verified: explicitVerified,
      state: 'success',
      message: explicitVerified
        ? `${definitions[id].name} bridge executed and explicitly verified the result.`
        : `${definitions[id].name} bridge executed, but verification was not explicitly asserted.`,
      evidence,
    };
  } catch (error) {
    return {
      ok: false,
      verified: false,
      state: 'failed',
      message: error instanceof Error ? error.message : `${definitions[id].name} bridge failed.`,
    };
  }
}
