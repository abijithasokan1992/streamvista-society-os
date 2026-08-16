import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.COMMAND_CENTER_SUPABASE_URL?.trim() || 'https://solauojbnazfeutsxrwz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.COMMAND_CENTER_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  'sb_publishable_NgbkGb54HxLTHXQBuNGLhA_G360DZW2';

type Agent = {
  canonical_id: string;
  display_name: string;
  lifecycle_status: string;
  department_slug: string | null;
  risk_level: string | null;
  approvals: string | null;
  connected_apps: string[] | null;
  source_repository: string | null;
  source_path: string | null;
  summary: string | null;
  duplicate_decision: string | null;
};

type Connection = {
  app_key: string;
  app_name: string;
  agent_canonical_id: string;
  status: string;
  notes: string | null;
  updated_at: string | null;
};

type AgentTool = {
  agent_canonical_id: string;
  tool_key: string;
  tool_name: string;
  category: string;
  description: string | null;
};

type SyncRun = {
  status: string;
  trigger_source: string;
  message: string | null;
  started_at: string;
  finished_at: string | null;
  repositories_synced: number | null;
  agents_synced: number | null;
};

type Setting = { key: string; value: string };

async function read<T>(path: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`read_model_http_${response.status}`);
  }
  return (await response.json()) as T;
}

export async function GET() {
  try {
    const [agents, connections, tools, runs, settingsRows] = await Promise.all([
      read<Agent[]>('agents?select=*&duplicate_decision=eq.canonical&order=display_name.asc'),
      read<Connection[]>('app_agent_connections?select=*&order=app_name.asc,agent_canonical_id.asc'),
      read<AgentTool[]>('agent_tools?select=*&order=tool_name.asc'),
      read<SyncRun[]>('sync_runs?select=*&order=started_at.desc&limit=10'),
      read<Setting[]>('command_center_settings?select=key,value&order=key.asc'),
    ]);

    const connectedRoutes = connections.filter((row) => row.status === 'connected').length;
    const plannedRoutes = connections.filter((row) => row.status === 'planned').length;
    const totalRoutes = connections.length;
    const connectedApps = new Set(
      connections.filter((row) => row.status === 'connected').map((row) => row.app_key),
    ).size;
    const appCount = new Set(connections.map((row) => row.app_key)).size;
    const latestRun = runs[0] ?? null;
    const settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));

    const runtimeState =
      totalRoutes > 0 && connectedRoutes === totalRoutes
        ? 'connected'
        : connectedRoutes > 0
          ? 'degraded'
          : 'blocked';

    const syncHealth =
      !latestRun
        ? 'never_run'
        : latestRun.status === 'success'
          ? 'healthy'
          : latestRun.status === 'blocked'
            ? 'degraded'
            : latestRun.status === 'failed'
              ? 'failed'
              : 'degraded';

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      agents,
      connections,
      tools,
      latestRun,
      settings,
      metrics: {
        canonicalAgents: agents.length,
        totalRoutes,
        connectedRoutes,
        plannedRoutes,
        connectedApps,
        appCount,
        runtimeState,
        syncHealth,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'read_model_unavailable',
        message: error instanceof Error ? error.message : 'Unknown read-model error',
      },
      { status: 503 },
    );
  }
}
