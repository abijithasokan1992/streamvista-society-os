import { NextResponse } from 'next/server';
import { getConnectorStatuses } from '@/lib/connectors';

export async function GET() {
  const connectors = getConnectorStatuses();
  const configured = connectors.filter((item) => item.configured).length;

  return NextResponse.json({
    service: 'vista-os-command-center',
    status: 'ok',
    version: '0.2.0',
    modules: {
      commandCenter: 'online',
      orchestrator: 'online',
      connectorRegistry: 'online',
      iphoneVoiceGateway: process.env.VISTA_COMMAND_SECRET ? 'configured' : 'unconfigured',
    },
    integrations: {
      configured,
      total: connectors.length,
      connectors,
    },
  });
}
