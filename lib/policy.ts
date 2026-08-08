import type { ConnectorId } from '@/lib/connectors';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type CommandPolicy = {
  risk: RiskLevel;
  approvalRequired: boolean;
  reason: string;
  readOnly: boolean;
};

const MUTATION = /\b(merge|deploy|release|publish|delete|remove|send|reply|forward|create|update|edit|approve|reject|pay|purchase|transfer|schedule|cancel|invite|upload|write|push|archive|restore|enable|disable|rotate|change|modify)\b/i;
const CRITICAL = /\b(delete|destroy|drop|payment|pay|transfer|refund|dns|domain|secret|credential|production|prod|contract|agreement|sign|execute agreement)\b/i;
const HIGH = /\b(merge|deploy|release|publish|approve|reject|send|reply|forward|upload|enable|disable|rotate)\b/i;

export function classifyCommand(command: string, intents: ConnectorId[]): CommandPolicy {
  const readOnly = !MUTATION.test(command);
  if (readOnly) {
    return { risk: 'low', approvalRequired: false, reason: 'Read-only command.', readOnly: true };
  }

  if (CRITICAL.test(command) || (intents.includes('deployment') && /\b(production|prod|delete|domain|dns)\b/i.test(command))) {
    return { risk: 'critical', approvalRequired: true, reason: 'Critical or irreversible action requires explicit founder approval.', readOnly: false };
  }

  if (HIGH.test(command) || intents.includes('deployment')) {
    return { risk: 'high', approvalRequired: true, reason: 'External mutation requires explicit approval.', readOnly: false };
  }

  return { risk: 'medium', approvalRequired: true, reason: 'Mutating command requires explicit approval.', readOnly: false };
}
