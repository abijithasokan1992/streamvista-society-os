import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const text = (path) => readFile(new URL(path, root), 'utf8');

test('web command route authenticates before execution', async () => {
  const source = await text('app/api/command/route.ts');
  assert.ok(source.includes('authenticateRequest(request)'));
  assert.ok(source.indexOf('authenticateRequest(request)') < source.indexOf('executeCommand(command'));
});

test('canonical agent registry contains exactly nine agents', async () => {
  const source = await text('lib/agents.ts');
  const ids = source.match(/id: '[a-z-]+-agent'/g) ?? [];
  assert.equal(ids.length, 9);
  assert.ok(source.includes("'qa-security-agent'"));
  assert.ok(source.includes("'founder-agent'"));
});

test('mutating commands are approval gated', async () => {
  const policy = await text('lib/policy.ts');
  const orchestrator = await text('lib/orchestrator.ts');
  assert.ok(policy.includes('approvalRequired: true'));
  assert.ok(orchestrator.includes('verifyApprovalToken'));
  assert.ok(orchestrator.includes("decision: 'approval_required'"));
});

test('connector verification requires explicit bridge assertion', async () => {
  const source = await text('lib/connectors.ts');
  assert.ok(source.includes(".verified === true"));
  assert.ok(source.includes('verification was not explicitly asserted'));
});

test('audit and memory tables are protected by RLS', async () => {
  const sql = await text('supabase/migrations/20260808_society_os_control_plane.sql');
  assert.match(sql, /alter table public\.society_os_audit enable row level security/i);
  assert.match(sql, /alter table public\.society_os_memory enable row level security/i);
  assert.match(sql, /revoke all on table public\.society_os_audit from anon, authenticated/i);
});

test('production promotion remains fail closed', async () => {
  const source = await text('app/api/status/route.ts');
  assert.ok(source.includes('productionPromotionAllowed: false'));
  assert.ok(source.includes("lifecycle: 'implemented-not-production'"));
});
