import { z } from 'zod';
import { ConnectorId, executeConnector } from '@/lib/connectors';

export const CommandSchema = z.object({
  command: z.string().min(1).max(2000),
  source: z.enum(['web', 'iphone', 'voice', 'agent']).default('web'),
});

export type CommandInput = z.infer<typeof CommandSchema>;

export const CANONICAL_AGENT_IDS = [
  'inbox-agent',
  'partner-agent',
  'requirements-agent',
  'rights-agent',
  'sales-agent',
  'legal-agent',
  'finance-agent',
  'ceo-agent',
  'qa-security-agent',
] as const;

type CanonicalAgentId = (typeof CANONICAL_AGENT_IDS)[number];

export type ExecutionResult = {
  id: string;
  status: 'success' | 'waiting' | 'failed';
  intent: string;
  agent: CanonicalAgentId;
  agents: readonly CanonicalAgentId[];
  message: string;
  verified: boolean;
  evidence?: unknown;
};

type Route = {
  match: RegExp;
  intent: ConnectorId | 'local';
  agent: CanonicalAgentId;
};

const routes: Route[] = [
  { match: /mail|email|inbox|message|reply/i, intent: 'mail', agent: 'inbox-agent' },
  { match: /partner|platform|studio|creator|owner|relationship/i, intent: 'business', agent: 'partner-agent' },
  { match: /requirement|deliverable|format|language|territory|window|metadata/i, intent: 'business', agent: 'requirements-agent' },
  { match: /rights|license|licence|avod|svod|tvod|exclusive|non-exclusive/i, intent: 'business', agent: 'rights-agent' },
  { match: /sales|buyer|lead|deal|outreach|pipeline|offer/i, intent: 'business', agent: 'sales-agent' },
  { match: /legal|contract|agreement|clause|compliance/i, intent: 'business', agent: 'legal-agent' },
  { match: /finance|revenue|price|payment|payout|invoice|money/i, intent: 'business', agent: 'finance-agent' },
  { match: /ceo|founder|approve|decision|priority|strategy/i, intent: 'local', agent: 'ceo-agent' },
  { match: /github|repo|pull request|commit|branch/i, intent: 'github', agent: 'qa-security-agent' },
  { match: /deploy|vercel|release|build|test/i, intent: 'deployment', agent: 'qa-security-agent' },
  { match: /qa|security|audit|verify|verification/i, intent: 'local', agent: 'qa-security-agent' },
  { match: /calendar|meeting|schedule/i, intent: 'calendar', agent: 'requirements-agent' },
];

export async function executeCommand(input: CommandInput): Promise<ExecutionResult> {
  const parsed = CommandSchema.parse(input);
  const route = routes.find((candidate) => candidate.match.test(parsed.command)) ?? {
    intent: 'local' as const,
    agent: 'ceo-agent' as const,
  };

  if (route.intent === 'local') {
    return {
      id: crypto.randomUUID(),
      status: 'success',
      intent: 'local-control-plane',
      agent: route.agent,
      agents: CANONICAL_AGENT_IDS,
      message:
        'Command routed inside the StreamVista control plane. No external action was executed, so production verification remains false.',
      verified: false,
    };
  }

  const execution = await executeConnector(route.intent, parsed.command);
  return {
    id: crypto.randomUUID(),
    status: execution.ok ? 'success' : 'waiting',
    intent: route.intent,
    agent: route.agent,
    agents: CANONICAL_AGENT_IDS,
    message: execution.message,
    verified: execution.verified,
    evidence: execution.evidence,
  };
}
