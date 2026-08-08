'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Actor = { id: string; email: string; role: string };
type Connector = { id: string; name: string; configured: boolean; tokenConfigured: boolean; mode: string };
type PlanStep = { id: string; intent: string; agentId: string; instruction: string };
type Result = {
  id?: string;
  status?: string;
  intent?: string;
  agent?: string;
  message?: string;
  verified?: boolean;
  risk?: string;
  approvalRequired?: boolean;
  reasoningMode?: string;
  degradedReason?: string;
  plan?: PlanStep[];
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const ACCESS_KEY = 'vista_access_token';

export default function Home() {
  const [command, setCommand] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [email, setEmail] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [actor, setActor] = useState<Actor | null>(null);
  const [authMessage, setAuthMessage] = useState('');

  useEffect(() => {
    fetch('/api/integrations', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setConnectors(data.connectors ?? []))
      .catch(() => setConnectors([]));

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const returnedToken = hash.get('access_token') ?? '';
    const errorDescription = hash.get('error_description');
    if (errorDescription) setAuthMessage(errorDescription);

    const storedToken = sessionStorage.getItem(ACCESS_KEY) ?? '';
    const token = returnedToken || storedToken;
    if (returnedToken) {
      sessionStorage.setItem(ACCESS_KEY, returnedToken);
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }
    if (token) {
      setAccessToken(token);
      void loadActor(token);
    }
  }, []);

  const modules = useMemo(() => {
    const base: Array<[string, string]> = [
      ['Vista Core', 'AVAILABLE'],
      ['Agent Registry', '9 CANONICAL'],
      ['Auth / RBAC', actor ? actor.role.toUpperCase() : 'SIGN IN'],
      ['Approval Engine', 'ENFORCED'],
    ];
    return [...base, ...connectors.map((item) => [item.name, item.configured ? 'BOUND' : 'UNBOUND'] as [string, string])];
  }, [connectors, actor]);

  async function loadActor(token: string) {
    try {
      const response = await fetch('/api/me', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) throw new Error('Session expired. Sign in again.');
      const data = await response.json() as { actor: Actor };
      setActor(data.actor);
      setAuthMessage('');
    } catch (error) {
      sessionStorage.removeItem(ACCESS_KEY);
      setAccessToken('');
      setActor(null);
      setAuthMessage(error instanceof Error ? error.message : 'Authentication failed.');
    }
  }

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    if (!supabaseUrl || !supabaseKey) {
      setAuthMessage('Supabase public auth environment variables are not configured.');
      return;
    }
    if (!email.trim()) return;

    setRunning(true);
    try {
      const redirect = encodeURIComponent(window.location.origin);
      const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/otp?redirect_to=${redirect}`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          authorization: `Bearer ${supabaseKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), create_user: false }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { msg?: string; message?: string };
        throw new Error(data.msg ?? data.message ?? `Sign-in request failed (${response.status}).`);
      }
      setAuthMessage('Secure sign-in link sent. Use the newest email link.');
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Could not send sign-in link.');
    } finally {
      setRunning(false);
    }
  }

  function signOut() {
    sessionStorage.removeItem(ACCESS_KEY);
    setAccessToken('');
    setActor(null);
    setResult(null);
    setAuthMessage('Signed out.');
  }

  async function runCommand(approvalToken?: string) {
    if (!accessToken) {
      setResult({ status: 'failed', message: 'Sign in before executing commands.', verified: false });
      return;
    }
    const response = await fetch('/api/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ command, source: 'web', ...(approvalToken ? { approvalToken } : {}) }),
    });
    const data = await response.json() as Result;
    setResult(data);
    if (response.status === 401) {
      sessionStorage.removeItem(ACCESS_KEY);
      setAccessToken('');
      setActor(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!command.trim()) return;
    setRunning(true);
    try {
      await runCommand();
    } finally {
      setRunning(false);
    }
  }

  async function approveAndExecute() {
    if (!accessToken || !command.trim()) return;
    setRunning(true);
    try {
      const response = await fetch('/api/approval', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ command }),
      });
      const approval = await response.json() as { approvalToken?: string; message?: string };
      if (!response.ok || !approval.approvalToken) {
        setResult((current) => ({ ...current, status: 'failed', verified: false, message: approval.message ?? 'Approval failed.' }));
        return;
      }
      await runCommand(approval.approvalToken);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">STREAMVISTA SOCIETY OS</p>
          <h1>Vista Core Command Center</h1>
        </div>
        <span className="pill">V2 CONTROL PLANE</span>
      </header>

      <section className="hero panel">
        <div>
          <p className="eyebrow">OWNER CONTROL PLANE</p>
          <h2>Plan. Authorize. Execute. Verify.</h2>
          <p className="muted">Commands are identity-gated, risk classified and routed across canonical agents. Mutations require explicit approval; connector success is never treated as verified unless the bridge explicitly asserts verification.</p>
        </div>
        <div className="health"><span className="dot" /> Implemented · production HOLD</div>
      </section>

      <section className="panel authPanel">
        <div>
          <p className="eyebrow">IDENTITY & RBAC</p>
          {actor ? (
            <p className="identity"><strong>{actor.email}</strong><span>{actor.role}</span></p>
          ) : (
            <p className="muted">Sign in with an authorized Supabase account before command execution.</p>
          )}
        </div>
        {actor ? (
          <button className="secondaryButton" onClick={signOut}>Sign out</button>
        ) : (
          <form className="authForm" onSubmit={sendMagicLink}>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Authorized email" aria-label="Authorized email" />
            <button disabled={running}>Send secure sign-in link</button>
          </form>
        )}
        {authMessage && <p className="authMessage">{authMessage}</p>}
      </section>

      <section className="grid">
        {modules.map(([name, status]) => (
          <article className="card" key={name}>
            <p>{name}</p>
            <strong>{status}</strong>
          </article>
        ))}
      </section>

      <section className="panel commandPanel">
        <p className="eyebrow">COMMAND</p>
        <form onSubmit={submit}>
          <textarea value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Example: Check GitHub, inspect deployment blockers, then summarize the result" aria-label="Vista command" />
          <button disabled={running || !actor}>{running ? 'Running…' : 'Execute'}</button>
        </form>
        {result && (
          <div className="result">
            <div><span>Status</span><b>{result.status}</b></div>
            <div><span>Risk</span><b>{result.risk ?? '—'}</b></div>
            <div><span>Agent</span><b>{result.agent ?? '—'}</b></div>
            <div><span>Verified</span><b>{result.verified ? 'YES' : 'NO'}</b></div>
            <p>{result.message}</p>
            {result.degradedReason && <p className="warning">Degraded: {result.degradedReason}</p>}
            {result.plan && result.plan.length > 0 && (
              <div className="planList">
                {result.plan.map((step) => <span key={step.id}>{step.id}: {step.agentId} → {step.intent}</span>)}
              </div>
            )}
            {result.approvalRequired && result.status === 'waiting' && (
              <button className="approvalButton" disabled={running} onClick={approveAndExecute}>Approve this exact command & execute</button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
