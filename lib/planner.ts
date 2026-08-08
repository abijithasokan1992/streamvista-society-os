import { z } from 'zod';
import type { ConnectorId } from '@/lib/connectors';
import { isAgentId, type AgentId } from '@/lib/agents';

export type PlanStep = {
  id: string;
  intent: ConnectorId;
  agentId: AgentId;
  instruction: string;
};

export type ExecutionPlan = {
  steps: PlanStep[];
  mode: 'reasoning-bridge' | 'deterministic-fallback';
  rationale?: string;
  confidence?: number;
  degradedReason?: string;
};

const routes: Array<{ intent: ConnectorId; match: RegExp }> = [
  { intent: 'mail', match: /mail|email|inbox|reply|forward/i },
  { intent: 'github', match: /github|repo|pull request|\bpr\b|commit|branch|workflow/i },
  { intent: 'calendar', match: /calendar|meeting|schedule|invite/i },
  { intent: 'deployment', match: /deploy|vercel|cloudflare|release|build|production/i },
  { intent: 'business', match: /buyer|licen[cs]e|rights|revenue|finance|sales|partner|content|crayons bridge/i },
];

const reasoningSchema = z.object({
  steps: z.array(z.object({
    intent: z.enum(['github', 'mail', 'calendar', 'deployment', 'business']),
    agentId: z.string().optional(),
    instruction: z.string().min(1).max(4000),
  })).min(1).max(8),
  rationale: z.string().max(2000).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

function agentFor(intent: ConnectorId, command: string): AgentId {
  if (intent === 'github' || intent === 'deployment') return 'qa-security-agent';
  if (intent === 'mail') return 'communication-agent';
  if (intent === 'calendar') return 'founder-agent';
  if (/\bright(s)?\b|chain.of.title|avail/i.test(command)) return 'rights-agent';
  if (/licen[cs]e|deal|commercial/i.test(command)) return 'licensing-agent';
  if (/revenue|finance|payment|payout|invoice/i.test(command)) return 'finance-agent';
  if (/buyer|sales|partner/i.test(command)) return 'sales-agent';
  if (/research|study|market|source/i.test(command)) return 'research-agent';
  return 'ceo-agent';
}

export function deterministicPlan(command: string): PlanStep[] {
  const matches = routes
    .map((route) => {
      const match = route.match.exec(command);
      return match ? { ...route, index: match.index } : null;
    })
    .filter((value): value is { intent: ConnectorId; match: RegExp; index: number } => Boolean(value))
    .sort((a, b) => a.index - b.index);

  return matches.map((match, index) => ({
    id: `step-${index + 1}`,
    intent: match.intent,
    agentId: agentFor(match.intent, command),
    instruction: command,
  }));
}

export function getReasoningStatus() {
  return {
    configured: Boolean(process.env.VISTA_REASONING_BRIDGE_URL?.trim()),
    mode: process.env.VISTA_REASONING_BRIDGE_URL?.trim() ? 'bridge' : 'deterministic-fallback',
  };
}

export async function createExecutionPlan(command: string): Promise<ExecutionPlan> {
  const fallback = deterministicPlan(command);
  const url = process.env.VISTA_REASONING_BRIDGE_URL?.trim();
  if (!url) return { steps: fallback, mode: 'deterministic-fallback', degradedReason: 'Reasoning bridge is unbound.' };

  try {
    const token = process.env.VISTA_REASONING_BRIDGE_TOKEN?.trim();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ command, fallbackPlan: fallback }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Reasoning bridge returned HTTP ${response.status}.`);

    const parsed = reasoningSchema.parse(await response.json());
    return {
      steps: parsed.steps.map((step, index) => ({
        id: `step-${index + 1}`,
        intent: step.intent,
        agentId: step.agentId && isAgentId(step.agentId) ? step.agentId : agentFor(step.intent, step.instruction),
        instruction: step.instruction,
      })),
      mode: 'reasoning-bridge',
      rationale: parsed.rationale,
      confidence: parsed.confidence,
    };
  } catch (error) {
    return {
      steps: fallback,
      mode: 'deterministic-fallback',
      degradedReason: error instanceof Error ? error.message : 'Reasoning bridge failed.',
    };
  }
}
