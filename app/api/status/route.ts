import { NextResponse } from 'next/server';
import { getConnectorStatuses } from '@/lib/connectors';
import { CANONICAL_AGENT_IDS } from '@/lib/orchestrator';

export async function GET() {
  const connectors = getConnectorStatuses();
  const configured = connectors.filter((item) => item.configured).length;

  return NextResponse.json({
    service: 'streamvista-ai-command-center',
    status: 'ok',
    version: '0.3.0',
    modules: {
      commandCenter: 'online',
      coreScreen: 'online',
      orchestrator: 'online',
      connectorRegistry: 'online',
      canonicalAgentsLoaded: CANONICAL_AGENT_IDS.length,
      productionExecution: 'evidence_required',
      iphoneVoiceGateway: process.env.VISTA_COMMAND_SECRET ? 'configured' : 'unconfigured',
    },
    integrations: {
      configured,
      total: connectors.length,
      connectors,
    },
  });
}
