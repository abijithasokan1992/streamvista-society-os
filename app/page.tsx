'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Result = {
  id?: string;
  status?: string;
  intent?: string;
  agent?: string;
  message?: string;
  verified?: boolean;
};

type Connector = { id: string; name: string; configured: boolean; mode: string };

export default function Home() {
  const [command, setCommand] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  const [connectors, setConnectors] = useState<Connector[]>([]);

  useEffect(() => {
    fetch('/api/integrations', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setConnectors(data.connectors ?? []))
      .catch(() => setConnectors([]));
  }, []);

  const modules = useMemo(() => [
    ['Vista Core', 'ONLINE'],
    ['Agent Orchestrator', 'ONLINE'],
    ['iPhone / Voice Gateway', 'READY'],
    ...connectors.map((item) => [item.name, item.configured ? 'CONNECTED' : 'UNBOUND']),
  ], [connectors]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!command.trim()) return;
    setRunning(true);
    try {
      const response = await fetch('/api/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command, source: 'web' }),
      });
      setResult(await response.json());
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">STREAMVISTA</p>
          <h1>Vista OS Command Center</h1>
        </div>
        <span className="pill">V1 FULL STACK</span>
      </header>

      <section className="hero panel">
        <div>
          <p className="eyebrow">OWNER CONTROL PLANE</p>
          <h2>One command. The correct agent. Verified execution.</h2>
          <p className="muted">Web, iPhone, voice, agents and StreamVista workflows share one execution plane. External actions only show verified after a bound connector returns evidence.</p>
        </div>
        <div className="health"><span className="dot" /> Core healthy</div>
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
          <textarea
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Example: Check GitHub and show deployment blockers"
            aria-label="Vista command"
          />
          <button disabled={running}>{running ? 'Running…' : 'Execute'}</button>
        </form>
        {result && (
          <div className="result">
            <div><span>Status</span><b>{result.status}</b></div>
            <div><span>Agent</span><b>{result.agent}</b></div>
            <div><span>Intent</span><b>{result.intent}</b></div>
            <div><span>Verified</span><b>{result.verified ? 'YES' : 'NO'}</b></div>
            <p>{result.message}</p>
          </div>
        )}
      </section>
    </main>
  );
}
