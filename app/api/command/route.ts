import { NextResponse } from 'next/server';
import { CommandSchema, executeCommand } from '@/lib/orchestrator';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const command = CommandSchema.parse(body);
    const result = await executeCommand(command);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { status: 'failed', message: error instanceof Error ? error.message : 'Invalid command' },
      { status: 400 },
    );
  }
}
