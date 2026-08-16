import { z } from 'zod';
import type { Actor } from '@/lib/auth';
import { assertRiskAllowed } from '@/lib/auth';
import { executeConnector } from '@/lib/connectors';
import { createExecutionPlan, type PlanStep } from '@/lib/planner';
import { classifyCommand, type RiskLevel } from '@/lib/policy';
import { verifyApprovalToken } from '@/lib/approval';
import { persistAudit, persistMemory } from '@/lib/persistence';

export const CommandSchema = z.object({
  command: z.string().min(1).max(2000),
  source: z.enum(['web', 'iphone', 'voice', 'agent']).default('web'),
  approvalToken: z.string().max(4096).optional(),
});

export type CommandInput = z.infer<typeof CommandSchema>;

export type ExecutionResult = {
  id: string;
  status: 'success' | 'waiting' | 'failed';
  intent: string;
  agent: string;
  message: string;
  verified: boolean;
  risk: RiskLevel;
  approvalRequired: boolean;
  plan: PlanStep[];
  reasoningMode: string;
  degradedReason?: string;
  executions?: Array<{ stepId: string; intent: string; agent: string; state: string; verified: boolean; message: string }>;
  auditPersisted?: boolean;
  memoryPersisted?: boolean;
};

export async function executeCommand(input: CommandInput, context: { actor: Actor }): Promise<ExecutionResult> {
  const parsed = CommandSchema.parse(input);
  const commandId = crypto.randomUUID();
  const plan = await createExecutionPlan(parsed.command);
  const intents = plan.steps.map((step) => step.intent);
  const policy = classifyCommand(parsed.command, intents);
  assertRiskAllowed(context.actor, policy.risk);

  const approvalValid = !policy.approvalRequired
    || verifyApprovalToken(parsed.approvalToken, context.actor, parsed.command, policy.risk);

  if (!approvalValid) {
    const auditPersisted = await persistAudit({
      commandId,
      actor: context.actor,
      command: parsed.command,
      intents,
      risk: policy.risk,
      decision: 'approval_required',
    });
    return {
      id: commandId,
      status: 'waiting',
      intent: intents.join(',') || 'general',
      agent: plan.steps.map((step) => step.agentId).join(',') || 'vista-core-agent',
      message: policy.reason,
      verified: false,
      risk: policy.risk,
      approvalRequired: true,
      plan: plan.steps,
      reasoningMode: plan.mode,
      degradedReason: plan.degradedReason,
      auditPersisted,
    };
  }

  const auditPersisted = await persistAudit({
    commandId,
    actor: context.actor,
    command: parsed.command,
    intents,
    risk: policy.risk,
    decision: 'accepted',
  });

  if (plan.steps.length === 0) {
    const message = 'No executable connector route was produced. The command was not externally executed.';
    const memoryPersisted = await persistMemory({ commandId, actor: context.actor, command: parsed.command, summary: message, verified: false });
    return {
      id: commandId,
      status: 'waiting',
      intent: 'general',
      agent: 'vista-core-agent',
      message,
      verified: false,
      risk: policy.risk,
      approvalRequired: false,
      plan: [],
      reasoningMode: plan.mode,
      degradedReason: plan.degradedReason,
      auditPersisted,
      memoryPersisted,
    };
  }

  const executions: NonNullable<ExecutionResult['executions']> = [];
  for (const step of plan.steps) {
    const result = await executeConnector(step.intent, step.instruction, {
      actor: context.actor,
      approved: approvalValid,
      risk: policy.risk,
      commandId,
    });
    executions.push({
      stepId: step.id,
      intent: step.intent,
      agent: step.agentId,
      state: result.state,
      verified: result.verified,
      message: result.message,
    });
    if (!result.ok) break;
  }

  const anyFailed = executions.some((item) => item.state === 'failed');
  const anyUnbound = executions.some((item) => item.state === 'unbound');
  const completedAll = executions.length === plan.steps.length;
  const verified = completedAll && executions.every((item) => item.state === 'success' && item.verified);
  const status: ExecutionResult['status'] = anyFailed ? 'failed' : anyUnbound || !completedAll ? 'waiting' : 'success';
  const message = verified
    ? `${executions.length} planned step(s) executed with explicit verification.`
    : `${executions.length}/${plan.steps.length} planned step(s) processed; verification is incomplete.`;

  let finalAuditPersisted = auditPersisted;
  try {
    finalAuditPersisted = await persistAudit({
      commandId,
      actor: context.actor,
      command: parsed.command,
      intents,
      risk: policy.risk,
      decision: status,
      verified,
      executionSummary: executions,
    });
  } catch (error) {
    return {
      id: commandId,
      status: 'failed',
      intent: intents.join(','),
      agent: plan.steps.map((step) => step.agentId).join(','),
      message: `Execution occurred but final audit persistence failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      verified: false,
      risk: policy.risk,
      approvalRequired: policy.approvalRequired,
      plan: plan.steps,
      reasoningMode: plan.mode,
      degradedReason: plan.degradedReason,
      executions,
      auditPersisted: false,
      memoryPersisted: false,
    };
  }

  const memoryPersisted = await persistMemory({ commandId, actor: context.actor, command: parsed.command, summary: message, verified });
  return {
    id: commandId,
    status,
    intent: intents.join(','),
    agent: plan.steps.map((step) => step.agentId).join(','),
    message,
    verified,
    risk: policy.risk,
    approvalRequired: policy.approvalRequired,
    plan: plan.steps,
    reasoningMode: plan.mode,
    degradedReason: plan.degradedReason,
    executions,
    auditPersisted: finalAuditPersisted,
    memoryPersisted,
  };
}
