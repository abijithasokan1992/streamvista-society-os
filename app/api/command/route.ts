import { NextResponse } from 'next/server';
import { AuthError, authenticateRequest } from '@/lib/auth';
import { CommandSchema, executeCommand } from '@/lib/orchestrator';

export async function POST(request: Request) {
  try {
    const actor = await authenticateRequest(request);
    const body = await request.json();
    const command = CommandSchema.parse(body);
    const result = await executeCommand(command, { actor });
    return NextResponse.json(result, { status: 200 });
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
