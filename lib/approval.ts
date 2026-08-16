import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Actor } from '@/lib/auth';
import type { RiskLevel } from '@/lib/policy';

const TTL_SECONDS = 5 * 60;

type ApprovalPayload = {
  v: 1;
  sub: string;
  role: string;
  commandHash: string;
  risk: RiskLevel;
  exp: number;
  nonce: string;
};

function secret() {
  return process.env.VISTA_APPROVAL_SECRET?.trim();
}

export function getApprovalStatus() {
  return { configured: Boolean(secret()), ttlSeconds: TTL_SECONDS };
}

export function hashCommand(command: string) {
  return createHash('sha256').update(command.trim()).digest('hex');
}

function sign(encoded: string, key: string) {
  return createHmac('sha256', key).update(encoded).digest('base64url');
}

export function issueApprovalToken(actor: Actor, command: string, risk: RiskLevel) {
  const key = secret();
  if (!key) throw new Error('Approval signing is not configured.');

  const payload: ApprovalPayload = {
    v: 1,
    sub: actor.id,
    role: actor.role,
    commandHash: hashCommand(command),
    risk,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
    nonce: crypto.randomUUID(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded, key)}`;
}

export function verifyApprovalToken(token: string | undefined, actor: Actor, command: string, risk: RiskLevel) {
  const key = secret();
  if (!key || !token) return false;

  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return false;
  const expected = sign(encoded, key);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ApprovalPayload;
    return payload.v === 1
      && payload.sub === actor.id
      && payload.commandHash === hashCommand(command)
      && payload.risk === risk
      && payload.exp >= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
