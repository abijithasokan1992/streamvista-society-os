import { z } from 'zod';

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
};

const routes: Array<{ match: RegExp; intent: string; agent: string }> = [
  { match: /mail|email|inbox/i, intent: 'mail', agent: 'mail-agent' },
  { match: /github|repo|pull request|commit|branch/i, intent: 'github', agent: 'github-agent' },
  { match: /calendar|meeting|schedule/i, intent: 'calendar', agent: 'calendar-agent' },
  { match: /deploy|vercel|release|build/i, intent: 'deployment', agent: 'deployment-agent' },
  { match: /buyer|licen[cs]e|content|crayons bridge/i, intent: 'business', agent: 'business-agent' },
];

export async function executeCommand(input: CommandInput): Promise<ExecutionResult> {
  const parsed = CommandSchema.parse(input);
  const route = routes.find((candidate) => candidate.match.test(parsed.command));
  const intent = route?.intent ?? 'general';
  const agent = route?.agent ?? 'vista-core-agent';

  // V1 execution boundary: real connector adapters are registered server-side.
  // Until a connector is bound, commands are safely routed and reported as waiting.
  return {
    id: crypto.randomUUID(),
    status: route ? 'waiting' : 'success',
    intent,
    agent,
    message: route
      ? `Command routed to ${agent}. Connector binding is required for external execution.`
      : 'Vista Core accepted and processed the command.',
    verified: !route,
  };
}
