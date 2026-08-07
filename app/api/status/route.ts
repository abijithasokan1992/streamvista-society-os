import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ service: 'vista-os-command-center', status: 'ok', version: '0.1.0' });
}
