import { NextResponse } from 'next/server';
import { AuthError, authenticateRequest } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    return NextResponse.json({ actor: await authenticateRequest(request) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 'failed', message: error.message }, { status: error.status });
    }
    return NextResponse.json({ status: 'failed', message: 'Authentication failed.' }, { status: 500 });
  }
}
