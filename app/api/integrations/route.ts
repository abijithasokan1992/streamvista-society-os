import { NextResponse } from 'next/server';
import { getConnectorStatuses } from '@/lib/connectors';

export async function GET() {
  const connectors = getConnectorStatuses();
  return NextResponse.json({
    service: 'vista-os-integrations',
    status: connectors.every((item) => item.configured) ? 'ready' : 'partial',
    connectors,
  });
}
