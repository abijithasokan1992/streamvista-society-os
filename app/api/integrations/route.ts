import { NextResponse } from 'next/server';
import { getConnectorStatuses } from '@/lib/connectors';

export async function GET() {
  const connectors = getConnectorStatuses();
  const configured = connectors.filter((item) => item.configured).length;
  return NextResponse.json({
    service: 'vista-os-integrations',
    status: configured === connectors.length ? 'bound' : 'partial',
    configured,
    total: connectors.length,
    productionVerified: false,
    connectors,
  });
}
