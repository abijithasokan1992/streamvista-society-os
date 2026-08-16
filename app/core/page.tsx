'use client';

import Link from 'next/link';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

type Agent = {
  canonical_id: string;
  display_name: string;
  lifecycle_status: string;
  department_slug: string | null;
  risk_level: string | null;
  approvals: string | null;
  connected_apps: string[] | null;
  source_repository: string | null;
  source_path: string | null;
  summary: string | null;
};

type Connection = {
  app_key: string;
  app_name: string;
  agent_canonical_id: string;
  status: string;
  notes: string | null;
  updated_at: string | null;
};

type AgentTool = {
  agent_canonical_id: string;
  tool_key: string;
  tool_name: string;
  category: string;
  description: string | null;
};

type ReadModel = {
  generatedAt: string;
  agents: Agent[];
  connections: Connection[];
  tools: AgentTool[];
  latestRun: {
    status: string;
    message: string | null;
    started_at: string;
    finished_at: string | null;
  } | null;
  settings: Record<string, string>;
  metrics: {
    canonicalAgents: number;
    totalRoutes: number;
    connectedRoutes: number;
    plannedRoutes: number;
    connectedApps: number;
    appCount: number;
    runtimeState: 'connected' | 'degraded' | 'blocked';
    syncHealth: 'healthy' | 'degraded' | 'failed' | 'never_run';
  };
};

type CommandResult = {
  status?: string;
  agent?: string;
  intent?: string;
  message?: string;
  verified?: boolean;
};

type BrowserRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type BrowserRecognitionCtor = new () => BrowserRecognition;

const EMPTY: ReadModel = {
  generatedAt: '',
  agents: [],
  connections: [],
  tools: [],
  latestRun: null,
  settings: {},
  metrics: {
    canonicalAgents: 0,
    totalRoutes: 0,
    connectedRoutes: 0,
    plannedRoutes: 0,
    connectedApps: 0,
    appCount: 0,
    runtimeState: 'blocked',
    syncHealth: 'never_run',
  },
};

function badgeClass(value: string) {
  if (value === 'production' || value === 'connected' || value === 'healthy') return 'truthBadge truthGood';
  if (value === 'tested' || value === 'implemented' || value === 'degraded') return 'truthBadge truthWarn';
  if (value === 'blocked' || value === 'failed') return 'truthBadge truthBad';
  return 'truthBadge';
}

function formatAge(value?: string | null) {
  if (!value) return 'never';
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return 'unknown';
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export default function CoreOnlinePage() {
  const [model, setModel] = useState<ReadModel>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [commandResult, setCommandResult] = useState<CommandResult | null>(null);
  const [running, setRunning] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.55);
  const [audioLevel, setAudioLevel] = useState(0.08);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<BrowserRecognition | null>(null);

  const refresh = useCallback(async () => {
    try {
      setReadError(null);
      const response = await fetch('/api/read-model', { cache: 'no-store' });
      const data = (await response.json()) as ReadModel & { message?: string };
      if (!response.ok) throw new Error(data.message || `Read model HTTP ${response.status}`);
      setModel(data);
      setSelectedId((current) => current ?? data.agents[0]?.canonical_id ?? null);
    } catch (error) {
      setReadError(error instanceof Error ? error.message : 'Read model unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const ensureAudio = useCallback(async () => {
    if (!audioContextRef.current) {
      const AudioCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return null;
      const ctx = new AudioCtor();
      const analyser = ctx.createAnalyser();
      const master = ctx.createGain();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;
      master.gain.value = muted ? 0 : volume;
      analyser.connect(master);
      master.connect(ctx.destination);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      masterRef.current = master;
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, [muted, volume]);

  useEffect(() => {
    if (!masterRef.current || !audioContextRef.current) return;
    masterRef.current.gain.setTargetAtTime(muted ? 0 : volume, audioContextRef.current.currentTime, 0.03);
  }, [muted, volume]);

  const startAudio = useCallback(async () => {
    const ctx = await ensureAudio();
    const analyser = analyserRef.current;
    if (!ctx || !analyser) return;
    const now = ctx.currentTime + 0.02;
    [392, 523.25, 659.25, 987.77].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + index * 0.09;
      oscillator.type = index % 2 === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
      oscillator.connect(gain);
      gain.connect(analyser);
      oscillator.start(start);
      oscillator.stop(start + 0.6);
    });
    setAudioReady(true);
  }, [ensureAudio]);

  useEffect(() => {
    if (!audioReady && !micActive) return;
    let frame = 0;
    let lastUpdate = 0;
    const render = (time: number) => {
      const analyser = micActive ? micAnalyserRef.current : analyserRef.current;
      if (analyser && time - lastUpdate > 70) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const average = data.reduce((sum, value) => sum + value, 0) / Math.max(1, data.length) / 255;
        setAudioLevel(Math.max(0.06, Math.min(1, average * 2.1)));
        lastUpdate = time;
      }
      frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [audioReady, micActive]);

  const toggleMic = useCallback(async () => {
    if (micActive) {
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
      micAnalyserRef.current = null;
      setMicActive(false);
      return;
    }
    try {
      const ctx = await ensureAudio();
      if (!ctx || !navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      micStreamRef.current = stream;
      micAnalyserRef.current = analyser;
      setMicActive(true);
      setAudioReady(true);
    } catch {
      setMicActive(false);
    }
  }, [ensureAudio, micActive]);

  useEffect(
    () => () => {
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      recognitionRef.current?.stop();
      void audioContextRef.current?.close();
    },
    [],
  );

  const speakStatus = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    const text = `StreamVista control plane online. ${model.metrics.canonicalAgents} canonical agents loaded. Runtime connections ${model.metrics.connectedRoutes} of ${model.metrics.totalRoutes}. Sync ${model.metrics.syncHealth}.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = muted ? 0 : volume;
    utterance.rate = 0.96;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [model.metrics, muted, volume]);

  const startVoiceCommand = useCallback(() => {
    const speechWindow = window as unknown as {
      SpeechRecognition?: BrowserRecognitionCtor;
      webkitSpeechRecognition?: BrowserRecognitionCtor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) setCommand(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening]);

  async function submitCommand(event: FormEvent) {
    event.preventDefault();
    if (!command.trim()) return;
    setRunning(true);
    try {
      const response = await fetch('/api/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command, source: 'web' }),
      });
      const result = (await response.json()) as CommandResult;
      setCommandResult(result);
      if ('speechSynthesis' in window && result.message) {
        const utterance = new SpeechSynthesisUtterance(result.message);
        utterance.volume = muted ? 0 : volume;
        utterance.rate = 1;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      setCommandResult({ status: 'failed', verified: false, message: 'Command endpoint unavailable.' });
    } finally {
      setRunning(false);
    }
  }

  const selected = useMemo(
    () => model.agents.find((agent) => agent.canonical_id === selectedId) ?? model.agents[0] ?? null,
    [model.agents, selectedId],
  );
  const selectedConnections = useMemo(
    () => model.connections.filter((row) => row.agent_canonical_id === selected?.canonical_id),
    [model.connections, selected],
  );
  const selectedTools = useMemo(
    () => model.tools.filter((tool) => tool.agent_canonical_id === selected?.canonical_id),
    [model.tools, selected],
  );
  const runtimeGate =
    model.settings.production_promotion_blocker ||
    selectedConnections.find((row) => row.notes)?.notes ||
    'Production runtime verification has not been recorded.';

  const bars = Array.from({ length: 42 }, (_, index) => {
    const wave = (Math.sin(index * 0.63 + Date.now() / 620) + 1) / 2;
    return Math.max(8, Math.round((0.18 + wave * 0.4 + audioLevel * 0.9) * 84));
  });

  return (
    <main className="corePage">
      <div className="coreGridBackdrop" aria-hidden />
      <header className="coreTopbar">
        <div>
          <p className="eyebrow">STREAMVISTA · AI COMMAND CENTER</p>
          <h1>CORE ONLINE</h1>
        </div>
        <div className="coreTopActions">
          <span className="truthBadge truthGood">CONTROL PLANE ONLINE</span>
          <span className={badgeClass(model.metrics.runtimeState)}>
            RUNTIME {model.metrics.runtimeState.toUpperCase()}
          </span>
          <Link href="/" className="ghostButton">Dashboard</Link>
        </div>
      </header>

      <section className="truthStrip" aria-label="Production truth">
        <div><span>Canonical agents</span><strong>{loading ? '…' : model.metrics.canonicalAgents}</strong></div>
        <div><span>Runtime routes</span><strong>{model.metrics.connectedRoutes}/{model.metrics.totalRoutes}</strong></div>
        <div><span>Connected apps</span><strong>{model.metrics.connectedApps}/{model.metrics.appCount}</strong></div>
        <div><span>Planned routes</span><strong>{model.metrics.plannedRoutes}</strong></div>
        <div><span>Sync</span><strong className={model.metrics.syncHealth === 'healthy' ? 'goodText' : 'warnText'}>{model.metrics.syncHealth}</strong></div>
        <div><span>Last read</span><strong>{formatAge(model.generatedAt)}</strong></div>
      </section>

      {readError && <div className="coreAlert">Read model unavailable: {readError}</div>}
      {!loading && model.metrics.canonicalAgents !== 9 && (
        <div className="coreAlert">Expected 9 canonical agents; read model currently reports {model.metrics.canonicalAgents}.</div>
      )}

      <section className="coreMainLayout">
        <div className="coreStagePanel">
          <div className="coreStage" style={{ '--core-level': audioLevel } as CSSProperties}>
            <div className="orbit orbitOne" aria-hidden />
            <div className="orbit orbitTwo" aria-hidden />
            <div className="orbit orbitThree" aria-hidden />
            <div className="coreHalo" aria-hidden />
            <div className="coreSphere" onClick={speakStatus} role="button" tabIndex={0}>
              <div className="coreSphereInner">
                <span>SV</span>
                <strong>CORE</strong>
                <small>{model.metrics.canonicalAgents || 9} AGENTS</small>
              </div>
            </div>

            {model.agents.map((agent, index) => {
              const angle = (360 / Math.max(1, model.agents.length)) * index - 90;
              const connectionRows = model.connections.filter((row) => row.agent_canonical_id === agent.canonical_id);
              const connected = connectionRows.filter((row) => row.status === 'connected').length;
              return (
                <button
                  key={agent.canonical_id}
                  type="button"
                  className={`agentOrbiter ${selected?.canonical_id === agent.canonical_id ? 'selected' : ''}`}
                  style={{ '--angle': `${angle}deg` } as CSSProperties}
                  onClick={() => setSelectedId(agent.canonical_id)}
                  title={`${agent.display_name} · ${agent.lifecycle_status} · ${connected}/${connectionRows.length} connected`}
                >
                  <span className="agentPulse" />
                  <b>{agent.display_name.replace(' Agent', '')}</b>
                  <small>{agent.lifecycle_status}</small>
                </button>
              );
            })}
          </div>

          <div className="audioDeck">
            <div className="audioHeader">
              <div>
                <p className="eyebrow">FULL AUDIO BUS</p>
                <strong>{micActive ? 'MIC LIVE' : audioReady ? 'AUDIO READY' : 'AWAITING USER INTERACTION'}</strong>
              </div>
              <div className="audioButtons">
                <button type="button" onClick={() => void startAudio()}>Start / Chime</button>
                <button type="button" className={micActive ? 'activeAudioButton' : ''} onClick={() => void toggleMic()}>{micActive ? 'Stop Mic' : 'Microphone'}</button>
                <button type="button" onClick={startVoiceCommand}>{listening ? 'Listening…' : 'Voice Command'}</button>
                <button type="button" onClick={() => setMuted((value) => !value)}>{muted ? 'Unmute' : 'Mute'}</button>
              </div>
            </div>
            <div className="spectrum" aria-label="Audio activity visualizer">
              {bars.map((height, index) => (
                <i key={index} style={{ height }} />
              ))}
            </div>
            <label className="volumeRow">
              <span>Volume</span>
              <input type="range" min="0" max="100" value={Math.round(volume * 100)} onChange={(event) => setVolume(Number(event.target.value) / 100)} />
              <b>{Math.round(volume * 100)}%</b>
            </label>
          </div>
        </div>

        <aside className="coreSidePanel">
          {selected ? (
            <>
              <div className="agentTitleRow">
                <div>
                  <p className="eyebrow">SELECTED CANONICAL AGENT</p>
                  <h2>{selected.display_name}</h2>
                  <code>{selected.canonical_id}</code>
                </div>
                <span className={badgeClass(selected.lifecycle_status)}>{selected.lifecycle_status}</span>
              </div>
              <p className="agentSummary">{selected.summary || 'No summary recorded.'}</p>
              <div className="detailGrid">
                <div><span>Department</span><b>{selected.department_slug || '—'}</b></div>
                <div><span>Risk</span><b>{selected.risk_level || '—'}</b></div>
                <div><span>Approvals</span><b>{selected.approvals || '—'}</b></div>
                <div><span>Tools</span><b>{selectedTools.length}</b></div>
              </div>

              <div className="miniSection">
                <h3>App connections</h3>
                <div className="connectionList">
                  {selectedConnections.map((row) => (
                    <div key={`${row.app_key}-${row.agent_canonical_id}`}>
                      <span>{row.app_name}</span>
                      <b className={row.status === 'connected' ? 'goodText' : 'warnText'}>{row.status}</b>
                    </div>
                  ))}
                </div>
              </div>

              <div className="miniSection">
                <h3>Tools</h3>
                <div className="toolTags">
                  {selectedTools.length ? selectedTools.map((tool) => <span key={`${tool.agent_canonical_id}-${tool.tool_key}`}>{tool.tool_name}</span>) : <span>No tool rows recorded</span>}
                </div>
              </div>

              <div className="sourceBox">
                <span>SOURCE</span>
                <code>{selected.source_repository || '—'}</code>
                <code>{selected.source_path || '—'}</code>
              </div>
            </>
          ) : (
            <p className="muted">No canonical agent is available in the read model.</p>
          )}
        </aside>
      </section>

      <section className="coreBottomGrid">
        <div className="runtimeGatePanel">
          <div className="agentTitleRow">
            <div>
              <p className="eyebrow">RUNTIME GATE</p>
              <h2>{model.metrics.runtimeState === 'connected' ? 'Production execution verified' : 'Production execution locked'}</h2>
            </div>
            <span className={badgeClass(model.metrics.runtimeState)}>{model.metrics.runtimeState}</span>
          </div>
          <p>{runtimeGate}</p>
          <div className="gateFacts">
            <span>{model.metrics.connectedRoutes}/{model.metrics.totalRoutes} routes connected</span>
            <span>{model.metrics.plannedRoutes} planned</span>
            <span>{model.latestRun?.message || 'No sync evidence message.'}</span>
          </div>
        </div>

        <div className="coreCommandPanel">
          <p className="eyebrow">COMMAND BUS</p>
          <form onSubmit={submitCommand}>
            <textarea value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Speak or type: check rights, buyer opportunity, finance, legal, QA, inbox…" aria-label="Core command" />
            <button disabled={running}>{running ? 'Routing…' : 'Route Command'}</button>
          </form>
          {commandResult && (
            <div className="commandResult">
              <span>{commandResult.status || 'unknown'}</span>
              <b>{commandResult.agent || 'unrouted'}</b>
              <em>{commandResult.verified ? 'VERIFIED EXECUTION' : 'NO EXTERNAL VERIFICATION'}</em>
              <p>{commandResult.message}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
