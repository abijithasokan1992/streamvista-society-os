export type AgentId =
  | 'ceo-agent'
  | 'founder-agent'
  | 'research-agent'
  | 'rights-agent'
  | 'licensing-agent'
  | 'finance-agent'
  | 'sales-agent'
  | 'communication-agent'
  | 'qa-security-agent';

export type AgentDefinition = {
  id: AgentId;
  name: string;
  department: string;
  responsibility: string;
  capabilities: string[];
  escalation?: AgentId;
};

export const AGENTS: readonly AgentDefinition[] = [
  { id: 'ceo-agent', name: 'CEO', department: 'Executive', responsibility: 'Cross-functional operating decisions and escalation', capabilities: ['strategy', 'priority', 'cross-functional review'], escalation: 'founder-agent' },
  { id: 'founder-agent', name: 'Founder', department: 'Executive', responsibility: 'Owner control, final policy and critical approvals', capabilities: ['owner-control', 'critical-approval', 'business-priority'] },
  { id: 'research-agent', name: 'Research', department: 'Intelligence', responsibility: 'Source-grounded research and market intelligence', capabilities: ['research', 'source-verification', 'market-intelligence'], escalation: 'ceo-agent' },
  { id: 'rights-agent', name: 'Rights', department: 'Rights & Legal', responsibility: 'Rights, chain-of-title and availability checks', capabilities: ['rights', 'avails', 'chain-of-title'], escalation: 'founder-agent' },
  { id: 'licensing-agent', name: 'Licensing', department: 'Commercial', responsibility: 'Licensing models, buyer terms and deal readiness', capabilities: ['licensing', 'deal-readiness', 'commercial-terms'], escalation: 'ceo-agent' },
  { id: 'finance-agent', name: 'Finance', department: 'Finance', responsibility: 'Revenue, payment and financial impact review', capabilities: ['revenue', 'payments', 'financial-review'], escalation: 'founder-agent' },
  { id: 'sales-agent', name: 'Sales', department: 'Commercial', responsibility: 'Buyer pipeline, sales actions and partner opportunities', capabilities: ['buyers', 'sales', 'partners'], escalation: 'ceo-agent' },
  { id: 'communication-agent', name: 'Communication', department: 'Operations', responsibility: 'Mail, calendar and stakeholder communication', capabilities: ['mail', 'calendar', 'stakeholder-comms'], escalation: 'ceo-agent' },
  { id: 'qa-security-agent', name: 'QA / Security', department: 'Engineering & Security', responsibility: 'Build, deployment, security and verification gates', capabilities: ['github', 'deployment', 'security', 'verification'], escalation: 'founder-agent' },
] as const;

export function isAgentId(value: string): value is AgentId {
  return AGENTS.some((agent) => agent.id === value);
}

export function getAgent(id: AgentId) {
  return AGENTS.find((agent) => agent.id === id)!;
}

export function getAgentRegistryStatus() {
  return { canonical: AGENTS.length, mode: 'registry' as const, agents: AGENTS };
}
