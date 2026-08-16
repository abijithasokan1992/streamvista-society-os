export type Role = 'founder' | 'admin' | 'operator' | 'viewer';

export type Actor = {
  id: string;
  email: string;
  role: Role;
};

const ROLES: Role[] = ['founder', 'admin', 'operator', 'viewer'];

export class AuthError extends Error {
  constructor(message: string, public readonly status = 401) {
    super(message);
  }
}

function authConfig() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, '');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.SUPABASE_ANON_KEY;
  return { url, key, configured: Boolean(url && key) };
}

function founderEmails() {
  return new Set(
    (process.env.VISTA_FOUNDER_EMAILS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function resolveRole(user: Record<string, unknown>, email: string): Role {
  if (founderEmails().has(email.toLowerCase())) return 'founder';

  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const candidate = appMetadata.role ?? userMetadata.role;
  if (typeof candidate === 'string' && ROLES.includes(candidate as Role)) return candidate as Role;

  const candidates = appMetadata.roles ?? userMetadata.roles;
  if (Array.isArray(candidates)) {
    for (const role of ROLES) {
      if (candidates.includes(role)) return role;
    }
  }

  return 'viewer';
}

export function getAuthStatus() {
  const config = authConfig();
  return {
    configured: config.configured,
    provider: config.configured ? 'supabase' : 'unconfigured',
    founderAllowlistConfigured: founderEmails().size > 0,
  };
}

export async function authenticateRequest(request: Request): Promise<Actor> {
  const config = authConfig();
  if (!config.configured || !config.url || !config.key) {
    throw new AuthError('Authentication is not configured for this deployment.', 503);
  }

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) throw new AuthError('Sign in is required.', 401);

  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.key,
      authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) throw new AuthError('The supplied session is invalid or expired.', 401);

  const user = await response.json() as Record<string, unknown>;
  const id = typeof user.id === 'string' ? user.id : '';
  const email = typeof user.email === 'string' ? user.email : '';
  if (!id || !email) throw new AuthError('The authenticated user record is incomplete.', 401);

  return { id, email, role: resolveRole(user, email) };
}

export function assertCanExecute(actor: Actor) {
  if (actor.role === 'viewer') {
    throw new AuthError('This account has read-only access and cannot execute commands.', 403);
  }
}

export function assertRiskAllowed(actor: Actor, risk: 'low' | 'medium' | 'high' | 'critical') {
  assertCanExecute(actor);
  if (risk === 'critical' && actor.role !== 'founder') {
    throw new AuthError('Critical actions require the founder role.', 403);
  }
  if ((risk === 'medium' || risk === 'high') && !['founder', 'admin'].includes(actor.role)) {
    throw new AuthError('Mutating actions require founder or admin role.', 403);
  }
}

export function canApprove(actor: Actor) {
  return actor.role === 'founder' || actor.role === 'admin';
}
