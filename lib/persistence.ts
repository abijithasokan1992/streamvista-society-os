import { hashCommand } from '@/lib/approval';
import type { Actor } from '@/lib/auth';
import type { RiskLevel } from '@/lib/policy';

function config() {
  const url = (process.env.VISTA_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, '');
  const key = process.env.VISTA_SUPABASE_SERVICE_ROLE_KEY?.trim();
  return { url, key, configured: Boolean(url && key) };
}

function isRequired(name: 'audit' | 'memory') {
  const value = name === 'audit' ? process.env.VISTA_AUDIT_REQUIRED : process.env.VISTA_MEMORY_REQUIRED;
  return value?.toLowerCase() === 'true';
}

function redactPreview(command: string) {
  return command
    .replace(/\b(token|secret|password|api[_ -]?key|credential)\b\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
    .slice(0, 240);
}

async function insert(table: string, body: Record<string, unknown>, required: boolean) {
  const { url, key, configured } = config();
  if (!configured || !url || !key) {
    if (required) throw new Error(`${table} persistence is required but not configured.`);
    return false;
  }

  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    if (required) throw new Error(`${table} persistence returned HTTP ${response.status}.`);
    return false;
  }
  return true;
}

export function getPersistenceStatus() {
  const current = config();
  return {
    configured: current.configured,
    auditRequired: isRequired('audit'),
    memoryRequired: isRequired('memory'),
    auditTable: 'society_os_audit',
    memoryTable: 'society_os_memory',
  };
}

export async function persistAudit(input: {
  commandId: string;
  actor: Actor;
  command: string;
  intents: string[];
  risk: RiskLevel;
  decision: string;
  verified?: boolean;
  executionSummary?: unknown;
}) {
  return insert('society_os_audit', {
    command_id: input.commandId,
    actor_id: input.actor.id,
    actor_email: input.actor.email,
    actor_role: input.actor.role,
    command_hash: hashCommand(input.command),
    command_preview: redactPreview(input.command),
    intents: input.intents,
    risk: input.risk,
    decision: input.decision,
    verified: input.verified ?? false,
    execution_summary: input.executionSummary ?? null,
  }, isRequired('audit'));
}

export async function persistMemory(input: {
  commandId: string;
  actor: Actor;
  command: string;
  summary: string;
  verified: boolean;
}) {
  return insert('society_os_memory', {
    actor_id: input.actor.id,
    memory_key: `execution:${input.commandId}`,
    memory_value: {
      commandHash: hashCommand(input.command),
      commandPreview: redactPreview(input.command),
      summary: input.summary,
      verified: input.verified,
    },
  }, isRequired('memory'));
}
