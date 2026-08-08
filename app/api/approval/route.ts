import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError, authenticateRequest, assertRiskAllowed, canApprove } from '@/lib/auth';
import { issueApprovalToken } from '@/lib/approval';
import { createExecutionPlan } from '@/lib/planner';
import { classifyCommand } from '@/lib/policy';
import { persistAudit } from '@/lib/persistence';

const ApprovalRequest = z.object({ command: z.string().min(1).max(2000) });

export async function POST(request: Request) {
  try {
    const actor = await authenticateRequest(request);
    const { command } = ApprovalRequest.parse(await request.json());
    const plan = await createExecutionPlan(command);
    const intents = plan.steps.map((step) => step.intent);
    const policy = classifyCommand(command, intents);
    assertRiskAllowed(actor, policy.risk);

    if (!policy.approvalRequired) {
      return NextResponse.json({ required: false, risk: policy.risk, reason: policy.reason });
    }
    if (!canApprove(actor)) throw new AuthError('This role cannot approve mutating actions.', 403);

    const approvalToken = issueApprovalToken(actor, command, policy.risk);
    await persistAudit({
      commandId: crypto.randomUUID(),
      actor,
      command,
      intents,
      risk: policy.risk,
      decision: 'approved',
    });
    return NextResponse.json({ required: true, approved: true, risk: policy.risk, approvalToken, expiresInSeconds: 300 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 'failed', message: error.message }, { status: error.status });
    }
    return NextResponse.json({ status: 'failed', message: error instanceof Error ? error.message : 'Approval failed.' }, { status: 400 });
  }
}
