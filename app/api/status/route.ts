import { NextResponse } from 'next/server';
import { getAgentRegistryStatus } from '@/lib/agents';
import { getApprovalStatus } from '@/lib/approval';
import { getAuthStatus } from '@/lib/auth';
import { getConnectorStatuses } from '@/lib/connectors';
import { getPersistenceStatus } from '@/lib/persistence';
import { getReasoningStatus } from '@/lib/planner';

export async function GET() {
  const connectors = getConnectorStatuses();
  const configured = connectors.filter((item) => item.configured).length;

  return NextResponse.json({
    service: 'streamvista-society-os',
    status: 'ok',
    version: '0.3.0',
    lifecycle: 'implemented-not-production',
    productionPromotionAllowed: false,
    productionPromotionBlocker: 'Authenticated end-to-end runtime evidence and production security gates are still required.',
    modules: {
      commandCenter: 'available',
      orchestrator: 'available',
      agentRegistry: getAgentRegistryStatus(),
      authentication: getAuthStatus(),
      approvalEngine: getApprovalStatus(),
      persistence: getPersistenceStatus(),
      reasoning: getReasoningStatus(),
      iphoneVoiceGateway: process.env.VISTA_COMMAND_SECRET ? 'configured-read-only-operator' : 'unconfigured',
    },
    integrations: {
      configured,
      total: connectors.length,
      allBound: configured === connectors.length,
      productionVerified: false,
      connectors,
    },
  });
}
