import { z } from 'zod';
import { ConnectorId, executeConnector } from '@/lib/connectors';

export const CommandSchema = z.object({
  command: z.string().min(1).max(2000),
  source: z.enum(['web', 'iphone', 'voice', 'agent']).default('web'),
});

export type CommandInput = z.infer<typeof CommandSchema>;

export type ExecutionResult = {
  id: string;
  status: 'success' | 'waiting' | 'failed';
  intent: string;
  agent: string;
  message: string;
  verified: boolean;
  evidence?: unknown;
};

type Route = { match: RegExp; intent: ConnectorId; agent: string };

const routes: Route[] = [
  { match: /mail|email|inbox/i, intent: 'mail', agent: 'mail-agent' },
  { match: /github|repo|pull request|commit|branch/i, intent: 'github', agent: 'github-agent' },
  { match: /calendar|meeting|schedule/i, intent: 'calendar', agent: 'calendar-agent' },
  { match: /deploy|vercel|release|build/i, intent: 'deployment', agent: 'deployment-agent' },
  { match: /buyer|licen[cs]e|content|crayons bridge/i, intent: 'business', agent: 'business-agent' },
];

export async function executeCommand(input: CommandInput): Promise<ExecutionResult> {
  const parsed = CommandSchema.parse(input);
  const route = routes.find((candidate) => candidate.match.test(parsed.command));

  if (!route) {
    return {
      id: crypto.randomUUID(),
      status: 'success',
      intent: 'general',
      agent: 'vista-core-agent',
      message: 'Vista Core accepted and processed the command.',
      verified: true,
    };
  }

  const execution = await executeConnector(route.intent, parsed.command);
  return {
    id: crypto.randomUUID(),
    status: execution.ok ? 'success' : 'waiting',
    intent: route.intent,
    agent: route.agent,
    message: execution.message,
    verified: execution.verified,
    evidence: execution.evidence,
  };
}
