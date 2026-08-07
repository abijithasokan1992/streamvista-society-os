export type ConnectorId = 'github' | 'mail' | 'calendar' | 'deployment' | 'business';

export type ConnectorStatus = {
  id: ConnectorId;
  name: string;
  configured: boolean;
  mode: 'bridge' | 'unbound';
};

export type ConnectorExecution = {
  ok: boolean;
  verified: boolean;
  message: string;
  evidence?: unknown;
};

const definitions: Record<ConnectorId, { name: string; urlEnv: string }> = {
  github: { name: 'GitHub', urlEnv: 'VISTA_GITHUB_BRIDGE_URL' },
  mail: { name: 'Mail', urlEnv: 'VISTA_MAIL_BRIDGE_URL' },
  calendar: { name: 'Calendar', urlEnv: 'VISTA_CALENDAR_BRIDGE_URL' },
  deployment: { name: 'Deployment', urlEnv: 'VISTA_DEPLOYMENT_BRIDGE_URL' },
  business: { name: 'Business', urlEnv: 'VISTA_BUSINESS_BRIDGE_URL' },
};

function bridgeUrl(id: ConnectorId) {
  return process.env[definitions[id].urlEnv]?.trim();
}

export function getConnectorStatuses(): ConnectorStatus[] {
  return (Object.keys(definitions) as ConnectorId[]).map((id) => ({
    id,
    name: definitions[id].name,
    configured: Boolean(bridgeUrl(id)),
    mode: bridgeUrl(id) ? 'bridge' : 'unbound',
  }));
}

export async function executeConnector(id: ConnectorId, command: string): Promise<ConnectorExecution> {
  const url = bridgeUrl(id);
  if (!url) {
    return {
      ok: false,
      verified: false,
      message: `${definitions[id].name} connector is not bound in this deployment.`,
    };
  }

  try {
    const token = process.env.VISTA_BRIDGE_TOKEN;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ command, connector: id, source: 'vista-os' }),
      cache: 'no-store',
    });

    const text = await response.text();
    let evidence: unknown = text;
    try {
      evidence = text ? JSON.parse(text) : null;
    } catch {
      // Preserve plain-text evidence.
    }

    if (!response.ok) {
      return {
        ok: false,
        verified: false,
        message: `${definitions[id].name} bridge returned HTTP ${response.status}.`,
        evidence,
      };
    }

    return {
      ok: true,
      verified: true,
      message: `${definitions[id].name} bridge executed and returned evidence.`,
      evidence,
    };
  } catch (error) {
    return {
      ok: false,
      verified: false,
      message: error instanceof Error ? error.message : `${definitions[id].name} bridge failed.`,
    };
  }
}
