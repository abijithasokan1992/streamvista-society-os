import { NextResponse } from 'next/server';
import { AuthError, type Actor } from '@/lib/auth';
import { CommandSchema, executeCommand } from '@/lib/orchestrator';

function shortcutActor(): Actor {
  return {
    id: process.env.VISTA_SHORTCUT_ACTOR_ID?.trim() || 'shortcut-device',
    email: process.env.VISTA_SHORTCUT_ACTOR_EMAIL?.trim() || 'shortcut@local',
    role: 'operator',
  };
}

export async function POST(request: Request) {
  const secret = process.env.VISTA_COMMAND_SECRET;
  if (!secret) {
    return NextResponse.json({ status: 'waiting', message: 'Voice/iPhone gateway is not configured.' }, { status: 503 });
  }

  const supplied = request.headers.get('x-vista-key');
  if (supplied !== secret) {
    return NextResponse.json({ status: 'failed', message: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const command = CommandSchema.parse({ ...body, source: body?.source ?? 'iphone' });
    return NextResponse.json(await executeCommand(command, { actor: shortcutActor() }));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 'failed', message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { status: 'failed', message: error instanceof Error ? error.message : 'Invalid command' },
      { status: 400 },
    );
  }
}
